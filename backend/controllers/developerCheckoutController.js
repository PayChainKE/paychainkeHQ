import CheckoutSession from '../models/CheckoutSession.js';
import { syncCheckoutSessionStatus } from '../services/checkoutSessionService.js';

// checkout.paychain.co.ke is a separate hosted surface (like
// checkout.paystack.com) — no API key ever reaches it, only this session id.
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://checkout.paychain.co.ke';

// Default: 30 minutes is generous for a customer to land on the page, enter
// a phone number, and respond to an STK prompt, without leaving a stale,
// still-payable link around for hours after a developer generated it for
// one specific checkout. A caller can widen this via expiresInMinutes for
// the "payment link" use case — a link meant to be shared and paid
// whenever, not a one-shot purchase-flow redirect — up to 7 days.
const DEFAULT_SESSION_TTL_MINUTES = 30;
const MIN_SESSION_TTL_MINUTES = 5;
const MAX_SESSION_TTL_MINUTES = 7 * 24 * 60;

function publicSession(session) {
  return {
    id: session._id,
    mode: session.mode,
    amount: session.amount,
    currency: session.currency,
    reference: session.reference,
    description: session.description,
    status: session.status,
    callbackUrl: session.callbackUrl,
    checkoutUrl: `${CHECKOUT_BASE_URL}/pay/${session._id}`,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  };
}

// @desc    Create a hosted checkout session — returns a link to redirect
//          the customer to. PayChain hosts the whole payment page; the
//          customer never sees an API key.
// @route   POST /api/v1/developer/checkout
// @access  Public (API key)
export const createCheckoutSession = async (req, res) => {
  try {
    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const { amount, reference, description, callbackUrl, customer, expiresInMinutes } = req.body || {};
    const intAmount = Math.ceil(Number(amount));
    if (!Number.isFinite(intAmount) || intAmount <= 0) {
      return res.status(400).json({ error: 'A positive amount is required.' });
    }
    if (callbackUrl && !/^https:\/\//.test(String(callbackUrl))) {
      return res.status(400).json({ error: 'callbackUrl must be https://.' });
    }

    let ttlMinutes = DEFAULT_SESSION_TTL_MINUTES;
    if (expiresInMinutes !== undefined) {
      const n = Number(expiresInMinutes);
      if (!Number.isFinite(n) || n < MIN_SESSION_TTL_MINUTES || n > MAX_SESSION_TTL_MINUTES) {
        return res.status(400).json({ error: `expiresInMinutes must be between ${MIN_SESSION_TTL_MINUTES} and ${MAX_SESSION_TTL_MINUTES}.` });
      }
      ttlMinutes = n;
    }

    const session = await CheckoutSession.create({
      developerId: developer._id,
      apiKeyId: req.apiKey._id,
      merchantId,
      mode: req.apiKey.mode,
      amount: intAmount,
      reference: reference || null,
      description: description ? String(description).trim().slice(0, 200) : null,
      customer: {
        phone: customer?.phone || null,
        email: customer?.email || null,
        name: customer?.name || null,
      },
      callbackUrl: callbackUrl || null,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    });

    res.status(201).json({ success: true, session: publicSession(session) });
  } catch (error) {
    console.error('Create Checkout Session Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Check a checkout session's status — an alternative to relying
//          purely on the redirect/webhook for a developer who wants to poll.
// @route   GET /api/v1/developer/checkout/:id
// @access  Public (API key)
export const getCheckoutSession = async (req, res) => {
  try {
    const session = await CheckoutSession.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!session) return res.status(404).json({ error: 'Checkout session not found.' });

    await syncCheckoutSessionStatus(session);

    res.json({ success: true, session: publicSession(session) });
  } catch (error) {
    console.error('Get Checkout Session Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
