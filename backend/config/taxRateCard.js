// Kenya's standard resident corporate income tax rate (Income Tax Act).
// Single source of truth for the tax-liability estimator on the admin
// Bookkeeping/Tax & Compliance pages — never inline this number anywhere
// else. If PayChain's actual rate ever differs (e.g. a reduced rate under
// a special regime), change it here only.
export const CORPORATE_TAX_RATE = 0.30;
