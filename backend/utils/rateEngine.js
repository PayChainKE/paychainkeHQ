import axios from 'axios';

const FALLBACK_KES_PER_USD = 130;

// The Inflation Shield (KES<->USDC swap) isn't a live merchant feature yet —
// it's still in development — so nothing actually needs a real live rate
// right now. Every current caller (dashboard sidebar/Overview/Wallet balance
// estimates, GET /api/transactions/live-rate) is cosmetic until it ships.
// Skipping the live fetch entirely avoids hammering ExchangeRate-API's
// free-tier quota for a feature nobody's using, which is also what was
// producing repeated 403 warnings in the logs. Flip this back to false once
// the Inflation Shield actually goes live and a real rate matters.
const LIVE_RATE_FETCH_DISABLED = true;

// A KES/USD spot rate doesn't meaningfully move minute-to-minute, but this
// was being re-fetched from ExchangeRate-API on every single transaction
// needing a rate (getLiveRate, checkout swap calculations) with no caching
// at all — that burns through the free-tier request quota fast under real
// traffic, which is what was producing sustained 403s in production
// (confirmed live: the key itself still works fine on a one-off request,
// so this isn't a dead/revoked key). Caching for a few minutes cuts call
// volume by roughly the same factor without making the rate meaningfully
// staler than a live lookup already was.
const CACHE_TTL_MS = 5 * 60 * 1000;
// When the live fetch fails, cache the fallback for a much shorter window.
// Without this, every caller during an outage (e.g. every line item in a
// Bulk Pay batch, or the sidebar/Overview/Wallet pages all mounting at
// once) independently re-hits ExchangeRate-API and re-logs its own
// warning, which is both what was flooding the logs and what was keeping
// the API's rate limit from ever recovering.
const FALLBACK_CACHE_TTL_MS = 60 * 1000;
let cachedRate = null;
let cachedAt = 0;
let isCachedRateLive = false;

/**
 * Fetches the live USD to KES spot price from ExchangeRate-API and returns the inversion rate (USDC per 1 KES).
 * Falls back to 130 KES/USD if the API fails to ensure uninterrupted financial operations.
 * @returns {Promise<number>} The precise fractional amount of USDC equivalent to 1 KES.
 */
export const getLiveKesToUsdcRate = async () => {
  if (LIVE_RATE_FETCH_DISABLED) {
    return 1 / FALLBACK_KES_PER_USD;
  }

  const ttl = isCachedRateLive ? CACHE_TTL_MS : FALLBACK_CACHE_TTL_MS;
  if (cachedRate !== null && Date.now() - cachedAt < ttl) {
    return cachedRate;
  }

  try {
    const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
    if (!API_KEY) {
      throw new Error('EXCHANGE_RATE_API_KEY is not configured');
    }
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`, {
      timeout: 5000 // 5 second timeout to prevent hanging webhook responses
    });

    const currentKesPriceForOneDollar = parseFloat(response.data.conversion_rates.KES);

    if (isNaN(currentKesPriceForOneDollar) || currentKesPriceForOneDollar <= 0) {
      throw new Error('Invalid rate format received from ExchangeRate-API');
    }

    // Invert the rate to find out how much USDC you get for 1 KES
    cachedRate = 1 / currentKesPriceForOneDollar;
    cachedAt = Date.now();
    isCachedRateLive = true;
    return cachedRate;

  } catch (error) {
    console.warn(`⚠️ [RATE ENGINE WARNING] Failed to fetch live ExchangeRate-API KES/USD ticker: ${error.message}. Falling back to 1 USD = ${FALLBACK_KES_PER_USD} KES.`);
    // A stale-but-real cached rate is still more accurate than the static
    // fallback — only fall back to the constant if nothing's cached yet.
    cachedRate = cachedRate !== null ? cachedRate : 1 / FALLBACK_KES_PER_USD;
    cachedAt = Date.now();
    isCachedRateLive = false;
    return cachedRate;
  }
};
