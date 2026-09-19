import Merchant from '../models/Merchant.js';
import { KYB_REQUIREMENTS_BY_BUSINESS_TYPE } from '../config/kybRequirements.js';
import { computePrechecks } from '../utils/applicationPrechecks.js';
import { getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { PAYBILL_NUMBER, buildPaymentDetailsSms } from '../utils/accountSmsTemplates.js';
import { EAT_OFFSET_MS } from '../utils/eatSchedule.js';
import { screenMerchantForSanctions, screenNameForSanctions } from './sanctionsListCache.js';

// On-site ("field") approval: an officer who has just visited a business can
// approve it on the spot instead of waiting for an admin — but only through
// these gates. They apply to EVERY officer approval, including the ordinary
// Approve button in the workstation, so the guardrails can't be bypassed by
// using the old path.

const CHECKLIST_KEYS = ['legalNameMatch', 'ubosIdentified', 'kraPinVerified', 'tillVerified', 'businessTypeCompliant'];
const TIER_RANK = { low: 0, medium: 1, high: 2 };

// Prechecks that are advisory for a normal reviewer but stop an on-site
// approval outright (the officer can fix the application and retry).
const HARD_PRECHECKS = new Set(['national_id_duplicate', 'documents_missing', 'kra_pin_invalid', 'kra_pin_duplicate', 'national_id_missing', 'business_type_missing']);

export class FieldApprovalError extends Error {
  constructor(status, message, blockers = null) {
    super(message);
    this.status = status;
    this.blockers = blockers;
  }
}

export const isChecklistComplete = (c) => CHECKLIST_KEYS.every((k) => c?.[k] === true);

export function dailyApprovalCap() {
  const n = Number(process.env.FIELD_APPROVAL_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function startOfEatDay(now = new Date()) {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  return new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()) - EAT_OFFSET_MS);
}

export async function approvalsToday(officerId, now = new Date()) {
  return Merchant.countDocuments({ 'fieldApproval.officerId': officerId, 'fieldApproval.approvedAt': { $gte: startOfEatDay(now) } });
}

export function paymentDetailsOf(app) {
  return {
    paybill: PAYBILL_NUMBER,
    accountNumber: getNcbaVirtualAccountNumber(app.ncbaMerchantCode) || app.ncbaMerchantCode || '',
  };
}

// What stands between this application and an on-site approval, plus the risk
// tier the system assigns. Pure read — nothing is changed or flagged here.
export async function fieldReadiness(app, officerId = null, now = new Date()) {
  const blockers = [];
  const warnings = [];

  if (app.kybStatus !== 'pending') {
    blockers.push({ code: 'not_pending', message: app.kybStatus === 'approved' ? 'This application is already approved.' : `This application is ${String(app.kybStatus).replace('_', ' ')} and cannot be approved on site.` });
  }

  const flags = await computePrechecks(app);
  for (const f of flags) {
    (f.severity === 'critical' || HARD_PRECHECKS.has(f.code) ? blockers : warnings).push({ code: f.code, message: f.message });
  }

  if (app.flagged) {
    blockers.push({ code: 'flagged', message: `This account is flagged for review: ${app.flagReason || 'see an admin'}. It needs admin approval.` });
  } else if (screenNameForSanctions(app.name) || screenNameForSanctions(app.businessName)) {
    blockers.push({ code: 'sanctions_possible_match', message: 'The owner or business name resembles an entry on a sanctions watchlist. It needs admin review.' });
  }

  // Evidence: proof of ID (the type-specific documents check is in prechecks)
  // and at least one on-site photo of the business.
  const docs = (app.kybDocuments || []).filter((d) => d.status !== 'rejected');
  const hasId = docs.some((d) => d.type === 'national_id')
    || (docs.some((d) => d.type === 'national_id_front') && docs.some((d) => d.type === 'national_id_back'));
  if (!hasId && !blockers.some((b) => b.code === 'documents_missing')) {
    blockers.push({ code: 'id_missing', message: 'Add a photo of the owner\'s National ID (front and back) to the application.' });
  }
  const photos = (app.businessPhotos || []).length;
  if (photos < 1) blockers.push({ code: 'photos_missing', message: 'Take at least one photo of the business premises.' });

  const requirement = KYB_REQUIREMENTS_BY_BUSINESS_TYPE[app.businessType];
  const registeredEntity = !!requirement && (requirement.required || []).includes('business_registration');
  const riskTier = registeredEntity || warnings.length > 0 ? 'medium' : 'low';

  let dailyUsed = null;
  const cap = dailyApprovalCap();
  if (officerId) dailyUsed = await approvalsToday(officerId, now);

  return { blockers, warnings, riskTier, evidence: { idProvided: hasId, photos }, dailyCap: cap, dailyUsed };
}

// Runs the gates and, if they all pass, approves. `finalize` is
// officerController's finalizeApproval, passed in so this module doesn't
// import the controller (which imports this). Throws FieldApprovalError with
// the status the caller should return.
export async function applyFieldApproval(app, req, finalize, { officerRisk = null } = {}) {
  if (!isChecklistComplete(app.kybChecklist)) {
    throw new FieldApprovalError(400, 'Confirm every item on the checklist before approving.');
  }

  const r = await fieldReadiness(app, req.admin._id);
  if (r.blockers.length) {
    // A possible sanctions hit is raised to admins the moment an approval is
    // attempted (the same flag+alert signup screening produces).
    if (r.blockers.some((b) => b.code === 'sanctions_possible_match')) {
      await screenMerchantForSanctions(app).catch((e) => console.error('Field-approval sanctions flag failed:', e?.message || e));
    }
    throw new FieldApprovalError(400, r.blockers[0].message, r.blockers);
  }
  if (officerRisk === 'high') {
    throw new FieldApprovalError(403, 'High-risk applications must be approved by an admin. Ask an admin to review this one.');
  }
  if (r.dailyUsed >= r.dailyCap) {
    throw new FieldApprovalError(429, `You have reached today's limit of ${r.dailyCap} on-site approvals. Remaining applications can be approved by an admin.`);
  }

  const tier = officerRisk && TIER_RANK[officerRisk] > TIER_RANK[r.riskTier] ? officerRisk : r.riskTier;
  const now = new Date();

  // Atomic claim so a double-tap (or two devices) can't approve — and send
  // the invite emails — twice.
  const claim = await Merchant.updateOne(
    { _id: app._id, kybStatus: 'pending', 'fieldApproval.approvedAt': null },
    { $set: { 'fieldApproval.approvedAt': now, 'fieldApproval.officerId': req.admin._id, 'fieldApproval.riskTier': tier, 'fieldApproval.reviewStatus': 'pending_review' } }
  );
  if (!claim.modifiedCount) throw new FieldApprovalError(409, 'This application is already being approved.');

  try {
    app.riskTier = tier;
    await finalize(app, req, {
      auditAction: 'officer.application.field_approved',
      auditPrefix: 'On-site approval by officer: ',
      auditMetadata: { fieldApproval: true, riskTier: tier, warnings: r.warnings.map((w) => w.code) },
    });
  } catch (err) {
    await Merchant.updateOne(
      { _id: app._id },
      { $set: { 'fieldApproval.approvedAt': null, 'fieldApproval.officerId': null, 'fieldApproval.riskTier': null, 'fieldApproval.reviewStatus': null } }
    );
    throw err;
  }

  const details = paymentDetailsOf(app);
  const smsResult = await sendPaymentDetailsSms(app);
  return { ...details, riskTier: tier, smsSent: smsResult === 'sent', warnings: r.warnings };
}

// Texts the merchant their Paybill + account number. Counted and spaced so it
// can't be used to spam a number (the officer can resend, but not endlessly).
// Resolves 'sent' | 'failed' | 'no_phone'.
export async function sendPaymentDetailsSms(app) {
  const phone = toE164Kenyan(app.phone);
  const { accountNumber } = paymentDetailsOf(app);
  if (!phone || !accountNumber) return 'no_phone';
  const built = buildPaymentDetailsSms({ businessName: app.businessName || app.name, accountNumber });
  const res = await safeSendSMS({ to: phone, message: built.message });
  await Merchant.updateOne(
    { _id: app._id },
    { $set: { 'fieldApproval.detailsSmsAt': new Date() }, $inc: { 'fieldApproval.detailsSmsCount': 1 } }
  );
  return res?.success === false ? 'failed' : 'sent';
}
