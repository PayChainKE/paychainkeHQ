import api from '../api/api';

// Opens a stored KYC/KYB document in a new tab. Business PDFs don't open
// over their plain Cloudinary URL (Cloudinary blocks PDF delivery on this
// account — 401 "deny or ACL failure"), so non-image documents go through
// the backend for a short-lived signed link first (see
// backend/controllers/documentViewController.js). Photos open directly.
//
// The tab is opened synchronously, before the request, so the browser's
// popup blocker treats it as part of the click.
const isImageUrl = (url) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(String(url));

export default async function openDocument(url) {
  if (!url) return;
  if (isImageUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const tab = window.open('', '_blank');
  if (tab) tab.document.write('<p style="font-family:sans-serif;padding:24px;color:#555">Opening document…</p>');
  try {
    const res = await api.get('/api/admin/documents/view-url', { params: { url } });
    if (tab) tab.location.href = res.data.url;
    else window.location.assign(res.data.url);
  } catch (err) {
    const msg = err.response?.data?.error || 'Could not open this document.';
    if (tab) tab.document.body.innerHTML = `<p style="font-family:sans-serif;padding:24px;color:#b91c1c">${msg.replace(/</g, '&lt;')}</p>`;
    else window.alert(msg);
  }
}
