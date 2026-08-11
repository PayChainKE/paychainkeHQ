// Kenyan bank clearing codes accepted by NCBA's PesaLink/EFT rails, used as
// `BeneficiaryBankBIC` on payment payloads and `targetPic` on PesaLink
// validation. Per NCBA's Open Banking UAT Guide, these are the Central Bank
// of Kenya clearing code "prefixed with 00 (zero zero)" — e.g. Equity's
// real clearing code is 68, sent as "0068".
//
// The bulk of this list (everything below the first three) is sourced from
// the Kenya Bankers' Association's own "Bank Branch Address Listing" PDF
// (14 October 2011, in API documents/), which publishes each bank's 2-digit
// CBK clearing code under a "BANK : XX - <name>" heading per bank. Equity's
// code there (68) matches NCBA's own confirmed '0068' below exactly, which
// is the validation that the "00" + KBA-code pattern is the right one.
//
// That document is from 2011, so it was deliberately NOT used as-is: every
// bank below was checked against what's happened to it since, and left out
// entirely if there was real doubt about whether its old code still routes
// correctly today. Left OUT for that reason: Commercial Bank of Africa (07,
// merged into NCBA in 2019 — superseded by NCBA's own confirmed 07000 code
// below), NIC Bank (41, same 2019 merger), Habib Bank Ltd (08, absorbed
// into Diamond Trust Bank 2017), Giro Commercial Bank (42, merged into I&M
// 2017), Guardian Bank (55, merged into I&M 2020), Fina Bank (53, acquired
// by Guaranty Trust Bank 2013 — brand and possibly code both changed),
// Trans-National Bank (26, absorbed into Access Bank Kenya 2019), Chase
// Bank (30, put under receivership 2016 and absorbed into SBM Bank Kenya
// 2018), Imperial Bank (39, under CBK receivership since 2015), Equatorial
// Commercial Bank (49, absorbed into Spire Bank then liquidated), Dubai
// Bank (20, liquidated 2015), and Central Bank of Kenya (09 — the
// regulator itself, not a payout destination). Banks that only entered the
// Kenyan market after 2011 (e.g. SBM Bank Kenya) aren't in the 2011
// document at all, so they're simply not here yet either.
//
// STILL WORTH RECONCILING against NCBA directly (or a current KBA listing)
// before relying on any of this for a real payout — clearing codes are
// generally stable across a rename/ownership change, but "generally" isn't
// "confirmed", and this file's own history already has one example
// (KCBLKENX below) of a plausible-looking code that turned out to be the
// wrong rail's identifier.
export const KENYAN_BANK_CODES = [
  { code: '0068', name: 'Equity Bank' },
  // NCBA's own PesaLink BeneficiaryBankBIC — 07000, confirmed directly by
  // NCBA via email 2026-07-30 (supersedes the earlier unconfirmed '01096'
  // guess this file carried, which didn't match the "00"-prefix pattern
  // above and was never verified against NCBA's own documentation).
  { code: '07000', name: 'NCBA Bank' },
  // Was 'KCBLKENX' (KCB's SWIFT BIC, an RTGS example in NCBA's docs, not
  // confirmed for PesaLink/EFT) — replaced with KCB's actual CBK clearing
  // code from the KBA listing (bank code 01), matching the "00"-prefix
  // pattern every other entry here uses.
  { code: '0001', name: 'KCB Bank' },
  { code: '0002', name: 'Standard Chartered Bank Kenya' },
  // KBA lists this as "Barclays Bank of Kenya" (its 2011 name) — same
  // institution, rebranded Absa Bank Kenya in 2020.
  { code: '0003', name: 'Absa Bank Kenya' },
  { code: '0005', name: 'Bank of India' },
  { code: '0006', name: 'Bank of Baroda (Kenya)' },
  { code: '0010', name: 'Prime Bank' },
  { code: '0011', name: 'Co-operative Bank of Kenya' },
  { code: '0012', name: 'National Bank of Kenya' },
  // KBA lists this as "Oriental Commercial Bank" — rebranded M-Oriental Bank.
  { code: '0014', name: 'M-Oriental Bank' },
  { code: '0016', name: 'Citibank N.A. Kenya' },
  { code: '0017', name: 'Habib Bank AG Zurich' },
  { code: '0018', name: 'Middle East Bank Kenya' },
  { code: '0019', name: 'Bank of Africa Kenya' },
  { code: '0023', name: 'Consolidated Bank of Kenya' },
  { code: '0025', name: 'Credit Bank' },
  // KBA lists this as "CfC Stanbic Bank Kenya" — dropped "CfC" from the name
  // once Stanbic took full ownership.
  { code: '0031', name: 'Stanbic Bank Kenya' },
  { code: '0035', name: 'African Banking Corporation (ABC Bank)' },
  { code: '0043', name: 'Ecobank Kenya' },
  // KBA lists this as "Paramount Universal Bank" — now Paramount Bank.
  { code: '0050', name: 'Paramount Bank' },
  // KBA lists this as "Jamii Bora Bank" — acquired by Co-operative Bank and
  // rebranded Kingdom Bank in 2020.
  { code: '0051', name: 'Kingdom Bank' },
  { code: '0054', name: 'Victoria Commercial Bank' },
  { code: '0057', name: 'I&M Bank' },
  { code: '0059', name: 'Development Bank of Kenya' },
  { code: '0060', name: 'Fidelity Commercial Bank' },
  { code: '0063', name: 'Diamond Trust Bank (DTB)' },
  // KBA lists this as "K-Rep Bank" — rebranded Sidian Bank in 2014.
  { code: '0066', name: 'Sidian Bank' },
  { code: '0070', name: 'Family Bank' },
  { code: '0072', name: 'Gulf African Bank' },
  { code: '0074', name: 'First Community Bank' },
  { code: '0076', name: 'UBA Kenya Bank' },
];

export function isKnownBankCode(code) {
  return KENYAN_BANK_CODES.some((b) => b.code === String(code ?? '').trim());
}
