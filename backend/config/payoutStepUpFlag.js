// Kill switch for the new-device + large-payout step-up OTP challenge
// (utils/payoutStepUpGuard.js). Off by default per a product decision, 2026:
// PIN alone authorizes every payout again — no second factor, no code sent,
// regardless of device or amount. The guard's code, state, and both
// frontends' UI for it are left fully in place (not deleted) specifically
// so this can be flipped back on instantly if needed, without rebuilding
// the feature. Set PAYOUT_STEP_UP_ENABLED=true to re-enable.
export const PAYOUT_STEP_UP_ENABLED = process.env.PAYOUT_STEP_UP_ENABLED === 'true';
