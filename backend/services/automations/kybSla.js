import Admin from '../../models/Admin.js';
import Merchant from '../../models/Merchant.js';
import { notifyAdminsOfAutomation } from '../../utils/adminNotices.js';
import { sendAdminAutomationNoticeEmail } from '../../utils/resend.js';
import { claimEvent, hasEvent } from '../automationEvents.js';
import { HOUR, OFFICER_URL, esc } from './common.js';

const KEY = 'kyb_sla_alert';
const LIST_LIMIT = 15;

function waitedLabel(submittedAt, now) {
  const h = Math.floor((now.getTime() - new Date(submittedAt).getTime()) / HOUR);
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h`;
}

function listHtml(apps, now) {
  const rows = apps.slice(0, LIST_LIMIT).map((a) =>
    `<li style="margin:0 0 4px;"><strong>${esc(a.businessName || a.name || 'Unnamed')}</strong> — waiting ${waitedLabel(a.submittedAt, now)}</li>`
  ).join('');
  const more = apps.length > LIST_LIMIT ? `<p style="margin:8px 0 0;">…and ${apps.length - LIST_LIMIT} more.</p>` : '';
  return `<ul style="margin:0;padding-left:18px;">${rows}</ul>${more}`;
}

// Alerts admins (everything) and officers (only applications they onboarded)
// when a KYC application has waited past the SLA, and again — to admins only,
// as an escalation — past the escalation threshold. Each application is
// alerted once per level (see automationEvents.js), so a backlog is one email,
// not one per run.
export async function runKybSla(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const slaHours = Number(cfg.slaHours) > 0 ? Number(cfg.slaHours) : 24;
  const escalateHours = Number(cfg.escalateHours) > slaHours ? Number(cfg.escalateHours) : slaHours * 2;

  const overdue = await Merchant.find({
    kybStatus: 'pending',
    submittedAt: { $lte: new Date(now.getTime() - slaHours * HOUR) },
  }).select('businessName name submittedAt onboardingOfficerId').sort({ submittedAt: 1 }).lean();

  const fresh = [];      // newly past SLA
  const escalated = [];  // newly past escalation
  for (const a of overdue) {
    const ageH = (now.getTime() - a.submittedAt.getTime()) / HOUR;
    if (dryRun) {
      if (!(await hasEvent(KEY, a._id, 'sla'))) fresh.push(a);
      if (ageH >= escalateHours && !(await hasEvent(KEY, a._id, 'escalated'))) escalated.push(a);
      continue;
    }
    if (await claimEvent(KEY, a._id, 'sla')) fresh.push(a);
    if (ageH >= escalateHours && (await claimEvent(KEY, a._id, 'escalated'))) escalated.push(a);
  }

  if (dryRun) {
    return { status: 'ok', summary: `Would alert about ${fresh.length} application${fresh.length === 1 ? '' : 's'} over ${slaHours}h${escalated.length ? ` and escalate ${escalated.length} over ${escalateHours}h` : ''}.`, counts: { fresh: fresh.length, escalated: escalated.length } };
  }
  if (fresh.length === 0 && escalated.length === 0) {
    return { status: 'skipped', summary: `Nothing new past ${slaHours}h.` };
  }

  if (fresh.length) {
    notifyAdminsOfAutomation({
      subject: `${fresh.length} KYC application${fresh.length === 1 ? '' : 's'} waiting over ${slaHours}h`,
      heading: `${fresh.length} application${fresh.length === 1 ? ' is' : 's are'} past the ${slaHours}-hour review target`,
      detailsHtml: listHtml(fresh, now),
      ctaLabel: 'Open KYC queue',
      ctaPath: '/kyc-verification',
    });

    // Officers only hear about applications they onboarded themselves.
    const byOfficer = new Map();
    for (const a of fresh) {
      if (!a.onboardingOfficerId) continue;
      const k = String(a.onboardingOfficerId);
      if (!byOfficer.has(k)) byOfficer.set(k, []);
      byOfficer.get(k).push(a);
    }
    if (byOfficer.size) {
      const officers = await Admin.find({ _id: { $in: [...byOfficer.keys()] }, role: 'officer', status: 'active' }).select('email').lean();
      for (const o of officers) {
        const mine = byOfficer.get(String(o._id));
        sendAdminAutomationNoticeEmail(
          o.email,
          `${mine.length} of your applications ${mine.length === 1 ? 'is' : 'are'} awaiting review`,
          `${mine.length} of your applications ${mine.length === 1 ? 'has' : 'have'} been waiting over ${slaHours}h`,
          listHtml(mine, now),
          'Open officer portal',
          OFFICER_URL
        ).catch((e) => console.error('KYB SLA officer email failed:', e?.message || e));
      }
    }
  }

  if (escalated.length) {
    notifyAdminsOfAutomation({
      subject: `ESCALATION: ${escalated.length} KYC application${escalated.length === 1 ? '' : 's'} waiting over ${escalateHours}h`,
      heading: `Escalation — ${escalated.length} application${escalated.length === 1 ? '' : 's'} waiting over ${escalateHours} hours`,
      detailsHtml: `<p style="margin:0 0 10px;">These have now waited past the escalation threshold and need someone to pick them up.</p>${listHtml(escalated, now)}`,
      ctaLabel: 'Open KYC queue',
      ctaPath: '/kyc-verification',
    });
  }

  return { status: 'ok', summary: `Alerted on ${fresh.length} application${fresh.length === 1 ? '' : 's'} over ${slaHours}h${escalated.length ? `, escalated ${escalated.length} over ${escalateHours}h` : ''}.`, counts: { fresh: fresh.length, escalated: escalated.length } };
}
