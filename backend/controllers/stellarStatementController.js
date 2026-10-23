import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import StellarLedgerEntry from '../models/StellarLedgerEntry.js';
import { explorerTxUrl, ledgerEntryToRow, RECONCILIATION_COLUMNS } from '../services/stellarSettlementService.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// Stellar Instaward evidence: an exportable statement of every on-chain
// Stellar movement (auto-settlement splits + redemptions) across the pilot
// (isDemoMerchant) accounts, with working StellarExpert links. Admin-only and
// read-only. Same rows/columns as the pilots' own reconciliation export
// (stellarSettlementService.js#ledgerEntryToRow), plus which merchant.

const MAX_ROWS = 5000;

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseDay(value, endOfDay) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+03:00`); // Nairobi days
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadStatement(query) {
  const pilots = await Merchant.find({ isDemoMerchant: true })
    .select('businessName email stellarPublicKey')
    .sort('businessName')
    .lean();
  const pilotIds = pilots.map((p) => p._id);

  const filter = { merchantId: { $in: pilotIds } };
  if (query.merchantId) {
    if (!mongoose.Types.ObjectId.isValid(query.merchantId) || !pilotIds.some((id) => String(id) === String(query.merchantId))) {
      return { error: 'Choose one of the Stellar pilot accounts.' };
    }
    filter.merchantId = new mongoose.Types.ObjectId(query.merchantId);
  }
  const from = parseDay(query.from, false);
  const to = parseDay(query.to, true);
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (query.onChainOnly === 'true') filter.stellarTxHash = { $type: 'string', $ne: '' };

  const rows = await StellarLedgerEntry.find(filter).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
  const byId = new Map(pilots.map((p) => [String(p._id), p]));
  const entries = rows.map((r) => ({
    ...r,
    businessName: byId.get(String(r.merchantId))?.businessName || '—',
    stellarExpertUrl: explorerTxUrl(r.stellarTxHash),
  }));

  const done = entries.filter((e) => e.status === 'completed');
  const sum = (kind, field) => Math.round(done.filter((e) => e.kind === kind).reduce((t, e) => t + (e[field] || 0), 0) * 1e7) / 1e7;
  const totals = {
    entries: entries.length,
    onChain: entries.filter((e) => e.stellarTxHash).length,
    settledKes: sum('split_settlement', 'kesAmount'),
    settledUsdc: sum('split_settlement', 'usdcAmount'),
    redeemedKes: sum('redemption', 'kesAmount'),
    redeemedUsdc: sum('redemption', 'usdcAmount'),
  };

  return {
    pilots: pilots.map((p) => ({ _id: p._id, businessName: p.businessName, email: p.email, stellarPublicKey: p.stellarPublicKey || null })),
    entries,
    totals,
    truncated: rows.length === MAX_ROWS,
    network: entries[0]?.stellarExpertUrl?.includes('/public/') ? 'public' : 'testnet',
  };
}

// @desc    Stellar pilot statement (JSON) for the admin page + client-side PDF.
// @route   GET /api/admin/stellar/statement?merchantId=&from=YYYY-MM-DD&to=YYYY-MM-DD&onChainOnly=true
// @access  Private (Admin, not officer)
export const getStellarStatement = async (req, res) => {
  try {
    const data = await loadStatement(req.query);
    if (data.error) return res.status(400).json({ error: data.error });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get Stellar Statement Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Same statement as a CSV download, one row per ledger entry, with
//          a StellarExpert link column.
// @route   GET /api/admin/stellar/statement.csv (same query params)
// @access  Private (Admin, not officer)
export const exportStellarStatementCsv = async (req, res) => {
  try {
    const data = await loadStatement(req.query);
    if (data.error) return res.status(400).json({ error: data.error });

    const header = ['Merchant', ...RECONCILIATION_COLUMNS];
    const lines = [header, ...data.entries.map((e) => [e.businessName, ...ledgerEntryToRow(e)])]
      .map((row) => row.map(csvCell).join(','));
    lines.push('');
    lines.push(csvCell(`Completed totals — settled to Stellar: KES ${data.totals.settledKes} / USDC ${data.totals.settledUsdc}; redeemed: KES ${data.totals.redeemedKes} / USDC ${data.totals.redeemedUsdc}`));
    lines.push(csvCell(`${data.totals.entries} entries, ${data.totals.onChain} with a Stellar ${data.network} transaction hash. Generated ${new Date().toISOString()}.`));

    logAudit({
      action: 'admin.stellar_statement.exported', category: 'admin', severity: 'info',
      message: `Exported Stellar pilot statement as CSV (${data.totals.entries} entries)`,
      actor: adminActor(req.admin), req,
      metadata: { merchantId: req.query.merchantId || null, from: req.query.from || null, to: req.query.to || null },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paychain-stellar-statement-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (error) {
    console.error('Export Stellar Statement CSV Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
