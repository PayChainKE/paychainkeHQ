// Which KYB document(s) a self-serve signup must provide, keyed by business
// type — enforced by registerMerchant (merchantAuthController.js). Existing
// entity types (LLC/SACCO/Cooperative/PLC) actually have a CR12 to prove
// they're registered; an unregistered sole trader or partnership doesn't,
// so they instead prove identity + trading legitimacy some other way. This
// exists specifically so someone can't register a PayChain account (and
// start moving other people's money) on nothing more than a name and an
// unverifiable claim. Mirrored in
// apps/merchant-dashboard/src/pages/Login.jsx (web) — keep both in sync.
//
// mode: 'choice'  — upload exactly ONE of `options` (self-employed/informal
//                    businesses have no fixed registration document).
// mode: 'all'     — upload every type in `required` (formally registered
//                    entities — nothing here is optional).
const SOLE_TRADER_CHOICE = { mode: 'choice', options: ['national_id', 'business_permit_or_license'] };
const REGISTERED_ENTITY_ALL = { mode: 'all', required: ['business_registration', 'business_permit_or_license'] };

export const KYB_REQUIREMENTS_BY_BUSINESS_TYPE = {
  'Sole Proprietorship': SOLE_TRADER_CHOICE,
  'Partnership': SOLE_TRADER_CHOICE,
  // Not one of the enumerated document buckets — falls back to the same
  // flexible choice as a sole trader, the safer default for an entity type
  // this codebase has no dedicated registration-certificate schema for.
  'NGO/Non-Profit': SOLE_TRADER_CHOICE,
  'Other': SOLE_TRADER_CHOICE,
  'Limited Liability Company (LLC)': REGISTERED_ENTITY_ALL,
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
// accepts.
export const ALL_KYB_DOC_TYPES = ['business_registration', 'national_id', 'kra_pin', 'business_permit_or_license'];

export const KYB_DOC_LABELS = {
  business_registration: 'Business Registration (CR12)',
  national_id: 'National ID / Passport',
  kra_pin: 'KRA PIN Certificate',
  business_permit_or_license: 'Business Permit or License',
};
