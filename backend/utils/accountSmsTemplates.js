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
      `Welcome to PayChain, ${name}! Your merchant account is now active. Receive M-PESA payments via Paybill ${paybill}, Account No. ${account}${interimNote}. Share these details with your customers. Thank you for choosing PayChain.`,
    {
      fixed: {
        paybill: PAYBILL_NUMBER,
        account: accountNumber,
        // Same "temporary, upgrades automatically" framing as the email's
        // accountIsInterim branch — never claim a pending 8-digit code is
        // the merchant's final account number.
        interimNote: accountIsInterim ? ' (temporary, upgrades automatically)' : '',
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
      `Hi ${name}, install the PayChain app for instant access. No need to open your browser every time. Open this link on your phone and log in: ${url}. Then add it to your home screen when prompted.`,
    {
      fixed: { url: loginUrl },
      truncatable: [{ key: 'name', value: businessName || 'there' }],
    }
  );
}
