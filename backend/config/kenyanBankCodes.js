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
  { code: '01096', name: 'NCBA Bank' },
  { code: 'KCBLKENX', name: 'KCB Bank (SWIFT — appears as a RTGS BeneficiaryBankBIC example, not confirmed for PesaLink)' },
];

export function isKnownBankCode(code) {
  return KENYAN_BANK_CODES.some((b) => b.code === String(code ?? '').trim());
}
