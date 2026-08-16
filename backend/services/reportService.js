import EtimsInvoice from '../models/EtimsInvoice.js';
import { money2dp, TAX_TYPE_CODES } from '../utils/etimsFormat.js';

function emptyTaxBreakdown() {
  return Object.fromEntries(TAX_TYPE_CODES.map((c) => [c, { taxblAmt: 0, taxAmt: 0 }]));
}

function emptyPaymentMethods() {
  return { cash: 0, card: 0, mobile_money: 0, other: 0 };
}

async function buildReport({ merchantId, bhfId, from, to }) {
  const invoices = await EtimsInvoice.find({
    merchantId, bhfId, status: 'signed', createdAt: { $gte: from, $lte: to },
  }).lean();

  const summary = {
    merchantId: String(merchantId),
    bhfId,
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    invoiceCount: invoices.length,
    normalSales: { count: 0, amount: 0 },
    creditNotes: { count: 0, amount: 0 },
    taxBreakdown: emptyTaxBreakdown(),
    paymentMethods: emptyPaymentMethods(),
    totalTaxblAmt: 0,
    totalTaxAmt: 0,
    totalAmt: 0,
  };

  for (const inv of invoices) {
    if (inv.transactionType === 'CREDIT_NOTE') {
      summary.creditNotes.count += 1;
      summary.creditNotes.amount = money2dp(summary.creditNotes.amount + inv.totAmt);
    } else if (inv.transactionType === 'NORMAL_SALE') {
      summary.normalSales.count += 1;
      summary.normalSales.amount = money2dp(summary.normalSales.amount + inv.totAmt);
    }

    for (const code of TAX_TYPE_CODES) {
      summary.taxBreakdown[code].taxblAmt = money2dp(summary.taxBreakdown[code].taxblAmt + (inv[`taxblAmt${code}`] || 0));
      summary.taxBreakdown[code].taxAmt = money2dp(summary.taxBreakdown[code].taxAmt + (inv[`taxAmt${code}`] || 0));
    }

    const method = inv.paymentMethod || 'other';
    summary.paymentMethods[method] = money2dp((summary.paymentMethods[method] || 0) + inv.totAmt);

    summary.totalTaxblAmt = money2dp(summary.totalTaxblAmt + inv.totTaxblAmt);
    summary.totalTaxAmt = money2dp(summary.totalTaxAmt + inv.totTaxAmt);
    summary.totalAmt = money2dp(summary.totalAmt + inv.totAmt);
  }

  return summary;
}

// X-Report: an in-progress shift summary — the same aggregation as a
// Z-report but over an arbitrary open window (typically "since the last
// Z-report"). Explicitly non-resetting: a read, never a close-out.
export async function generateXReport({ merchantId, bhfId = '00', from, to = new Date() }) {
  if (!from) throw new Error('generateXReport requires an explicit `from` (start of the current shift)');
  const report = await buildReport({ merchantId, bhfId, from, to });
  return { ...report, reportType: 'X_REPORT', generatedAt: new Date().toISOString() };
}

// Z-Report: the full calendar-day close-out, 00:00:00 to 23:59:59 local
// time for the given date (defaults to today).
export async function generateZReport({ merchantId, bhfId = '00', date = new Date() }) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  const report = await buildReport({ merchantId, bhfId, from, to });
  return { ...report, reportType: 'Z_REPORT', generatedAt: new Date().toISOString() };
}
