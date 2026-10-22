import { v2 as cloudinary } from 'cloudinary';
// Side-effect import: applies cloudinary.config() with the account credentials.
import '../utils/cloudinary.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// KYC/KYB documents are uploaded with resource_type 'image' (see
// utils/cloudinary.js#uploadBufferToCloudinary), PDFs included. Cloudinary
// refuses to deliver PDFs stored that way over their plain URL unless the
// account-wide "Allow delivery of PDF and ZIP files" setting is on — every
// business-registration/KRA/permit PDF returned 401 "deny or ACL failure"
// in the admin console, while ID photos (JPG/PNG) opened fine.
//
// Instead of making every KYC PDF public by URL, the admin console asks
// for a short-lived signed download link here. Cloudinary's authenticated
// download API isn't subject to that delivery restriction, so it works for
// every document already uploaded — no re-upload or migration needed.

const SIGNED_URL_TTL_SECONDS = 5 * 60;

// .../<cloud>/(image|raw|video)/upload/[v123/]<public_id>.<ext>
function parseCloudinaryUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com') return null;
  const m = u.pathname.match(/^\/([^/]+)\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!m) return null;
  const [, cloud, resourceType, rest] = m;
  if (cloud !== process.env.CLOUDINARY_CLOUD_NAME) return null;
  const dot = rest.lastIndexOf('.');
  const format = dot > rest.lastIndexOf('/') ? rest.slice(dot + 1).toLowerCase() : '';
  const publicId = resourceType === 'raw' || !format ? rest : rest.slice(0, dot);
  return { resourceType, publicId, format };
}

// Returns a URL that will actually open for a stored document: images as-is,
// PDFs/other formats as a 5-minute signed download link. null if `rawUrl`
// isn't one of this account's Cloudinary assets.
export function documentViewUrl(rawUrl) {
  const parsed = parseCloudinaryUrl(rawUrl);
  if (!parsed) return null;
  const { resourceType, publicId, format } = parsed;
  if (resourceType === 'image' && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(format)) {
    return { url: String(rawUrl), signed: false, publicId, format };
  }
  const url = cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
  });
  return { url, signed: true, publicId, format };
}

// @desc    Short-lived link an admin can open for a stored KYC/KYB document.
//          Images come back unchanged (they already open); PDFs and any
//          other non-image format get a 5-minute signed download URL.
// @route   GET /api/admin/documents/view-url?url=<cloudinary url>
// @access  Private (Admin, not officer)
export const getDocumentViewUrl = async (req, res) => {
  try {
    const view = documentViewUrl(req.query.url);
    if (!view) return res.status(400).json({ error: 'Not a PayChain document link.' });

    if (view.signed) {
      logAudit({
        action: 'admin.document.viewed', category: 'admin', severity: 'info',
        message: `Opened document ${view.publicId}${view.format ? `.${view.format}` : ''}`,
        actor: adminActor(req.admin), req,
        metadata: { publicId: view.publicId, format: view.format },
      });
    }

    res.json({ success: true, url: view.url, expiresInSeconds: view.signed ? SIGNED_URL_TTL_SECONDS : null });
  } catch (error) {
    console.error('Get Document View URL Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
