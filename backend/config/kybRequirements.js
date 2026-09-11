// Which KYB document(s) a self-serve signup must provide, keyed by business
// type — enforced by registerMerchant (merchantAuthController.js). Existing
// entity types (LLC/SACCO/Cooperative/PLC) actually have a CR12 to prove
// they're registered; an unregistered sole trader or partnership doesn't,
// so they instead prove identity + trading legitimacy some other way. This
// exists specifically so someone can't register a PayChain account (and
// start moving other people's money) on nothing more than a name and an
// unverifiable claim. Mirrored in apps/merchant-dashboard/src/pages/Login.jsx
// (web, different naming: mode 'all_plus_choice'/slots/choiceOptions) and
// apps/mobile-app/src/utils/kybRequirements.ts (mobile, same naming as
// here) — keep all three in sync.
//
// mode: 'choice'  — upload exactly ONE of `options` (self-employed/informal
//                    businesses have no fixed registration document).
// mode: 'all'     — upload every type in `required` (formally registered
//                    entities — nothing here is optional).
const SOLE_TRADER_CHOICE = { mode: 'choice', options: ['national_id', 'business_permit_or_license'] };
const REGISTERED_ENTITY_ALL = { mode: 'all', required: ['business_registration', 'business_permit_or_license'] };
// LLC's directors are its accountable individuals — a business permit/
// license isn't something every LLC actually holds (many operate without
// one), unlike CR12 and personal/company identity documents, which every
// registered LLC and its directors always have. `choiceAlso` layers a
// choice requirement on top of `required`: CR12 is always mandatory, plus
// exactly one of Director's ID or the company's own KRA PIN Certificate
// (2026-09-10, replaces business_permit_or_license for LLC specifically).
const LLC_REQUIREMENT = { mode: 'all', required: ['business_registration'], choiceAlso: ['national_id', 'kra_pin'] };

export const KYB_REQUIREMENTS_BY_BUSINESS_TYPE = {
  'Sole Proprietorship': SOLE_TRADER_CHOICE,
  'Partnership': SOLE_TRADER_CHOICE,
  // Not one of the enumerated document buckets — falls back to the same
  // flexible choice as a sole trader, the safer default for an entity type
  // this codebase has no dedicated registration-certificate schema for.
  'NGO/Non-Profit': SOLE_TRADER_CHOICE,
  'Other': SOLE_TRADER_CHOICE,
  'Limited Liability Company (LLC)': LLC_REQUIREMENT,
  'SACCO': REGISTERED_ENTITY_ALL,
  'Cooperative Society': REGISTERED_ENTITY_ALL,
  // A PLC's directors are its accountable individuals (unlike an LLC's,
  // which can be another company) — a real KRA certificate is also
  // realistically obtainable for an entity this formal, unlike a sole
  // trader who may not have one yet.
  'Public Limited Company (PLC)': { mode: 'all', required: ['business_registration', 'national_id', 'kra_pin'] },
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
