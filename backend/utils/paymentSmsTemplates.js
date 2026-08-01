// Merchant-facing "you've been paid" / "you've paid someone" SMS —
// deliberately mirrors M-Pesa's own confirmation SMS format and tone
// (receipt code, "Confirmed.", masked third-party number, "New balance
// is..."), rebranded for PayChain rather than reusing anything
// Safaricom-specific (their "Download My OneApp" footer, "Amount you can
// transact within the day" limit — both belong to Safaricom's own product,
// not ours, so they're intentionally left out rather than copied verbatim).
// Single source of truth so every collection/payout rail (STK, C2B, NCBA,
// B2C) sends the same professional, consistent message shape.
import { buildStrictSms } from './smsSanitizer.js';
import { formatPhoneDisplay } from './formatPhoneDisplay.js';

// Matches M-Pesa's own convention: mask the middle 3 digits of a THIRD
// PARTY's number disclosed to someone else (privacy) — e.g. 0740***805.
// Only ever applied to a payer's number shown to a merchant in
// buildPaymentReceivedSms below; never to a recipient the merchant
// themselves chose and typed in (buildPaymentSentSms shows that in full,
// same as M-Pesa does — there's no new privacy concern in showing someone
// their own already-known input back to them).
function maskPhoneMiddle(formatted) {
  if (!formatted || !/^0\d{9}$/.test(formatted)) return formatted;
  return formatted.slice(0, 4) + '***' + formatted.slice(7);
}

/**
 * @param {{ ref: string, amount: number, payerName?: string|null, payerPhone?: string|null, date: string, time: string, balance: number, channel?: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPaymentReceivedSms({ ref, amount, payerName, payerPhone, date, time, balance, channel = 'M-PESA' }) {
  const maskedPhone = payerPhone ? maskPhoneMiddle(formatPhoneDisplay(payerPhone)) : null;
  return buildStrictSms(
    ({ ref, amt, name, phone, channel, date, time, balance }) =>
      `${ref} Confirmed. You have received KES ${amt} from ${name}${phone ? ` ${phone}` : ''} via ${channel} on ${date} at ${time}. New PayChain balance is KES ${balance}.`,
    {
      fixed: { ref, amt: amount.toLocaleString(), phone: maskedPhone || '', channel, date, time, balance: balance.toLocaleString() },
      truncatable: [{ key: 'name', value: payerName || 'a customer', minLength: 10 }],
    }
  );
}

/**
 * @param {{ ref: string, amount: number, recipientName?: string|null, recipientPhone?: string|null, date: string, time: string, balance: number, fee?: number|null }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPaymentSentSms({ ref, amount, recipientName, recipientPhone, date, time, balance, fee }) {
  const phone = recipientPhone ? formatPhoneDisplay(recipientPhone) : null;
  const showFee = typeof fee === 'number' && Number.isFinite(fee);
  return buildStrictSms(
    ({ ref, amt, name, phone, date, time, balance, feeLine }) =>
      `${ref} Confirmed. KES ${amt} sent to ${name}${phone ? ` ${phone}` : ''} on ${date} at ${time}. New PayChain balance is KES ${balance}.${feeLine}`,
    {
      fixed: {
        ref,
        amt: amount.toLocaleString(),
        phone: phone || '',
        date,
        time,
        balance: balance.toLocaleString(),
        feeLine: showFee ? ` Transaction cost, KES ${fee.toLocaleString()}.` : '',
      },
      truncatable: [{ key: 'name', value: recipientName || 'the recipient', minLength: 8 }],
    }
  );
}

/**
 * "You paid" receipt SMS to the customer/payer — confirms where their
 * M-Pesa payment landed. Deliberately doesn't claim to show a "New M-Pesa
 * balance" the way the merchant-facing templates above show a PayChain
 * balance — Safaricom already sends the payer that in their own separate
 * SMS for every M-Pesa transaction; PayChain has no way to know that
 * number, and fabricating one would be a real correctness problem, not a
 * cosmetic one.
 *
 * @param {{ ref: string, amount: number, businessName: string, accountRef?: string|null, date: string, time: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildCustomerPaidSms({ ref, amount, businessName, accountRef, date, time }) {
  return buildStrictSms(
    ({ ref, amt, name, acct, date, time }) =>
      `${ref} Confirmed. KES ${amt} paid to ${name}${acct ? ` for account ${acct}` : ''} on ${date} at ${time}. Thank you for your payment.`,
    {
      fixed: { ref, amt: amount.toLocaleString(), acct: accountRef || '', date, time },
      truncatable: [{ key: 'name', value: businessName || 'PayChain', minLength: 10 }],
    }
  );
}
