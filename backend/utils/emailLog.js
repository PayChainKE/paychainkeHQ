import EmailLog from '../models/EmailLog.js';
import Merchant from '../models/Merchant.js';

// Central write path for models/EmailLog.js, called from utils/resend.js
// right after (or instead of, on failure) resend.emails.send() resolves.
// Fire-and-forget by design (every call site does `logEmail(...).catch(() =>
// {})` without awaiting) — a logging hiccup must never slow down or affect
// whether the real email send succeeds.
//
// Scope decision (2026-09): NOT every one of resend.js's ~26 senders calls
// this. Excluded on purpose:
//   - sendOTP / sendAdminActionOTP — carry a live, usable one-time code;
//     must never be persisted somewhere an admin can browse it later.
//   - sendTeamInvite / sendOfficerCredentials — internal admin/officer
//     onboarding, not a merchant conversation; the latter also carries a
//     plaintext password.
//   - sendNewsletterConfirmation / sendNewsletterEmail / sendWaitlistConfirmation
//     — pre-merchant marketing, already tracked in aggregate via
//     NewsletterCampaign; logging every individual send here would mostly
//     be noise against this log's "merchant relationship" purpose.
//   - sendSupportReply — already recorded on Contact.replies[]; logging it
//     here too would create two sources of truth for the same reply.
//   - sendRevenueSweepNotification / sendReconciliationAlertEmail — sent to
//     admins, not merchants.
// Everything else a merchant might plausibly need to reference during a
// follow-up (welcome, invites, KYC review outcomes, security alerts,
// invoices/receipts/statements, dormancy nudges, tax reminders) is logged.
export async function logEmail({ to, type, subject, bodyHtml, resendId = null, status = 'sent', error = null }) {
  try {
    const lower = String(to || '').trim().toLowerCase();
    if (!lower) return;
    const merchant = await Merchant.findOne({ email: lower }).select('_id').lean();
    await EmailLog.create({
      to: lower,
      merchantId: merchant?._id || null,
      type,
      subject,
      bodyHtml,
      resendId,
      status,
      error,
    });
  } catch (err) {
    console.error('Email log write failed (non-fatal):', err?.message || err);
  }
}
