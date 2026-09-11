// Which KYB document(s) a self-serve signup must provide, keyed by business
// type — mirrors backend/config/kybRequirements.js exactly (same shape/
// naming, unlike apps/merchant-dashboard/src/pages/Login.jsx's web-only
// 'all_plus_choice'/slots/choiceOptions naming — using the backend's own
// canonical shape here avoids introducing a third naming scheme). Enforced
// server-side too (registerMerchant) — this only drives what the form asks
// for. Keep all three in sync if this ever changes.
//
// mode: 'choice'  — upload exactly ONE of `options` (self-employed/informal
//                    businesses have no fixed registration document).
// mode: 'all'     — upload every type in `required` (formally registered
//                    entities — nothing here is optional). `choiceAlso`,
//                    when present, layers an additional choice requirement
//                    on top: exactly one of those types must ALSO be
//                    uploaded (LLC only, replacing business_permit_or_license).
export type KybRequirement =
  | { mode: 'choice'; options: string[] }
  | { mode: 'all'; required: string[]; choiceAlso?: string[] };

const SOLE_TRADER_CHOICE: KybRequirement = { mode: 'choice', options: ['national_id', 'business_permit_or_license'] };
const REGISTERED_ENTITY_ALL: KybRequirement = { mode: 'all', required: ['business_registration', 'business_permit_or_license'] };
const LLC_REQUIREMENT: KybRequirement = { mode: 'all', required: ['business_registration'], choiceAlso: ['national_id', 'kra_pin'] };

export const KYB_REQUIREMENTS_BY_BUSINESS_TYPE: Record<string, KybRequirement> = {
  'Sole Proprietorship': SOLE_TRADER_CHOICE,
  'Partnership': SOLE_TRADER_CHOICE,
  'NGO/Non-Profit': SOLE_TRADER_CHOICE,
  'Other': SOLE_TRADER_CHOICE,
  'Limited Liability Company (LLC)': LLC_REQUIREMENT,
  'SACCO': REGISTERED_ENTITY_ALL,
  'Cooperative Society': REGISTERED_ENTITY_ALL,
  'Public Limited Company (PLC)': { mode: 'all', required: ['business_registration', 'national_id', 'kra_pin'] },
};

export const ALL_KYB_DOC_TYPES = ['business_registration', 'national_id', 'national_id_front', 'national_id_back', 'kra_pin', 'business_permit_or_license'];

export const KYB_DOC_LABELS: Record<string, string> = {
  business_registration: 'Business Registration (CR12)',
  national_id: 'National ID / Passport',
  national_id_front: 'National ID / Passport (front)',
  national_id_back: 'National ID / Passport (back)',
  kra_pin: 'KRA PIN Certificate',
  business_permit_or_license: 'Business Permit or License',
};

// national_id is the one document type with two valid shapes — a single
// uploaded file, or a front+back camera-captured pair. Mirrors
// merchantAuthController.js's isDocProvided/resolveDocTypes exactly, so
// what this form considers "done" always matches what the server accepts.
// Mobile doesn't yet offer the camera front/back capture (deferred — see
// project plan), so in practice national_id_front/back never get set here
// today, but the dual-shape check is kept so this stays correct the moment
// that capability is added on top.
export function isDocSelected(type: string, signupDocs: Record<string, unknown>): boolean {
  if (type === 'national_id') {
    return !!(signupDocs.national_id || (signupDocs.national_id_front && signupDocs.national_id_back));
  }
  return !!signupDocs[type];
}

export function resolveDocTypes(type: string, signupDocs: Record<string, unknown>): string[] {
  if (type === 'national_id' && !signupDocs.national_id && signupDocs.national_id_front && signupDocs.national_id_back) {
    return ['national_id_front', 'national_id_back'];
  }
  return signupDocs[type] ? [type] : [];
}
