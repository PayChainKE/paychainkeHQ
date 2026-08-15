// Merchant-facing "you've been paid" / "you've paid someone" SMS —
// deliberately mirrors M-Pesa's own confirmation SMS format and tone
// (receipt code, "Confirmed.", full sender number, "New balance
// is..."), rebranded for PayChain rather than reusing anything
// Safaricom-specific (their "Download My OneApp" footer, "Amount you can
// transact within the day" limit — both belong to Safaricom's own product,
// not ours, so they're intentionally left out rather than copied verbatim).
// Single source of truth so every collection/payout rail (STK, C2B, NCBA,
// B2C) sends the same professional, consistent message shape.
import { buildStrictSms } from './smsSanitizer.js';
import { formatPhoneDisplay } from './formatPhoneDisplay.js';

/**
 * @param {{ ref: string, amount: number, payerName?: string|null, payerPhone?: string|null, date: string, time: string, balance: number, channel?: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPaymentReceivedSms({ ref, amount, payerName, payerPhone, date, time, balance, channel = 'M-PESA' }) {
  const phone = payerPhone ? formatPhoneDisplay(payerPhone) : null;
  return buildStrictSms(
    ({ ref, amt, name, phone, channel, date, time, balance }) =>
      `${ref} Confirmed. You have received KES ${amt} from ${name}${phone ? ` ${phone}` : ''} via ${channel} on ${date} at ${time}. New PayChain balance is KES ${balance}.`,
    {
      fixed: { ref, amt: amount.toLocaleString(), phone: phone || '', channel, date, time, balance: balance.toLocaleString() },
      truncatable: [{ key: 'name', value: payerName || 'a customer', minLength: 6 }],
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
      truncatable: [{ key: 'name', value: businessName || 'PayChain', minLength: 5 }],
    }
  );
}

/**
 * Merchant-facing "your payout landed" SMS for NCBA bank/mobile-wallet
 * payouts (controllers/ncbaOpenBankingController.js's handlePesaLinkCallback)
 * — replaces a raw inline template that had no length protection, unlike
 * every other SMS in this file. Matters more here than for Daraja's
 * templates above: `ref` is NCBA's own generated transaction id (e.g.
 * `NCBA-B2W-1786394243290-TIU7N`, ~28 chars — much longer than a Daraja
 * M-Pesa receipt code) and `recipientName` is the merchant's own free-typed
 * withdrawal destination label, both of which can push the message over one
 * GSM-7 segment on their own.
 *
 * `balance` is optional — handleBankPayout knows the new balance
 * synchronously and shows it; handlePesaLinkCallback's async success path
 * historically didn't, so it stays omitted unless passed.
 *
 * @param {{ ref: string, label: string, amount: number, recipientName?: string|null, date: string, time: string, balance?: number|null }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPayoutSentSms({ ref, label, amount, recipientName, date, time, balance }) {
  const showBalance = typeof balance === 'number' && Number.isFinite(balance);
  return buildStrictSms(
    ({ ref, label, amt, name, date, time, balanceLine }) =>
      `${ref} ${label} Sent. KES ${amt} paid to ${name} on ${date} at ${time}.${balanceLine}`,
    {
      fixed: { ref, label, amt: amount.toLocaleString(), date, time, balanceLine: showBalance ? ` New balance: KES ${balance.toLocaleString()}.` : '' },
      truncatable: [{ key: 'name', value: recipientName || 'the recipient', minLength: 6 }],
    }
  );
}

/**
 * Merchant-facing "your payout failed and was refunded" SMS. `date`/`time`
 * are accepted but deliberately left out of the message — with the longest
 * `label` ("KPLC prepaid token purchase") and a full-length `ref`, the old
 * wording (which included them plus "could not be completed on ... and has
 * been refunded") ran 190-215 chars, guaranteeing safeSendSMS's hard-truncate
 * backstop fired on every payout failure and silently cut off the refund
 * confirmation and balance. This shorter wording stays under 160 chars even
 * in the worst case, so recipientName's truncation headroom is a real
 * safety margin again instead of always being exhausted.
 *
 * @param {{ ref: string, label: string, amount: number, recipientName?: string|null, date: string, time: string, balance: number }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPayoutFailedSms({ ref, label, amount, recipientName, balance }) {
  return buildStrictSms(
    ({ ref, label, amt, name, balance }) =>
      `${ref} ${label} Failed. KES ${amt} to ${name} refunded. New PayChain balance: KES ${balance}.`,
    {
      fixed: { ref, label, amt: amount.toLocaleString(), balance: balance.toLocaleString() },
      truncatable: [{ key: 'name', value: recipientName || 'the recipient', minLength: 6 }],
    }
  );
}

/**
 * Recipient-facing "you've been paid" SMS for a Mobile Money (M-PESA/Airtel
 * Money) payout landing in someone's personal wallet — sent to the
 * recipient's own phone alongside (not instead of) Safaricom/Airtel's own
 * network confirmation SMS, so they know which PayChain business it came
 * from. No "New balance" line — unlike the merchant-facing templates above,
 * PayChain has no visibility into the recipient's actual M-Pesa/Airtel
 * balance, and only Safaricom/Airtel's own SMS can correctly state it.
 *
 * @param {{ ref: string, amount: number, businessName?: string|null, date: string, time: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPayoutRecipientReceivedSms({ ref, amount, businessName, date, time }) {
  return buildStrictSms(
    ({ ref, amt, name, date, time }) =>
      `${ref} Confirmed. You have received KES ${amt} from ${name} via PayChain on ${date} at ${time}.`,
    {
      fixed: { ref, amt: amount.toLocaleString(), date, time },
      truncatable: [{ key: 'name', value: businessName || 'a PayChain business', minLength: 6 }],
    }
  );
}
