// Merchant-facing "you've been paid" / "you've paid someone" SMS —
// deliberately mirrors M-Pesa's own confirmation SMS format and tone
// (receipt code, "Confirmed.", full sender number, "New balance
// is..."), rebranded for PayChain rather than reusing anything
// Safaricom-specific (their "Download My OneApp" footer, "Amount you can
// transact within the day" limit — both belong to Safaricom's own product,
// not ours, so they're intentionally left out rather than copied verbatim).
// Single source of truth so every collection/payout rail (STK, C2B, NCBA,
// B2C) sends the same professional, consistent message shape.
import { buildStrictSms, formatKes } from './smsSanitizer.js';
import { formatPhoneDisplay } from './formatPhoneDisplay.js';

/**
 * @param {{ ref: string, amount: number, payerName?: string|null, payerPhone?: string|null, date: string, time: string, balance: number, channel?: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPaymentReceivedSms({ ref, amount, payerName, payerPhone, date, time, balance, channel = 'M-PESA' }) {
  const phone = payerPhone ? formatPhoneDisplay(payerPhone) : null;
  return buildStrictSms(
    ({ ref, amt, name, phone, channel, date, time, balance }) =>
      `${ref} Confirmed. You have received Ksh ${amt} from ${name}${phone ? ` ${phone}` : ''} via ${channel} on ${date} at ${time}. New PayChain balance is Ksh ${balance}.`,
    {
      fixed: { ref, amt: formatKes(amount), phone: phone || '', channel, date, time, balance: formatKes(balance) },
      truncatable: [{ key: 'name', value: payerName || 'a customer', minLength: 6 }],
    }
  );
}

/**
 * Merchant self-funding their own PayChain wallet via M-PESA — replaces a
 * raw inline template in mpesaController.js that had no length protection
 * (the only one in the whole self-funding/collection path that didn't go
 * through buildStrictSms), which is what let "Your updated available
 * balance is Ksh ..." get silently guillotined by safeSendSMS's crude
 * hard-truncate the moment the balance figure ran a few digits long.
 * Shorter "New balance" wording buys real headroom instead of just
 * shrinking the odds.
 *
 * @param {{ ref: string, amount: number, date: string, time: string, balance: number }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildWalletTopUpSms({ ref, amount, date, time, balance }) {
  return buildStrictSms(
    ({ ref, amt, date, time, balance }) =>
      `${ref} Confirmed. Ksh ${amt} deposited to your PayChain wallet via M-PESA on ${date} at ${time}. New balance: Ksh ${balance}.`,
    {
      fixed: { ref, amt: formatKes(amount), date, time, balance: formatKes(balance) },
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
      `${ref} Confirmed. Ksh ${amt} sent to ${name}${phone ? ` ${phone}` : ''} on ${date} at ${time}. New PayChain balance is Ksh ${balance}.${feeLine}`,
    {
      fixed: {
        ref,
        amt: formatKes(amount),
        phone: phone || '',
        date,
        time,
        balance: formatKes(balance),
        feeLine: showFee ? ` Transaction cost Ksh ${formatKes(fee)}.` : '',
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
/**
 * Sent BEFORE the STK prompt fires, only for merchant-initiated "Request
 * Money" pushes — the only STK flow where the customer never lands on any
 * PayChain page first (Payment Links / Pay Account already show this same
 * breakdown on-screen before the customer submits — see checkout-preview's
 * doc comment in transactionController.js). Without this, the M-PESA
 * prompt is the customer's first and only signal, and NCBA's STK API has
 * no free-text field to explain why it's asking for more than the amount
 * the merchant told them — this fills that gap out-of-band, ideally
 * arriving just ahead of (or alongside) the prompt itself.
 *
 * @param {{ businessName: string, baseAmount: number, fee: number }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildPaymentRequestSms({ businessName, baseAmount, fee }) {
  const total = Math.round((baseAmount + fee) * 100) / 100;
  const showFee = fee > 0;
  return buildStrictSms(
    ({ name, amt, feeLine, total }) =>
      `${name} is requesting Ksh ${amt} via PayChain.${feeLine} Enter M-PESA PIN to pay Ksh ${total}.`,
    {
      fixed: {
        amt: formatKes(baseAmount),
        feeLine: showFee ? ` Transaction cost, Ksh ${formatKes(fee)}.` : '',
        total: formatKes(total),
      },
      // The business name always renders in full — buildStrictSms never
      // shortens anything. Kept concise wording around it (rather than
      // truncating the name) so a normal business name still fits one
      // segment; a genuinely long name is sent complete regardless, as a
      // standard multi-part SMS.
      truncatable: [{ key: 'name', value: businessName || 'A PayChain business' }],
    }
  );
}

export function buildCustomerPaidSms({ ref, amount, businessName, accountRef, date, time, fee }) {
  const showFee = typeof fee === 'number' && Number.isFinite(fee) && fee > 0;
  return buildStrictSms(
    ({ ref, amt, name, acct, date, time, feeLine }) =>
      `${ref} Confirmed. Ksh ${amt} paid to ${name}${acct ? ` for account ${acct}` : ''} on ${date} at ${time}.${feeLine} Thank you for your payment.`,
    {
      fixed: {
        ref,
        amt: formatKes(amount),
        date,
        time,
        // Same rationale as buildPaymentSentSms's feeLine: this SMS is the
        // payer's own receipt, so the total it confirms (amount) already
        // includes PayChain's customer surcharge — showing the fee here
        // (not just the total) is what lets them check "base + fee" adds
        // up, the same way an M-Pesa "Transaction cost" line does.
        feeLine: showFee ? ` Transaction cost Ksh ${formatKes(fee)}.` : '',
      },
      // Both render in full — buildStrictSms never shortens a field. A long
      // business name or account ref just makes this a multi-part SMS
      // rather than losing "Thank you for your payment." off the end.
      truncatable: [
        { key: 'name', value: businessName || 'PayChain' },
        { key: 'acct', value: accountRef || '' },
      ],
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
      `${ref} ${label} Sent. Ksh ${amt} paid to ${name} on ${date} at ${time}.${balanceLine}`,
    {
      fixed: { ref, label, amt: formatKes(amount), date, time, balanceLine: showBalance ? ` New balance: Ksh ${formatKes(balance)}.` : '' },
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
      `${ref} ${label} Failed. Ksh ${amt} to ${name} refunded. New PayChain balance: Ksh ${balance}.`,
    {
      fixed: { ref, label, amt: formatKes(amount), balance: formatKes(balance) },
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
      `${ref} Confirmed. You have received Ksh ${amt} from ${name} via PayChain on ${date} at ${time}.`,
    {
      fixed: { ref, amt: formatKes(amount), date, time },
      truncatable: [{ key: 'name', value: businessName || 'a PayChain business', minLength: 6 }],
    }
  );
}
