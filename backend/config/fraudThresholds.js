// Shared "what counts as a large payout" threshold — a single number used
// everywhere a controller needs to decide whether a money-out request is
// big enough to warrant extra scrutiny (an admin heads-up alert in
// transactionController.js's sendMoney, or a step-up OTP challenge in
// payoutStepUpGuard.js). Kept in one place so "large" means the same thing
// platform-wide instead of drifting into several different hardcoded
// numbers. Configurable since "large" depends on the merchant base's real
// transaction sizes; defaults to a conservative KES 500,000 in case the env
// var is unset.
export const LARGE_TRANSACTION_ALERT_KES = Number(process.env.LARGE_TRANSACTION_ALERT_KES) || 500_000;
