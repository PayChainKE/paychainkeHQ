import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import RevenueSweep from '../models/RevenueSweep.js';
import BankReconciliation from '../models/BankReconciliation.js';
import { REVENUE_STREAMS } from '../config/revenueRateCard.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';
import { runRevenueSweep, REVENUE_SWEEP_DESTINATION } from '../services/revenueSweepService.js';
import { recordReconciliation } from '../services/reconciliationService.js';
import { reversedTransactionExclusionMatch } from '../utils/reversedTransactions.js';
import { excludeDemoMerchantsMatch } from '../utils/demoMerchantExclusion.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// ── Helpers ─────────────────────────────────────────────────────────────
const RANGES = ['24h', '7d', '30d', '90d', 'ytd', 'all'];

// Maps each transaction type to the user-facing payment rail used in the
// channel breakdown. Mobile Money for M-Pesa-touching flows, On-Chain for
// Stellar swaps, Bank Transfer for off-ramp settlements.
const TYPE_TO_CHANNEL = {
  inbound:    'Mobile Money',
  outbound:   'Mobile Money',
  bulk_pay:   'Mobile Money',
  settlement: 'Bank Transfer',
  fx_swap:    'On-Chain (Stellar)',
  mpesa_b2c:  'Mobile Money',
};

// Corporate operating account where accumulated fees sweep to, shown on the
// admin Revenue page's settlement-batch log. Was a fabricated placeholder
// ("Standard Chartered — OpEx ·4829"), then an env var that could silently
// drift from the real sweep destination — now sourced from the same
// hardcoded REVENUE_SWEEP_DESTINATION the sweep itself uses, so the display
// can never disagree with where the money actually goes.
const CORPORATE_DESTINATION = `${REVENUE_SWEEP_DESTINATION.accountName} — NCBA •••${REVENUE_SWEEP_DESTINATION.accountNumber.slice(-4)}`;

// Every window this resolves to is clamped to LIVE_DATA_CUTOFF — the
// five weeks of pre-production sandbox/simulated transactions before that
// date should never appear in revenue figures, regardless of range or
// prior-period comparison. Clamping both bounds here (rather than in each
// individual query below) means every aggregation in this file inherits
// the cutoff automatically.
function clamp(date) {
  return date.getTime() < LIVE_DATA_CUTOFF.getTime() ? LIVE_DATA_CUTOFF : date;
}

function resolveWindow(range) {
  const now = new Date();
  if (range === 'all') {
    // Use the earliest possible — Mongo will still index-scan efficiently.
    const start = new Date('2020-01-01');
    const prev  = new Date('2019-01-01');
    return { since: clamp(start), prevSince: clamp(prev) };
  }
  if (range === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1);
    const lastYear = new Date(now.getFullYear() - 1, 0, 1);
    return { since: clamp(start), prevSince: clamp(lastYear) };
  }
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const days = map[range] ?? 30;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
  return { since: clamp(since), prevSince: clamp(prevSince) };
}

function bucketFormat(range) {
  if (range === '24h') return '%Y-%m-%d %H:00';
  if (range === '7d')  return '%Y-%m-%d';
  if (range === '30d') return '%Y-%m-%d';
  return '%Y-%m'; // 90d / ytd / all → monthly buckets
}

function pctChange(a, b) {
  if (!b) return a > 0 ? 100 : 0;
  return Number((((a - b) / b) * 100).toFixed(1));
}

// kesAmount is the field most transactions populate. Fall back to `amount`
// when kesAmount is zero (older docs / fx_swap rows without explicit kes).
const KES_BASIS = {
  $cond: [
    { $gt: ['$kesAmount', 0] },
    '$kesAmount',
    { $ifNull: ['$amount', 0] },
  ],
};

// Every stream's actual fee — sourced from the persisted Transaction.paychainFee
// field (the same single source of truth channelAgg/sweepAgg below already
// use), not recomputed live from a rate card. A live recompute here used to
// mean this file needed its own Mongo-expression twin of every fee rule
// (flat surcharges, free-tier thresholds, tiered bands) — those inevitably
// drifted from the real JS-side pricing logic (see pricingEngine.js /
// ncbaTariffCard.js's $inc-after-create reconciliation pattern for surcharges
// that a live recompute can't see at all), which is exactly why this table
// and the per-stream KPIs were showing KES 0.00 revenue for real,
// already-fee-charged transactions. paychainFee is stamped/reconciled once,
// at settlement time, and is the same number the revenue sweep sums — so
// summing it here can never diverge from what actually got charged.
const FEE_EXPR = { $ifNull: ['$paychainFee', 0] };

// excludeReversed: see reversedTransactionExclusionMatch's doc comment —
// a duplicate credit and its correction entry must never count as PayChain
// revenue anywhere on this dashboard, regardless of what their fee fields
// happen to say.
function streamMatch(stream, since, excludeReversed, excludeDemo) {
  return {
    type:   { $in: stream.txTypes },
    status: { $in: stream.statuses },
    createdAt: { $gte: since },
    ...excludeReversed,
    ...excludeDemo,
  };
}

// @desc    Aggregated revenue across all PayChain revenue streams. Computes
//          fees from the canonical rate card, period-over-period change,
//          daily/hourly series, per-stream breakdown, and top fee-generating
//          merchants. One round trip — frontend just renders.
// @route   GET /api/admin/revenue?range=24h|7d|30d|90d|ytd|all
// @access  Private (Admin)
export const getRevenue = async (req, res) => {
  try {
    const range = RANGES.includes(req.query.range) ? req.query.range : '30d';
    const { since, prevSince } = resolveWindow(range);
    const fmt = bucketFormat(range);
    const [excludeReversed, excludeDemo] = await Promise.all([
      reversedTransactionExclusionMatch(),
      excludeDemoMerchantsMatch(),
    ]);

    // ─── Per-stream aggregates (current + previous period) ─────────────
    const streamJobs = REVENUE_STREAMS.map(async (stream) => {
      if (!stream.txTypes.length) {
        // Pilot / not-yet-instrumented streams — return zeros.
        return { id: stream.id, revenue: 0, prevRevenue: 0, volume: 0, prevVolume: 0, count: 0 };
      }
      const [cur, prv] = await Promise.all([
        Transaction.aggregate([
          { $match: streamMatch(stream, since, excludeReversed, excludeDemo) },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              volume: { $sum: KES_BASIS },
              revenue: { $sum: FEE_EXPR },
            },
          },
        ]),
        Transaction.aggregate([
          { $match: { ...streamMatch(stream, prevSince, excludeReversed, excludeDemo), createdAt: { $gte: prevSince, $lt: since } } },
          { $group: { _id: null, revenue: { $sum: FEE_EXPR }, volume: { $sum: KES_BASIS } } },
        ]),
      ]);
      const c = cur[0] || { count: 0, volume: 0, revenue: 0 };
      const p = prv[0] || { revenue: 0, volume: 0 };
      return {
        id: stream.id,
        count: c.count,
        volume: Math.round(c.volume * 100) / 100,
        prevVolume: Math.round(p.volume * 100) / 100,
        revenue: Math.round(c.revenue * 100) / 100,
        prevRevenue: Math.round(p.revenue * 100) / 100,
      };
    });

    // ─── Time series — one bucket per period, summed across all streams.
    // We tag each doc with its stream id via $switch so the chart can be
    // stacked (revenue by stream over time).
    const switchBranches = REVENUE_STREAMS
      .filter((s) => s.txTypes.length)
      .map((s) => ({
        case: { $in: ['$type', s.txTypes] },
        then: s.id,
      }));

    const seriesAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: { $in: ['completed', 'verified'] },
          type: { $in: REVENUE_STREAMS.flatMap((s) => s.txTypes) },
          ...excludeReversed,
          ...excludeDemo,
        },
      },
      {
        $addFields: {
          streamId: { $switch: { branches: switchBranches, default: null } },
          _kes: KES_BASIS,
        },
      },
      {
        $addFields: {
          _fee: FEE_EXPR,
        },
      },
      {
        $group: {
          _id: {
            bucket: { $dateToString: { format: fmt, date: '$createdAt' } },
            streamId: '$streamId',
          },
          revenue: { $sum: '$_fee' },
          // Real per-bucket GMV and Safaricom pass-through cost — the chart
          // used to fabricate a "GMV" bar by dividing gross fees by a flat
          // assumed 0.5% take rate (`b.total / 0.005`), which doesn't match
          // the real tiered/per-channel rate card and could show numbers
          // that don't reconcile with the KPI strip above it. Sourced from
          // the same persisted fields (kesAmount/safaricomFee) every other
          // real aggregate in this file already uses — never approximated.
          gmv:  { $sum: '$_kes' },
          cost: { $sum: { $ifNull: ['$safaricomFee', 0] } },
        },
      },
      { $sort: { '_id.bucket': 1 } },
    ]);

    // Reshape into [{ bucket, transaction_fee: x, fx_spread: y, ..., gmv, net }]
    const seriesMap = new Map();
    for (const row of seriesAgg) {
      const b = row._id.bucket;
      if (!seriesMap.has(b)) {
        const z = { bucket: b, total: 0, gmv: 0, cost: 0, net: 0 };
        for (const s of REVENUE_STREAMS) z[s.id] = 0;
        seriesMap.set(b, z);
      }
      const node = seriesMap.get(b);
      const rev = Math.round(row.revenue * 100) / 100;
      const gmv = Math.round(row.gmv * 100) / 100;
      const cost = Math.round(row.cost * 100) / 100;
      node[row._id.streamId] = rev;
      node.total = Math.round((node.total + rev) * 100) / 100;
      node.gmv = Math.round((node.gmv + gmv) * 100) / 100;
      node.cost = Math.round((node.cost + cost) * 100) / 100;
      node.net = Math.round((node.total - node.cost) * 100) / 100;
    }
    const series = Array.from(seriesMap.values());

    // ─── Top fee-generating merchants in the window ────────────────────
    const topMerchantsAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: { $in: ['completed', 'verified'] },
          type: { $in: REVENUE_STREAMS.flatMap((s) => s.txTypes) },
          // Merged (not spread) — excludeDemo also keys off merchantId, and
          // a second ...excludeDemo spread here would silently clobber this
          // $ne:null instead of combining with it.
          merchantId: { $ne: null, ...(excludeDemo.merchantId || {}) },
          ...excludeReversed,
        },
      },
      {
        $addFields: {
          _kes: KES_BASIS,
          _fee: FEE_EXPR,
        },
      },
      {
        $group: {
          _id: '$merchantId',
          revenue: { $sum: '$_fee' },
          volume:  { $sum: '$_kes' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'merchants',
          localField: '_id',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          merchantId: '$_id',
          // Deleted merchants keep their historical revenue and volume —
          // only the $lookup comes back empty (preserveNullAndEmptyArrays
          // above), so this is the one spot that needs a fallback label
          // rather than showing a blank name for real, counted revenue.
          businessName: { $ifNull: ['$merchant.businessName', 'Deleted Merchant'] },
          email: '$merchant.email',
          status: '$merchant.status',
          revenue: { $round: ['$revenue', 2] },
          volume:  { $round: ['$volume', 2] },
          count: '$count',
        },
      },
    ]);

    // Compute lifetime KES and USDC volumes for these top merchants
    const topMerchantIds = topMerchantsAgg.map(m => m.merchantId);
    if (topMerchantIds.length > 0) {
      const KES_VOL_REAL = {
        $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }]
      };
      const USDC_VOL_REAL = {
        $ifNull: ['$usdcAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, '$amount', 0] }]
      };
      
      const lifetimeVolsAgg = await Transaction.aggregate([
        { $match: { merchantId: { $in: topMerchantIds }, status: { $in: ['completed', 'verified'] }, ...excludeReversed } },
        { $group: { _id: '$merchantId', kesVolume: { $sum: KES_VOL_REAL }, usdcVolume: { $sum: USDC_VOL_REAL } } }
      ]);
      
      const volMap = new Map();
      lifetimeVolsAgg.forEach(v => volMap.set(v._id.toString(), v));
      
      topMerchantsAgg.forEach(m => {
        const vols = volMap.get(m.merchantId.toString()) || { kesVolume: 0, usdcVolume: 0 };
        m.lifetimeKesVolume = vols.kesVolume;
        m.lifetimeUsdcVolume = vols.usdcVolume;
      });
    }

    // ─── Network & partner costs — what PayChain actually paid out to
    // Safaricom/NCBA on top of its own fee. Reads the persisted
    // Transaction.safaricomFee field (stamped once per transaction by
    // calculateFees at creation time — see models/Transaction.js), same
    // as channelAgg and sweepAgg below, instead of live-recomputing a
    // tariff lookup scoped to only the old Daraja-era passthrough types.
    // That old approach silently excluded every NCBA-rail transaction
    // (ncba_inbound, ncba_lipa_na_mpesa, ncba_kplc, etc.) even though
    // those also carry a real safaricomFee, understating this KPI's costs
    // (and overstating Net Revenue) the moment NCBA rails carried real
    // volume — exactly the drift the sweep batch table's own "figures
    // reconcile to KPI strip" footer assumes can't happen.
    const [safCur, safPrv] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: since },
            status: { $in: ['completed', 'verified'] },
            paychainFee: { $gt: 0 },
            ...excludeReversed,
            ...excludeDemo,
          },
        },
        { $group: { _id: null, fees: { $sum: '$safaricomFee' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: prevSince, $lt: since },
            status: { $in: ['completed', 'verified'] },
            paychainFee: { $gt: 0 },
            ...excludeReversed,
            ...excludeDemo,
          },
        },
        { $group: { _id: null, fees: { $sum: '$safaricomFee' } } },
      ]),
    ]);
    const safaricomFees     = Math.round((safCur[0]?.fees || 0) * 100) / 100;
    const safaricomFeesPrev = Math.round((safPrv[0]?.fees || 0) * 100) / 100;

    // ─── Channel breakdown — group revenue by payment rail. Each rail
    // shows GMV, gross fees, partner costs and net margin so finance can
    // see which channel actually pays the bills. Aggregation uses the
    // persisted paychainFee/safaricomFee fields (single source of truth).
    const channelAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: { $in: ['completed', 'verified'] },
          type: { $in: Object.keys(TYPE_TO_CHANNEL) },
          ...excludeReversed,
          ...excludeDemo,
        },
      },
      {
        $addFields: {
          _channel: {
            $switch: {
              branches: Object.entries(TYPE_TO_CHANNEL).map(([t, c]) => ({
                case: { $eq: ['$type', t] }, then: c,
              })),
              default: 'Other',
            },
          },
          _kes: KES_BASIS,
        },
      },
      {
        $group: {
          _id: '$_channel',
          gmv:   { $sum: '$_kes' },
          gross: { $sum: '$paychainFee' },
          costs: { $sum: '$safaricomFee' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          channel: '$_id',
          gmv:   { $round: ['$gmv', 2] },
          gross: { $round: ['$gross', 2] },
          costs: { $round: ['$costs', 2] },
          net:   { $round: [{ $subtract: ['$gross', '$costs'] }, 2] },
          count: '$count',
        },
      },
      { $sort: { net: -1 } },
    ]);

    const now = new Date();

    // ─── Wait for stream aggregates and roll up totals ─────────────────
    const streams = await Promise.all(streamJobs);
    const totalRevenue = streams.reduce((s, x) => s + x.revenue, 0);
    const prevTotalRevenue = streams.reduce((s, x) => s + x.prevRevenue, 0);
    const totalVolume = streams.reduce((s, x) => s + x.volume, 0);
    const prevTotalVolume = streams.reduce((s, x) => s + (x.prevVolume || 0), 0);
    const totalCount  = streams.reduce((s, x) => s + x.count, 0);
    const takeRate    = totalVolume ? (totalRevenue / totalVolume) * 100 : 0;

    // Forward projection — simple linear run-rate based on the window.
    // For "all" / "ytd" we annualise from MTD; for finite windows we scale
    // daily run-rate × 365.
    let runRate;
    if (range === 'all' || range === 'ytd') {
      const start = clamp(new Date(range === 'ytd' ? new Date().getFullYear() : 2020, 0, 1));
      const days = Math.max(1, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      runRate = (totalRevenue / days) * 365;
    } else {
      const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
      const days = map[range] || 30;
      runRate = (totalRevenue / days) * 365;
    }

    // Decorate each stream with rate-card metadata + % share.
    const enriched = REVENUE_STREAMS.map((meta) => {
      const data = streams.find((s) => s.id === meta.id) || { revenue: 0, prevRevenue: 0, volume: 0, count: 0 };
      return {
        id: meta.id,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        accent: meta.accent,
        rate: meta.rate,
        tiered: !!meta.tiered,
        minFee: meta.minFee,
        pilot: !!meta.pilot,
        revenue: data.revenue,
        prevRevenue: data.prevRevenue,
        change: pctChange(data.revenue, data.prevRevenue),
        volume: data.volume,
        count: data.count,
        share: totalRevenue ? Number(((data.revenue / totalRevenue) * 100).toFixed(1)) : 0,
      };
    });

    res.json({
      success: true,
      data: {
        range,
        windowStart: since,
        // Explicit end so the frontend can label exactly which calendar
        // period every KPI card on this page covers ("Aug 27 - Sep 26,
        // 2026") instead of just naming the range button ("30D") — the
        // window's actual end is "now", not implied by anything else in
        // this payload.
        windowEnd: now,
        kpis: {
          // Financial-summary fields (preferred naming, used by the
          // Revenue page hero strip).
          gmv:           Math.round(totalVolume * 100) / 100,
          gmvChange:     pctChange(totalVolume, prevTotalVolume),
          grossRevenue:  Math.round(totalRevenue * 100) / 100,
          grossChange:   pctChange(totalRevenue, prevTotalRevenue),
          networkCosts:  safaricomFees,
          costsChange:   pctChange(safaricomFees, safaricomFeesPrev),
          netRevenue:    Math.round((totalRevenue - safaricomFees) * 100) / 100,
          netChange:     pctChange(totalRevenue - safaricomFees, prevTotalRevenue - safaricomFeesPrev),

          // Legacy fields (kept for existing consumers / charts).
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          prevTotalRevenue: Math.round(prevTotalRevenue * 100) / 100,
          change: pctChange(totalRevenue, prevTotalRevenue),
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalCount,
          takeRate: Number(takeRate.toFixed(3)),
          projectedARR: Math.round(runRate),
          safaricomPassthrough: safaricomFees,
          safaricomPassthroughChange: pctChange(safaricomFees, safaricomFeesPrev),
        },
        streams: enriched,
        series,
        topMerchants: topMerchantsAgg,
        channels: channelAgg,
        corporateDestination: CORPORATE_DESTINATION,
      },
    });
  } catch (error) {
    console.error('Get Revenue Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Real sweep history — actual PesaLink transfers of PayChain's
//          accrued fee revenue out of the pooled NCBA paybill into
//          PayChain's own account (see services/revenueSweepService.js).
//          The only sweep record surfaced to admin — a projected/estimated
//          weekly batch view used to sit alongside this, re-derived from
//          transaction fees on every request, but it duplicated (and could
//          silently disagree with) this real settlement record while adding
//          little the Cash Position "Held in FBO · Unswept" figure and this
//          history don't already cover, so it was removed.
// @route   GET /api/admin/revenue/sweeps
// @access  Private (Admin)
export const getRevenueSweeps = async (req, res) => {
  try {
    // 52 (one/week for a year) undercounted in practice — manual "Run Sweep
    // Now" attempts and every redeploy landing on the configured sweep day
    // each add their own row, so a busy week alone can produce several.
    // Client paginates this at 25/page; querying more up front is cheap.
    // Archived rows are excluded from this list view only — they're never
    // deleted, still count in every real sweep computation, and still
    // appear in the full CSV export below.
    const sweeps = await RevenueSweep.find({ archived: { $ne: true } }).sort('-createdAt').limit(500).lean();
    res.json({ success: true, count: sweeps.length, data: sweeps });
  } catch (error) {
    console.error('Get Revenue Sweeps Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Hide a sweep history row from the admin Revenue page's list —
//          the record itself is untouched (still a real audit row, still
//          counted by revenueSweepService.js) and can be restored.
// @route   PATCH /api/admin/revenue/sweeps/:id/archive
// @access  Private (Admin, owner/admin only)
export const archiveRevenueSweep = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid sweep id.' });
    }
    const sweep = await RevenueSweep.findByIdAndUpdate(
      id,
      { $set: { archived: true, archivedAt: new Date(), archivedBy: req.admin._id } },
      { new: true }
    );
    if (!sweep) return res.status(404).json({ error: 'Sweep record not found.' });

    logAudit({
      action: 'admin.revenue_sweep.archived', category: 'admin', severity: 'info',
      message: `Sweep record ${sweep._id} cleared from the Revenue page list`,
      actor: adminActor(req.admin), req,
      metadata: { sweepId: String(sweep._id), status: sweep.status, amount: sweep.amount },
    });

    res.json({ success: true, data: sweep });
  } catch (error) {
    console.error('Archive Revenue Sweep Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Undo an accidental "clear" — restores a sweep row to the list.
// @route   PATCH /api/admin/revenue/sweeps/:id/unarchive
// @access  Private (Admin, owner/admin only)
export const unarchiveRevenueSweep = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid sweep id.' });
    }
    const sweep = await RevenueSweep.findByIdAndUpdate(
      id,
      { $set: { archived: false, archivedAt: null, archivedBy: null } },
      { new: true }
    );
    if (!sweep) return res.status(404).json({ error: 'Sweep record not found.' });

    logAudit({
      action: 'admin.revenue_sweep.unarchived', category: 'admin', severity: 'info',
      message: `Sweep record ${sweep._id} restored to the Revenue page list`,
      actor: adminActor(req.admin), req,
      metadata: { sweepId: String(sweep._id) },
    });

    res.json({ success: true, data: sweep });
  } catch (error) {
    console.error('Unarchive Revenue Sweep Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Full sweep history as CSV, for offline record-keeping /
//          reconciliation against the real bank statement. Always the
//          complete set — including rows an admin has "cleared" from the
//          list view above — since archiving is display-only and this
//          export exists specifically so nothing is ever actually lost.
// @route   GET /api/admin/revenue/sweeps/export
// @access  Private (Admin)
export const exportRevenueSweeps = async (req, res) => {
  try {
    const sweeps = await RevenueSweep.find({}).sort('-createdAt').lean();

    const header = [
      'Ran At', 'Period Start', 'Period End', 'Status', 'Amount (KES)',
      'Attempted Amount (KES)', 'Transactions', 'Destination Bank Code',
      'Destination Account Number', 'NCBA Reference', 'Simulated',
      'Failure Reason', 'Archived',
    ];
    // Excel/Sheets-safe CSV cell — quotes any value containing a comma,
    // quote, or newline, and doubles internal quotes per RFC 4180.
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = sweeps.map((s) => [
      s.createdAt?.toISOString() || '',
      s.periodStart?.toISOString() || '',
      s.periodEnd?.toISOString() || '',
      s.status,
      s.status === 'completed' ? s.amount : 0,
      s.attemptedAmount,
      s.transactionCount,
      s.destinationBankCode || '',
      s.destinationAccountNumber || '',
      s.ncbaReference || '',
      s.simulated ? 'yes' : 'no',
      s.failureReason || '',
      s.archived ? 'yes' : 'no',
    ].map(cell).join(','));

    const csv = [header.map(cell).join(','), ...rows].join('\r\n');

    logAudit({
      action: 'admin.revenue_sweep.exported', category: 'admin', severity: 'info',
      message: `Exported ${sweeps.length} sweep records as CSV`,
      actor: adminActor(req.admin), req,
      metadata: { count: sweeps.length },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paychain-sweep-history-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export Revenue Sweeps Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Manually trigger a revenue sweep attempt right now, outside the
//          normal weekly schedule — useful to sweep immediately after
//          configuring the destination account for the first time, or to
//          verify the pipeline works before waiting for the next Monday.
// @route   POST /api/admin/revenue/sweeps/run
// @access  Private (Admin, owner/admin only)
export const triggerRevenueSweep = async (req, res) => {
  try {
    const sweep = await runRevenueSweep();
    res.json({ success: true, data: sweep });
  } catch (error) {
    console.error('Trigger Revenue Sweep Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Bank reconciliation history — every past check of the real NCBA
//          pooled-account balance against what PayChain's own ledger
//          expects it to be (see services/reconciliationService.js).
// @route   GET /api/admin/revenue/reconciliations
// @access  Private (Admin)
export const getReconciliations = async (req, res) => {
  try {
    const records = await BankReconciliation.find({})
      .sort('-createdAt')
      .limit(52)
      .populate('checkedBy', 'email name')
      .lean();
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('Get Reconciliations Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Submit a manual reconciliation check — admin pastes in the real
//          NCBA pooled-account balance (there's no API to pull it
//          automatically) and this compares it against what PayChain's
//          ledger expects (Σ merchant balances + unswept revenue), alerting
//          every owner if they don't match within rounding tolerance.
// @route   POST /api/admin/revenue/reconciliations
// @access  Private (Admin, owner/admin only)
export const submitReconciliation = async (req, res) => {
  try {
    const { reportedBalance, note } = req.body || {};
    const numeric = Number(reportedBalance);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return res.status(400).json({ error: 'A valid, non-negative reportedBalance is required.' });
    }
    const record = await recordReconciliation({ reportedBalance: numeric, note, checkedBy: req.admin._id });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Submit Reconciliation Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
