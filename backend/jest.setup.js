// Importing the backend throws without these (utils/cryptoHelper.js,
// utils/resend.js). CI has no .env, so give tests harmless placeholders. A real
// value, e.g. from a local .env, is left alone.
process.env.ENCRYPTION_MASTER_KEY ||= '0'.repeat(64);
process.env.RESEND_API_KEY ||= 're_test_placeholder';
