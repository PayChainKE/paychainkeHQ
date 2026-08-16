import Admin from '../models/Admin.js';
import SecurityAlert from '../models/SecurityAlert.js';
import { sendSecurityAlertEmail } from './resend.js';

// Fire-and-forget security/ops alert to every active owner/admin — used for
// events that warrant human attention before they become an incident:
// account lockouts, large transfers, new privileged-account creation.
// Deliberately never awaited by callers and never throws into their
// request/response cycle — a notification failure must not block or fail
// the underlying action that triggered it.
//
// Persists a SecurityAlert record (surfaced in the admin dashboard's
// Security > Alerts page) in addition to emailing — previously this only
// ever reached admins as an email with no record inside the app itself.
export function notifyAdmins({ type, severity = 'warning', subject, heading, details, metadata = null }) {
  SecurityAlert.create({ type, severity, subject, heading, details, metadata }).catch((err) => {
    console.error('notifyAdmins: failed to persist alert record:', err?.message || err);
  });

  Admin.find({ role: { $in: ['owner', 'admin'] }, status: 'active' })
    .select('email')
    .lean()
    .then((admins) => {
      admins.forEach((admin) => {
        if (!admin.email) return;
        sendSecurityAlertEmail(admin.email, subject, heading, details).catch((err) => {
          console.error('Security alert email failed:', err?.message || err);
        });
      });
    })
    .catch((err) => {
      console.error('notifyAdmins: failed to look up admins:', err?.message || err);
    });
}
