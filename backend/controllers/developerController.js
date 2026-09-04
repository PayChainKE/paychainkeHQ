import crypto from 'crypto';
import Developer from '../models/Developer.js';
import ApiKey from '../models/ApiKey.js';
import { logAudit } from '../utils/auditLog.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';
import { runIntegrationTestForDeveloper } from '../services/developerIntegrationTestService.js';

const publicApiKey = (key) => ({
  _id: key._id,
  mode: key.mode,
  keyPrefix: key.keyPrefix,
  label: key.label,
  status: key.status,
  lastUsedAt: key.lastUsedAt,
  createdAt: key.createdAt,
  revokedAt: key.revokedAt,
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
      liveAccess: {
        approved: d.liveAccess?.approved || false,
        requestedAt: d.liveAccess?.requestedAt || null,
        approvedAt: d.liveAccess?.approvedAt || null,
      },
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
    const keys = await ApiKey.find({ developerId: req.developer._id }).sort({ createdAt: -1 });
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

    if (mode === 'live' && !req.developer.liveAccess?.approved) {
      return res.status(403).json({
        error: 'Live API access has not been approved for this account yet. Request live access first, or use a test-mode key in the meantime.',
        code: 'LIVE_ACCESS_NOT_APPROVED',
      });
    }

    const rawKey = `pc_${mode}_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.create({
      developerId: req.developer._id,
      mode,
      keyPrefix: rawKey.slice(0, 12),
      hashedKey,
      label: label ? String(label).trim().slice(0, 100) : null,
    });

    logAudit({
      action: 'developer.api_key.created', category: 'security', severity: mode === 'live' ? 'warning' : 'info',
      message: `Created a ${mode}-mode API key`,
      req, actor: { type: 'self', id: req.developer._id, email: req.developer.email, name: req.developer.name },
      metadata: { mode, keyPrefix: apiKey.keyPrefix },
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
    const developer = await Developer.findById(req.developer._id);
    if (developer.liveAccess?.approved) {
      return res.status(400).json({ error: 'Live access is already approved for this account.' });
    }

    let autoTest = null;
    try {
      autoTest = await runIntegrationTestForDeveloper(developer);
    } catch (err) {
      console.error('requestLiveAccess: auto integration test failed to run:', err?.message || err);
    }

    developer.liveAccess = developer.liveAccess || {};
    developer.liveAccess.requestedAt = new Date();
    developer.liveAccess.autoTest = autoTest;
    await developer.save();

    const webhookSummary = autoTest?.noWebhooksRegistered
      ? 'no webhook registered (polling-only integration)'
      : `${autoTest?.webhookTests?.filter((w) => w.passed).length ?? 0}/${autoTest?.webhookTests?.length ?? 0} webhooks acked`;
    const testSummary = autoTest
      ? `Auto-check: collect test ${autoTest.collectTest.passed ? 'passed' : 'FAILED'} (${escapeHtml(autoTest.collectTest.message)}), ${webhookSummary}.`
      : 'Auto-check could not be run — review manually.';

    logAudit({
      action: 'developer.live_access.requested', category: 'security', severity: 'info',
      message: 'Requested live API access',
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      metadata: {
        collectTestPassed: autoTest?.collectTest?.passed ?? null,
        webhookCount: autoTest?.webhookTests?.length ?? 0,
        webhookTestsPassed: autoTest?.webhookTests?.filter((w) => w.passed).length ?? 0,
      },
    });

    notifyAdmins({
      type: 'developer_live_access_requested',
      severity: autoTest && !autoTest.collectTest.passed ? 'warning' : 'info',
      subject: 'Developer requested live API access',
      heading: 'Live API Access Requested',
      details: `<strong>${escapeHtml(developer.companyName)}</strong> (${escapeHtml(developer.email)}) requested approval for live-mode API keys.<br><br>${testSummary}`,
      metadata: { developerId: String(developer._id), companyName: developer.companyName, email: developer.email, autoTestPassed: autoTest?.collectTest?.passed ?? null },
    });

    res.json({ success: true, message: 'Request submitted. An admin will review your account.' });
  } catch (error) {
    console.error('Request Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
