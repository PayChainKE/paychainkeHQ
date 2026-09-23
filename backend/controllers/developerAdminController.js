import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import ApiKey from '../models/ApiKey.js';
import { linkedMerchantIds, liveAccessFor, liveAccessSummary } from '../utils/developerMerchants.js';
import { migrateLegacyLink } from '../services/developerMerchantLinkService.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import STKRequest from '../models/STKRequest.js';
import { initiateCollectPayment, syncLiveCollectFromStkRequest, CollectValidationError } from '../services/developerCollectService.js';
import { validatePhoneNumber } from '../utils/ncbaValidators.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import Developer from '../models/Developer.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import Contact from '../models/Contact.js';
import { logAudit } from '../utils/auditLog.js';
import { runIntegrationTestForDeveloper } from '../services/developerIntegrationTestService.js';
import { sendSupportReply } from '../utils/resend.js';

// A developer as the admin dashboard needs it: the account, plus each linked
// merchant with its own live-access state (approval is per merchant), and a
// summary `liveAccess` for the list badges.
async function describeDevelopers(developers) {
  const ids = new Set();
  developers.forEach((d) => linkedMerchantIds(d).forEach((id) => ids.add(String(id))));
  const docs = ids.size ? await Merchant.find({ _id: { $in: [...ids] } }).select('businessName email') : [];
  const byId = new Map(docs.map((m) => [String(m._id), m]));
  return developers.map((d) => {
    const plain = d.toObject ? d.toObject() : d;
    const merchants = linkedMerchantIds(d).map((id) => ({
      merchantId: id,
      businessName: byId.get(String(id))?.businessName || null,
      email: byId.get(String(id))?.email || null,
      liveAccess: liveAccessFor(d, id),
    }));
    const summary = liveAccessSummary(d);
    // autoTest of the pending request, for the badge on the list row.
    const pending = merchants.find((m) => !m.liveAccess.approved && m.liveAccess.requestedAt);
    return { ...plain, merchants, liveAccess: { ...(plain.liveAccess || {}), ...summary, autoTest: pending?.liveAccess.autoTest ?? null } };
  });
}

// Picks which of a developer's linked merchants an admin action is for.
function resolveTargetMerchant(developer, requested) {
  const ids = linkedMerchantIds(developer);
  if (requested) return ids.find((id) => String(id) === String(requested)) || null;
  return ids.length === 1 ? ids[0] : null;
}

// @desc    List developer accounts (filterable by live-access review state)
// @route   GET /api/admin/developers
// @access  Private (Admin — owner/admin/analyst)
export const listDevelopers = async (req, res) => {
  try {
    const { liveAccessStatus, page = 1, pageSize = 25 } = req.query;
    const filter = {};
    // Per merchant, with the old developer-level fields still honoured for a
    // developer whose single link has not been migrated yet.
    if (liveAccessStatus === 'requested') {
      filter.$or = [
        { linkedMerchants: { $elemMatch: { 'liveAccess.requestedAt': { $ne: null }, 'liveAccess.approved': false } } },
        { 'linkedMerchants.0': { $exists: false }, 'liveAccess.approved': false, 'liveAccess.requestedAt': { $ne: null } },
      ];
    } else if (liveAccessStatus === 'approved') {
      filter.$or = [
        { 'linkedMerchants.liveAccess.approved': true },
        { 'linkedMerchants.0': { $exists: false }, 'liveAccess.approved': true },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const [developers, total] = await Promise.all([
      Developer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
      Developer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: await describeDevelopers(developers),
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.max(1, Math.ceil(total / Number(pageSize))),
    });
  } catch (error) {
    console.error('List Developers Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve live (real-money) API keys for ONE of a developer's merchants
// @route   PATCH /api/admin/developers/:id/approve-live   body: { merchantId }
// @access  Private (Admin — owner/admin)
export const approveLiveAccess = async (req, res) => {
  try {
    // Moves a legacy single link into the per-merchant list first.
    const developer = await migrateLegacyLink(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    if (linkedMerchantIds(developer).length === 0) {
      return res.status(400).json({ error: 'This developer has not linked a real merchant account yet, so live access cannot be approved.', code: 'NO_LINKED_MERCHANT' });
    }
    const merchantId = resolveTargetMerchant(developer, req.body?.merchantId);
    if (!merchantId) {
      return res.status(400).json({ error: 'Say which of the developer\'s merchants this is for (merchantId).', code: 'MERCHANT_REQUIRED' });
    }

    await Developer.updateOne(
      { _id: developer._id, 'linkedMerchants.merchantId': merchantId },
      { $set: {
        'linkedMerchants.$.liveAccess.approved': true,
        'linkedMerchants.$.liveAccess.approvedAt': new Date(),
        'linkedMerchants.$.liveAccess.approvedBy': req.admin._id,
      } }
    );
    const merchantDoc = await Merchant.findById(merchantId).select('businessName');

    logAudit({
      action: 'admin.developer.live_access_approved', category: 'admin', severity: 'warning',
      message: `${req.admin.name || req.admin.email} approved live API access for ${developer.companyName} on merchant ${merchantDoc?.businessName || merchantId}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName, merchantId: String(merchantId) },
    });

    const [described] = await describeDevelopers([await Developer.findById(developer._id)]);
    res.json({ success: true, developer: described });
  } catch (error) {
    console.error('Approve Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    A developer's registered webhook endpoints, with delivery health
//          — lets support/ops see at a glance whether an integration (an
//          ISP's reconnection system, a CRM sync) is actually receiving
//          events, without needing DB access. Never exposes the signing
//          secret (`-secret`) — admins don't need it, only PayChain's own
//          delivery worker does.
// @route   GET /api/admin/developers/:id/webhooks
// @access  Private (Admin — owner/admin/analyst)
export const getDeveloperWebhooks = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const webhooks = await DeveloperWebhook.find({ developerId: developer._id }).select('-secret').sort({ createdAt: -1 });

    const data = await Promise.all(webhooks.map(async (webhook) => {
      const [statusCounts, recentDeliveries] = await Promise.all([
        WebhookDelivery.aggregate([
          { $match: { webhookId: webhook._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        WebhookDelivery.find({ webhookId: webhook._id }).sort({ createdAt: -1 }).limit(10),
      ]);

      const deliveryStats = { pending: 0, success: 0, failed: 0, exhausted: 0 };
      statusCounts.forEach((row) => { deliveryStats[row._id] = row.count; });

      return {
        _id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        lastDeliveryAt: webhook.lastDeliveryAt,
        lastDeliveryStatus: webhook.lastDeliveryStatus,
        createdAt: webhook.createdAt,
        deliveryStats,
        recentDeliveries: recentDeliveries.map((d) => ({
          _id: d._id,
          event: d.event,
          status: d.status,
          attempts: d.attempts,
          lastResponseCode: d.lastResponseCode,
          lastError: d.lastError,
          createdAt: d.createdAt,
        })),
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get Developer Webhooks Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reject a live-access request, or revoke approval, for ONE of a
//          developer's merchants. Sandbox access is untouched. Revoking an
//          approved merchant also revokes that merchant's live API keys.
// @route   PATCH /api/admin/developers/:id/reject-live   body: { merchantId }
// @access  Private (Admin — owner/admin)
export const rejectLiveAccess = async (req, res) => {
  try {
    const developer = await migrateLegacyLink(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const merchantId = resolveTargetMerchant(developer, req.body?.merchantId);
    if (!merchantId) {
      return res.status(400).json({ error: 'Say which of the developer\'s merchants this is for (merchantId).', code: 'MERCHANT_REQUIRED' });
    }

    const wasApproved = liveAccessFor(developer, merchantId).approved;
    await Developer.updateOne(
      { _id: developer._id, 'linkedMerchants.merchantId': merchantId },
      { $set: {
        'linkedMerchants.$.liveAccess.approved': false,
        'linkedMerchants.$.liveAccess.requestedAt': null,
        'linkedMerchants.$.liveAccess.approvedAt': null,
        'linkedMerchants.$.liveAccess.approvedBy': null,
      } }
    );
    let keysRevoked = 0;
    if (wasApproved) {
      const r = await ApiKey.updateMany(
        { developerId: developer._id, merchantId, mode: 'live', status: 'active' },
        { $set: { status: 'revoked', revokedAt: new Date() } }
      );
      keysRevoked = r.modifiedCount;
    }
    const merchantDoc = await Merchant.findById(merchantId).select('businessName');

    logAudit({
      action: 'admin.developer.live_access_rejected', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} ${wasApproved ? 'revoked' : 'rejected'} live API access for ${developer.companyName} on merchant ${merchantDoc?.businessName || merchantId}${keysRevoked ? ` (${keysRevoked} live key(s) revoked)` : ''}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName, merchantId: String(merchantId), keysRevoked },
    });

    const [described] = await describeDevelopers([await Developer.findById(developer._id)]);
    res.json({ success: true, developer: described, keysRevoked });
  } catch (error) {
    console.error('Reject Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Runs two live checks of a developer's integration before an
//          admin approves live access — see
//          services/developerIntegrationTestService.js for what they check
//          and why. Same test the developer's own live-access request
//          already auto-runs (developerController.js#requestLiveAccess);
//          this route lets an admin re-run it on demand — e.g. after
//          telling a developer to fix something and waiting for them to
//          confirm.
// @route   POST /api/admin/developers/:id/run-integration-test
// @access  Private (Admin — owner/admin/analyst)
export const runIntegrationTest = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const result = await runIntegrationTestForDeveloper(developer);

    logAudit({
      action: 'admin.developer.integration_test_run', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} ran an integration test for ${developer.companyName}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: {
        developerId: String(developer._id),
        companyName: developer.companyName,
        collectTestPassed: result.collectTest.passed,
        webhookCount: result.webhookTests.length,
        webhookTestsPassed: result.webhookTests.filter((w) => w.passed).length,
      },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Run Integration Test Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get the admin↔developer email conversation for one developer.
//          One running thread per developer (a single Contact document,
//          re-used across every email sent to them — see sendDeveloperEmail
//          below), not a fresh thread per message. Returns null when
//          nothing has ever been sent to this developer yet.
// @route   GET /api/admin/developers/:id/messages
// @access  Private (Admin — owner/admin/analyst)
export const getDeveloperMessages = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const thread = await Contact.findOne({ developerId: developer._id }).lean();
    res.json({ success: true, data: thread || null });
  } catch (error) {
    console.error('Get Developer Messages Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a real email to a developer (approval/rejection notice, a
//          nudge to link their merchant account, or any custom message —
//          the admin frontend supplies canned templates, this endpoint
//          just sends whatever subject/body it's given) and record it in
//          that developer's conversation thread. Reuses the exact same
//          Resend-backed send + delivery-id tracking the merchant-facing
//          Contact/Messages feature already uses (sendSupportReply), so
//          delivery failures are surfaced rather than silently "sent".
//
//          Note: unlike a real two-way inbox, a developer hitting "Reply"
//          in their email client does NOT appear here automatically — this
//          codebase has no inbound-email webhook anywhere yet (the
//          Contact/Messages reply_to already points at the sending admin's
//          own address, not a monitored inbox). This endpoint only records
//          what PayChain sends, not what comes back.
// @route   POST /api/admin/developers/:id/messages
// @access  Private (Admin — owner/admin)
export const sendDeveloperEmail = async (req, res) => {
  try {
    const { subject, body } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    if (!body || String(body).trim().length < 2) {
      return res.status(400).json({ error: 'Message body cannot be empty.' });
    }
    if (String(body).length > 10000) {
      return res.status(400).json({ error: 'Message body too long.' });
    }

    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    let resendId = null;
    try {
      const sent = await sendSupportReply(developer.email, developer.name, subject, body, req.admin?.email, []);
      resendId = sent?.data?.id || sent?.id || null;
    } catch (mailErr) {
      return res.status(502).json({ error: 'Failed to send the email. Nothing was recorded.' });
    }

    const entry = {
      body: String(body).trim(),
      subject: String(subject).trim(),
      attachments: [],
      sentByEmail: req.admin?.email || 'support@paychain.co.ke',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
      resendId,
    };

    let thread = await Contact.findOne({ developerId: developer._id });
    if (!thread) {
      // First email ever sent to this developer — the Contact schema
      // requires a top-level subject/message, but the frontend renders
      // this thread purely from `replies` (see entry pushed below), so
      // these top-level fields exist only to satisfy the schema/for
      // searchability in the general Messages inbox, not for display here.
      thread = await Contact.create({
        name: developer.name,
        email: developer.email,
        contactType: 'developer',
        developerId: developer._id,
        subject: entry.subject,
        message: entry.body,
        isRead: true,
        status: 'in_progress',
        replies: [entry],
        lastRepliedAt: entry.sentAt,
      });
    } else {
      thread.replies.push(entry);
      thread.lastRepliedAt = entry.sentAt;
      thread.isRead = true;
      if (thread.status === 'open') thread.status = 'in_progress';
      await thread.save();
    }

    logAudit({
      action: 'admin.developer.email_sent', category: 'admin', severity: 'info',
      message: `${req.admin?.name || req.admin?.email} emailed ${developer.companyName}: "${entry.subject}"`,
      req, actor: { type: 'admin', id: req.admin?._id, email: req.admin?.email, name: req.admin?.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName, subject: entry.subject },
    });

    res.json({ success: true, data: thread });
  } catch (error) {
    console.error('Send Developer Email Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Live test: a small REAL payment, started by an admin ────────────────────
// Checks a developer's linked merchant end to end (the STK push reaches a phone,
// the money lands in that merchant's wallet). Money IN only: it never pays
// anything out, because a payout would spend the merchant's own balance and
// bypass the merchant's payout PIN and limits.
//
// Guardrails: owner/admin only, a hard amount cap, a phone chosen from three
// known parties (the admin's own, the developer's, or the merchant's) or typed
// in directly, one test at a time per merchant, rate limited, and audited.
// By default no webhook is sent to the developer's endpoints, so their system
// never mistakes it for a real customer payment.
const LIVE_TEST_MAX_KES = () => Math.max(1, Number(process.env.ADMIN_LIVE_TEST_MAX_KES) || 50);

// 254733444555 -> 0733***555. Never send a full number to the browser.
const maskPhone = (p) => (p ? (() => { const local = `0${String(p).replace(/^\+?254/, '')}`; return `${local.slice(0, 4)}${'*'.repeat(Math.max(0, local.length - 7))}${local.slice(-3)}`; })() : null);

// Resolves the phones an admin may send a test to: three known parties, plus
// "custom" — always offered, so an admin can type any Kenyan number (e.g. a
// tester's phone that isn't the developer's or merchant's contact on file).
async function livePhoneChoices(developer, admin, merchantId, customPhone) {
  const merchant = merchantId ? await Merchant.findById(merchantId).select('businessName phone') : null;
  const raw = { admin: admin?.phone, developer: developer?.phone, merchant: merchant?.phone };
  const labels = { admin: 'My phone', developer: 'The developer\'s phone', merchant: `The merchant's phone (${merchant?.businessName || 'merchant'})`, custom: 'Another number' };
  const out = [];
  for (const source of ['admin', 'developer', 'merchant']) {
    let normalized = null;
    try { normalized = raw[source] ? validatePhoneNumber(raw[source]) : null; } catch { normalized = null; }
    out.push({ source, label: labels[source], hint: maskPhone(normalized), available: !!normalized, normalized });
  }
  let customNormalized = null;
  let customError = null;
  if (customPhone) {
    try { customNormalized = validatePhoneNumber(customPhone); }
    catch { customError = 'Not a valid Kenyan phone number.'; }
  }
  out.push({
    source: 'custom', label: labels.custom, hint: customNormalized ? maskPhone(customNormalized) : (customError || 'type a number'),
    available: !!customNormalized, normalized: customNormalized, freeText: true,
  });
  return { merchant, choices: out };
}

// @desc    What an admin can pick for a live test on one merchant.
// @route   GET /api/admin/developers/:id/live-test/options?merchantId=
// @access  Private (Admin — owner/admin)
export const getLiveTestOptions = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });
    const merchantId = resolveTargetMerchant(developer, req.query?.merchantId);
    if (!merchantId) return res.status(400).json({ error: 'Choose one of the developer\'s merchants.', code: 'MERCHANT_REQUIRED' });
    const { merchant, choices } = await livePhoneChoices(developer, req.admin, merchantId, null);
    res.json({
      success: true,
      merchant: { merchantId, businessName: merchant?.businessName || null },
      maxAmount: LIVE_TEST_MAX_KES(),
      phones: choices.map(({ normalized, ...c }) => c),
    });
  } catch (error) {
    console.error('Live Test Options Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// The raw NCBA/Daraja result behind a live test — what an admin copies into a
// message to the developer so they're not just told "it failed," they see the
// actual reason. ncbaReason is only ever meaningful once the push resolves,
// so it's left out while still pending or once it resolved successfully.
async function buildDiagnostic(payment) {
  if (!payment.linkedStkCheckoutId) return null;
  const stk = await STKRequest.findOne({ checkoutRequestId: payment.linkedStkCheckoutId })
    .select('checkoutRequestId status resultDesc ncbaReason');
  if (!stk) return null;
  return {
    checkoutRequestId: stk.checkoutRequestId,
    resultDesc: stk.resultDesc || null,
    ncbaReason: stk.status === 'failed' ? (stk.ncbaReason || null) : null,
  };
}

// @desc    Start a small real STK push into one of the developer's merchants.
// @route   POST /api/admin/developers/:id/live-test   body: { merchantId, phoneSource, amount, deliverWebhook }
// @access  Private (Admin — owner/admin)
export const startLiveTest = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });
    if (developer.status !== 'active') return res.status(400).json({ error: 'This developer account is not active.' });

    const merchantId = resolveTargetMerchant(developer, req.body?.merchantId);
    if (!merchantId) return res.status(400).json({ error: 'Choose one of the developer\'s merchants.', code: 'MERCHANT_REQUIRED' });

    const amount = Math.ceil(Number(req.body?.amount));
    const max = LIVE_TEST_MAX_KES();
    if (!Number.isFinite(amount) || amount < 1 || amount > max) {
      return res.status(400).json({ error: `Amount must be a whole number of KES between 1 and ${max}.`, code: 'AMOUNT_OUT_OF_RANGE' });
    }

    const { merchant, choices } = await livePhoneChoices(developer, req.admin, merchantId, req.body?.customPhone);
    const choice = choices.find((c) => c.source === req.body?.phoneSource);
    if (!choice) return res.status(400).json({ error: 'Choose whose phone receives the M-PESA prompt.', code: 'PHONE_SOURCE_REQUIRED' });
    if (!choice.available) {
      return res.status(400).json({
        error: choice.freeText ? 'Enter a valid Kenyan phone number.' : 'There is no valid phone number on file for that choice.',
        code: 'PHONE_UNAVAILABLE',
      });
    }

    // One at a time per merchant: a double-click must not send two prompts.
    const recent = await DeveloperPayment.findOne({
      developerId: developer._id, merchantId, origin: 'admin_test', status: 'pending', createdAt: { $gte: new Date(Date.now() - 3 * 60 * 1000) },
    });
    if (recent) return res.status(409).json({ error: 'A test for this merchant is still waiting for the M-PESA prompt. Let it finish or expire first.', code: 'TEST_IN_PROGRESS', paymentId: recent._id });

    const deliverWebhook = req.body?.deliverWebhook === true;
    let payment;
    try {
      payment = await initiateCollectPayment({
        developerId: developer._id,
        apiKeyId: null,
        merchantId,
        mode: 'live',
        amount,
        phone: choice.normalized,
        reference: `admin-test-${String(new mongoose.Types.ObjectId()).slice(-8)}`,
        idempotencyKey: `admin-live-test-${req.admin._id}-${Date.now()}`,
        origin: 'admin_test',
        testedBy: req.admin._id,
        suppressWebhooks: !deliverWebhook,
      });
    } catch (e) {
      if (e instanceof CollectValidationError) return res.status(400).json({ error: e.message });
      throw e;
    }

    logAudit({
      action: 'admin.developer.live_test', category: 'admin', severity: 'warning',
      message: `${req.admin.name || req.admin.email} started a real KES ${amount} test payment for ${developer.companyName} into ${merchant?.businessName || merchantId}, to ${choice.label.toLowerCase()} (${choice.hint})`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { developerId: String(developer._id), merchantId: String(merchantId), paymentId: String(payment._id), amount, phoneSource: choice.source, deliverWebhook },
    });

    res.status(201).json({
      success: true,
      payment: { ...publicDeveloperPayment(payment), webhooksSent: deliverWebhook },
      diagnostic: await buildDiagnostic(payment),
      sentTo: choice.hint,
      merchant: { merchantId, businessName: merchant?.businessName || null },
    });
  } catch (error) {
    console.error('Start Live Test Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Status of a live test (the page polls this while the prompt is open).
// @route   GET /api/admin/developers/:id/live-test/:paymentId
// @access  Private (Admin — owner/admin)
export const getLiveTest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) return res.status(404).json({ error: 'Test not found.' });
    const payment = await DeveloperPayment.findOne({ _id: req.params.paymentId, developerId: req.params.id, origin: 'admin_test' });
    if (!payment) return res.status(404).json({ error: 'Test not found.' });
    await syncLiveCollectFromStkRequest(payment);
    res.json({
      success: true,
      payment: { ...publicDeveloperPayment(payment), webhooksSent: !payment.suppressWebhooks },
      diagnostic: await buildDiagnostic(payment),
    });
  } catch (error) {
    console.error('Get Live Test Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    The last few live tests run for this developer, across all its
//          merchants — so an admin re-opening this page can see whether it's
//          already been verified, without starting a new real payment.
// @route   GET /api/admin/developers/:id/live-test/history
// @access  Private (Admin — owner/admin)
export const getLiveTestHistory = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });
    const payments = await DeveloperPayment.find({ developerId: developer._id, origin: 'admin_test' })
      .sort({ createdAt: -1 }).limit(15)
      .populate('merchantId', 'businessName')
      .populate('testedBy', 'name email');
    res.json({
      success: true,
      tests: payments.map((p) => ({
        id: p._id,
        merchant: p.merchantId ? { merchantId: p.merchantId._id, businessName: p.merchantId.businessName } : null,
        amount: p.amount,
        status: p.status,
        failureReason: p.failureReason,
        webhooksSent: !p.suppressWebhooks,
        testedBy: p.testedBy ? (p.testedBy.name || p.testedBy.email) : null,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Live Test History Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
