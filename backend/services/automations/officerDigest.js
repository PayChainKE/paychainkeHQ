import Admin from '../../models/Admin.js';
import Merchant from '../../models/Merchant.js';
import { notifyAdminsOfAutomation } from '../../utils/adminNotices.js';
import { sendAdminAutomationNoticeEmail } from '../../utils/resend.js';
import { DAY, OFFICER_URL, esc } from './common.js';

const KEY = 'officer_digest';

async function countsByOfficer(match) {
  const rows = await Merchant.aggregate([
    { $match: { onboardingOfficerId: { $ne: null }, ...match } },
    { $group: { _id: '$onboardingOfficerId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

// Weekly (on the configured slot) summary for every active officer — how many
// applications they submitted, how many of theirs were approved, and how many
// are still open — plus a ranking email to admins. "Approved" credits the
// officer who ONBOARDED the merchant, not whoever clicked approve.
export async function runOfficerDigest(auto, { now = new Date(), dryRun = false } = {}) {
  const since = new Date(now.getTime() - 7 * DAY);
  const [officers, submitted, approved, open] = await Promise.all([
    Admin.find({ role: 'officer', status: 'active' }).select('email name').lean(),
    countsByOfficer({ submittedAt: { $gte: since, $lte: now } }),
    countsByOfficer({ kybStatus: 'approved', reviewedAt: { $gte: since, $lte: now } }),
    countsByOfficer({ kybStatus: { $in: ['pending', 'requires_revision'] } }),
  ]);

  const rows = officers.map((o) => ({
    officer: o,
    submitted: submitted.get(String(o._id)) || 0,
    approved: approved.get(String(o._id)) || 0,
    open: open.get(String(o._id)) || 0,
  }));
  const active = rows.filter((r) => r.submitted || r.approved || r.open);

  if (dryRun) {
    return { status: 'ok', summary: `Would email ${active.length} officer${active.length === 1 ? '' : 's'} their week and send admins a ranking.`, counts: { officers: active.length } };
  }
  if (rows.length === 0) return { status: 'skipped', summary: 'There are no active officers.' };

  let sent = 0;
  for (const r of active) {
    try {
      await sendAdminAutomationNoticeEmail(
        r.officer.email,
        'Your week on PayChain',
        'Your week in numbers',
        `<p style="margin:0 0 10px;">Hi ${esc(r.officer.name || 'there')}, here is how the last 7 days went for the merchants you onboarded:</p><ul style="margin:0;padding-left:18px;"><li><strong>${r.submitted}</strong> application${r.submitted === 1 ? '' : 's'} submitted</li><li><strong>${r.approved}</strong> approved</li><li><strong>${r.open}</strong> still open</li></ul>`,
        'Open officer portal',
        OFFICER_URL
      );
      sent++;
    } catch (e) { console.error('Officer digest email failed:', e?.message || e); }
  }

  const ranked = [...rows].sort((a, b) => b.approved - a.approved || b.submitted - a.submitted);
  const tr = ranked.slice(0, 20).map((r, i) => `<tr><td style="padding:4px 10px 4px 0;">${i + 1}.</td><td style="padding:4px 14px 4px 0;"><strong>${esc(r.officer.name || r.officer.email)}</strong></td><td style="padding:4px 14px 4px 0;">${r.submitted} submitted</td><td style="padding:4px 14px 4px 0;">${r.approved} approved</td><td style="padding:4px 0;">${r.open} open</td></tr>`).join('');
  const totalSub = rows.reduce((a, r) => a + r.submitted, 0);
  const totalApp = rows.reduce((a, r) => a + r.approved, 0);
  notifyAdminsOfAutomation({
    subject: 'Officer performance — last 7 days',
    heading: 'Officer leaderboard',
    detailsHtml: `<p style="margin:0 0 10px;">${totalSub} applications submitted and ${totalApp} approved by officers in the last 7 days.</p><table style="border-collapse:collapse;font-size:14px;">${tr}</table>`,
    ctaLabel: 'Open Officers',
    ctaPath: '/officers',
  });

  return { status: 'ok', summary: `Emailed ${sent} officer${sent === 1 ? '' : 's'} and sent admins the leaderboard (${totalSub} submitted, ${totalApp} approved this week).`, counts: { officers: sent } };
}
