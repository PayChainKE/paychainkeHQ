import CheckoutSession from '../models/CheckoutSession.js';
import Merchant from '../models/Merchant.js';
import { initiateCollectPayment, CollectValidationError } from '../services/developerCollectService.js';
import { DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { isCheckoutSessionExpired, syncCheckoutSessionStatus } from '../services/checkoutSessionService.js';
import { generateBrandedQrDataUri } from '../utils/qrCode.js';

// Same convention as developerCheckoutController.js's CHECKOUT_BASE_URL —
// kept as a separate constant rather than a shared import so this public,
// unauthenticated controller has zero coupling to the API-key-gated one.
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://checkout.paychain.co.ke';

// @desc    Public-safe checkout session details, for rendering the hosted
//          payment page. No API key involved — the session id itself is
//          the access token, the same trust model any hosted checkout link
//          (Paystack, a bank gateway) uses.
// @route   GET /api/public/checkout/:id
// @access  Public
export const getPublicCheckoutSession = async (req, res) => {
  try {
    const session = await CheckoutSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Checkout link not found or no longer valid.' });

    const merchant = await Merchant.findById(session.merchantId).select('businessName');
    const checkoutUrl = `${CHECKOUT_BASE_URL}/pay/${session._id}`;

    res.json({
      success: true,
      session: {
        id: session._id,
        mode: session.mode,
        amount: session.amount,
        currency: session.currency,
        description: session.description,
        reference: session.reference,
        status: isCheckoutSessionExpired(session) ? 'expired' : session.status,
        merchantName: merchant?.businessName || 'PayChain Merchant',
        prefillPhone: session.customer?.phone || null,
        // Encodes this exact page's own URL — lets a merchant display this
        // page on a desktop/kiosk screen and have the customer scan with
        // their own phone camera to open the identical payment page there,
        // rather than typing their M-Pesa number into a shared device.
        qrCodeDataUri: await generateBrandedQrDataUri(checkoutUrl),
      },
    });
  } catch (error) {
    console.error('Get Public Checkout Session Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Customer submits their phone number here to trigger the STK
//          push for this session.
// @route   POST /api/public/checkout/:id/pay
// @access  Public
export const payCheckoutSession = async (req, res) => {
  try {
    const session = await CheckoutSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Checkout link not found or no longer valid.' });

    if (session.status === 'success') return res.status(409).json({ error: 'This checkout has already been paid.' });
    if (session.status === 'processing') return res.status(409).json({ error: 'A payment is already in progress for this checkout.' });
    if (isCheckoutSessionExpired(session)) return res.status(410).json({ error: 'This checkout link has expired.' });

    // Atomic claim: only one request ever flips a session pending ->
    // processing, so two rapid clicks (or a client retry racing the first
    // request) can't both trigger a second STK push for the same session.
    const claimed = await CheckoutSession.findOneAndUpdate(
      { _id: session._id, status: 'pending' },
      { $set: { status: 'processing' } },
      { returnDocument: 'after' }
    );
    if (!claimed) return res.status(409).json({ error: 'A payment is already in progress for this checkout.' });

    try {
      const payment = await initiateCollectPayment({
        developerId: claimed.developerId,
        apiKeyId: claimed.apiKeyId,
        merchantId: claimed.merchantId,
        mode: claimed.mode,
        amount: claimed.amount,
        phone: req.body?.phone,
        reference: claimed.reference || `checkout-${claimed._id}`,
        // Generated fresh per attempt, not derived from the session id —
        // the session-status claim above is what prevents a double
        // submission; this just needs to be unique so a genuine retry
        // after a failure creates a new STK push instead of replaying the
        // failed one.
        idempotencyKey: `checkout-${claimed._id}-${Date.now()}`,
      });

      claimed.linkedDeveloperPaymentId = payment._id;
      await claimed.save();

      res.json({ success: true, status: 'processing' });
    } catch (e) {
      // Roll the session back to 'pending' so the customer can retry with a
      // corrected phone number instead of being stuck on a dead session.
      await CheckoutSession.updateOne({ _id: session._id }, { $set: { status: 'pending' } });

      if (e instanceof CollectValidationError) return res.status(400).json({ error: e.message });
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }
  } catch (error) {
    console.error('Pay Checkout Session Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Poll for this checkout session's current status — what the
//          hosted page calls every few seconds after the customer submits
//          their phone, waiting to redirect once it resolves.
// @route   GET /api/public/checkout/:id/status
// @access  Public
export const getCheckoutSessionStatus = async (req, res) => {
  try {
    const session = await CheckoutSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Checkout link not found or no longer valid.' });

    const { failureReason } = await syncCheckoutSessionStatus(session);

    res.json({
      success: true,
      status: isCheckoutSessionExpired(session) ? 'expired' : session.status,
      failureReason,
      callbackUrl: session.callbackUrl,
    });
  } catch (error) {
    console.error('Get Checkout Session Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
