// Kenyan bank clearing codes accepted by NCBA's PesaLink/EFT rails, used as
// `BeneficiaryBankBIC` on payment payloads and `targetPic` on PesaLink
// validation. Per NCBA's Open Banking UAT Guide, these are the Central Bank
// of Kenya clearing code "prefixed with 00 (zero zero)" — e.g. Equity's
// real clearing code is 68, sent as "0068".
//
// INCOMPLETE — seeded only from the handful of codes visible in NCBA's
// Postman collection / UAT Guide examples. NCBA hasn't supplied the full
// bank-code table; reconcile against it (or NCBA support) before going live
// with a bank not listed here.
export const KENYAN_BANK_CODES = [
  { code: '0068', name: 'Equity Bank' },
  // NCBA's own PesaLink BeneficiaryBankBIC — 07000, confirmed directly by
  // NCBA via email 2026-07-30 (supersedes the earlier unconfirmed '01096'
  // guess this file carried, which didn't match the "00"-prefix pattern
  // above and was never verified against NCBA's own documentation).
  { code: '07000', name: 'NCBA Bank' },
  // Code is KCB's SWIFT BIC (confirmed as an RTGS BeneficiaryBankBIC example
  // in NCBA's docs) — not yet confirmed valid for the local PesaLink/EFT
  // rail, which expects a "00"-prefixed CBK clearing code like the two
  // above. Flagged here rather than in the display name.
  { code: 'KCBLKENX', name: 'KCB Bank' },
];

export function isKnownBankCode(code) {
  return KENYAN_BANK_CODES.some((b) => b.code === String(code ?? '').trim());
}
