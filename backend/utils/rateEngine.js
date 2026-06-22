import axios from 'axios';

/**
 * Fetches the live USD to KES spot price from ExchangeRate-API and returns the inversion rate (USDC per 1 KES).
 * Falls back to 130 KES/USD if the API fails to ensure uninterrupted financial operations.
 * @returns {Promise<number>} The precise fractional amount of USDC equivalent to 1 KES.
 */
export const getLiveKesToUsdcRate = async () => {
  const FALLBACK_KES_PER_USD = 130;
  
  try {
    const API_KEY = process.env.EXCHANGE_RATE_API_KEY || 'ea323792994b2f107fead1db';
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`, {
      timeout: 5000 // 5 second timeout to prevent hanging webhook responses
    });

    const currentKesPriceForOneDollar = parseFloat(response.data.conversion_rates.KES);

    if (isNaN(currentKesPriceForOneDollar) || currentKesPriceForOneDollar <= 0) {
      throw new Error('Invalid rate format received from ExchangeRate-API');
    }

    // Invert the rate to find out how much USDC you get for 1 KES
    return 1 / currentKesPriceForOneDollar;

  } catch (error) {
    console.warn(`⚠️ [RATE ENGINE WARNING] Failed to fetch live ExchangeRate-API KES/USD ticker: ${error.message}. Falling back to 1 USD = ${FALLBACK_KES_PER_USD} KES.`);
    return 1 / FALLBACK_KES_PER_USD;
  }
};
