// Shared status classification for the Merchants Map — kybStatus only
// exists on officer-onboarded applications (see Merchant.js), so a merchant
// with no kybStatus at all is treated as already-approved (self-serve /
// admin-direct-onboarded merchants skip that pipeline entirely).
export function getMerchantMapStatus(m) {
  if (m.status === 'locked') {
    return { key: 'locked', label: 'Locked', pill: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  }
  if (m.kybStatus && m.kybStatus !== 'approved') {
    const label = m.kybStatus === 'requires_revision' ? 'Needs Revision' : m.kybStatus === 'rejected' ? 'Rejected' : 'Pending Verification';
    return { key: 'pending', label, pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  }
  return { key: 'active', label: 'Active', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
}

export function relativeTimeShort(iso) {
  if (!iso) return 'No transactions yet';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
