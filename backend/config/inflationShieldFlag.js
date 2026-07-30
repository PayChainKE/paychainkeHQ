// Kill switch for the automatic, webhook-triggered Inflation Shield
// conversion (every M-Pesa C2B payment to a merchant with a Stellar wallet
// gets auto-swapped to on-chain USDC inside mpesaController.js's
// confirmationURL). Off by default: a slow/unreachable Stellar Horizon
// endpoint previously delayed merchant payment notifications by 10+ minutes
// (fixed in a9ae3b1 by moving the SMS/notification ahead of it, but the
// underlying on-chain dependency in the payment path remains a risk). This
// flag lets that automatic conversion be paused instantly without a deploy,
// while merchant-initiated "Convert to USDC" swaps (transactionController.js
// swapKesToUsdc) — an explicit, opt-in action — are untouched by it.
// Set AUTO_INFLATION_SHIELD_ENABLED=true to re-enable.
export const AUTO_INFLATION_SHIELD_ENABLED = process.env.AUTO_INFLATION_SHIELD_ENABLED === 'true';
