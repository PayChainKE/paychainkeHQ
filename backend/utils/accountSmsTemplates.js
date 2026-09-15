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
 * Sent once an application clears admin/officer KYB review — the
 * self-serve/officer-application counterpart to buildMerchantWelcomeSms
 * above, for merchants who never got a password at signup and are only now
 * gaining real account access (see officerController.js#approveApplication).
 * Carries the same Paybill/account details as the email, plus the secure
 * one-time setup-password link (`/setup-password?token=...`) — no password
 * or code is ever put in the SMS itself, only the link.
 *
 * @param {{ businessName?: string|null, accountNumber: string, accountIsInterim?: boolean, setupLink: string }} params
 * @returns {{ message: string, truncated: boolean, length: number }}
 */
export function buildAccountApprovedSms({ businessName, accountNumber, accountIsInterim = false, setupLink }) {
  return buildStrictSms(
    ({ name, paybill, account, interimNote, url }) =>
      `PayChain: ${name}, your application is approved! Paybill ${paybill}, Account No. ${account}${interimNote}. Set your password to log in: ${url}`,
    {
      fixed: {
        paybill: PAYBILL_NUMBER,
        account: accountNumber,
        interimNote: accountIsInterim ? ' (temporary)' : '',
        url: setupLink,
      },
      truncatable: [{ key: 'name', value: businessName || 'valued merchant' }],
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
