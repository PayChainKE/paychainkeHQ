import Admin from '../models/Admin.js';
import { sendAdminAutomationNoticeEmail } from './resend.js';

// Emails every active owner/admin about an automation event (a digest waiting
// for approval, a scheduled send that failed, ...). Alerts from automations go
// to all admins by decision — not a configurable per-automation list — so this
// is the one place to change that. Fire-and-forget: a notice failing must
// never fail the run that raised it.
export function notifyAdminsOfAutomation({ subject, heading, detailsHtml, ctaLabel, ctaPath }) {
  Admin.find({ role: { $in: ['owner', 'admin'] }, status: 'active' })
    .select('email')
    .lean()
    .then((admins) => {
      admins.forEach((admin) => {
        if (!admin.email) return;
        sendAdminAutomationNoticeEmail(admin.email, subject, heading, detailsHtml, ctaLabel, ctaPath)
          .catch((err) => console.error('Automation notice email failed:', err?.message || err));
      });
    })
    .catch((err) => console.error('notifyAdminsOfAutomation: admin lookup failed:', err?.message || err));
}
