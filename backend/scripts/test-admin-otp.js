// One-shot diagnostic: sends a real OTP-style email to admin@paychain.co.ke
// using the same code path the login flow uses. Reads RESEND_API_KEY from .env.
//
// Run: node backend/test-admin-otp.js
import dotenv from 'dotenv';
import { sendOTP } from '../utils/resend.js';

dotenv.config();

const recipient = 'admin@paychain.co.ke';
const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

console.log(`🧪 Testing Resend OTP delivery to ${recipient}…`);
console.log(`   RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'yes' : 'NO — missing'}`);

if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set. Add it to backend/.env and re-run.');
  process.exit(1);
}

try {
  const result = await sendOTP(recipient, testOtp);
  console.log('✅ Resend accepted the message.');
  console.log('   Message ID:', result?.data?.id || result?.id || '(no id returned)');
  console.log(`   Test OTP used: ${testOtp} (for reference — check inbox)`);
  console.log('\nIf the inbox at admin@paychain.co.ke receives this within ~1 min, end-to-end OTP delivery is working.');
  process.exit(0);
} catch (err) {
  console.error('❌ Resend rejected the send.');
  console.error('   Error:', err?.message || err);
  console.error('\nCommon causes:');
  console.error('  • Domain paychain.co.ke not verified in Resend (check resend.com/domains)');
  console.error('  • RESEND_API_KEY belongs to a different team/sandbox');
  console.error('  • Sending limit hit on free tier');
  process.exit(1);
}
