// Creates the five Stellar Instaward pilot merchants — realistic (invented)
// Kenyan SMEs across different trades and counties, each a flagged
// isDemoMerchant account with its own Stellar TESTNET wallet and a
// pre-configured settlement rule. They sign in on the demo app.
//
// The businesses, owners and locations are invented. No KRA PIN, national ID
// or business registration number is set, so nothing here can collide with a
// real taxpayer or company.
//
// Sign-in codes and payment SMS go to each pilot's phone, so the phones MUST
// be numbers your team controls (e.g. sales / onboarding staff) — never made-up
// numbers, which could belong to a stranger.
//
//   Preview (writes nothing):
//     PILOT_PASSWORD='...' node backend/scripts/create-stellar-pilot-merchants.js \
//       --phones=0712000001,0712000002,0712000003,0712000004,0712000005 \
//       --email-base=you@gmail.com
//   Create:  add --yes
//
// Run it where the real MONGO_URI is set (e.g. the Render shell). Re-running is
// safe: a pilot whose email already exists is skipped.
import dotenv from 'dotenv';
dotenv.config();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PILOTS = [
  {
    slug: 'wanjiku-greens', businessName: 'Wanjiku Fresh Greens Ltd',
    first: 'Grace', other: 'Wanjiku', surname: 'Mwangi', businessType: 'Limited Liability Company (LLC)',
    county: 'Nairobi', area: 'Dagoretti North', ward: 'Kawangware', street: 'Naivasha Road', employees: '11-50',
    rule: { enabled: true, stellarSharePercent: 20 }, // keeps most of its float liquid
  },
  {
    slug: 'kilimani-brew', businessName: 'Kilimani Brew House',
    first: 'Daniel', other: 'Otieno', surname: 'Ouma', businessType: 'Limited Liability Company (LLC)',
    county: 'Nairobi', area: 'Dagoretti North', ward: 'Kilimani', street: 'Argwings Kodhek Road', employees: '11-50',
    rule: { enabled: true, stellarSharePercent: 50 },
  },
  {
    slug: 'pwani-fish', businessName: 'Pwani Fresh Fish Traders',
    first: 'Amina', other: 'Hassan', surname: 'Mwinyi', businessType: 'Partnership',
    county: 'Mombasa', area: 'Nyali', ward: 'Kongowea', street: 'Kongowea Market Road', employees: '1-10',
    rule: { enabled: true, stellarSharePercent: 80 }, // reserve-heavy
  },
  {
    slug: 'rift-dairy', businessName: 'Rift Valley Dairy Cooperative',
    first: 'Peter', other: 'Kiprono', surname: 'Rotich', businessType: 'Cooperative Society',
    county: 'Nakuru', area: 'Nakuru Town East', ward: 'Flamingo', street: 'Kenyatta Avenue', employees: '51-200',
    rule: { enabled: true, stellarSharePercent: 20 },
  },
  {
    slug: 'lakeside-hardware', businessName: 'Lakeside Hardware & Building Supplies',
    first: 'Lucy', other: 'Akinyi', surname: 'Odhiambo', businessType: 'Sole Proprietorship',
    county: 'Kisumu', area: 'Kisumu Central', ward: 'Kondele', street: 'Kondele Junction Road', employees: '1-10',
    rule: { enabled: false, stellarSharePercent: 0 }, // control account: rule off
  },
];

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const toIntlPhone = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(d)) return `+${d}`;
  if (/^0[17]\d{8}$/.test(d)) return `+254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `+254${d}`;
  return null;
};

// ── Inputs ──────────────────────────────────────────────────────────────
const phones = String(args.phones || '').split(',').map((p) => p.trim()).filter(Boolean).map(toIntlPhone);
if (phones.length !== PILOTS.length || phones.some((p) => !p)) {
  die(`Give exactly ${PILOTS.length} valid Kenyan phone numbers your team controls: --phones=0712...,0722...,...`);
}
if (new Set(phones).size !== phones.length) die('Each pilot needs a different phone number.');

const emailBase = String(args['email-base'] || '');
const m = emailBase.match(/^([^@+\s]+)@([^@\s]+\.[^@\s]+)$/);
if (!m) die('Give an inbox you own as --email-base=you@gmail.com — each pilot gets a "you+slug@…" alias that delivers to it.');
const emailFor = (slug) => `${m[1]}+${slug}@${m[2]}`;

const password = process.env.PILOT_PASSWORD || '';
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  die('Set PILOT_PASSWORD in the environment: 12+ characters with upper, lower and a digit. It is shared by the five pilots.');
}
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');
if (String(process.env.STELLAR_NETWORK || 'TESTNET').toUpperCase() === 'PUBLIC') die('Refusing to run: STELLAR_NETWORK is PUBLIC. Pilots are testnet only.');

const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';
console.log(`\nStellar pilot merchants — ${args.yes ? 'CREATE' : 'PREVIEW (nothing will be written)'}   database host: ${dbHost}\n`);
PILOTS.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.businessName}`);
  console.log(`     ${p.first} ${p.other} ${p.surname} · ${p.businessType} · ${p.ward}, ${p.county} · ${p.employees} staff`);
  console.log(`     ${emailFor(p.slug)} · ${phones[i]} · rule: ${p.rule.enabled ? `${p.rule.stellarSharePercent}% to Stellar` : 'OFF (control)'}`);
});
if (!args.yes) {
  console.log('\nPreview only. Re-run with --yes to create these accounts.\n');
  process.exit(0);
}

// ── Create ──────────────────────────────────────────────────────────────
const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');
const { provisionMerchantWallet } = await import('../utils/stellarHelper.js');
const { encryptKey } = await import('../utils/cryptoHelper.js');

await mongoose.connect(process.env.MONGO_URI);
const created = [];
const failed = [];

for (let i = 0; i < PILOTS.length; i++) {
  const p = PILOTS[i];
  const email = emailFor(p.slug);
  if (await Merchant.exists({ email })) { console.log(`\n  ↷ ${p.businessName}: ${email} already exists — skipped`); continue; }
  if (await Merchant.exists({ phone: phones[i] })) { console.log(`\n  ↷ ${p.businessName}: ${phones[i]} is already used by another merchant — skipped`); continue; }

  console.log(`\n  Creating ${p.businessName} …`);
  try {
    let wallet;
    for (let attempt = 1; attempt <= 3; attempt++) {           // Friendbot / Horizon can hiccup
      try { wallet = await provisionMerchantWallet(); break; }  // Friendbot + USDC trustline (testnet)
      catch (err) { if (attempt === 3) throw err; console.log(`    wallet attempt ${attempt} failed (${err.message}) — retrying`); await new Promise((r) => setTimeout(r, 2000)); }
    }
    const merchant = await Merchant.create({
      name: `${p.first} ${p.other} ${p.surname}`,
      firstName: p.first, otherNames: p.other, surname: p.surname,
      email, phone: phones[i], password,
      businessName: p.businessName,
      businessType: p.businessType, county: p.county, businessArea: p.area, ward: p.ward, street: p.street,
      employeeCount: p.employees,
      registrationSource: 'web', isVerified: true,
      // No kybStatus on purpose: like every admin-onboarded merchant, it can sign in straight away.
      isDemoMerchant: true,
      stellarPublicKey: wallet.publicKey,
      stellarEncryptedSecretKey: encryptKey(wallet.secretKey),
      settlementRule: p.rule,
    });
    created.push({ business: p.businessName, email, phone: phones[i], code: merchant.ncbaMerchantCode, wallet: wallet.publicKey });
    console.log(`  ✓ created (account ${merchant.ncbaMerchantCode}, wallet ${wallet.publicKey.slice(0, 8)}…)`);
  } catch (err) {
    failed.push(p.businessName);
    console.log(`  ✖ ${p.businessName} FAILED: ${err.message} — the others continue; re-run to retry this one.`);
  }
}

console.log(`\nDone — ${created.length} created, ${failed.length} failed, ${PILOTS.length - created.length - failed.length} skipped.`);
if (created.length) {
  console.log('\nSign in on the demo app (Wallet → "Connect the demo Stellar wallet") with the email + the shared password;');
  console.log('the sign-in code is sent to the phone (or to the email inbox if you sign in by email).\n');
  created.forEach((c) => console.log(`  ${c.business.padEnd(40)} ${c.email}   wallet ${c.wallet}`));
  console.log('\nTo fund the wallets: switch a pilot\'s rule on and send it a test payment, or run the stress test.\n');
}
await mongoose.disconnect();
process.exit(failed.length ? 1 : 0);
