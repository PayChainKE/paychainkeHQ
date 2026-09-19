import Merchant from '../../models/Merchant.js';
import { toE164Kenyan } from '../../utils/notificationService.js';
import { safeSendSMS } from '../../utils/smsSanitizer.js';
import { isQuietHoursEAT } from '../../utils/quietHours.js';
import { buildOnboardingTipSms } from '../../utils/accountSmsTemplates.js';
import { getNcbaVirtualAccountNumber } from '../../utils/ncbaValidators.js';
import { sendMerchantLifecycleEmail } from '../../utils/resend.js';
import { unsubscribeUrl } from '../../utils/unsubscribeToken.js';
import { claimEvent, hasEvent, markEventFailed } from '../automationEvents.js';
import {
  DAY, MAX_EMAIL_PER_RUN, MAX_SMS_PER_RUN, MERCHANT_URL, PLAY_STORE_URL,
  activityFlagsByMerchant, esc,
} from './common.js';

const KEY = 'onboarding_drip';
const PAYBILL = '880100';

const STAGES = [
  { id: 'd1', cfg: 'day1', days: 1 },
  { id: 'd3', cfg: 'day3', days: 3 },
  { id: 'd7', cfg: 'day7', days: 7 },
];

function accountNumberOf(m) {
  return getNcbaVirtualAccountNumber(m.ncbaMerchantCode) || m.ncbaMerchantCode || '';
}

function emailContent(stage, m) {
  const name = esc(m.businessName || m.name || 'there');
  if (stage === 'd1') {
    return {
      subject: 'Start getting paid with PayChain',
      heading: 'Share your Paybill to get your first payment',
      paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${name},</p><p style="margin:0 0 14px;">Your PayChain account is ready. Customers can pay you by M-PESA using:</p><p style="margin:0 0 14px;padding:14px 18px;background:#f4f7f5;border-radius:12px;"><strong>Paybill:</strong> ${PAYBILL}<br><strong>Account No.:</strong> ${esc(accountNumberOf(m))}</p><p style="margin:0;">Put these on your invoices, share them on WhatsApp, or display them at the till.</p>`,
      ctaLabel: 'Open PayChain', ctaUrl: `${MERCHANT_URL}/login`,
    };
  }
  if (stage === 'd3') {
    return {
      subject: 'Pay suppliers and staff from PayChain',
      heading: 'Move your money where it needs to go',
      paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${name},</p><p style="margin:0;">You can pay suppliers, staff and bills straight from your PayChain balance — send to M-PESA numbers, pay bills, or pay many people at once with Bulk Pay.</p>`,
      ctaLabel: 'Send your first payment', ctaUrl: `${MERCHANT_URL}/login`,
    };
  }
  return {
    subject: 'Take PayChain with you',
    heading: 'Run your business from your phone',
    paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${name},</p><p style="margin:0;">The PayChain mobile app lets you check payments and send money wherever you are.</p>`,
    ctaLabel: 'Get the Android app', ctaUrl: PLAY_STORE_URL,
  };
}

// Day 1 / 3 / 7 after approval. Each stage is skipped when the merchant has
// already done what it suggests (already paid → skip "share your Paybill";
// already sent money → skip "pay suppliers"; PWA installed → skip "get the
// app"), and only sent inside a 2-day window after its day, so switching this
// on never mails merchants approved months ago. Each channel is claimed and
// sent independently.
export async function runOnboardingDrip(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const channel = ['email', 'sms', 'both'].includes(cfg.channel) ? cfg.channel : 'email';
  const wantEmail = channel === 'email' || channel === 'both';
  const wantSms = channel === 'sms' || channel === 'both';
  const quiet = isQuietHoursEAT(now);
  const tally = { email: 0, sms: 0, failed: 0, heldQuiet: 0, capped: 0 };

  const merchants = await Merchant.find({
    kybStatus: 'approved',
    isVerified: true,
    status: { $ne: 'locked' },
    reviewedAt: { $gte: new Date(now.getTime() - 9 * DAY), $lte: new Date(now.getTime() - 1 * DAY) },
  }).select('email phone name businessName ncbaMerchantCode reviewedAt pwaInstalledAt newsletterOptOut').lean();

  const flags = await activityFlagsByMerchant(merchants.map((m) => m._id));

  for (const m of merchants) {
    const age = now.getTime() - m.reviewedAt.getTime();
    const f = flags.get(String(m._id)) || { received: false, paidOut: false };
    for (const st of STAGES) {
      if (cfg[st.cfg] === false) continue;
      if (age < st.days * DAY || age >= (st.days + 2) * DAY) continue;
      if (st.id === 'd1' && (f.received || !accountNumberOf(m))) continue;
      if (st.id === 'd3' && f.paidOut) continue;
      if (st.id === 'd7' && m.pwaInstalledAt) continue;

      if (wantEmail && m.email && !m.newsletterOptOut) {
        if (tally.email >= MAX_EMAIL_PER_RUN) { tally.capped++; }
        else if (dryRun) { if (!(await hasEvent(KEY, m._id, `${st.id}:email`))) tally.email++; }
        else if (await claimEvent(KEY, m._id, `${st.id}:email`)) {
          try {
            await sendMerchantLifecycleEmail(m.email, { ...emailContent(st.id, m), unsubscribeUrl: unsubscribeUrl('m', m._id) });
            tally.email++;
          } catch (e) { tally.failed++; await markEventFailed(KEY, m._id, `${st.id}:email`, e?.message); }
        }
      }

      const phone = wantSms ? toE164Kenyan(m.phone) : null;
      if (phone) {
        if (quiet) { tally.heldQuiet++; }
        else if (tally.sms >= MAX_SMS_PER_RUN) { tally.capped++; }
        else if (dryRun) { if (!(await hasEvent(KEY, m._id, `${st.id}:sms`))) tally.sms++; }
        else if (await claimEvent(KEY, m._id, `${st.id}:sms`)) {
          const built = buildOnboardingTipSms({ businessName: m.businessName || m.name, stage: st.id, accountNumber: accountNumberOf(m) });
          const res = await safeSendSMS({ to: phone, message: built.message });
          if (res?.success === false) { tally.failed++; await markEventFailed(KEY, m._id, `${st.id}:sms`, res.error); } else tally.sms++;
        }
      }
    }
  }

  const parts = [`${tally.email} email${tally.email === 1 ? '' : 's'}`, `${tally.sms} SMS`];
  const extra = `${tally.heldQuiet ? ` ${tally.heldQuiet} SMS held for quiet hours.` : ''}${tally.capped ? ` ${tally.capped} more next run.` : ''}${tally.failed ? ` ${tally.failed} failed.` : ''}`;
  return dryRun
    ? { status: 'ok', summary: `Would send ${parts.join(' and ')}.${extra}`, counts: tally }
    : { status: tally.failed && !tally.email && !tally.sms ? 'error' : 'ok', summary: `Sent ${parts.join(' and ')}.${extra}`, counts: tally };
}
