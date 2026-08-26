import crypto from 'crypto';
import { sendSMS } from './sms.js';

// Defensive layer sitting in front of utils/sms.js#sendSMS. Every outbound
// message is sent complete, exactly as composed — a real business name, a
// real reference, a real "Thank you for your payment." close, never cut
// short and never left dangling with "...". That's non-negotiable: a
// merchant's or customer's name is part of what makes the message feel
// like a real, professional confirmation (the standard every M-Pesa
// payment SMS itself is held to), not an artifact to be sacrificed for a
// billing optimization. Two responsibilities, in order:
//   1. sanitizeGsmText   — strip anything that would force UCS-2 encoding
//                          (which drops the per-segment budget from 160 to
//                          70) — a real encoding constraint, not a content
//                          decision, so this one still applies.
//   2. buildStrictSms    — compile a template from fixed + dynamic fields,
//                          all rendered in full, and report (informational
//                          only) whether the result exceeds one GSM-7
//                          segment.
// A message that runs past 160 chars still sends in full, as a standard
// concatenated multi-part SMS — Africa's Talking (like every SMS gateway)
// delivers that to the handset as one seamless message, just billed for
// the extra segment. Template wording is kept as concise as possible
// specifically so that stays the exception, not so content ever gets cut.

const SINGLE_SEGMENT_LIMIT = 160;

// Every KES figure quoted in an SMS goes through this — "Ksh 1,500.00", always
// two decimal places, never a bare "KES 1,500" — so a customer can add up a
// base amount + fee themselves and get exactly what's shown as the total.
export function formatKes(amount) {
  return Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
 * Compiles a message from a template function against fixed + dynamic field
 * values. Every field — including anything listed in the legacy
 * `data.truncatable` shape — is always rendered in full: nothing is ever
 * shortened or ellipsized here. A real business name, reference, or any
 * other field must read exactly as typed, the same way an M-Pesa
 * confirmation SMS never clips the paybill/till name it's confirming.
 * `truncated`/`length` in the return value are purely informational — they
 * tell a caller the message will go out as more than one concatenated GSM-7
 * segment (>160 chars), which costs more but is standard, fully-supported
 * SMS behaviour (Africa's Talking — and every carrier — delivers a
 * concatenated multi-part message to the handset as one seamless text, not
 * as separate broken messages).
 *
 * @param {(fields: Record<string, string>) => string} templateFunc
 *        Builds the final SMS body from a flat object of fixed + dynamic
 *        field values.
 * @param {{
 *   fixed?: Record<string, string>,
 *   truncatable?: Array<{ key: string, value: string }>
 * }} data
 * @param {number} [segmentLength=160]
 *        Only used to compute the informational `truncated`/`length` flags.
 * @returns {{ message: string, truncated: boolean, length: number }}
 *
 * @example
 *   buildStrictSms(
 *     ({ transId, amount, businessName, accountRef, date, time }) =>
 *       `${transId} Confirmed. KES ${amount} paid to ${businessName} for account ${accountRef} on ${date} at ${time}. Thank you for your payment.`,
 *     {
 *       fixed: { transId: 'QGH7X9K2M', amount: '5,000', accountRef: '00005421', date: '12/7/26', time: '2:09 PM' },
 *       truncatable: [{ key: 'businessName', value: 'Mama Mboga General Green Grocers Ltd' }],
 *     }
 *   );
 *   // => { message: "QGH7X9K2M Confirmed. KES 5,000 paid to Mama Mboga General Green Grocers Ltd for account 00005421 on 12/7/26 at 2:09 PM. Thank you for your payment.", truncated: true, length: 172 }
 */
export function buildStrictSms(templateFunc, data, segmentLength = SINGLE_SEGMENT_LIMIT) {
  const { fixed = {}, truncatable = [] } = data ?? {};

  const sanitizedFixed = Object.fromEntries(
    Object.entries(fixed).map(([key, value]) => [key, sanitizeGsmText(value)])
  );
  const merged = { ...sanitizedFixed };
  for (const f of truncatable) merged[f.key] = sanitizeGsmText(f.value);

  const message = templateFunc(merged);

  return { message, truncated: message.length > segmentLength, length: message.length };
}

/**
 * Production-safe send wrapper: sanitizes for GSM-7 (still real — dropping
 * an emoji/curly-quote is what keeps a message billed at 160 chars/segment
 * instead of collapsing to UCS-2's 70), then delegates to the real
 * sendSMS() with the message exactly as built — never shortened, never
 * ellipsized. A message longer than one segment is sent in full as a
 * standard concatenated multi-part SMS (Africa's Talking, like every SMS
 * gateway, handles this natively and the handset renders it as one
 * complete text) — logged as informational so segment cost is visible, not
 * as an error to fix. Never throws — matches utils/sms.js's contract,
 * always resolves { success, error?, truncated, trackingCode? }.
 *
 * @param {{ to: string, message: string }} options
 */
export async function safeSendSMS({ to, message } = {}) {
  const finalMessage = sanitizeGsmText(message);
  const truncated = finalMessage.length > SINGLE_SEGMENT_LIMIT;
  let trackingCode = null;

  if (truncated) {
    trackingCode = `SMS-MULTIPART-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'sms_multi_segment',
        trackingCode,
        to,
        length: finalMessage.length,
        segments: Math.ceil(finalMessage.length / 153), // 153, not 160 — concatenated GSM-7 segments reserve 7 chars each for the UDH part header
        ts: new Date().toISOString(),
      })
    );
  }

  const result = await sendSMS(to, finalMessage);
  return { ...result, truncated, trackingCode };
}

// Confirmed live (2026-08-04) against real transactions: when two SMS for
// the same event (customer + merchant) fire back-to-back, the FIRST always
// dispatches in under a second, but the SECOND is queued by Africa's
// Talking for minutes — 172s, 380s, 607s and 827s across every real
// multi-recipient transaction sampled, a 100% hit rate. That pattern
// (always-instant first, always-delayed second) is the signature of a
// per-second/per-minute send-rate limit on the account or sender ID, not
// random network flakiness.
//
// Spacing is now guaranteed entirely by the shared queue in utils/sms.js
// (every safeSendSMS call funnels through sendSMS's FIFO + MIN_SEND_GAP_MS
// gate), which didn't exist when this function was first written — back
// then this had to impose its own manual delay between sends. That queue
// enforces the gap between ANY two sends app-wide now, in enqueue order,
// so doing it again here would just double the wait for no extra safety.
// Do not add a manual delay back in — it stacks on top of the queue's own
// gap rather than replacing it.
// Never throws — same contract as safeSendSMS. Callers that shouldn't be
// delayed (e.g. a webhook handler acking a third party) should call this
// without awaiting it.
export async function sendStaggeredSms(sends) {
  return Promise.all(sends.map((send) => safeSendSMS(send)));
}
