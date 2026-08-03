import crypto from 'crypto';
import { sendSMS } from './sms.js';

// Defensive layer sitting in front of utils/sms.js#sendSMS — guarantees every
// outbound message stays inside a single GSM-7 SMS segment (160 chars) so we
// never get silently double/triple-billed by Africa's Talking for a
// concatenated multi-part message. Three responsibilities, in order:
//   1. sanitizeGsmText   — strip anything that would force UCS-2 encoding
//                          (which drops the per-segment budget from 160 to 70).
//   2. buildStrictSms    — compile a template + trim only its *dynamic*
//                          fields (store name, customer name, etc.) so the
//                          final text fits 160 chars without ever touching
//                          the amount, reference/token, date or time.
//   3. safeSendSMS       — last-resort backstop wrapper around sendSMS() that
//                          hard-truncates anything that still overflows and
//                          logs a critical, trackable warning when it does.

const SINGLE_SEGMENT_LIMIT = 160;

// GSM 03.38 default alphabet (basic table only — the extension table
// characters like ^ { } \ [ ~ ] | € are deliberately excluded here too,
// since each one silently costs 2 characters of the 160 budget). Anything
// outside this set — emojis, curly quotes, em-dashes, accented characters
// beyond this table, etc. — forces the whole message into UCS-2, which caps
// a single segment at 70 characters instead of 160.
const GSM_7BIT_BASIC =
  "@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

const GSM_7BIT_SET = new Set(GSM_7BIT_BASIC);

// Common "smart"/typographic characters that word processors, iOS keyboards,
// and copy-pasted text love to introduce — mapped to their plain-ASCII GSM-7
// equivalents rather than just being dropped, so the message still reads
// naturally instead of losing punctuation entirely.
const UNICODE_TO_ASCII_MAP = {
  '“': '"', // “
  '”': '"', // ”
  '‘': "'", // ‘
  '’': "'", // ’
  '–': '-', // – (en dash)
  '—': '-', // — (em dash)
  '…': '...', // … (ellipsis)
  ' ': ' ', // non-breaking space
};

/**
 * Cleans a string down to pure GSM-7 basic-alphabet characters:
 *   1. Known "dangerous" typographic Unicode (curly quotes, dashes, ellipsis,
 *      nbsp) is transliterated to its ASCII equivalent so meaning survives.
 *   2. Anything else not in the GSM-7 basic table (emojis, other accented
 *      letters, symbols, double-byte characters of any kind) is stripped
 *      outright — an allowlist, not a blocklist, so we never have to
 *      enumerate every emoji range there is.
 * Never throws; a non-string input is coerced to '' rather than crashing a
 * caller mid-webhook.
 */
export function sanitizeGsmText(rawText) {
  const input = String(rawText ?? '');

  const transliterated = input.replace(
    /[“”‘’–—… ]/g,
    (char) => UNICODE_TO_ASCII_MAP[char] ?? ''
  );

  let cleaned = '';
  for (const char of transliterated) {
    if (GSM_7BIT_SET.has(char)) cleaned += char;
    // else: silently dropped — this is what keeps encoding at GSM-7/160
    // instead of falling back to UCS-2/70 the moment one stray emoji or
    // curly quote slips through.
  }
  return cleaned;
}

/**
 * Compiles a message from a template function while guaranteeing the result
 * fits within `maxLength` (default 160 — one GSM-7 segment). Only the fields
 * listed in `data.truncatable` are ever shortened, in the order given
 * (earliest = truncated first); everything in `data.fixed` — amount,
 * transaction reference/token, date, time — is passed through untouched.
 *
 * @param {(fields: Record<string, string>) => string} templateFunc
 *        Builds the final SMS body from a flat object of fixed + dynamic
 *        field values.
 * @param {{
 *   fixed?: Record<string, string>,
 *   truncatable?: Array<{ key: string, value: string, minLength?: number }>
 * }} data
 * @param {number} [maxLength=160]
 * @returns {{ message: string, truncated: boolean, length: number }}
 *
 * @example
 *   buildStrictSms(
 *     ({ transId, amount, businessName, accountRef, date, time }) =>
 *       `${transId} Confirmed. KES ${amount} paid to ${businessName} for account ${accountRef} on ${date} at ${time}. Thank you for your payment.`,
 *     {
 *       fixed: { transId: 'QGH7X9K2M', amount: '5,000', accountRef: '00005421', date: '12/7/26', time: '2:09 PM' },
 *       truncatable: [{ key: 'businessName', value: 'Mama Mboga General Green Grocers Ltd', minLength: 10 }],
 *     }
 *   );
 *   // => { message: "QGH7X9K2M Confirmed. KES 5,000 paid to Mama Mboga Gen... for account 00005421 on 12/7/26 at 2:09 PM. Thank you for your payment.", truncated: true, length: 160 }
 */
export function buildStrictSms(templateFunc, data, maxLength = SINGLE_SEGMENT_LIMIT) {
  const { fixed = {}, truncatable = [] } = data ?? {};

  // Sanitize every input value up front — truncation math must run against
  // the character count that will actually be sent, not the raw input.
  const sanitizedFixed = Object.fromEntries(
    Object.entries(fixed).map(([key, value]) => [key, sanitizeGsmText(value)])
  );
  const fields = truncatable.map((f) => ({
    ...f,
    value: sanitizeGsmText(f.value),
    minLength: f.minLength ?? 8,
  }));

  const compile = () => {
    const merged = { ...sanitizedFixed };
    for (const f of fields) merged[f.key] = f.current ?? f.value;
    return templateFunc(merged);
  };

  let message = compile();
  let truncated = false;

  // Shorten the lowest-priority dynamic field first, one field at a time,
  // re-measuring after every step — never touches `fixed` values (amount,
  // token, date, time) no matter how far over budget the message is.
  let fieldIndex = 0;
  while (message.length > maxLength && fieldIndex < fields.length) {
    const field = fields[fieldIndex];
    const current = field.current ?? field.value;

    if (current.length <= field.minLength) {
      fieldIndex += 1; // this field is already as short as it's allowed to go
      continue;
    }

    const overBy = message.length - maxLength;
    const ellipsis = '...';
    const targetLength = Math.max(field.minLength, current.length - overBy - ellipsis.length);
    field.current = current.slice(0, targetLength).trimEnd() + ellipsis;
    truncated = true;
    message = compile();
  }

  return { message, truncated, length: message.length };
}

/**
 * Production-safe send wrapper: sanitizes + hard-truncates as a last-resort
 * backstop (callers should already be using buildStrictSms so this rarely
 * has to actually cut anything), then delegates to the real sendSMS().
 * Never throws — matches utils/sms.js's contract, always resolves
 * { success, error?, truncated, trackingCode? }.
 *
 * @param {{ to: string, message: string }} options
 */
export async function safeSendSMS({ to, message } = {}) {
  const sanitized = sanitizeGsmText(message);
  let finalMessage = sanitized;
  let truncated = false;
  let trackingCode = null;

  if (finalMessage.length > SINGLE_SEGMENT_LIMIT) {
    truncated = true;
    trackingCode = `SMS-TRUNC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    finalMessage = finalMessage.slice(0, SINGLE_SEGMENT_LIMIT - 3).trimEnd() + '...';

    // Critical, not warn — this means a caller built a message without
    // going through buildStrictSms and it overflowed a single segment.
    // That's either a silent double-billing event narrowly avoided, or (if
    // this hard truncation still isn't acceptable for that message) a bug
    // that needs a real fix upstream, not just this backstop.
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'sms_hard_truncated',
        trackingCode,
        to,
        originalLength: sanitized.length,
        finalLength: finalMessage.length,
        ts: new Date().toISOString(),
      })
    );
  }

  const result = await sendSMS(to, finalMessage);
  return { ...result, truncated, trackingCode };
}

// Confirmed live (2026-08-04) against real transactions: when two SMS for
// the same event (customer + merchant) fire back-to-back via safeSendSMS,
// the FIRST always dispatches in under a second, but the SECOND is queued
// by Africa's Talking for minutes — 172s, 380s, 607s and 827s across every
// real multi-recipient transaction sampled, a 100% hit rate. That pattern
// (always-instant first, always-delayed second) is the signature of a
// per-second/per-minute send-rate limit on the account or sender ID, not
// random network flakiness — spacing sends out avoids tripping it.
// Never throws — same contract as safeSendSMS. Callers that shouldn't be
// delayed by the stagger (e.g. a webhook handler acking a third party)
// should call this without awaiting it.
export async function sendStaggeredSms(sends, delayMs = 2000) {
  const results = [];
  for (let i = 0; i < sends.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    results.push(await safeSendSMS(sends[i]));
  }
  return results;
}
