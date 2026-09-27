// Looks up (and optionally resets the password on) the flagged Stellar
// demo/pilot merchant account(s) — for when the credentials from an earlier
// create-stellar-pilot-merchants.js run (or the original single flagged
// demo account) are lost. No password is ever stored in plaintext anywhere
// (Merchant.password is bcrypt-hashed pre-save), so there is nothing to
// "look up" for an existing password — this only lets you set a NEW one.
//
// Run it where the real MONGO_URI is set (e.g. the Render shell).
//
//   List every isDemoMerchant account (writes nothing):
//     node backend/scripts/reset-demo-merchant-password.js
//
//   Reset one account's password (preview — writes nothing without --yes):
//     NEW_PASSWORD='...' node backend/scripts/reset-demo-merchant-password.js \
//       --email=you+wanjiku-greens@gmail.com
//
//   Actually write it:
//     ...same as above, plus --yes
import dotenv from 'dotenv';
dotenv.config();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

if (!process.env.MONGO_URI) die('MONGO_URI is not set.');

const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';

const targetEmail = String(args.email || '').trim().toLowerCase();

if (!targetEmail) {
  // No email given — just list what's there, so you know which one to target.
  const demoMerchants = await Merchant.find({ isDemoMerchant: true })
    .select('email businessName status createdAt')
    .sort('createdAt')
    .lean();
  console.log(`\nDemo merchant accounts on ${dbHost}:\n`);
  if (!demoMerchants.length) {
    console.log('  (none found — no merchant is flagged isDemoMerchant: true)');
  } else {
    demoMerchants.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.businessName || '(no business name)'}`);
      console.log(`     ${m.email} · status: ${m.status} · created ${new Date(m.createdAt).toLocaleDateString()}`);
    });
  }
  console.log('\nRe-run with --email=<one of the above> (and NEW_PASSWORD set) to reset its password.\n');
  process.exit(0);
}

const merchant = await Merchant.findOne({ email: targetEmail }).select('+password isDemoMerchant businessName status');
if (!merchant) die(`No merchant found with email "${targetEmail}".`);
if (!merchant.isDemoMerchant && !args.force) {
  die(`${targetEmail} is NOT flagged isDemoMerchant — refusing to touch a real merchant's password. Pass --force if this is genuinely intended.`);
}

const newPassword = process.env.NEW_PASSWORD || '';
if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
  die('Set NEW_PASSWORD in the environment: 12+ characters with upper, lower and a digit.');
}

console.log(`\n${args.yes ? 'RESETTING' : 'PREVIEW (nothing will be written)'} password for ${merchant.businessName || merchant.email} <${merchant.email}> on ${dbHost}\n`);
if (!args.yes) {
  console.log('Preview only. Re-run with --yes to actually set the new password.\n');
  process.exit(0);
}

merchant.password = newPassword; // Merchant's pre-save hook bcrypt-hashes this (12 rounds)
merchant.tokenVersion = (merchant.tokenVersion || 0) + 1; // sign out any existing sessions, same as a normal password reset
await merchant.save();

console.log(`✔ Password reset. Sign in with:\n    email: ${merchant.email}\n    password: (the NEW_PASSWORD you set)\n`);
process.exit(0);
