import express from 'express';
import rateLimit from 'express-rate-limit';
import { upload } from '../utils/cloudinary.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import {
  createApplication,
  getQueue,
  getMetrics,
  getApplication,
  claimApplication,
  updateChecklist,
  updateDocumentStatus,
  addNote,
  setRiskTier,
  approveApplication,
  requestRevision,
  rejectApplication,
  validateResubmitToken,
  resubmitDocuments,
} from '../controllers/officerController.js';

const router = express.Router();

// Viewing/acting on an existing application — including claiming one — is
// open to owner, admin, and officer per the product's RBAC table.
// Originating a brand-new application stays officer-only (that's the
// officer's specific job in the field, not something owner/admin do
// directly); claiming was officer-only for the same reason until an
// explicit product decision (2026-08-31) to let owner/admin claim and work
// applications themselves too, same as they can already approve/reject.
const viewOrAct = requireRole('owner', 'admin', 'officer');
const officerOnly = requireRole('officer');

const docFields = [
  { name: 'business_registration', maxCount: 1 },
  { name: 'kra_pin', maxCount: 1 },
  { name: 'national_id', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 },
];

// Application intake only — optional on-site photos (e.g. the shopfront) an
// officer captures as due-diligence evidence the business exists. Not part
// of the KYC checklist/revision workflow, so kept out of docFields (which
// the public kyc-resubmit route also uses) rather than added there.
const applicationFields = [...docFields, { name: 'business_photos', maxCount: 6 }];

// Throttle application intake the same way merchant onboarding is throttled.
const applicationCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many applications submitted. Slow down and try again later.' },
});

// Throttle the public resubmission endpoints against abuse/enumeration.
const resubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

router.get('/metrics', protect, viewOrAct, getMetrics);
router.get('/applications', protect, viewOrAct, getQueue);
router.post('/applications', protect, officerOnly, applicationCreateLimiter, upload.fields(applicationFields), createApplication);
router.get('/applications/:id', protect, viewOrAct, getApplication);
router.post('/applications/:id/claim', protect, viewOrAct, claimApplication);
router.patch('/applications/:id/checklist', protect, viewOrAct, updateChecklist);
router.patch('/applications/:id/documents/:docType', protect, viewOrAct, updateDocumentStatus);
router.post('/applications/:id/notes', protect, viewOrAct, addNote);
router.patch('/applications/:id/risk-tier', protect, viewOrAct, setRiskTier);
router.post('/applications/:id/approve', protect, viewOrAct, approveApplication);
router.post('/applications/:id/request-revision', protect, viewOrAct, requestRevision);
router.post('/applications/:id/reject', protect, viewOrAct, rejectApplication);

// Public — applicant-facing resubmission of flagged KYC documents.
router.get('/kyc-resubmit/:token', resubmitLimiter, validateResubmitToken);
router.post('/kyc-resubmit/:token', resubmitLimiter, upload.fields(docFields), resubmitDocuments);

export default router;
