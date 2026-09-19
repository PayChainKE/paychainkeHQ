// Account/onboarding SMS — distinct from payment-event SMS in
// paymentSmsTemplates.js (that file is deliberately scoped to STK/C2B/NCBA
// payment confirmations only). Kept in step with sendWelcomeEmail's copy in
// utils/resend.js: same Paybill number, same account-number fallback logic,
// so a merchant never sees the email and SMS disagree.
import { buildStrictSms } from './smsSanitizer.js';

// Hardcoded to match utils/resend.js's welcome/invite emails, which also
// hardcode this rather than import NCBA_STK_BUSINESS_NUMBER from
// services/ncbaStkPushService.js — every merchant-facing "here's your
// Paybill" surface in the app currently sources it the same (fixed) way,
// so this stays consistent with that rather than introducing a second,
// independently-configurable source that could drift from the emails.
const PAYBILL_NUMBER = '880100';

/**
 * Sent once, right after a merchant's account becomes usable — self-signup
 * (registerMerchant) or an admin-invited merchant finishing setupPassword.
 * Gives them their Paybill + account number by SMS as well as email, since
 * a merchant may see the SMS first (or at all, if the welcome email lands
 * in spam) and wants to start sharing payment details immediately.
 *
 * `accountNumber` should already be resolved by the caller the same way
 * sendWelcomeEmail resolves it: `ncbaVirtualAccountNumber || ncbaMerchantCode`
 * (full 12-digit if NCBA's institution prefix is configured, else the
 * interim 8-digit merchant code) — this function doesn't re-derive it, so
 * it can never disagree with what the email shows.
 *
 * @param {{ businessName?: string|null, accountNumber: string, accountIsInterim?: boolean }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildMerchantWelcomeSms({ businessName, accountNumber, accountIsInterim = false }) {
  return buildStrictSms(
    ({ name, paybill, account, interimNote }) =>
      `Welcome to PayChain, ${name}! Your M-PESA Paybill is ${paybill}, Account No. ${account}${interimNote}.`,
    {
      fixed: {
        paybill: PAYBILL_NUMBER,
        account: accountNumber,
        // Same "temporary" framing as the email's accountIsInterim branch —
        // never claim a pending 8-digit code is the merchant's final account
        // number. Shortened from the email's own wording ("temporary,
        // upgrades automatically") to buy back segment budget.
        interimNote: accountIsInterim ? ' (temporary)' : '',
      },
      truncatable: [{ key: 'name', value: businessName || 'valued merchant' }],
    }
  );
}

/**
 * Sent right after a self-serve signup is submitted, while it waits in the
 * KYC review queue (see merchantAuthController.js#registerMerchant). The
 * only message a merchant gets between "I registered" and "I was approved",
 * so it says plainly that the application landed and that they'll be told
 * when it's done — no login/next-step instructions, since there's nothing
 * to do yet.
 *
 * @param {{ businessName?: string|null }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildRegistrationReceivedSms({ businessName }) {
  return buildStrictSms(
    ({ name }) =>
      `PayChain: Hi ${name}, we have received your registration and it is under review. We will notify you once your account is activated.`,
    { truncatable: [{ key: 'name', value: businessName || 'there' }] }
  );
}

/**
 * Sent once an application clears admin/officer KYB review (see
 * officerController.js#approveApplication). Deliberately just "you're
 * approved" — the Paybill/account number go out separately in
 * buildMerchantWelcomeSms once the merchant has set their password, and
 * again in the invite email, so repeating them here only made this longer.
 *
 * A merchant who has no password yet (every self-serve signup and
 * officer-originated application) can't log in until they set one, so for
 * them `setupLink` — the secure one-time `/setup-password?token=...` link —
 * is what actually lets them in and MUST be included; no password or code
 * is ever put in the SMS itself. A merchant who already has a password gets
 * the plain version with no link.
 *
 * @param {{ businessName?: string|null, setupLink?: string|null }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildAccountApprovedSms({ businessName, setupLink = null }) {
  return buildStrictSms(
    ({ name, url }) =>
      url
        ? `PayChain: Hi ${name}, your account has been approved. Set your password to get started: ${url}`
        : `PayChain: Hi ${name}, your account has been approved. You can now start using PayChain.`,
    {
      fixed: { url: setupLink || '' },
      truncatable: [{ key: 'name', value: businessName || 'there' }],
    }
  );
}

/**
 * Admin-triggered nudge (Merchants page → "Resend Install Link") for a
 * merchant who hasn't installed the web app (PWA) yet — see
 * Merchant.pwaInstalledAt and apps/merchant-dashboard's useInstallPrompt.js.
 * Deliberately doesn't repeat the Paybill/account details from
 * buildMerchantWelcomeSms above — this is purely about getting them onto
 * the home-screen app, not a payment-details reminder.
 *
 * @param {{ businessName?: string|null, loginUrl: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildInstallReminderSms({ businessName, loginUrl }) {
  return buildStrictSms(
    ({ name, url }) =>
      `Hi ${name}, install the PayChain app: open this link on your phone, log in, and add to your home screen. ${url}`,
    {
      fixed: { url: loginUrl },
      truncatable: [{ key: 'name', value: businessName || 'there' }],
    }
  );
}

/**
 * Fired the moment utils/newDeviceLoginAlert.js sees a successful login
 * from a device+IP fingerprint it hasn't recorded for this merchant before
 * — the SMS companion to sendNewDeviceLoginEmail (utils/resend.js). No
 * business name or IP/device string here (that detail is in the email) —
 * SMS segment budget is precious and fixed-text needs no truncation logic,
 * so this one skips buildStrictSms entirely.
 *
 * @returns {{ message: string, truncated: false, length: number }}
 */
export function buildNewDeviceLoginSms() {
  const message = "PayChain Security: New sign-in to your account from a device we haven't seen before. Wasn't you? Contact support@paychain.co.ke now.";
  return { message, truncated: false, length: message.length };
}

/**
 * Sent to a phone number entered in the signup wizard, before an
 * application (or a Merchant document) exists at all — proves the
 * applicant controls that number. See models/PhoneVerification.js. Fixed
 * text plus a 6-digit code, no truncatable content, so this skips
 * buildStrictSms entirely — same reasoning as buildNewDeviceLoginSms above.
 *
 * @param {{ otp: string }} params
 * @returns {{ message: string, truncated: false, length: number }}
 */
export function buildSignupPhoneOtpSms({ otp }) {
  const message = `PayChain: Your verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`;
  return { message, truncated: false, length: message.length };
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ke.co.paychain.app';

/**
 * Sent to someone who verified their phone in the signup wizard but never
 * submitted the application (see services/automations/signupNudge.js). There
 * is no merchant record yet, so no name — just a link back in.
 *
 * @param {{ url: string }} params
 */
export function buildSignupAbandonedSms({ url }) {
  const message = `PayChain: You started creating a PayChain account but did not finish. Continue here: ${url}`;
  return { message, truncated: false, length: message.length };
}

/**
 * A self-serve application that has been waiting on review longer than
 * expected. Reassurance only — no promise of a time.
 */
export function buildRegistrationDelaySms({ businessName }) {
  return buildStrictSms(
    ({ name }) => `PayChain: Hi ${name}, thank you for your patience. Your registration is still under review and we will notify you as soon as it is done.`,
    { truncatable: [{ key: 'name', value: businessName || 'there' }] }
  );
}

/**
 * A reviewer asked the applicant to fix documents and they haven't yet. The
 * resubmit link is in the email (its raw token is never stored, so an SMS
 * can't carry it) — this points them back to it.
 */
export function buildRevisionNudgeSms({ businessName }) {
  return buildStrictSms(
    ({ name }) => `PayChain: Hi ${name}, your registration needs a few updates before we can approve it. Please use the link we emailed you to resubmit.`,
    { truncatable: [{ key: 'name', value: businessName || 'there' }] }
  );
}

/**
 * Onboarding drip texts, one per stage after approval ('d1' | 'd3' | 'd7').
 * d1 carries the merchant's Paybill + account number (same source as the
 * welcome SMS/email); d7 links the Play Store listing.
 */
export function buildOnboardingTipSms({ businessName, stage, accountNumber = '' }) {
  if (stage === 'd1') {
    return buildStrictSms(
      ({ name, paybill, account }) => `PayChain: Hi ${name}, share your Paybill ${paybill}, Account No. ${account}, with customers to start receiving payments.`,
      { fixed: { paybill: PAYBILL_NUMBER, account: accountNumber }, truncatable: [{ key: 'name', value: businessName || 'there' }] }
    );
  }
  if (stage === 'd3') {
    return buildStrictSms(
      ({ name }) => `PayChain: Hi ${name}, you can pay suppliers and staff straight from PayChain. Open the app to send your first payment.`,
      { truncatable: [{ key: 'name', value: businessName || 'there' }] }
    );
  }
  return buildStrictSms(
    ({ name, url }) => `PayChain: Hi ${name}, run your business from your phone. Get the PayChain app: ${url}`,
    { fixed: { url: PLAY_STORE_URL }, truncatable: [{ key: 'name', value: businessName || 'there' }] }
  );
}
