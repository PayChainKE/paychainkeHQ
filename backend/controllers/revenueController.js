import Transaction from '../models/Transaction.js';
import { REVENUE_STREAMS, SAFARICOM_TARIFF } from '../config/revenueRateCard.js';

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
};

// Corporate operating account where accumulated fees sweep to. Real-world
// this would be configurable; for now PayChain ops uses a single Standard
// Chartered USD operating account.
const CORPORATE_DESTINATION = 'Standard Chartered — OpEx ·4829';

function resolveWindow(range) {
  const now = new Date();
  if (range === 'all') {
    // Use the earliest possible — Mongo will still index-scan efficiently.
    const start = new Date('2020-01-01');
    const prev  = new Date('2019-01-01');
    return { since: start, prevSince: prev };
  }
  if (range === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1);
    const lastYear = new Date(now.getFullYear() - 1, 0, 1);
    return { since: start, prevSince: lastYear };
  }
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const days = map[range] ?? 30;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
  return { since, prevSince };
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
// the JS `computeStreamFee` helper.
function feeExpr(stream) {
  return {
    $max: [
      stream.minFee || 0,
      { $multiply: [KES_BASIS, stream.rate] },
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
        // Match-and-multiply the per-stream rate by joining the rate as a
        // literal map. We expand each stream into a candidate and pick the
        // one whose id matches streamId. Cheaper than $lookup.
        $addFields: {
          _fee: {
            $switch: {
              branches: REVENUE_STREAMS.filter((s) => s.txTypes.length).map((s) => ({
                case: { $eq: ['$streamId', s.id] },
                then: { $max: [s.minFee || 0, { $multiply: ['$_kes', s.rate] }] },
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
                then: { $max: [s.minFee || 0, { $multiply: ['$_kes', s.rate] }] },
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
      const start = new Date(range === 'ytd' ? new Date().getFullYear() : 2020, 0, 1);
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
