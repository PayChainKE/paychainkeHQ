import DeveloperPayment from '../models/DeveloperPayment.js';
import Invoice from '../models/Invoice.js';
import Developer from '../models/Developer.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { calculateFees } from '../utils/feeCalculator.js';
import { calculateCustomerSurcharge, calculateInvoiceClientMarkup, calculateInvoiceServiceFee } from '../utils/pricingEngine.js';
import { withMerchantTariffLock } from '../services/tariffCardCache.js';
import { computeTotals } from './invoiceController.js';
import { excludeDemoMerchantsMatch } from '../utils/demoMerchantExclusion.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Every kind an API-channel payment can be, in a fixed display order —
// never re-sorted by volume/revenue, so a channel's position in any
// breakdown/chart stays stable across requests.
const CHANNELS = [
  { id: 'collect',      label: 'Collect' },
  { id: 'payout',       label: 'Payout' },
  { id: 'bulk_payout',  label: 'Bulk Payout' },
  { id: 'invoice',      label: 'Invoice' },
];
const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label]));

// destination.type itself is never persisted on a DeveloperPayment (only
// destination.counterparty is — see developerPaymentController.js's
// payoutPayment) — this mirrors parsePayoutDestination's own
// mutually-exclusive field check to recover which NCBA rail a payout used.
function inferPayoutRailType(counterparty) {
  const cp = counterparty || {};
  if (cp.phone) return 'ncba_mobile_b2w';
  if (cp.paybillNumber || cp.tillNumber) return 'ncba_lipa_na_mpesa';
  return null; // bank rows resolve via linkedTransactionId instead, see below
}

function counterpartySummary(payment) {
  const cp = payment.counterparty || {};
  if (payment.kind === 'collect') return cp.phone || '—';
  if (cp.bankCode || cp.accountNumber) return `Bank · ${cp.accountName || cp.accountNumber || '—'}`;
  if (cp.phone) return `Mobile Money · ${cp.phone}`;
  if (cp.paybillNumber) return `Paybill ${cp.paybillNumber}`;
  if (cp.tillNumber) return `Till ${cp.tillNumber}`;
  return '—';
}

function channelOf(payment) {
  if (payment.kind === 'collect') return 'collect';
  return payment.batchId ? 'bulk_payout' : 'payout';
}

// DeveloperPayment is a deliberately fee-less "public payment object" (see
// its own header comment) — a mode:'test' row is fully simulated (no rail
// call, no real money), and even a mode:'live' row never gets its own
// paychainFee/safaricomFee stamped anywhere. The one case where the real,
// already-charged fee IS persisted is a synchronous bank payout
// (linkedTransactionId points at the real Transaction row it created) — that
// one is read directly. Every other live/success row (a collect, or an
// async mobile-money/paybill/till payout) has its fee recomputed here, off
// the exact same pricing functions and merchant tariff lock the real
// controller used at charge time, so this can never disagree with what was
// actually charged.
async function computeApiFee(payment) {
  if (payment.mode !== 'live' || payment.status !== 'success') {
    return { paychainFee: 0, safaricomFee: 0 };
  }

  if (payment.kind === 'collect') {
    const paychainFee = await withMerchantTariffLock(payment.merchantId, () => calculateCustomerSurcharge(payment.amount));
    return { paychainFee: round2(paychainFee), safaricomFee: 0 };
  }

  if (payment.linkedTransactionId) {
    const tx = await Transaction.findById(payment.linkedTransactionId).select('paychainFee safaricomFee').lean();
    return { paychainFee: tx?.paychainFee || 0, safaricomFee: tx?.safaricomFee || 0 };
  }

  const type = inferPayoutRailType(payment.counterparty);
  if (!type) return { paychainFee: 0, safaricomFee: 0 };
  const fees = await withMerchantTariffLock(payment.merchantId, () => calculateFees(type, payment.amount));
  return { paychainFee: round2(fees.paychainFee), safaricomFee: round2(fees.safaricomFee) };
}

// Invoicing's dual-sided model — see pricingEngine.js: PayChain earns both
// the client-facing markup (added to the STK prompt) and the merchant-facing
// Invoice Service Fee (deducted from settlement). Neither is ever persisted
// on the Invoice document itself, so this recomputes both the same way
// transactionController.js's processPaymentLink does at send/pay time — same
// functions, same merchant tariff lock.
async function computeInvoiceFee(invoice) {
  const base = computeTotals(invoice.items || []).total;
  const [clientMarkup, merchantFee] = await withMerchantTariffLock(invoice.merchantId, () => ([
    calculateInvoiceClientMarkup(base),
    calculateInvoiceServiceFee(base),
  ]));
  return { base, clientMarkup: round2(clientMarkup), merchantFee: round2(merchantFee), paychainFee: round2(clientMarkup + merchantFee) };
}

function normalizeInvoiceStatus(status) {
  if (status === 'paid') return 'success';
  if (status === 'void') return 'failed';
  return 'pending'; // draft, sent
}

function resolveRange(range) {
  const now = new Date();
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[range];
  let windowStart;
  if (range === 'ytd') windowStart = new Date(now.getFullYear(), 0, 1);
  else if (range === 'all' || !days) windowStart = LIVE_DATA_CUTOFF;
  else windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  if (windowStart.getTime() < LIVE_DATA_CUTOFF.getTime()) windowStart = LIVE_DATA_CUTOFF;
  return { windowStart, windowEnd: now };
}

// @desc    Every transaction that ran through the Developer/API integration
//          channel — Direct Collect, Payouts (standalone and bulk-batch
//          rows), and Developer-created Invoices — normalized into one
//          list, distinct from Transaction Audit (which covers every
//          transaction platform-wide regardless of origin). Small data
//          volume today (see the funding memo's own traction numbers), so
//          this merges DeveloperPayment and Invoice in application code
//          rather than building cross-collection pagination — revisit if
//          API-channel volume grows enough for that to matter.
// @route   GET /api/admin/api-transactions
// @access  Private (Admin)
export const getApiTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const channel = req.query.channel && req.query.channel !== 'all' ? req.query.channel : null;
    const mode = req.query.mode && req.query.mode !== 'all' ? req.query.mode : null;
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;

    const createdAt = { $gte: LIVE_DATA_CUTOFF };
    if (req.query.from) createdAt.$gte = new Date(req.query.from);
    if (req.query.to) createdAt.$lte = new Date(req.query.to);

    const excludeDemo = await excludeDemoMerchantsMatch();

    let developerIds = null;
    let merchantIds = null;
    const search = (req.query.q || '').trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      [developerIds, merchantIds] = await Promise.all([
        Developer.distinct('_id', { $or: [{ name: re }, { companyName: re }, { email: re }] }),
        Merchant.distinct('_id', { businessName: re }),
      ]);
    }

    const wantsPayments = !channel || channel !== 'invoice';
    const wantsInvoices = !channel || channel === 'invoice';

    let paymentDocs = [];
    if (wantsPayments) {
      const filter = { createdAt, ...excludeDemo };
      if (channel === 'collect') filter.kind = 'collect';
      if (channel === 'payout') { filter.kind = 'payout'; filter.batchId = null; }
      if (channel === 'bulk_payout') { filter.kind = 'payout'; filter.batchId = { $ne: null }; }
      if (mode) filter.mode = mode;
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { reference: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          ...(developerIds?.length ? [{ developerId: { $in: developerIds } }] : []),
          ...(merchantIds?.length ? [{ merchantId: { $in: merchantIds } }] : []),
        ];
        if (filter.$or.length === 0) filter._id = null; // no matches possible
      }
      paymentDocs = await DeveloperPayment.find(filter)
        .populate('developerId', 'name companyName')
        .populate('merchantId', 'businessName')
        .sort('-createdAt')
        .limit(500)
        .lean();
    }

    let invoiceDocs = [];
    if (wantsInvoices) {
      const filter = { createdAt, createdViaDeveloperId: { $ne: null }, ...excludeDemo };
      if (status) filter.status = { success: 'paid', pending: { $in: ['draft', 'sent'] }, failed: 'void' }[status];
      if (search) {
        filter.$or = [
          { invoiceNumber: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { 'customer.name': new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          ...(developerIds?.length ? [{ createdViaDeveloperId: { $in: developerIds } }] : []),
          ...(merchantIds?.length ? [{ merchantId: { $in: merchantIds } }] : []),
        ];
        if (filter.$or.length === 0) filter._id = null;
      }
      if (mode) invoiceDocs = []; // invoices have no mode concept — always "live"; a test/mode filter excludes them entirely
      else {
        invoiceDocs = await Invoice.find(filter)
          .populate('createdViaDeveloperId', 'name companyName')
          .populate('merchantId', 'businessName')
          .sort('-createdAt')
          .limit(500)
          .lean();
      }
    }

    const [paymentFees, invoiceFees] = await Promise.all([
      Promise.all(paymentDocs.map(computeApiFee)),
      Promise.all(invoiceDocs.map(computeInvoiceFee)),
    ]);

    const paymentRows = paymentDocs.map((p, i) => ({
      id: String(p._id),
      channel: channelOf(p),
      channelLabel: CHANNEL_LABEL[channelOf(p)],
      mode: p.mode,
      status: p.status,
      amount: p.amount,
      currency: p.currency || 'KES',
      reference: p.reference || p.batchId || null,
      developer: p.developerId ? { id: String(p.developerId._id), name: p.developerId.name, companyName: p.developerId.companyName } : null,
      merchant: p.merchantId ? { id: String(p.merchantId._id), businessName: p.merchantId.businessName } : null,
      counterparty: counterpartySummary(p),
      paychainFee: paymentFees[i].paychainFee,
      safaricomFee: paymentFees[i].safaricomFee,
      createdAt: p.createdAt,
    }));

    const invoiceRows = invoiceDocs.map((inv, i) => ({
      id: String(inv._id),
      channel: 'invoice',
      channelLabel: CHANNEL_LABEL.invoice,
      mode: 'live',
      status: normalizeInvoiceStatus(inv.status),
      amount: invoiceFees[i].base,
      currency: inv.currency || 'KES',
      reference: inv.invoiceNumber,
      developer: inv.createdViaDeveloperId ? { id: String(inv.createdViaDeveloperId._id), name: inv.createdViaDeveloperId.name, companyName: inv.createdViaDeveloperId.companyName } : null,
      merchant: inv.merchantId ? { id: String(inv.merchantId._id), businessName: inv.merchantId.businessName } : null,
      counterparty: inv.customer?.name || inv.customer?.email || '—',
      paychainFee: invoiceFees[i].paychainFee,
      safaricomFee: 0,
      createdAt: inv.createdAt,
    }));

    const all = [...paymentRows, ...invoiceRows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = all.length;
    const totalFee = round2(all.reduce((s, r) => s + (r.paychainFee || 0), 0));
    const totalVolume = round2(all.filter((r) => r.mode === 'live' && r.status === 'success').reduce((s, r) => s + (r.amount || 0), 0));
    const data = all.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data, total, page, limit, totalFee, totalVolume });
  } catch (error) {
    console.error('Get API Transactions Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Revenue PayChain earned specifically from the Developer/API
//          integration channel, plus a fixed-order breakdown by channel —
//          the API-channel counterpart to /api/admin/revenue's
//          platform-wide KPIs. Only mode:'live' (or, for invoices, real —
//          they have no test concept), status:'success'/'paid' activity
//          counts; simulated test-mode traffic is zero-fee by construction
//          (see DeveloperPayment.js) and excluded here for the same reason
//          it's excluded from every other revenue aggregation.
// @route   GET /api/admin/api-transactions/summary
// @access  Private (Admin)
export const getApiTransactionsSummary = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const tabMode = req.query.mode === 'test' ? 'test' : 'live';
    const { windowStart, windowEnd } = resolveRange(range);
    const excludeDemo = await excludeDemoMerchantsMatch();

    // Invoicing has no test-mode concept at all (Invoice.js has no `mode`
    // field — see the model) — every developer-created invoice is real.
    // So the Test tab's summary is DeveloperPayment activity only; revenue
    // there is always 0 by construction (computeApiFee zeroes any
    // mode:'test' row), which is the whole point of a test key.
    const [payments, invoices] = await Promise.all([
      DeveloperPayment.find({ createdAt: { $gte: windowStart, $lte: windowEnd }, mode: tabMode, status: 'success', ...excludeDemo })
        .select('kind amount batchId merchantId counterparty linkedTransactionId')
        .lean(),
      tabMode === 'live'
        ? Invoice.find({ createdAt: { $gte: windowStart, $lte: windowEnd }, createdViaDeveloperId: { $ne: null }, status: 'paid', ...excludeDemo })
            .select('items merchantId')
            .lean()
        : Promise.resolve([]),
    ]);

    const [paymentFees, invoiceFees] = await Promise.all([
      Promise.all(payments.map(computeApiFee)),
      Promise.all(invoices.map(computeInvoiceFee)),
    ]);

    const byChannel = Object.fromEntries(CHANNELS.map((c) => [c.id, { volume: 0, revenue: 0, count: 0 }]));
    payments.forEach((p, i) => {
      const ch = channelOf(p);
      byChannel[ch].volume += p.amount || 0;
      byChannel[ch].revenue += paymentFees[i].paychainFee || 0;
      byChannel[ch].count += 1;
    });
    invoices.forEach((inv, i) => {
      byChannel.invoice.volume += invoiceFees[i].base || 0;
      byChannel.invoice.revenue += invoiceFees[i].paychainFee || 0;
      byChannel.invoice.count += 1;
    });

    const channels = CHANNELS.map((c) => ({
      id: c.id,
      label: c.label,
      volume: round2(byChannel[c.id].volume),
      revenue: round2(byChannel[c.id].revenue),
      count: byChannel[c.id].count,
    }));

    const totalVolume = round2(channels.reduce((s, c) => s + c.volume, 0));
    const totalRevenue = round2(channels.reduce((s, c) => s + c.revenue, 0));
    const totalTransactions = channels.reduce((s, c) => s + c.count, 0);
    const takeRate = totalVolume ? round2((totalRevenue / totalVolume) * 100) : 0;

    res.json({
      success: true,
      data: {
        range, mode: tabMode, windowStart, windowEnd,
        kpis: { totalVolume, totalRevenue, totalTransactions, takeRate },
        channels,
      },
    });
  } catch (error) {
    console.error('Get API Transactions Summary Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
