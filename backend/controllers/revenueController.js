import Transaction from '../models/Transaction.js';
import RevenueSweep from '../models/RevenueSweep.js';
import BankReconciliation from '../models/BankReconciliation.js';
import { REVENUE_STREAMS, SAFARICOM_TARIFF } from '../config/revenueRateCard.js';
import { ncbaMarkupMongoExpr } from '../config/ncbaTariffCard.js';
import { mpesaMerchantFeeMongoExpr } from '../utils/pricingEngine.js';
import { mpesaB2cMarkupMongoExpr } from '../config/mpesaB2cTariffCard.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';
import { runRevenueSweep } from '../services/revenueSweepService.js';
import { recordReconciliation } from '../services/reconciliationService.js';

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

// Corporate operating account where accumulated fees sweep to. Was a
// fabricated placeholder ("Standard Chartered — OpEx ·4829") — PayChain
// doesn't have this account. Now env-configurable like every other real
// destination account in this codebase (e.g. NCBA_SETTLEMENT_ACCOUNT);
// shows an honest pending state until the real one is set.
const CORPORATE_DESTINATION = process.env.PAYCHAIN_CORPORATE_SWEEP_ACCOUNT || 'Not configured';

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

// Compute fee for a single doc inside the aggregation pipeline. Mirrors
// the JS `computeStreamFee` helper for linear-rate streams; the NCBA
// collection stream instead prices off the tiered band table (see
// config/ncbaTariffCard.js) since it has no single rate to multiply by.
// `basisExpr` defaults to the raw per-doc KES_BASIS expression, but callers
// that have already materialised the basis into a field (e.g. `$_kes` via
// $addFields) pass that alias instead so it isn't recomputed.
function feeExpr(stream, basisExpr = KES_BASIS) {
  if (stream.id === 'ncba_collection_fee') {
    return ncbaMarkupMongoExpr(basisExpr);
  }
  if (stream.id === 'transaction_fee') {
    return mpesaMerchantFeeMongoExpr(basisExpr);
  }
  if (stream.id === 'mpesa_b2c_fee') {
    return mpesaB2cMarkupMongoExpr();
  }
  return {
    $max: [
      stream.minFee || 0,
      { $multiply: [basisExpr, stream.rate] },
    ],
  };
}

function streamMatch(stream, since) {
  return {
    type:   { $in: stream.txTypes },
    status: { $in: stream.statuses },
    createdAt: { $gte: since },
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

    // ─── Per-stream aggregates (current + previous period) ─────────────
    const streamJobs = REVENUE_STREAMS.map(async (stream) => {
      if (!stream.txTypes.length) {
        // Pilot / not-yet-instrumented streams — return zeros.
        return { id: stream.id, revenue: 0, prevRevenue: 0, volume: 0, count: 0 };
      }
      const [cur, prv] = await Promise.all([
        Transaction.aggregate([
          { $match: streamMatch(stream, since) },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              volume: { $sum: KES_BASIS },
              revenue: { $sum: feeExpr(stream) },
            },
          },
        ]),
        Transaction.aggregate([
          { $match: { ...streamMatch(stream, prevSince), createdAt: { $gte: prevSince, $lt: since } } },
          { $group: { _id: null, revenue: { $sum: feeExpr(stream) } } },
        ]),
      ]);
      const c = cur[0] || { count: 0, volume: 0, revenue: 0 };
      const p = prv[0] || { revenue: 0 };
      return {
        id: stream.id,
        count: c.count,
        volume: Math.round(c.volume * 100) / 100,
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
        },
      },
      {
        $addFields: {
          streamId: { $switch: { branches: switchBranches, default: null } },
          _kes: KES_BASIS,
        },
      },
      {
        // Match-and-price by joining the per-stream fee expression as a
        // literal map. We expand each stream into a candidate and pick the
        // one whose id matches streamId. Cheaper than $lookup. feeExpr()
        // handles both linear-rate streams and the tiered NCBA stream.
        $addFields: {
          _fee: {
            $switch: {
              branches: REVENUE_STREAMS.filter((s) => s.txTypes.length).map((s) => ({
                case: { $eq: ['$streamId', s.id] },
                then: feeExpr(s, '$_kes'),
              })),
              default: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: {
            bucket: { $dateToString: { format: fmt, date: '$createdAt' } },
            streamId: '$streamId',
          },
          revenue: { $sum: '$_fee' },
        },
      },
      { $sort: { '_id.bucket': 1 } },
    ]);

    // Reshape into [{ bucket, transaction_fee: x, fx_spread: y, ... }]
    const seriesMap = new Map();
    for (const row of seriesAgg) {
      const b = row._id.bucket;
      if (!seriesMap.has(b)) {
        const z = { bucket: b, total: 0 };
        for (const s of REVENUE_STREAMS) z[s.id] = 0;
        seriesMap.set(b, z);
      }
      const node = seriesMap.get(b);
      const rev = Math.round(row.revenue * 100) / 100;
      node[row._id.streamId] = rev;
      node.total = Math.round((node.total + rev) * 100) / 100;
    }
    const series = Array.from(seriesMap.values());

    // ─── Top fee-generating merchants in the window ────────────────────
    const topMerchantsAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: { $in: ['completed', 'verified'] },
          type: { $in: REVENUE_STREAMS.flatMap((s) => s.txTypes) },
          merchantId: { $ne: null },
        },
      },
      {
        $addFields: {
          _kes: KES_BASIS,
          _fee: {
            $switch: {
              branches: REVENUE_STREAMS.filter((s) => s.txTypes.length).map((s) => ({
                case: { $in: ['$type', s.txTypes] },
                then: feeExpr(s, '$_kes'),
              })),
              default: 0,
            },
          },
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
          businessName: '$merchant.businessName',
          email: '$merchant.email',
          paybillAccount: '$merchant.paybillAccount',
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
        { $match: { merchantId: { $in: topMerchantIds }, status: { $in: ['completed', 'verified'] } } },
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

    // ─── Safaricom passthrough — what customers paid Safaricom in fees.
    // Pure transparency line, not PayChain revenue. We build a $switch
    // that picks the tier fee for each doc by KES amount.
    const safaricomBranches = SAFARICOM_TARIFF.map((tier) => ({
      case: { $lte: [KES_BASIS, tier.max] },
      then: tier.fee,
    }));
    const passthroughTypes = REVENUE_STREAMS
      .filter((s) => s.passthrough === 'safaricom')
      .flatMap((s) => s.txTypes);

    const [safCur, safPrv] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: since },
            type: { $in: passthroughTypes },
            status: { $in: ['completed', 'verified'] },
          },
        },
        {
          $addFields: {
            _saf: {
              $switch: {
                branches: safaricomBranches,
                default: SAFARICOM_TARIFF[SAFARICOM_TARIFF.length - 1].fee,
              },
            },
          },
        },
        { $group: { _id: null, fees: { $sum: '$_saf' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: prevSince, $lt: since },
            type: { $in: passthroughTypes },
            status: { $in: ['completed', 'verified'] },
          },
        },
        {
          $addFields: {
            _saf: {
              $switch: {
                branches: safaricomBranches,
                default: SAFARICOM_TARIFF[SAFARICOM_TARIFF.length - 1].fee,
              },
            },
          },
        },
        { $group: { _id: null, fees: { $sum: '$_saf' } } },
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

    // ─── Sweep batches — week-by-week roll-up of accumulated PayChain
    // fees, presented as the settlement-batch log finance teams expect.
    // Status derives from whether the week is closed (settled), the most
    // recent finished week (pending bank clearing) or the current week
    // (accruing). Real-world this would be a separate RevenueSweep
    // collection; for now we derive it on the fly from fees data so the
    // numbers exactly match the headline KPIs.
    const sweepAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: { $in: ['completed', 'verified'] },
          paychainFee: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: { yr: { $isoWeekYear: '$createdAt' }, wk: { $isoWeek: '$createdAt' } },
          gross: { $sum: '$paychainFee' },
          costs: { $sum: '$safaricomFee' },
          count: { $sum: 1 },
          first: { $min: '$createdAt' },
          last:  { $max: '$createdAt' },
        },
      },
      { $sort: { '_id.yr': -1, '_id.wk': -1 } },
      { $limit: 24 },
    ]);

    const now = new Date();
    const curYr = now.getUTCFullYear();
    // ISO week of "now" — approximate to flag the current accruing week.
    const isoNow = (() => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayN = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - dayN + 3);
      const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
      const wk = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
      return { yr: d.getUTCFullYear(), wk };
    })();

    const sweepBatches = sweepAgg.map((row, idx) => {
      const isCurrent = row._id.yr === isoNow.yr && row._id.wk === isoNow.wk;
      const isMostRecentClosed = !isCurrent && idx === (sweepAgg[0]._id.yr === isoNow.yr && sweepAgg[0]._id.wk === isoNow.wk ? 1 : 0);
      let status = 'Settled to Corporate';
      if (isCurrent) status = 'Accruing';
      else if (isMostRecentClosed) status = 'Pending Bank Clearing';
      const id = `SWP-${row._id.yr}W${String(row._id.wk).padStart(2, '0')}`;
      const gross = Math.round(row.gross * 100) / 100;
      const costs = Math.round(row.costs * 100) / 100;
      return {
        id,
        period: { from: row.first, to: row.last },
        gross,
        costs,
        net: Math.round((gross - costs) * 100) / 100,
        count: row.count,
        status,
        destination: isCurrent ? '— (held in FBO)' : CORPORATE_DESTINATION,
      };
    });

    // ─── Wait for stream aggregates and roll up totals ─────────────────
    const streams = await Promise.all(streamJobs);
    const totalRevenue = streams.reduce((s, x) => s + x.revenue, 0);
    const prevTotalRevenue = streams.reduce((s, x) => s + x.prevRevenue, 0);
    const totalVolume = streams.reduce((s, x) => s + x.volume, 0);
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
        kpis: {
          // Financial-summary fields (preferred naming, used by the
          // Revenue page hero strip).
          gmv:           Math.round(totalVolume * 100) / 100,
          gmvChange:     pctChange(totalVolume, 0), // placeholder until volume prev wired
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
        sweepBatches,
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
//          Distinct from `sweepBatches` above, which is a projected/accrual
//          estimate re-derived from transaction fees on every request; this
//          is the real settlement record.
// @route   GET /api/admin/revenue/sweeps
// @access  Private (Admin)
export const getRevenueSweeps = async (req, res) => {
  try {
    const sweeps = await RevenueSweep.find({}).sort('-createdAt').limit(52).lean();
    res.json({ success: true, count: sweeps.length, data: sweeps });
  } catch (error) {
    console.error('Get Revenue Sweeps Error:', error);
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
