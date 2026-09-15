// Which KYB document(s) a self-serve signup must provide, keyed by business
// type — mirrors backend/config/kybRequirements.js exactly (same shape/
// naming, unlike apps/merchant-dashboard/src/pages/Login.jsx's web-only
// slots/choiceOptions naming — using the backend's own canonical shape
// here avoids introducing a third naming scheme). Enforced server-side too
// (registerMerchant) — this only drives what the form asks for. Keep all
// three in sync if this ever changes.
//
// National ID is a core requirement for every business type (2026-09-15)
// — no combination of other documents can substitute for it. `optional`
// documents are collected and stored if the merchant provides them, but
// never block submission if they don't (2026-09-15: business_permit_or_
// license moved here for every type that used to require it, and the KRA
// PIN Certificate document requirement was dropped entirely for LLC/PLC —
// CR12 + National ID is the compulsory pair for both now). With national_id
// no longer part of any choice, every requirement below is mode 'all' —
// mode 'choice'/`choiceAlso` are unused for now but kept as machinery in
// case a future business type still needs them.
//
// mode: 'choice'  — upload exactly ONE of `options`.
// mode: 'all'     — upload every type in `required`. `optional`, when
//                    present, is collected if provided but never blocks
//                    submission. `choiceAlso`, when present, layers an
//                    additional choice requirement on top: exactly one of
//                    those types must ALSO be uploaded.
export type KybRequirement =
  | { mode: 'choice'; options: string[] }
  | { mode: 'all'; required: string[]; optional?: string[]; choiceAlso?: string[] };

const SOLE_TRADER_REQUIREMENT: KybRequirement = { mode: 'all', required: ['national_id'], optional: ['business_permit_or_license'] };
const REGISTERED_ENTITY_ALL: KybRequirement = { mode: 'all', required: ['business_registration', 'national_id'], optional: ['business_permit_or_license'] };
// LLC's directors are its accountable individuals — CR12 and the
// Director's own National ID are mandatory. No KRA PIN Certificate
// requirement (removed 2026-09-15) — the separate KRA PIN text field
// elsewhere on the form is unrelated and stays as-is.
const LLC_REQUIREMENT: KybRequirement = { mode: 'all', required: ['business_registration', 'national_id'] };

export const KYB_REQUIREMENTS_BY_BUSINESS_TYPE: Record<string, KybRequirement> = {
  'Sole Proprietorship': SOLE_TRADER_REQUIREMENT,
  'Partnership': SOLE_TRADER_REQUIREMENT,
  'NGO/Non-Profit': SOLE_TRADER_REQUIREMENT,
  'Other': SOLE_TRADER_REQUIREMENT,
  'Limited Liability Company (LLC)': LLC_REQUIREMENT,
  'SACCO': REGISTERED_ENTITY_ALL,
  'Cooperative Society': REGISTERED_ENTITY_ALL,
  // Same requirement as LLC: CR12 + National ID compulsory, no KRA PIN
  // Certificate requirement.
  'Public Limited Company (PLC)': { mode: 'all', required: ['business_registration', 'national_id'] },
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

// national_id always resolves to a front+back pair — whether the merchant
// uploads existing files or takes photos, both sides are required either
// way. Mirrors merchantAuthController.js's isDocProvided/resolveDocTypes:
// the backend still separately accepts a single combined `national_id`
// file for any caller that isn't this form, so this is a frontend-only
// tightening, not a backend requirement change.
export function isDocSelected(type: string, signupDocs: Record<string, unknown>): boolean {
  if (type === 'national_id') {
    return !!(signupDocs.national_id_front && signupDocs.national_id_back);
  }
  return !!signupDocs[type];
}

export function resolveDocTypes(type: string, signupDocs: Record<string, unknown>): string[] {
  if (type === 'national_id') {
    return (signupDocs.national_id_front && signupDocs.national_id_back) ? ['national_id_front', 'national_id_back'] : [];
  }
  return signupDocs[type] ? [type] : [];
}
