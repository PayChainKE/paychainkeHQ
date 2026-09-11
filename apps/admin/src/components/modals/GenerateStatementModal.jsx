import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/api';
import { formatKES } from '../../utils/formatCurrency';
import { formatAccountNumber } from '../../utils/formatAccountNumber';
import { formatName } from '../../utils/formatName';
import { isCreditTransaction, isDebitTransaction, netBalanceImpact } from '../../utils/transactionDirection';
import logo from '../../assets/logo.png';

const PRESETS = [
  { key: 'all',   label: 'Since Joining' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: 'year',  label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

// Admin-side equivalent of the merchant's own self-serve statement export
// (apps/merchant-dashboard/src/pages/Transactions.jsx) — same jsPDF ledger
// approach, but the transaction data has to be fetched fresh (admin
// doesn't already have this merchant's full history loaded client-side the
// way a merchant has their own), scoped to one merchant via
// GET /api/admin/merchants/:id/statement. Defaults to the merchant's
// entire lifetime, i.e. "since the day they joined".
export default function GenerateStatementModal({ merchant, onClose }) {
  const [preset, setPreset] = React.useState('all');
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const resolveRange = () => {
    const now = new Date();
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const joined = new Date(merchant.createdAt);

    if (preset === '30d') {
      const from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
      return { from: from < joined ? joined : from, to: endOfToday };
    }
    if (preset === 'year') {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from < joined ? joined : from, to: endOfToday };
    }
    if (preset === 'custom') {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : joined;
      const to = customTo ? new Date(`${customTo}T23:59:59`) : endOfToday;
      return { from, to };
    }
    return { from: joined, to: endOfToday }; // Since Joining
  };

  const formatPeriodLabel = (from, to) => {
    const fmt = (d) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(from)} – ${fmt(to)}`;
  };

  async function confirmGenerate() {
    const { from, to } = resolveRange();
    if (from > to) {
      setError('The "from" date must be before the "to" date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/merchants/${merchant._id}/statement`, {
        params: { from: from.toISOString(), to: to.toISOString() },
      });
      const { transactions, netChangeAfterPeriod, merchant: merchantData } = res.data;
      if (!transactions?.length) {
        setError('No transactions were found in the selected period.');
        setBusy(false);
        return;
      }
      buildPdf(transactions, formatPeriodLabel(from, to), to, netChangeAfterPeriod || 0, merchantData);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not generate the statement.');
      setBusy(false);
    }
  }

  // Full bank-statement layout, ported from the merchant's own self-serve
  // export (apps/merchant-dashboard/src/pages/Transactions.jsx#handleExport)
  // — letterhead, account-details block, Money In/Out/Net summary strip,
  // a ledger with a real running balance (reconciled to the merchant's
  // live kesBalance via netChangeAfterPeriod, see the backend endpoint's
  // doc comment), a closing-balance strip, and a repeating header/footer
  // with page numbers so a printed multi-page statement stays legible.
  function buildPdf(transactions, periodLabel, periodEnd, netChangeAfterPeriod, merchantData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const L = 14, R = W - 14;
    const now = new Date();
    const statementId = `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const fitText = (text, maxWidth) => {
      let str = String(text ?? '');
      if (doc.getTextWidth(str) <= maxWidth) return str;
      while (str.length > 1 && doc.getTextWidth(str + '…') > maxWidth) {
        str = str.slice(0, -1);
      }
      return str + '…';
    };

    // ── HEADER BAND ─────────────────────────────────────────────────────
    doc.setFillColor(6, 32, 27);
    doc.rect(0, 0, W, 38, 'F');
    const logoW = 30, logoH = logoW * (75 / 338);
    try { doc.addImage(logo, 'PNG', L, (38 - logoH) / 2, logoW, logoH, undefined, 'FAST'); } catch (_) {}
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PayChain Kenya', R, 15, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(94, 254, 179);
    doc.text('OFFICIAL ACCOUNT STATEMENT', R, 22, { align: 'right' });
    doc.setTextColor(200, 220, 210);
    doc.text(`Statement Ref: ${statementId}`, R, 27, { align: 'right' });
    doc.text(`Issued: ${now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`, R, 32, { align: 'right' });

    // ── ACCOUNT DETAILS BLOCK ───────────────────────────────────────────
    let y = 48;
    doc.setTextColor(6, 32, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Account Details', L, y);
    doc.setDrawColor(220, 230, 225);
    doc.setLineWidth(0.3);
    doc.line(L, y + 2, R, y + 2);

    y += 8;
    const col2 = W / 2 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const acctLines = [
      ['Account Name', merchantData.name || '—', 'Business', merchantData.businessName || '—'],
      ['Paybill / PayChain Account', `880100 / ${formatAccountNumber(merchantData.ncbaVirtualAccountNumber || merchantData.ncbaMerchantCode || 'Pending')}`, 'Email', merchantData.email || '—'],
      ['Phone', merchantData.phone || '—', 'Statement Period', periodLabel],
    ];
    acctLines.forEach(([lk, lv, rk, rv]) => {
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal');
      doc.text(lk + ':', L, y);
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold');
      doc.text(fitText(lv, col2 - (L + 32) - 4), L + 32, y);
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal');
      doc.text(rk + ':', col2, y);
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold');
      doc.text(fitText(rv, R - (col2 + 30)), col2 + 30, y);
      y += 7;
    });

    // ── SUMMARY STRIP ────────────────────────────────────────────────────
    const totalIn = transactions.reduce((s, t) => { const d = netBalanceImpact(t); return d > 0 ? s + d : s; }, 0);
    const totalOut = transactions.reduce((s, t) => { const d = netBalanceImpact(t); return d < 0 ? s - d : s; }, 0);
    const fmtNum = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Opening balance: work backwards from the merchant's real, current
    // kesBalance by undoing this period's net change AND whatever happened
    // after the period ended (netChangeAfterPeriod, from the backend) — so
    // the running balance column and the closing strip below always
    // reconcile with the merchant's actual live account balance, not an
    // arbitrary zero.
    const netChangeWithinPeriod = transactions.reduce((s, t) => s + netBalanceImpact(t), 0);
    const openingBalance = (merchantData.kesBalance || 0) - netChangeWithinPeriod - netChangeAfterPeriod;

    y += 3;
    const summaryItems = [
      { label: 'Total Money In', value: formatKES(totalIn), color: [6, 32, 27] },
      { label: 'Total Money Out', value: formatKES(totalOut), color: [180, 30, 30] },
      { label: 'Net Position', value: formatKES(totalIn - totalOut), color: totalIn >= totalOut ? [6, 32, 27] : [180, 30, 30] },
      { label: 'Transactions', value: String(transactions.length), color: [40, 80, 120] },
    ];
    const boxW = (R - L) / summaryItems.length - 2;
    summaryItems.forEach((item, i) => {
      const bx = L + i * (boxW + 2);
      doc.setFillColor(244, 247, 245);
      doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 110, 105);
      doc.text(item.label.toUpperCase(), bx + boxW / 2, y + 6, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...item.color);
      doc.text(item.value, bx + boxW / 2, y + 13, { align: 'center' });
    });

    // ── TRANSACTION TABLE ───────────────────────────────────────────────
    y += 24;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(6, 32, 27);
    doc.text('Transaction Ledger', L, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 125);
    doc.text(`${transactions.length} record${transactions.length !== 1 ? 's' : ''}`, R, y, { align: 'right' });
    y += 5;
    doc.text(`Opening Balance: ${formatKES(openingBalance)}`, L, y);

    let runBalance = openingBalance;
    const tableRows = [...transactions]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((tx) => {
        const dt = new Date(tx.createdAt);
        const dateStr = dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' });
        const timeStr = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
        const isIn = isCreditTransaction(tx.type);
        const isOut = isDebitTransaction(tx.type);
        const isSwp = tx.type === 'fx_swap';
        const rawAmt = tx.amount || tx.kesAmount || 0;

        let paidIn = '', paidOut = '';
        if (isIn) paidIn = fmtNum(rawAmt);
        if (isOut) paidOut = fmtNum(rawAmt);
        if (isSwp) paidOut = fmtNum(tx.kesAmount || 0);
        runBalance += netBalanceImpact(tx);

        const desc = isSwp
          ? `FX Swap -> ${tx.usdcAmount || 0} USDC`
          : (tx.sender?.name !== tx.recipient?.name
              ? `${formatName(tx.sender?.name) || '—'} -> ${formatName(tx.recipient?.name) || '—'}`
              : formatName(tx.sender?.name) || formatName(tx.recipient?.name) || '—');

        return [
          `${dateStr}\n${timeStr}`,
          (tx.reference || '—').slice(0, 14),
          desc.slice(0, 32),
          paidIn,
          paidOut,
          fmtNum(runBalance),
          (tx.status || '').toUpperCase().slice(0, 9),
        ];
      });

    autoTable(doc, {
      startY: y + 4,
      head: [['DATE/TIME', 'REF', 'DESCRIPTION', 'PAID IN (KES)', 'PAID OUT (KES)', 'BALANCE (KES)', 'STATUS']],
      body: tableRows,
      theme: 'plain',
      tableWidth: R - L,
      headStyles: {
        fillColor: [6, 32, 27], textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold',
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }, halign: 'left', lineWidth: 0,
      },
      bodyStyles: {
        fontSize: 7.5, textColor: [30, 40, 35], cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: [230, 235, 232], lineWidth: 0.2, valign: 'middle', overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: [246, 249, 247] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'left', fontStyle: 'normal' },
        1: { cellWidth: 28, halign: 'left', fontStyle: 'normal', fontSize: 6.5 },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 26, halign: 'right', textColor: [6, 120, 60], fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'right', textColor: [160, 30, 30], fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'center', fontSize: 6.5 },
      },
      didParseCell(data) {
        if (data.section === 'body') {
          if (data.column.index === 3 && data.cell.raw) data.cell.styles.textColor = [6, 120, 60];
          if (data.column.index === 4 && data.cell.raw) data.cell.styles.textColor = [160, 30, 30];
          if (data.column.index === 6) {
            const v = String(data.cell.raw);
            if (v === 'COMPLETED') { data.cell.styles.textColor = [6, 120, 60]; data.cell.styles.fontStyle = 'bold'; }
            if (v === 'PENDING') { data.cell.styles.textColor = [160, 110, 6]; data.cell.styles.fontStyle = 'bold'; }
            if (v === 'FAILED') { data.cell.styles.textColor = [160, 30, 30]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      },
      didDrawPage(data) {
        if (data.pageNumber > 1) {
          doc.setFillColor(6, 32, 27);
          doc.rect(0, 0, W, 12, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text(`PayChain — ${statementId} — continued`, L, 8);
          doc.text(`Page ${data.pageNumber}`, R, 8, { align: 'right' });
        }
      },
      margin: { left: L, right: W - R },
    });

    // ── CLOSING BALANCE STRIP ───────────────────────────────────────────
    const endY = doc.lastAutoTable.finalY + 4;
    doc.setFillColor(6, 32, 27);
    doc.rect(L, endY, R - L, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(94, 254, 179);
    doc.text('Closing Balance', L + 4, endY + 7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(formatKES(runBalance), R - 4, endY + 7.5, { align: 'right' });

    // ── FOOTER (every page) ─────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = H - 14;
      doc.setDrawColor(200, 210, 205); doc.setLineWidth(0.3);
      doc.line(L, footerY - 4, R, footerY - 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 150, 145);
      doc.text('This is a computer-generated statement issued by PayChain Admin on behalf of the merchant. For support: support@paychain.co.ke | +254 743 283 782', W / 2, footerY, { align: 'center' });
      doc.text(`© ${now.getFullYear()} Paychain Ltd  •  Ref: ${statementId}  •  Page ${p} of ${totalPages}`, W / 2, footerY + 5, { align: 'center' });
    }

    const filename = `PayChain_Statement_${(merchantData.businessName || merchantData._id).toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}_${periodEnd.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">receipt_long</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-1">Generate Account Statement</h3>
        <p className="text-sm text-on-surface-variant mb-5">
          For <strong>{merchant.businessName}</strong>. Downloads as a PDF — nothing is emailed.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                preset === p.key ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">From</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">To</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm" />
            </div>
          </div>
        )}

        {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
          <button onClick={confirmGenerate} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg disabled:opacity-50 transition-all">
            {busy ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
