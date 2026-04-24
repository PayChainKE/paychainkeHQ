/**
 * Server Environment Validator
 * 
 * Ensures all critical environment variables are present before the server starts.
 * This prevents runtime failures in production due to missing secrets.
 */

const CRITICAL_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'RESEND_API_KEY'
];

const validateEnv = () => {
  const missing = [];
  
  CRITICAL_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    console.error('\x1b[31m%s\x1b[0m', 'CRITICAL ERROR: Missing environment variables!');
    missing.forEach(m => {
      console.warn('\x1b[33m%s\x1b[0m', `  - ${m} is NOT defined.`);
    });
    console.log('\x1b[36m%s\x1b[0m', 'Please check your .env file or hosting provider dashboard (Vercel/Render).');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('Shutting down server to prevent inconsistent state.');
      process.exit(1);
    }
  } else {
    console.log('\x1b[32m%s\x1b[0m', '✓ All critical environment variables verified.');
  }
};

module.exports = { validateEnv };
