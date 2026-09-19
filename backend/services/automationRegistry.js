import Automation from '../models/Automation.js';
import { normalizeDays, parseTimeOfDay } from '../utils/eatSchedule.js';
import { sanitizeAudience } from './newsletterService.js';
import {
  buildOnboardingTipSms, buildRegistrationDelaySms, buildRevisionNudgeSms, buildSignupAbandonedSms,
} from '../utils/accountSmsTemplates.js';
import { runSignupNudge } from './automations/signupNudge.js';
import { runKybSla } from './automations/kybSla.js';
import { runOfficerDigest } from './automations/officerDigest.js';
import { runOnboardingDrip } from './automations/onboardingDrip.js';
import { runWinback } from './automations/winback.js';

function needNumber(label, v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be a number between ${min} and ${max}.`);
  return n;
}
const asBool = (v, dflt) => (v === undefined ? dflt : !!v);

const SAMPLE = { businessName: 'Mama Njeri Groceries' };

// Every admin-controllable automation is declared here: its label, its safe
// defaults, and how to validate the config an admin submits. Adding a new
// automation later = one entry here plus its runner in schedulerService.js.
export const AUTOMATIONS = {
  newsletter_digest: {
    label: 'Newsletter digest',
    description: 'Builds a newsletter from blog posts published since the last digest, on the days and time you choose.',
    defaults: {
      enabled: false,
      autoSend: false,
      config: { days: [2, 4, 6], time: '09:00', audience: { source: 'subscribers' } },
    },
    // Returns a clean config object, or throws an Error with an admin-readable message.
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      const days = normalizeDays(c.days);
      if (days.length === 0) throw new Error('Pick at least one day of the week.');
      if (days.length > 7) throw new Error('Invalid days.');
      if (!parseTimeOfDay(c.time)) throw new Error('Time must be in HH:MM (24-hour, East Africa Time).');
      return { days, time: c.time, audience: sanitizeAudience(c.audience) };
    },
  },

  signup_nudge: {
    kind: 'sweep',
    everyMinutes: 30,
    label: 'Stuck-signup nudges',
    description: 'Texts people who verified their phone but never finished signing up, and applicants who are left waiting on review or on a document fix.',
    channel: 'SMS',
    defaults: { enabled: false, autoSend: false, config: { abandonedSignup: true, pendingHours: 48 } },
    fields: [
      { key: 'abandonedSignup', label: "Nudge people who verified their phone but didn't finish signing up", type: 'toggle' },
      { key: 'pendingHours', label: 'Hours an application (or a requested fix) can wait before texting the applicant', type: 'number', min: 12, max: 168 },
    ],
    copy: () => [
      { label: 'Signup not finished', text: buildSignupAbandonedSms({ url: 'https://app.paychain.co.ke/login' }).message },
      { label: 'Waiting on review', text: buildRegistrationDelaySms(SAMPLE).message },
      { label: 'Documents need updating', text: buildRevisionNudgeSms(SAMPLE).message },
    ],
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      return { abandonedSignup: asBool(c.abandonedSignup, true), pendingHours: needNumber('Waiting hours', c.pendingHours ?? 48, 12, 168) };
    },
    run: runSignupNudge,
  },

  kyb_sla_alert: {
    kind: 'sweep',
    everyMinutes: 60,
    label: 'KYC review alerts',
    description: 'Emails all admins when a KYC application has waited too long — and the officer who onboarded it — then escalates to admins if it is still waiting.',
    channel: 'Email to admins & officers',
    defaults: { enabled: false, autoSend: false, config: { slaHours: 24, escalateHours: 48 } },
    fields: [
      { key: 'slaHours', label: 'Alert after (hours waiting)', type: 'number', min: 1, max: 336 },
      { key: 'escalateHours', label: 'Escalate to admins after (hours waiting)', type: 'number', min: 2, max: 720 },
    ],
    copy: null,
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      const slaHours = needNumber('Alert hours', c.slaHours ?? 24, 1, 336);
      const escalateHours = needNumber('Escalation hours', c.escalateHours ?? 48, 2, 720);
      if (escalateHours <= slaHours) throw new Error('Escalation must be later than the first alert.');
      return { slaHours, escalateHours };
    },
    run: runKybSla,
  },

  officer_digest: {
    kind: 'slot',
    label: 'Officer weekly digest',
    description: "Emails each officer a summary of their week (submitted, approved, still open) and sends admins a leaderboard.",
    channel: 'Email to officers & admins',
    defaults: { enabled: false, autoSend: false, config: { days: [1], time: '08:00' } },
    fields: [
      { key: 'days', label: 'Send on', type: 'days' },
      { key: 'time', label: 'Time (East Africa Time)', type: 'time' },
    ],
    copy: null,
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      const days = normalizeDays(c.days);
      if (days.length === 0) throw new Error('Pick at least one day of the week.');
      if (!parseTimeOfDay(c.time)) throw new Error('Time must be in HH:MM (24-hour, East Africa Time).');
      return { days, time: c.time };
    },
    run: runOfficerDigest,
  },

  onboarding_drip: {
    kind: 'sweep',
    everyMinutes: 60,
    label: 'Onboarding tips',
    description: 'After a merchant is approved, sends short tips on day 1, 3 and 7 — skipping any that the merchant has already done.',
    channel: 'Email and/or SMS',
    defaults: { enabled: false, autoSend: false, config: { channel: 'email', day1: true, day3: true, day7: true } },
    fields: [
      { key: 'channel', label: 'Send by', type: 'select', options: [{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'both', label: 'Email and SMS' }] },
      { key: 'day1', label: 'Day 1 — share your Paybill', type: 'toggle' },
      { key: 'day3', label: 'Day 3 — pay suppliers and staff', type: 'toggle' },
      { key: 'day7', label: 'Day 7 — get the mobile app', type: 'toggle' },
    ],
    copy: () => [
      { label: 'Day 1 (SMS)', text: buildOnboardingTipSms({ ...SAMPLE, stage: 'd1', accountNumber: '985100123456' }).message },
      { label: 'Day 3 (SMS)', text: buildOnboardingTipSms({ ...SAMPLE, stage: 'd3' }).message },
      { label: 'Day 7 (SMS)', text: buildOnboardingTipSms({ ...SAMPLE, stage: 'd7' }).message },
      { label: 'Emails', text: 'Subjects: "Start getting paid with PayChain" (day 1, includes their Paybill and account number), "Pay suppliers and staff from PayChain" (day 3), "Take PayChain with you" (day 7, Play Store link).' },
    ],
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      const channel = ['email', 'sms', 'both'].includes(c.channel) ? c.channel : 'email';
      return { channel, day1: asBool(c.day1, true), day3: asBool(c.day3, true), day7: asBool(c.day7, true) };
    },
    run: runOnboardingDrip,
  },

  winback: {
    kind: 'sweep',
    everyMinutes: 240,
    label: 'Win-back for quiet merchants',
    description: 'Emails merchants who have gone quiet — a friendly nudge at 14 days and a check-in at 30 — and flags merchants inactive for 60+ days to admins. No discounts are promised.',
    channel: 'Email; admin flag',
    defaults: { enabled: false, autoSend: false, config: { d14: true, d30: true, flagAdmins: true } },
    fields: [
      { key: 'd14', label: '14 days quiet — friendly nudge', type: 'toggle' },
      { key: 'd30', label: '30 days quiet — "what\'s in the way?" check-in', type: 'toggle' },
      { key: 'flagAdmins', label: '60+ days quiet — flag to admins', type: 'toggle' },
    ],
    copy: () => [
      { label: '14 days (email)', text: 'Subject: "Need a hand getting the most from PayChain?" — a short note saying we haven\'t seen them in a while and offering help; replies reach our team.' },
      { label: '30 days (email)', text: 'Subject: "We\'d love to have you back on PayChain" — asks what is getting in the way and promises a real person will reply. No discount or offer.' },
    ],
    validateConfig(raw) {
      const c = raw && typeof raw === 'object' ? raw : {};
      return { d14: asBool(c.d14, true), d30: asBool(c.d30, true), flagAdmins: asBool(c.flagAdmins, true) };
    },
    run: runWinback,
  },
};

export function isKnownAutomation(key) {
  return Object.prototype.hasOwnProperty.call(AUTOMATIONS, key);
}

// Returns the stored row for `key`, creating it with the registry's defaults
// on first use (so a fresh database needs no seeding and nothing runs until
// an admin deliberately switches it on).
export async function getOrCreateAutomation(key) {
  if (!isKnownAutomation(key)) throw new Error(`Unknown automation: ${key}`);
  const d = AUTOMATIONS[key].defaults;
  return Automation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, enabled: d.enabled, autoSend: d.autoSend, config: d.config } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}
