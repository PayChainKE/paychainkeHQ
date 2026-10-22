import { safeSendSMS } from './smsSanitizer.js';
import { sendMerchantLifecycleEmail } from './resend.js';
import { createNotification } from '../controllers/notificationController.js';

// Payout hold after a credential recovery. Since 2026-10-20 a merchant can
// reset their password AND their payment PIN with SMS codes alone, so a
// stolen phone or a SIM swap is enough to take over an account and drain
// it. Pausing payouts for a while after any recovery (the same idea as
// M-PESA's SIM-swap hold) gives the real owner time to notice the alert
// below and call support. Collections keep working throughout.
//
// Set by: password reset (forgot-password flow), PIN reset by SMS/email
// code, and an admin changing the merchant's login phone/email. NOT set by
// a signed-in change that proves the old secret (change-password with the
// current password, PIN change with the current PIN).
//
// Enforced in utils/availableBalance.js#debitAvailableBalance (every real
// payout rail). CREDENTIAL_RESET_PAYOUT_HOLD_HOURS=0 turns it off.
export function payoutHoldHours() {
  const raw = process.env.CREDENTIAL_RESET_PAYOUT_HOLD_HOURS;
  const n = raw === undefined || raw === '' ? 24 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Mutates the (unsaved) merchant doc; the caller saves. Returns the hold
// end, or null when holds are switched off.
export function applyPayoutHold(merchant, reason) {
  const hours = payoutHoldHours();
  if (!hours) return null;
  const until = new Date(Date.now() + hours * 3600 * 1000);
  // Never shorten a longer hold that's already running.
  if (!merchant.payoutHoldUntil || new Date(merchant.payoutHoldUntil) < until) {
    merchant.payoutHoldUntil = until;
    merchant.payoutHoldReason = reason;
  }
  return merchant.payoutHoldUntil;
}

export function activePayoutHold(merchant) {
  const until = merchant?.payoutHoldUntil ? new Date(merchant.payoutHoldUntil) : null;
  return until && until > new Date() ? until : null;
}

const fmtNairobi = (d) => new Date(d).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });

export function payoutHoldMessage(until) {
  return `For your security, payouts are paused until ${fmtNairobi(until)} because your password, PIN or contact details were just reset. Collections still work. If you didn't make this change, contact support@paychain.co.ke now.`;
}

// Tells the merchant on every channel. The email matters most: in a
// stolen-phone takeover the SMS lands on the thief's handset, but the
// email reaches the real owner.
export function notifyCredentialRecovery(merchant, { what, until }) {
  const holdLine = until ? ` Payouts are paused until ${fmtNairobi(until)} as a precaution.` : '';
  createNotification({
    merchantId: merchant._id,
    kind: 'security',
    title: `${what} reset`,
    message: `Your ${what.toLowerCase()} was just reset.${holdLine} If this wasn't you, contact support@paychain.co.ke immediately.`,
  });
  if (merchant.phone) {
    safeSendSMS({
      to: merchant.phone,
      message: `PayChain Security: Your ${what.toLowerCase()} was reset.${until ? ` Payouts paused until ${fmtNairobi(until)}.` : ''} Not you? Contact support@paychain.co.ke now.`,
    }).catch((err) => console.error('Credential recovery SMS failed:', err));
  }
  if (merchant.email) {
    sendMerchantLifecycleEmail(merchant.email, {
      subject: `Security alert: your PayChain ${what.toLowerCase()} was reset`,
      heading: `Your ${what.toLowerCase()} was reset`,
      paragraphsHtml: `<p>Your PayChain ${what.toLowerCase()} was just reset on ${fmtNairobi(new Date())}.</p>`
        + (until ? `<p>As a precaution, <strong>payouts from your account are paused until ${fmtNairobi(until)}</strong>. Payments into your account keep working normally.</p>` : '')
        + `<p><strong>If you didn't do this</strong>, someone may have access to your phone or SIM. Contact <a href="mailto:support@paychain.co.ke">support@paychain.co.ke</a> right away so we can lock your account.</p>`,
    }).catch((err) => console.error('Credential recovery email failed:', err?.message || err));
  }
}
