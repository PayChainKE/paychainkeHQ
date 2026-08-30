import TariffCard from '../models/TariffCard.js';

// Idempotent boot-time seed — same convention as
// migrations/backfillTransactionFees.js. Only ever CREATES a missing doc,
// never overwrites an existing one, so a redeploy can never silently reset
// an admin's prior tariff edit. Values below are the exact defaults each
// config/*TariffCard.js / utils/pricingEngine.js file already hardcodes —
// this seed brings the DB into sync with what's live in code today, it
// does not change any pricing on its own.
const TARIFF_CARDS = [
  {
    key: 'customer_surcharge', label: 'Customer Surcharge (STK/QR/Payment Links)', shape: 'tiered',
    bands: [
      { max: 100, fee: 0 }, { max: 500, fee: 3 }, { max: 1000, fee: 5 }, { max: 1500, fee: 7 },
      { max: 2500, fee: 8 }, { max: 3500, fee: 8 }, { max: 5000, fee: 10 }, { max: 7500, fee: 12 },
      { max: 10000, fee: 15 }, { max: 15000, fee: 20 }, { max: 20000, fee: 25 }, { max: 25000, fee: 25 },
      { max: 30000, fee: 27 }, { max: 35000, fee: 29 }, { max: 40000, fee: 31 }, { max: 45000, fee: 33 },
      { max: 50000, fee: 35 }, { max: 70000, fee: 35 }, { max: 250000, fee: 35 },
    ],
  },
  {
    key: 'invoice_client_markup', label: 'Invoice Customer Markup', shape: 'tiered',
    bands: [
      { max: 100, fee: 0 }, { max: 500, fee: 3 }, { max: 1000, fee: 5 }, { max: 1500, fee: 5 },
      { max: 2500, fee: 7 }, { max: 3500, fee: 8 }, { max: 5000, fee: 10 }, { max: 7500, fee: 12 },
      { max: 10000, fee: 15 }, { max: 15000, fee: 20 }, { max: 20000, fee: 25 }, { max: 25000, fee: 25 },
      { max: 30000, fee: 27 }, { max: 35000, fee: 29 }, { max: 40000, fee: 31 }, { max: 45000, fee: 33 },
      { max: 50000, fee: 35 }, { max: 70000, fee: 35 }, { max: 250000, fee: 35 },
    ],
  },
  { key: 'invoice_merchant_flat_fee', label: 'Invoice Merchant Fee', shape: 'flat', flatFee: 23 },
  {
    key: 'pesalink_service_fee', label: 'PesaLink — PayChain Margin', shape: 'tiered',
    bands: [
      { max: 500, fee: 50 }, { max: 3500, fee: 20 }, { max: 7000, fee: 38 },
      { max: 10000, fee: 50 }, { max: 250000, fee: 110 },
    ],
  },
  { key: 'rtgs_service_fee', label: 'RTGS — PayChain Margin', shape: 'flat', flatFee: 100 },
  {
    key: 'mobile_withdrawal_service_fee', label: 'Mobile Withdrawal (B2C/Mobile B2W) — PayChain Margin', shape: 'tiered',
    bands: [
      { max: 49, fee: 0 }, { max: 100, fee: 5 }, { max: 500, fee: 6 }, { max: 1000, fee: 12 },
      { max: 1500, fee: 19 }, { max: 2500, fee: 20 }, { max: 3500, fee: 25 }, { max: 5000, fee: 28 },
      { max: 7500, fee: 46 }, { max: 10000, fee: 56 }, { max: 20000, fee: 73 }, { max: 50000, fee: 100 },
      { max: 100000, fee: 150 }, { max: 250000, fee: 200 },
    ],
  },
  {
    key: 'lipa_na_mpesa_service_fee', label: 'Lipa na M-Pesa B2B — PayChain Margin', shape: 'tiered',
    bands: [
      { max: 100, fee: 0 }, { max: 500, fee: 5 }, { max: 1000, fee: 8 }, { max: 2500, fee: 13 },
      { max: 5000, fee: 15 }, { max: 10000, fee: 20 }, { max: 20000, fee: 37 }, { max: 30000, fee: 39 },
      { max: 40000, fee: 47 }, { max: 50000, fee: 54 }, { max: 100000, fee: 56 }, { max: 150000, fee: 74 },
      { max: 200000, fee: 92 }, { max: 250000, fee: 110 },
    ],
  },
  { key: 'kplc_postpaid_service_fee', label: 'KPLC Postpaid — PayChain Margin', shape: 'flat', flatFee: 27 },
  {
    key: 'kplc_prepaid_service_fee', label: 'KPLC Prepaid — PayChain Margin', shape: 'tiered',
    bands: [
      { max: 500, fee: 7 }, { max: 2000, fee: 12 }, { max: 4000, fee: 19 }, { max: 7000, fee: 29 },
      { max: 10000, fee: 40 }, { max: 25000, fee: 42 }, { max: 50000, fee: 51 }, { max: 100000, fee: 60 },
      { max: 250000, fee: 69 },
    ],
  },
  { key: 'ncwsc_service_fee', label: 'NCWSC (Nairobi Water) — PayChain Margin', shape: 'flat', flatFee: 27 },
  { key: 'internet_service_fee', label: 'Internet — PayChain Margin (not yet a live rail)', shape: 'flat', flatFee: 40 },
  {
    key: 'rent_service_fee', label: 'Rent Settlement — PayChain Margin (not yet a live rail)', shape: 'tiered',
    bands: [
      { max: 10000, fee: 52 }, { max: 20000, fee: 75 }, { max: 35000, fee: 125 },
      { max: 50000, fee: 175 }, { max: 250000, fee: 165 },
    ],
  },
  { key: 'settlement_flat', label: 'Generic Settlement — PayChain Margin', shape: 'flat', flatFee: 20 },
  { key: 'stablecoin_flat', label: 'Stablecoin (USDC) Payment — PayChain Margin', shape: 'flat', flatFee: 30 },
  { key: 'mpesa_b2b_legacy_flat', label: 'M-Pesa B2B (legacy) — PayChain Margin', shape: 'flat', flatFee: 20 },
  { key: 'ncba_disbursement_flat', label: 'NCBA Disbursement (generic) — PayChain Margin', shape: 'flat', flatFee: 50 },
];

export async function seedTariffCards() {
  let created = 0;
  for (const card of TARIFF_CARDS) {
    const existing = await TariffCard.findOne({ key: card.key }).select('_id');
    if (existing) continue;
    await TariffCard.create(card);
    created += 1;
  }
  if (created > 0) {
    console.log(`💳 Seeded ${created}/${TARIFF_CARDS.length} tariff card(s).`);
  }
}
