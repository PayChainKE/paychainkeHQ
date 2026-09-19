import Merchant from '../../models/Merchant.js';
import PhoneVerification from '../../models/PhoneVerification.js';
import { toE164Kenyan } from '../../utils/notificationService.js';
import { safeSendSMS } from '../../utils/smsSanitizer.js';
import { isQuietHoursEAT } from '../../utils/quietHours.js';
import {
  buildRegistrationDelaySms, buildRevisionNudgeSms, buildSignupAbandonedSms,
} from '../../utils/accountSmsTemplates.js';
import { claimEvent, hasEvent, markEventFailed } from '../automationEvents.js';
import { DAY, HOUR, MAX_SMS_PER_RUN, MERCHANT_URL, phoneVariants } from './common.js';

const KEY = 'signup_nudge';

// One SMS, claimed before sending (see automationEvents.js). In a dry run
// nothing is claimed or sent — it only reports whether it WOULD send.
async function nudge({ subjectId, stage, phone, built, dryRun, tally }) {
  if (tally.sent + tally.would >= MAX_SMS_PER_RUN) { tally.capped++; return; }
  if (dryRun) {
    if (!(await hasEvent(KEY, subjectId, stage))) tally.would++;
    return;
  }
  if (!(await claimEvent(KEY, subjectId, stage))) return;
  const res = await safeSendSMS({ to: phone, message: built.message });
  if (res?.success === false) { tally.failed++; await markEventFailed(KEY, subjectId, stage, res.error); } else tally.sent++;
}

export async function runSignupNudge(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const pendingHours = Number(cfg.pendingHours) > 0 ? Number(cfg.pendingHours) : 48;
  const tally = { sent: 0, would: 0, failed: 0, capped: 0 };

  // SMS is held overnight; nothing is claimed, so it resumes at 7am EAT.
  if (isQuietHoursEAT(now)) {
    return { status: 'skipped', summary: 'Quiet hours (8pm–7am EAT) — SMS held until morning.' };
  }

  // 1) Verified their phone in the signup wizard but never submitted. Those
  //    records self-delete after 2h, so only a window of the last ~2h exists.
  if (cfg.abandonedSignup !== false) {
    const started = await PhoneVerification.find({
      verified: true,
      createdAt: { $lte: new Date(now.getTime() - 30 * 60 * 1000), $gte: new Date(now.getTime() - 110 * 60 * 1000) },
    }).select('phone').lean();
    for (const pv of started) {
      const phone = toE164Kenyan(pv.phone);
      if (!phone) continue;
      // Belt and braces: registration deletes its record, but if that ever
      // fails don't tell someone who already registered to "finish".
      if (await Merchant.exists({ phone: { $in: phoneVariants(phone) } })) continue;
      await nudge({ subjectId: phone, stage: 'abandoned', phone, built: buildSignupAbandonedSms({ url: `${MERCHANT_URL}/login` }), dryRun, tally });
    }
  }

  // 2) Submitted, still waiting on review after pendingHours (but not ancient).
  const waiting = await Merchant.find({
    kybStatus: 'pending',
    submittedAt: { $lte: new Date(now.getTime() - pendingHours * HOUR), $gte: new Date(now.getTime() - 14 * DAY) },
  }).select('phone businessName name').lean();
  for (const m of waiting) {
    const phone = toE164Kenyan(m.phone);
    if (!phone) continue;
    await nudge({ subjectId: m._id, stage: 'review_delay', phone, built: buildRegistrationDelaySms({ businessName: m.businessName || m.name }), dryRun, tally });
  }

  // 3) A reviewer asked for changes and the applicant hasn't resubmitted.
  //    The request time is (resubmit-token expiry − its 7-day lifetime).
  const revisions = await Merchant.find({
    kybStatus: 'requires_revision',
    kybResubmitTokenExpires: { $gt: now },
  }).select('phone businessName name kybResubmitTokenExpires').lean();
  for (const m of revisions) {
    const requestedAt = m.kybResubmitTokenExpires.getTime() - 7 * DAY;
    if (now.getTime() - requestedAt < pendingHours * HOUR) continue;
    const phone = toE164Kenyan(m.phone);
    if (!phone) continue;
    await nudge({ subjectId: m._id, stage: 'revision', phone, built: buildRevisionNudgeSms({ businessName: m.businessName || m.name }), dryRun, tally });
  }

  const extra = `${tally.capped ? ` ${tally.capped} more next run.` : ''}${tally.failed ? ` ${tally.failed} failed to send.` : ''}`;
  return dryRun
    ? { status: 'ok', summary: `Would send ${tally.would} SMS right now.${extra}`, counts: tally }
    : { status: tally.failed && !tally.sent ? 'error' : 'ok', summary: `Sent ${tally.sent} SMS.${extra}`, counts: tally };
}
