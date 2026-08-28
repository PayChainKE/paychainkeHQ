import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';

// Never let a window start before LIVE_DATA_CUTOFF — mirrors
// revenueController.js's own clamp() exactly, so the five weeks of
// pre-production sandbox/simulated transactions it excludes from Revenue
// can't quietly reappear in any "all"/"ytd"/custom range built on this.
function clampSince(date) {
  return date.getTime() < LIVE_DATA_CUTOFF.getTime() ? LIVE_DATA_CUTOFF : date;
}

// ── Period resolution ────────────────────────────────────────────────────
// Calendar-aligned (month/quarter/year) periods rather than the rolling
// 24h/7d/30d windows used elsewhere in admin — that's what maps onto how
// KRA actually expects returns to be filed. Shared by bookkeepingController
// (P&L summary, KRA export) and adminController's payout audit trail
// (searchTransactionAudit, exportPayoutAuditCsv) so the Tax & Compliance
// page's single period selector resolves identically everywhere it's used
// — a second, drifted copy of this logic is exactly how "This Month" on
// one part of the page could silently disagree with "This Month" on
// another part of the same page.
export function resolvePeriod({ preset, from, to }) {
  if (from && to) {
    const since = new Date(from);
    const until = new Date(to);
    until.setHours(23, 59, 59, 999);
    if (!isNaN(since) && !isNaN(until)) {
      return { since: clampSince(since), until, label: 'Custom range', preset: 'custom' };
    }
  }

  const now = new Date();
  switch (preset) {
    case 'last_month': {
      const since = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const until = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { since: clampSince(since), until, label: since.toLocaleString('en-KE', { month: 'long', year: 'numeric' }), preset };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const since = new Date(now.getFullYear(), q * 3, 1);
      return { since: clampSince(since), until: now, label: `Q${q + 1} ${now.getFullYear()}`, preset };
    }
    case 'ytd': {
      const since = new Date(now.getFullYear(), 0, 1);
      return { since: clampSince(since), until: now, label: `${now.getFullYear()} (Year to date)`, preset };
    }
    case 'all': {
      return { since: clampSince(new Date('2020-01-01')), until: now, label: 'All time', preset };
    }
    case 'this_month':
    default: {
      const since = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: clampSince(since), until: now, label: since.toLocaleString('en-KE', { month: 'long', year: 'numeric' }), preset: 'this_month' };
    }
  }
}
