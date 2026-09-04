import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getTransactions, simulateIncomingPayment, swapKesToUsdc, activateWallet, getLiveRate, sendMoney, syncWalletBalance, generatePaymentLink, listPaymentLinks, getPaymentLink, processPaymentLink, getMerchantByAccount, payToMerchantAccount, emailStatement, downloadSticker, getPublicSTKStatus, getCheckoutPreview, createCheckoutPage, listCheckoutPages, getCheckoutPageForMerchant, updateCheckoutPage, deleteCheckoutPage, getCheckoutPagePublic, checkoutPageCheckout } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// The embed widget (public/paychain-button.js) now renders its own inline
// checkout UI directly on a merchant's third-party site and calls these
// five already-public endpoints via fetch() — that needs the browser to be
// allowed to read the response cross-origin, which server.js's main cors()
// deliberately does NOT allow (strict allowlist, credentials:true, gates
// every merchant/admin route). This is a second, narrowly-scoped cors()
// instance, mounted only on these specific paths below, not a change to the
// global policy. Safe to leave wide open (origin: true, reflecting any
// caller) because: (1) all five routes are already public/unauthenticated
// and already rate-limited — this only changes whether a *browser* can read
// the response, not whether the endpoint is reachable, which it already was
// to any server-to-server or same-origin caller; (2) credentials: false —
// none of these routes ever need a cookie/Authorization header, so there's
// no credential-leak surface from reflecting an arbitrary origin. Every
// other route in this app keeps going through only the strict global cors().
const embedCors = cors({ origin: true, credentials: false, methods: ['GET', 'POST', 'OPTIONS'] });

// sendMoney checks a 4-digit PIN inline — same brute-force exposure as
// every other PIN-guarded endpoint in the app.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

router.post('/simulate', protectMerchant, simulateIncomingPayment);
router.post('/swap', protectMerchant, swapKesToUsdc);
router.post('/activate-wallet', protectMerchant, activateWallet);
router.post('/sync-wallet', protectMerchant, syncWalletBalance);
router.post('/send-money', protectMerchant, pinLimiter, sendMoney);
router.post('/payment-link', protectMerchant, generatePaymentLink);
router.get('/payment-link', protectMerchant, listPaymentLinks);

// Checkout Pages — merchant-owned multi-product catalog backing the
// "storefront" no-code embed. Management routes are merchant-authenticated;
// the public/checkout routes below (with the other public routes) are not.
router.post('/checkout-page', protectMerchant, createCheckoutPage);
router.get('/checkout-page', protectMerchant, listCheckoutPages);
router.get('/checkout-page/:pageId', protectMerchant, getCheckoutPageForMerchant);
router.patch('/checkout-page/:pageId', protectMerchant, updateCheckoutPage);
router.delete('/checkout-page/:pageId', protectMerchant, deleteCheckoutPage);

// Public payment routes — unauthenticated by design (a customer paying a
// link/QR has no PayChain account), so both get the same throttle: without
// it, a public caller could trigger unlimited STK pushes (and SMS sends)
// to any phone number they type in.
const payAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts. Try again in 15 minutes.' },
});

// Both GET lookups below were unthrottled — a public caller could brute-force
// them to enumerate the merchant directory (ncbaMerchantCode is sequential
// and only 8 digits) or scan for live payment links (linkId is a random but
// only 32-bit token). Neither leaks anything beyond a business name/amount,
// but bulk-scraping the whole merchant list is exactly what a rate limit on
// a public read endpoint exists to prevent. Slightly more generous than
// payAccountLimiter since legitimate typo/retry browsing is more common
// here than on the actual payment attempt.
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup attempts. Try again in 15 minutes.' },
});

// Public Payment Link Routes — embedCors mounted via router.use (not on the
// .get/.post calls themselves) so it also covers the OPTIONS preflight a
// cross-origin fetch() sends first, which Express would otherwise 404
// before ever reaching a verb-specific handler.
router.use('/payment-link/:linkId', embedCors);
router.use('/payment-link/:linkId/pay', embedCors);
router.get('/payment-link/:linkId', lookupLimiter, getPaymentLink);
router.post('/payment-link/:linkId/pay', payAccountLimiter, processPaymentLink);

// Public Checkout Page routes — the storefront view a customer sees after
// opening the embed button, and the cart submission that mints a fresh
// PaymentLink for them to pay (see checkoutPageCheckout's doc comment).
router.use('/checkout-page/:pageId/public', embedCors);
router.use('/checkout-page/:pageId/checkout', embedCors);
router.get('/checkout-page/:pageId/public', lookupLimiter, getCheckoutPagePublic);
router.post('/checkout-page/:pageId/checkout', payAccountLimiter, checkoutPageCheckout);

// Public direct-account payment — powers the static "Settlement QR" on a
// merchant's Wallet page (open amount, no pre-generated link), as opposed
// to the fixed-amount PaymentLink routes above.
router.get('/pay-account/:account', lookupLimiter, getMerchantByAccount);
router.post('/pay-account/:account', payAccountLimiter, payToMerchantAccount);

// Fee-breakdown preview shown on the checkout page before the STK prompt
// fires — see getCheckoutPreview's doc comment for why this can't live
// inside the M-PESA prompt itself.
router.get('/checkout-preview', lookupLimiter, getCheckoutPreview);

// Public STK status poll — the checkout pages above hit this every ~3s for
// up to a minute after triggering a push, so it needs its own more generous
// budget than lookupLimiter (a single checkout attempt alone can use ~20
// requests).
const pollStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many status checks. Please refresh and try again shortly.' },
});
router.use('/public-stk-status/:checkoutId', embedCors);
router.get('/public-stk-status/:checkoutId', pollStatusLimiter, getPublicSTKStatus);

router.post('/statement/email', protectMerchant, emailStatement);
router.get('/sticker', protectMerchant, downloadSticker);

router.get('/live-rate', protectMerchant, getLiveRate);
router.get('/', protectMerchant, getTransactions);

export default router;
