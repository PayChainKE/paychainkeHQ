import crypto from 'crypto';
import Developer from '../models/Developer.js';
import ApiKey from '../models/ApiKey.js';
import { logAudit } from '../utils/auditLog.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';
import { runIntegrationTestForDeveloper } from '../services/developerIntegrationTestService.js';
import Merchant from '../models/Merchant.js';
import { linkedMerchantIds, isMerchantLinked, liveAccessFor, liveAccessSummary } from '../utils/developerMerchants.js';
import { migrateLegacyLink } from '../services/developerMerchantLinkService.js';
import mongoose from 'mongoose';
import DeveloperPayment from '../models/DeveloperPayment.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';

const publicApiKey = (key) => ({
  _id: key._id,
  mode: key.mode,
  keyPrefix: key.keyPrefix,
  label: key.label,
  status: key.status,
  lastUsedAt: key.lastUsedAt,
  createdAt: key.createdAt,
  revokedAt: key.revokedAt,
  // merchantId is populated (with businessName) on the list endpoint.
  merchantId: key.merchantId?._id || key.merchantId || null,
  merchantName: key.merchantId?.businessName || null,
});

// @desc    Current developer's own profile
// @route   GET /api/developer/me
// @access  Private (Developer)
export const getMe = async (req, res) => {
  const d = req.developer;
  res.json({
    success: true,
    developer: {
      _id: d._id,
      name: d.name,
      companyName: d.companyName,
      email: d.email,
      phone: d.phone,
      status: d.status,
      isVerified: d.isVerified,
      // Summary across merchants (approval is per merchant: see
      // GET /link-merchant/status for each merchant's own state).
      liveAccess: liveAccessSummary(d),
      linkedMerchantCount: linkedMerchantIds(d).length,
      createdAt: d.createdAt,
      lastLogin: d.lastLogin,
    },
  });
};

// @desc    List this developer's API keys (never returns the secret itself)
// @route   GET /api/developer/api-keys
// @access  Private (Developer)
export const listApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ developerId: req.developer._id }).sort({ createdAt: -1 }).populate('merchantId', 'businessName');
    res.json({ success: true, data: keys.map(publicApiKey) });
  } catch (error) {
    console.error('List API Keys Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Generate a new API key (test mode always allowed; live mode requires prior admin approval)
// @route   POST /api/developer/api-keys
// @access  Private (Developer)
export const createApiKey = async (req, res) => {
  try {
    const { mode, label } = req.body || {};
    if (!['test', 'live'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "test" or "live".' });
    }

    // Which merchant this key acts for. A live key must have one: the
    // developer picks it, or it defaults when they have exactly one linked.
    // A test key may leave it out (pure sandbox).
    const developerDoc = await Developer.findById(req.developer._id);
    const linkedIds = linkedMerchantIds(developerDoc);
    let merchantId = req.body?.merchantId || null;
    if (merchantId) {
      if (!isMerchantLinked(developerDoc, merchantId)) {
        return res.status(400).json({ error: 'That merchant is not linked to your account. Link it first.', code: 'MERCHANT_NOT_LINKED' });
      }
    } else if (mode === 'live') {
      if (linkedIds.length === 0) {
        return res.status(400).json({ error: 'Link your real merchant account before creating a live key.', code: 'NO_LINKED_MERCHANT' });
      }
      if (linkedIds.length > 1) {
        return res.status(400).json({ error: 'Choose which merchant this live key is for (merchantId).', code: 'MERCHANT_REQUIRED' });
      }
      merchantId = linkedIds[0];
    }

    // Live access is approved per merchant: this merchant must be cleared.
    if (mode === 'live' && !liveAccessFor(developerDoc, merchantId).approved) {
      return res.status(403).json({
        error: 'Live access has not been approved for this merchant yet. Request live access for it first, or use a test-mode key in the meantime.',
        code: 'LIVE_ACCESS_NOT_APPROVED',
      });
    }

    const rawKey = `pc_${mode}_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.create({
      developerId: req.developer._id,
      mode,
      merchantId,
      keyPrefix: rawKey.slice(0, 12),
      hashedKey,
      label: label ? String(label).trim().slice(0, 100) : null,
    });

    logAudit({
      action: 'developer.api_key.created', category: 'security', severity: mode === 'live' ? 'warning' : 'info',
      message: `Created a ${mode}-mode API key`,
      req, actor: { type: 'self', id: req.developer._id, email: req.developer.email, name: req.developer.name },
      metadata: { mode, keyPrefix: apiKey.keyPrefix, merchantId: merchantId ? String(merchantId) : null },
    });

    // The only point in this flow the plaintext key is ever available —
    // never persisted, never returned again after this response.
    res.status(201).json({ success: true, apiKey: { ...publicApiKey(apiKey), key: rawKey } });
  } catch (error) {
    console.error('Create API Key Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Revoke one of this developer's own API keys
// @route   PATCH /api/developer/api-keys/:id/revoke
// @access  Private (Developer)
export const revokeApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!apiKey) return res.status(404).json({ error: 'API key not found.' });

    if (apiKey.status === 'active') {
      apiKey.status = 'revoked';
      apiKey.revokedAt = new Date();
      await apiKey.save();

      logAudit({
        action: 'developer.api_key.revoked', category: 'security', severity: 'info',
        message: `Revoked a ${apiKey.mode}-mode API key`,
        req, actor: { type: 'self', id: req.developer._id, email: req.developer.email, name: req.developer.name },
        metadata: { mode: apiKey.mode, keyPrefix: apiKey.keyPrefix },
      });
    }

    res.json({ success: true, apiKey: publicApiKey(apiKey) });
  } catch (error) {
    console.error('Revoke API Key Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Ask an admin to review this account for live (real-money) API
//          access. Before notifying anyone, automatically runs the same
//          integration test an admin could otherwise only trigger by hand
//          (see services/developerIntegrationTestService.js) and attaches
//          the result to both the stored request and the admin
//          notification — so whoever reviews this sees "collect test
//          passed, 2/2 webhooks acked" (or exactly what's broken) instead
//          of approving on trust alone. Takes a few seconds longer than a
//          bare status flip because of that; a failure to run the check
//          itself is logged but never blocks the request from going
//          through — the check is a signal for the admin, not a gate.
// @route   POST /api/developer/live-access/request
// @access  Private (Developer)
export const requestLiveAccess = async (req, res) => {
  try {
    // A legacy single link is moved into the per-merchant list first.
    const developer = await migrateLegacyLink(req.developer._id);

    // Sandbox needs no merchant, but production does: live collections settle
    // into a real merchant's wallet. Nothing goes to an admin for approval
    // until that real account is linked.
    const linkedIds = linkedMerchantIds(developer);
    if (linkedIds.length === 0) {
      return res.status(400).json({
        error: 'Link your real PayChain merchant account before requesting live access.',
        code: 'NO_LINKED_MERCHANT',
      });
    }

    // Live access is approved per merchant, so say which one.
    let merchantId = req.body?.merchantId || null;
    if (!merchantId) {
      if (linkedIds.length > 1) {
        return res.status(400).json({ error: 'Choose which merchant you are requesting live access for (merchantId).', code: 'MERCHANT_REQUIRED' });
      }
      merchantId = linkedIds[0];
    } else if (!isMerchantLinked(developer, merchantId)) {
      return res.status(400).json({ error: 'That merchant is not linked to your account. Link it first.', code: 'MERCHANT_NOT_LINKED' });
    }
    if (liveAccessFor(developer, merchantId).approved) {
      return res.status(400).json({ error: 'Live access is already approved for this merchant.' });
    }
    const merchantDoc = await Merchant.findById(merchantId).select('businessName');

    let autoTest = null;
    try {
      autoTest = await runIntegrationTestForDeveloper(developer);
    } catch (err) {
      console.error('requestLiveAccess: auto integration test failed to run:', err?.message || err);
    }

    await Developer.updateOne(
      { _id: developer._id, 'linkedMerchants.merchantId': merchantId },
      { $set: { 'linkedMerchants.$.liveAccess.requestedAt': new Date(), 'linkedMerchants.$.liveAccess.autoTest': autoTest } }
    );

    const webhookSummary = autoTest?.noWebhooksRegistered
      ? 'no webhook registered (polling-only integration)'
      : `${autoTest?.webhookTests?.filter((w) => w.passed).length ?? 0}/${autoTest?.webhookTests?.length ?? 0} webhooks acked`;
    const testSummary = autoTest
      ? `Auto-check: collect test ${autoTest.collectTest.passed ? 'passed' : 'FAILED'} (${escapeHtml(autoTest.collectTest.message)}), ${webhookSummary}.`
      : 'Auto-check could not be run — review manually.';

    logAudit({
      action: 'developer.live_access.requested', category: 'security', severity: 'info',
      message: `Requested live API access for ${merchantDoc?.businessName || merchantId}`,
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      metadata: {
        collectTestPassed: autoTest?.collectTest?.passed ?? null,
        webhookCount: autoTest?.webhookTests?.length ?? 0,
        webhookTestsPassed: autoTest?.webhookTests?.filter((w) => w.passed).length ?? 0,
        merchantId: String(merchantId),
      },
    });

    notifyAdmins({
      type: 'developer_live_access_requested',
      severity: autoTest && !autoTest.collectTest.passed ? 'warning' : 'info',
      subject: 'Developer requested live API access',
      heading: 'Live API Access Requested',
      details: `<strong>${escapeHtml(developer.companyName)}</strong> (${escapeHtml(developer.email)}) requested approval for live-mode API keys for the merchant <strong>${escapeHtml(merchantDoc?.businessName || String(merchantId))}</strong>.<br><br>${testSummary}`,
      metadata: { developerId: String(developer._id), merchantId: String(merchantId), companyName: developer.companyName, email: developer.email, autoTestPassed: autoTest?.collectTest?.passed ?? null },
    });

    res.json({ success: true, merchantId, message: 'Request submitted. An admin will review this merchant.' });
  } catch (error) {
    console.error('Request Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    The developer's own payments, newest first: every collection and
//          payout made through their API keys, in both modes. The portal's
//          Transactions page reads this.
// @route   GET /api/developer/payments?mode=&kind=&status=&q=&page=&limit=
// @access  Private (Developer)
export const listPayments = async (req, res) => {
  try {
    const { mode, kind, status, q } = req.query;
    const filter = { developerId: req.developer._id };
    if (['test', 'live'].includes(mode)) filter.mode = mode;
    if (['collect', 'payout'].includes(kind)) filter.kind = kind;
    if (['pending', 'success', 'failed'].includes(status)) filter.status = status;

    const term = String(q || '').trim().slice(0, 100);
    if (term) {
      const ors = [{ reference: { $regex: escapeRegex(term), $options: 'i' } }];
      if (mongoose.isValidObjectId(term)) ors.push({ _id: term });
      filter.$or = ors;
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [rows, total] = await Promise.all([
      DeveloperPayment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      DeveloperPayment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: rows.map(publicDeveloperPayment),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('List Developer Payments Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
