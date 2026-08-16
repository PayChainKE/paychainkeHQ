import bcrypt from 'bcryptjs';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';

// @desc    Current API-payout configuration for this merchant (never
//          returns the PIN itself, just whether one is set and the caps).
// @route   GET /api/auth/merchant/api-payout/status
// @access  Private (Merchant)
export const getApiPayoutStatus = async (req, res) => {
  const merchant = await Merchant.findById(req.merchant._id).select('+apiPayoutPin');
  res.json({
    success: true,
    apiPayoutEnabled: merchant.apiPayoutEnabled,
    hasApiPayoutPin: !!merchant.apiPayoutPin,
    caps: merchant.apiPayoutCaps || { perTransactionKes: 0, dailyKes: 0 },
  });
};

// @desc    Enable Developer-API payouts — sets a NEW, separate API Payout
//          PIN (never the mobile app's appPin) plus per-transaction/daily
//          caps. Gated behind the existing appPin so a stolen session token
//          alone can't grant a third-party integration payout power.
// @route   POST /api/auth/merchant/api-payout/enable
// @access  Private (Merchant)
export const enableApiPayout = async (req, res) => {
  try {
    const { currentPin, apiPayoutPin, confirmApiPayoutPin, perTransactionCapKes, dailyCapKes } = req.body || {};

    if (!currentPin) {
      return res.status(400).json({ error: 'Enter your current payment PIN to authorize this change.' });
    }
    if (!apiPayoutPin || apiPayoutPin.length < 6 || apiPayoutPin !== confirmApiPayoutPin) {
      return res.status(400).json({ error: 'API payout PIN must be at least 6 characters and match its confirmation.' });
    }
    if (apiPayoutPin === String(currentPin)) {
      return res.status(400).json({ error: 'The API payout PIN must be different from your payment PIN.' });
    }
    const perTransactionKes = Number(perTransactionCapKes);
    const dailyKes = Number(dailyCapKes);
    if (!Number.isFinite(perTransactionKes) || perTransactionKes <= 0 || !Number.isFinite(dailyKes) || dailyKes <= 0) {
      return res.status(400).json({ error: 'Enter valid positive per-transaction and daily caps.' });
    }
    if (perTransactionKes > dailyKes) {
      return res.status(400).json({ error: 'The per-transaction cap cannot exceed the daily cap.' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant?.appPin) {
      return res.status(400).json({ error: 'Set your payment PIN before enabling API payouts.' });
    }

    try {
      await assertPinNotLocked(merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(String(currentPin), merchant.appPin);
    if (!isMatch) {
      await recordFailedPinAttempt(merchant._id);
      return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }
    await resetPinAttempts(merchant._id);

    const salt = await bcrypt.genSalt(12);
    merchant.apiPayoutPin = await bcrypt.hash(String(apiPayoutPin), salt);
    merchant.apiPayoutEnabled = true;
    merchant.apiPayoutCaps = { perTransactionKes, dailyKes };
    await merchant.save();

    logAudit({
      action: 'merchant.api_payout.enabled', category: 'security', severity: 'critical',
      message: `Developer API payouts enabled (per-transaction cap KES ${perTransactionKes}, daily cap KES ${dailyKes})`,
      merchant, req,
    });

    res.json({ success: true, message: 'API payouts enabled.', apiPayoutEnabled: true, caps: merchant.apiPayoutCaps });
  } catch (error) {
    console.error('Enable API Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Disable Developer-API payouts — clears the PIN hash entirely,
//          not just the flag, so re-enabling always requires setting a
//          fresh PIN rather than silently reactivating an old one.
// @route   POST /api/auth/merchant/api-payout/disable
// @access  Private (Merchant)
export const disableApiPayout = async (req, res) => {
  try {
    const { currentPin } = req.body || {};
    if (!currentPin) {
      return res.status(400).json({ error: 'Enter your current payment PIN to authorize this change.' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant?.appPin) {
      return res.status(400).json({ error: 'No payment PIN on file.' });
    }

    try {
      await assertPinNotLocked(merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(String(currentPin), merchant.appPin);
    if (!isMatch) {
      await recordFailedPinAttempt(merchant._id);
      return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }
    await resetPinAttempts(merchant._id);

    merchant.apiPayoutPin = null;
    merchant.apiPayoutEnabled = false;
    merchant.apiPayoutCaps = { perTransactionKes: 0, dailyKes: 0 };
    await merchant.save();

    logAudit({
      action: 'merchant.api_payout.disabled', category: 'security', severity: 'warning',
      message: 'Developer API payouts disabled',
      merchant, req,
    });

    res.json({ success: true, message: 'API payouts disabled.', apiPayoutEnabled: false });
  } catch (error) {
    console.error('Disable API Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
