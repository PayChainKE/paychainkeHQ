// Which KYB document(s) a self-serve signup must provide, keyed by business
// type — enforced by registerMerchant (merchantAuthController.js). Existing
// entity types (LLC/SACCO/Cooperative/PLC) actually have a CR12 to prove
// they're registered; an unregistered sole trader or partnership doesn't,
// so they instead prove identity + trading legitimacy some other way. This
// exists specifically so someone can't register a PayChain account (and
// start moving other people's money) on nothing more than a name and an
// unverifiable claim. Mirrored in apps/merchant-dashboard/src/pages/Login.jsx
// (web, different naming: slots/choiceOptions) and
// apps/mobile-app/src/utils/kybRequirements.ts (mobile, same naming as
// here) — keep all three in sync.
//
// National ID is a core requirement for every business type (2026-09-15) —
// no combination of other documents can substitute for it. `optional`
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
//                    submission.
const SOLE_TRADER_REQUIREMENT = { mode: 'all', required: ['national_id'], optional: ['business_permit_or_license'] };
const REGISTERED_ENTITY_ALL = { mode: 'all', required: ['business_registration', 'national_id'], optional: ['business_permit_or_license'] };
// LLC's directors are its accountable individuals — CR12 (business_
// registration) and the Director's own National ID are mandatory. No KRA
// PIN Certificate requirement (removed 2026-09-15) — the separate `kraPin`
// text field elsewhere on the form is unrelated and stays as-is.
const LLC_REQUIREMENT = { mode: 'all', required: ['business_registration', 'national_id'] };

export const KYB_REQUIREMENTS_BY_BUSINESS_TYPE = {
  'Sole Proprietorship': SOLE_TRADER_REQUIREMENT,
  'Partnership': SOLE_TRADER_REQUIREMENT,
  // Not one of the enumerated document buckets — falls back to the same
  // requirement as a sole trader, the safer default for an entity type
  // this codebase has no dedicated registration-certificate schema for.
  'NGO/Non-Profit': SOLE_TRADER_REQUIREMENT,
  'Other': SOLE_TRADER_REQUIREMENT,
  'Limited Liability Company (LLC)': LLC_REQUIREMENT,
  'SACCO': REGISTERED_ENTITY_ALL,
  'Cooperative Society': REGISTERED_ENTITY_ALL,
  // A PLC's directors are its accountable individuals (unlike an LLC's,
  // which can be another company) — same requirement as LLC otherwise: CR12
  // + National ID compulsory, no KRA PIN Certificate requirement.
  'Public Limited Company (PLC)': { mode: 'all', required: ['business_registration', 'national_id'] },
};

// Every document type any requirement above can reference — the full set
// of possible `doc_<type>` multipart fields registerMerchant's route
// accepts. national_id_front/national_id_back are never referenced in a
// requirement above directly (every requirement still just says
// 'national_id') — they're the two-photo alternative registerMerchant
// accepts in place of a single national_id file when the merchant used
// the signup form's front/back camera capture flow instead of uploading
// one pre-scanned file. See resolveDocTypes/isDocProvided in
// merchantAuthController.js.
export const ALL_KYB_DOC_TYPES = ['business_registration', 'national_id', 'national_id_front', 'national_id_back', 'kra_pin', 'business_permit_or_license'];

export const KYB_DOC_LABELS = {
  business_registration: 'Business Registration (CR12)',
  national_id: 'National ID / Passport',
  national_id_front: 'National ID / Passport (front)',
  national_id_back: 'National ID / Passport (back)',
  kra_pin: 'KRA PIN Certificate',
  business_permit_or_license: 'Business Permit or License',
};
