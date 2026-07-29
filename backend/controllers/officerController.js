import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { generateUniquePaybillAccount, phoneVariations } from './adminController.js';
import { getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';
import { sendMerchantInvite, sendKybRevisionRequest, sendKybRejection } from '../utils/resend.js';

// Onboarding-officer application pipeline. Officers originate new merchant
// applications (business details + KYC documents) and drive them through a
// verification checklist; admins can view/act on the same queue per the
// product's RBAC table. Self-serve merchant signup (authController.js /
// merchantAuthController.js) is completely untouched by this file — it
// never sets kybStatus, so it never enters this queue.

export const QUEUE_DOC_TYPES = ['business_registration', 'kra_pin', 'national_id', 'address_proof'];

const MERCHANT_DASHBOARD_URL = process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

const officerActor = (admin) => admin ? ({
  type: 'officer',
  id: admin._id || null,
  email: admin.email || null,
  name: admin.name || admin.email || 'officer',
}) : { type: 'officer', id: null, email: null, name: 'officer' };

const adminActorPlain = (admin) => admin ? ({
  type: 'admin',
  id: admin._id || null,
  email: admin.email || null,
  name: admin.name || admin.email || 'admin',
}) : { type: 'admin', id: null, email: null, name: 'admin' };

// Picks the correct actor shape based on who's actually calling — an admin
// acting directly on the queue should log as 'admin', not 'officer'.
const actorFor = (admin) => (admin?.role === 'officer' ? officerActor(admin) : adminActorPlain(admin));

const CHECKLIST_KEYS = ['legalNameMatch', 'ubosIdentified', 'kraPinVerified', 'tillVerified', 'businessTypeCompliant'];

const isChecklistComplete = (checklist) => CHECKLIST_KEYS.every((k) => checklist?.[k] === true);

const QUEUE_LIST_FIELDS = 'name email phone businessName businessType submittedAt kybStatus riskTier claimedBy resubmissionCount kybDocuments';

// @desc    Officer submits a new merchant KYC application.
// @route   POST /api/officer/applications
// @access  Private (Officer)
export const createApplication = async (req, res) => {
  try {
    let { name, email, phone, businessName, businessType, kraPin, businessNumber } = req.body || {};

    if (!name || !email || !phone || !businessName) {
      return res.status(400).json({ error: 'Name, email, phone and business name are required.' });
    }

    email = String(email).trim().toLowerCase();
    phone = String(phone).replace(/\s+/g, '');
    name = String(name).trim();
    businessName = String(businessName).trim();
    businessType = businessType ? String(businessType).trim() : null;
    kraPin = kraPin ? String(kraPin).trim().toUpperCase() : null;
    businessNumber = businessNumber ? String(businessNumber).trim() : null;

    // Checked against every merchant regardless of kybStatus, so an officer
    // can't double-file a business that's already approved, pending, or
    // came through self-serve signup.
    if (await Merchant.exists({ email })) {
      return res.status(409).json({ error: 'A merchant with that email already exists.' });
    }
    if (await Merchant.exists({ phone: { $in: phoneVariations(phone) } })) {
      return res.status(409).json({ error: 'A merchant with that phone number already exists.' });
    }
    if (kraPin && await Merchant.exists({ kraPin })) {
      return res.status(409).json({ error: 'A merchant with that KRA PIN already exists.' });
    }
    if (businessNumber && await Merchant.exists({ businessNumber })) {
      return res.status(409).json({ error: 'A merchant with that business registration number already exists.' });
    }

    const files = req.files || {};
    const kybDocuments = QUEUE_DOC_TYPES.filter((t) => files[t]?.[0]).map((t) => ({
      type: t,
      url: files[t][0].path,
      uploadedAt: new Date(),
      status: 'pending',
    }));

    const merchant = await Merchant.create({
      name,
      email,
      phone,
      businessName,
      businessType,
      kraPin,
      businessNumber,
      isVerified: false,
      kybStatus: 'pending',
      kybDocuments,
      onboardingOfficerId: req.admin._id,
      submittedAt: new Date(),
      registrationSource: 'web',
    });

    logAudit({
      action: 'officer.application.created', category: 'admin', severity: 'info',
      message: `KYC application submitted for ${businessName}`,
      merchant, actor: officerActor(req.admin), req,
      metadata: { businessName, docsUploaded: kybDocuments.length },
    });

    const missingDocs = QUEUE_DOC_TYPES.filter((t) => !files[t]?.[0]);

    res.status(201).json({
      success: true,
      data: {
        _id: merchant._id,
        businessName: merchant.businessName,
        kybStatus: merchant.kybStatus,
        submittedAt: merchant.submittedAt,
        kybDocuments: merchant.kybDocuments,
        missingDocs,
      },
    });
  } catch (error) {
    console.error('Create Application Error:', error);
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const labels = { email: 'email', phone: 'phone number', kraPin: 'KRA PIN', businessNumber: 'business registration number' };
      return res.status(409).json({ error: `A merchant with that ${labels[key] || 'detail'} already exists.` });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    List the KYC application queue. Whole queue is visible to every
//          officer/admin — claiming only prevents concurrent editing.
// @route   GET /api/officer/applications?status=&riskTier=&from=&to=&page=&limit=
// @access  Private (Owner/Admin/Officer)
export const getQueue = async (req, res) => {
  try {
    const { status, riskTier, from, to, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const filter = { kybStatus: { $exists: true } };
    if (status) filter.kybStatus = status;
    if (riskTier) filter.riskTier = riskTier;
    if (from || to) {
      filter.submittedAt = {};
      if (from) filter.submittedAt.$gte = new Date(from);
      if (to) filter.submittedAt.$lte = new Date(to);
    }
    if (q) {
      const re = new RegExp(String(q).trim(), 'i');
      filter.$or = [{ businessName: re }, { name: re }, { email: re }, { phone: re }];
    }

    const [total, applications] = await Promise.all([
      Merchant.countDocuments(filter),
      Merchant.find(filter)
        .select(QUEUE_LIST_FIELDS)
        .populate('claimedBy', 'name email')
        .sort({ submittedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({ success: true, data: applications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    console.error('Get Queue Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Top summary counts for the officer dashboard.
// @route   GET /api/officer/metrics
// @access  Private (Owner/Admin/Officer)
export const getMetrics = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [pending, resubmitted, approvedToday, approvedThisWeek] = await Promise.all([
      Merchant.countDocuments({ kybStatus: 'pending' }),
      Merchant.countDocuments({ kybStatus: { $in: ['pending', 'requires_revision'] }, resubmissionCount: { $gt: 0 } }),
      Merchant.countDocuments({ kybStatus: 'approved', reviewedAt: { $gte: startOfToday } }),
      Merchant.countDocuments({ kybStatus: 'approved', reviewedAt: { $gte: startOfWeek } }),
    ]);

    res.json({ success: true, data: { pending, resubmitted, approvedToday, approvedThisWeek } });
  } catch (error) {
    console.error('Get Officer Metrics Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Full application detail for the verification workstation.
// @route   GET /api/officer/applications/:id
// @access  Private (Owner/Admin/Officer)
export const getApplication = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const application = await Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true } })
      .populate('claimedBy', 'name email')
      .populate('onboardingOfficerId', 'name email')
      .populate('reviewedBy', 'name email');
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get Application Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Claim an unclaimed application so no two officers work it at
//          once. Atomic conditional update — same concurrency-safety idiom
//          used for balance debits elsewhere in this codebase.
// @route   POST /api/officer/applications/:id/claim
// @access  Private (Officer)
export const claimApplication = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const application = await Merchant.findOneAndUpdate(
      { _id: req.params.id, claimedBy: null, kybStatus: { $in: ['pending', 'requires_revision'] } },
      { $set: { claimedBy: req.admin._id, claimedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!application) {
      return res.status(409).json({ error: 'Already claimed by another officer, or not in a claimable state.' });
    }

    logAudit({
      action: 'officer.application.claimed', category: 'admin', severity: 'info',
      message: `Claimed by ${req.admin.name || req.admin.email}`,
      merchant: application, actor: officerActor(req.admin), req,
    });

    res.json({ success: true, data: { _id: application._id, claimedBy: application.claimedBy, claimedAt: application.claimedAt } });
  } catch (error) {
    console.error('Claim Application Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle checklist items on an application.
// @route   PATCH /api/officer/applications/:id/checklist
// @access  Private (Owner/Admin/Officer)
export const updateChecklist = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const updates = {};
    for (const key of CHECKLIST_KEYS) {
      if (typeof req.body?.[key] === 'boolean') updates[`kybChecklist.${key}`] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid checklist fields provided.' });
    }

    const application = await Merchant.findOneAndUpdate(
      { _id: req.params.id, kybStatus: { $exists: true } },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    logAudit({
      action: 'officer.application.checklist_updated', category: 'admin', severity: 'info',
      message: `Checklist updated: ${Object.keys(updates).join(', ')}`,
      merchant: application, actor: actorFor(req.admin), req,
    });

    res.json({ success: true, data: application.kybChecklist });
  } catch (error) {
    console.error('Update Checklist Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Flag a specific uploaded document approved/rejected.
// @route   PATCH /api/officer/applications/:id/documents/:docType
// @access  Private (Owner/Admin/Officer)
export const updateDocumentStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const { docType } = req.params;
    const { status, note } = req.body || {};
    if (!QUEUE_DOC_TYPES.includes(docType)) return res.status(400).json({ error: 'Invalid document type.' });
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'status must be approved, rejected, or pending.' });

    const application = await Merchant.findOneAndUpdate(
      { _id: req.params.id, kybStatus: { $exists: true }, 'kybDocuments.type': docType },
      { $set: { 'kybDocuments.$.status': status, 'kybDocuments.$.note': note || null } },
      { returnDocument: 'after' }
    );
    if (!application) return res.status(404).json({ error: 'Application or document not found.' });

    logAudit({
      action: 'officer.application.document_reviewed', category: 'admin', severity: 'info',
      message: `${docType} marked ${status}`,
      merchant: application, actor: actorFor(req.admin), req,
      metadata: { docType, status },
    });

    res.json({ success: true, data: application.kybDocuments });
  } catch (error) {
    console.error('Update Document Status Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Add an internal note to an application's review thread.
// @route   POST /api/officer/applications/:id/notes
// @access  Private (Owner/Admin/Officer)
export const addNote = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const note = String(req.body?.note || '').trim();
    if (!note) return res.status(400).json({ error: 'Note text is required.' });

    const entry = { authorId: req.admin._id, authorName: req.admin.name || req.admin.email, note, createdAt: new Date() };
    const application = await Merchant.findOneAndUpdate(
      { _id: req.params.id, kybStatus: { $exists: true } },
      { $push: { kybNotes: entry } },
      { returnDocument: 'after' }
    );
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    logAudit({
      action: 'officer.application.note_added', category: 'admin', severity: 'info',
      message: 'Internal note added',
      merchant: application, actor: actorFor(req.admin), req,
    });

    res.json({ success: true, data: application.kybNotes });
  } catch (error) {
    console.error('Add Note Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Assign or override an application's risk tier.
// @route   PATCH /api/officer/applications/:id/risk-tier
// @access  Private (Owner/Admin/Officer)
export const setRiskTier = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const { riskTier } = req.body || {};
    if (!['low', 'medium', 'high'].includes(riskTier)) {
      return res.status(400).json({ error: 'riskTier must be low, medium, or high.' });
    }

    const before = await Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true } }).select('riskTier');
    if (!before) return res.status(404).json({ error: 'Application not found.' });
    const previous = before.riskTier || null;

    const application = await Merchant.findByIdAndUpdate(req.params.id, { $set: { riskTier } }, { returnDocument: 'after' });

    logAudit({
      action: 'officer.application.risk_tier_set', category: 'admin', severity: 'info',
      message: `Risk tier set to ${riskTier}`,
      merchant: application, actor: actorFor(req.admin), req,
      metadata: { riskTier, previous },
    });

    res.json({ success: true, data: { riskTier: application.riskTier } });
  } catch (error) {
    console.error('Set Risk Tier Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve and activate an application. Mirrors adminController's
//          createMerchant activation half — paybill generation, setup link,
//          invite email — just gated behind the checklist instead of
//          happening immediately.
// @route   POST /api/officer/applications/:id/approve
// @access  Private (Owner/Admin/Officer)
export const approveApplication = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const application = await Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true } });
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.kybStatus === 'approved') return res.status(400).json({ error: 'Application is already approved.' });

    // Server-side re-verification — never trust the client's "all checked"
    // UI state, this is the actual security gate.
    if (!isChecklistComplete(application.kybChecklist)) {
      return res.status(400).json({ error: 'All checklist items must be verified before approval.' });
    }
    if (!application.riskTier) {
      return res.status(400).json({ error: 'Assign a risk tier before approving.' });
    }

    const paybillAccount = await generateUniquePaybillAccount();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    application.isVerified = true;
    application.kybStatus = 'approved';
    application.paybillAccount = paybillAccount;
    application.passwordResetToken = hashedToken;
    application.passwordResetExpires = expires;
    application.reviewedAt = new Date();
    application.reviewedBy = req.admin._id;
    await application.save();

    const setupLink = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;
    sendMerchantInvite(
      application.email, application.name, application.businessName, paybillAccount, setupLink,
      getNcbaVirtualAccountNumber(application.ncbaMerchantCode), application.ncbaMerchantCode
    ).catch((err) => console.error(`📧 Failed to send approval invite to ${application.email}:`, err));

    logAudit({
      action: 'officer.application.approved', category: 'admin', severity: 'success',
      message: `Approved and activated — invite sent to ${application.email}`,
      merchant: application, actor: actorFor(req.admin), req,
      metadata: { paybillAccount, riskTier: application.riskTier },
    });

    res.json({ success: true, data: { _id: application._id, kybStatus: 'approved', isVerified: true, paybillAccount } });
  } catch (error) {
    console.error('Approve Application Error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'Could not allocate account details — please retry.' });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Soft-reject: flags specific documents and lets the applicant fix
//          just those via a public resubmission link, without redoing the
//          whole application.
// @route   POST /api/officer/applications/:id/request-revision
// @access  Private (Owner/Admin/Officer)
export const requestRevision = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const docTypes = Array.isArray(req.body?.docTypes) ? req.body.docTypes.filter((t) => QUEUE_DOC_TYPES.includes(t)) : [];
    const message = String(req.body?.message || '').trim();
    if (docTypes.length === 0) return res.status(400).json({ error: 'Select at least one document type that needs fixing.' });
    if (!message) return res.status(400).json({ error: 'A message for the applicant is required.' });

    const application = await Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true } });
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    for (const doc of application.kybDocuments) {
      if (docTypes.includes(doc.type)) {
        doc.status = 'rejected';
        doc.note = message;
      }
    }
    application.kybStatus = 'requires_revision';

    const rawToken = crypto.randomBytes(32).toString('hex');
    application.kybResubmitToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    application.kybResubmitTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await application.save();

    const resubmitLink = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/kyc-resubmit?token=${rawToken}`;
    sendKybRevisionRequest(application.email, application.name, application.businessName, docTypes, message, resubmitLink).catch((err) => {
      console.error(`📧 Failed to send revision request to ${application.email}:`, err);
    });

    logAudit({
      action: 'officer.application.revision_requested', category: 'admin', severity: 'warning',
      message: `Revision requested: ${docTypes.join(', ')}`,
      merchant: application, actor: actorFor(req.admin), req,
      metadata: { docTypes, message },
    });

    res.json({ success: true, data: { kybStatus: application.kybStatus } });
  } catch (error) {
    console.error('Request Revision Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Hard reject. Requires a mandatory internal note (never shown to
//          the applicant — only a generic notice is sent, if any).
// @route   POST /api/officer/applications/:id/reject
// @access  Private (Owner/Admin/Officer)
export const rejectApplication = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const note = String(req.body?.note || '').trim();
    if (!note) return res.status(400).json({ error: 'An internal note is required to reject an application.' });

    const application = await Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true } });
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    application.kybStatus = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = req.admin._id;
    application.kybNotes.push({ authorId: req.admin._id, authorName: req.admin.name || req.admin.email, note, createdAt: new Date() });
    await application.save();

    sendKybRejection(application.email, application.name, application.businessName).catch((err) => {
      console.error(`📧 Failed to send rejection notice to ${application.email}:`, err);
    });

    logAudit({
      action: 'officer.application.rejected', category: 'admin', severity: 'critical',
      message: `Rejected — ${note}`,
      merchant: application, actor: actorFor(req.admin), req,
      metadata: { note },
    });

    res.json({ success: true, data: { kybStatus: application.kybStatus } });
  } catch (error) {
    console.error('Reject Application Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Public (no auth) — applicant self-service document resubmission ──────

// @desc    Validate a resubmission token before showing the public form.
// @route   GET /api/officer/kyc-resubmit/:token
// @access  Public
export const validateResubmitToken = async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
    const application = await Merchant.findOne({
      kybResubmitToken: tokenHash,
      kybResubmitTokenExpires: { $gt: new Date() },
    }).select('+kybResubmitToken +kybResubmitTokenExpires businessName kybDocuments');
    if (!application) return res.status(400).json({ error: 'This link is invalid or has expired.' });

    const flagged = application.kybDocuments.filter((d) => d.status === 'rejected');
    res.json({
      success: true,
      data: {
        businessName: application.businessName,
        flagged: flagged.map((d) => ({ type: d.type, note: d.note })),
      },
    });
  } catch (error) {
    console.error('Validate Resubmit Token Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Applicant re-uploads flagged documents. Single-use token, re-queues
//          the application and clears the claim so it's picked up fresh.
// @route   POST /api/officer/kyc-resubmit/:token
// @access  Public
export const resubmitDocuments = async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
    const application = await Merchant.findOne({
      kybResubmitToken: tokenHash,
      kybResubmitTokenExpires: { $gt: new Date() },
    }).select('+kybResubmitToken +kybResubmitTokenExpires');
    if (!application) return res.status(400).json({ error: 'This link is invalid or has expired.' });

    const files = req.files || {};
    let replaced = 0;
    for (const t of QUEUE_DOC_TYPES) {
      if (!files[t]?.[0]) continue;
      const existing = application.kybDocuments.find((d) => d.type === t);
      if (existing) {
        existing.url = files[t][0].path;
        existing.uploadedAt = new Date();
        existing.status = 'pending';
        existing.note = null;
      } else {
        application.kybDocuments.push({ type: t, url: files[t][0].path, uploadedAt: new Date(), status: 'pending' });
      }
      replaced += 1;
    }
    if (replaced === 0) return res.status(400).json({ error: 'No documents were uploaded.' });

    application.kybStatus = 'pending';
    application.resubmissionCount = (application.resubmissionCount || 0) + 1;
    application.claimedBy = null;
    application.claimedAt = null;
    application.kybResubmitToken = null;
    application.kybResubmitTokenExpires = null;
    await application.save();

    logAudit({
      action: 'merchant.kyc.resubmitted', category: 'admin', severity: 'info',
      message: `Applicant resubmitted ${replaced} document(s)`,
      merchant: application, actor: { type: 'self', id: application._id, email: application.email, name: application.name }, req,
      metadata: { replaced },
    });

    res.json({ success: true, data: { kybStatus: application.kybStatus } });
  } catch (error) {
    console.error('Resubmit Documents Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};
