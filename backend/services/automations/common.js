import Transaction from '../../models/Transaction.js';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

// Per-run ceilings so switching an automation on against a big backlog can't
// fire hundreds of messages in one go — the rest are picked up on later runs.
export const MAX_SMS_PER_RUN = 50;
export const MAX_EMAIL_PER_RUN = 100;

export const MERCHANT_URL = (process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke').replace(/\/+$/, '');
export const OFFICER_URL = (process.env.OFFICER_DASHBOARD_URL || 'https://officer.paychain.co.ke').replace(/\/+$/, '');
export const DEVELOPER_URL = (process.env.DEVELOPER_PORTAL_URL || 'https://developer.paychain.co.ke').replace(/\/+$/, '');
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ke.co.paychain.app';

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// "+254712345678" -> the other shapes a phone may be stored in.
export function phoneVariants(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (!/^254\d{9}$/.test(digits)) return [e164];
  return [`+${digits}`, digits, `0${digits.slice(3)}`];
}

// Map of merchantId -> Date of their most recent transaction of any kind.
export async function lastTransactionByMerchant(merchantIds) {
  if (merchantIds.length === 0) return new Map();
  const rows = await Transaction.aggregate([
    { $match: { merchantId: { $in: merchantIds } } },
    { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.lastTxnAt]));
}

const INBOUND_TYPES = ['inbound', 'ncba_inbound'];

// Map of merchantId -> { received: bool, paidOut: bool } — has the merchant
// ever been paid / ever moved money out. Used to skip onboarding tips for
// things they've already done.
export async function activityFlagsByMerchant(merchantIds) {
  if (merchantIds.length === 0) return new Map();
  const rows = await Transaction.aggregate([
    { $match: { merchantId: { $in: merchantIds } } },
    {
      $group: {
        _id: '$merchantId',
        received: { $max: { $cond: [{ $in: ['$type', INBOUND_TYPES] }, 1, 0] } },
        paidOut: { $max: { $cond: [{ $in: ['$type', INBOUND_TYPES] }, 0, 1] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { received: !!r.received, paidOut: !!r.paidOut }]));
}
