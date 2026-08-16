import crypto from 'crypto';
import Developer from '../models/Developer.js';
import ApiKey from '../models/ApiKey.js';
import { logAudit } from '../utils/auditLog.js';
import { notifyAdmins } from '../utils/securityAlerts.js';

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

// @desc    Ask an admin to review this account for live (real-money) API access
// @route   POST /api/developer/live-access/request
// @access  Private (Developer)
export const requestLiveAccess = async (req, res) => {
  try {
    const developer = await Developer.findById(req.developer._id);
    if (developer.liveAccess?.approved) {
      return res.status(400).json({ error: 'Live access is already approved for this account.' });
    }

    developer.liveAccess = developer.liveAccess || {};
    developer.liveAccess.requestedAt = new Date();
    await developer.save();

    notifyAdmins({
      type: 'developer_live_access_requested',
      severity: 'info',
      subject: 'Developer requested live API access',
      heading: 'Live API Access Requested',
      details: `<strong>${developer.companyName}</strong> (${developer.email}) requested approval for live-mode API keys.`,
      metadata: { developerId: String(developer._id), companyName: developer.companyName, email: developer.email },
    });

    res.json({ success: true, message: 'Request submitted. An admin will review your account.' });
  } catch (error) {
    console.error('Request Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
