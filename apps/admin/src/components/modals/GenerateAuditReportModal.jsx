import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/api';
import logo from '../../assets/logo.png';

const PRESETS = [
  { key: 'all',   label: 'Since Joining' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: 'year',  label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

// Same 5000-row cap and "narrow the range" warning as the global Audit Log
// page's own CSV export (apps/admin/src/pages/AuditLog.jsx) — this modal
// just scopes that same GET /api/admin/audit-log feed to one merchant via
// ?merchantId=, defaulting the range to since they joined. That endpoint
// already merges AuditLog rows with the merchant's real transaction
// activity (see auditLogController.js's buildTransactionUnionStage), so
// this is a genuine full activity trail, not just security/admin events.
const EXPORT_LIMIT = 5000;

export default function GenerateAuditReportModal({ merchant, onClose }) {
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
      const res = await api.get('/api/admin/audit-log', {
        params: { merchantId: merchant._id, from: from.toISOString(), to: to.toISOString(), page: 1, limit: EXPORT_LIMIT },
      });
      const rows = res.data?.data || [];
      if (!rows.length) {
        setError('No audit activity was found in the selected period.');
        setBusy(false);
        return;
      }
      buildPdf(rows, formatPeriodLabel(from, to), to, res.data?.total || rows.length);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not generate the audit report.');
      setBusy(false);
    }
  }

  function buildPdf(rows, periodLabel, periodEnd, totalMatching) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const L = 14, R = W - 14;
    const now = new Date();
    const reportId = `PC-AR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const fitText = (text, maxWidth) => {
      let str = String(text ?? '');
      if (doc.getTextWidth(str) <= maxWidth) return str;
      while (str.length > 1 && doc.getTextWidth(str + '…') > maxWidth) {
        str = str.slice(0, -1);
      }
      return str + '…';
    };

    // ── HEADER BAND ───────────────────────────────────────────────────────
    doc.setFillColor(6, 32, 27);
    doc.rect(0, 0, W, 32, 'F');
    const logoW = 28, logoH = logoW * (75 / 338);
    try { doc.addImage(logo, 'PNG', L, (32 - logoH) / 2, logoW, logoH, undefined, 'FAST'); } catch (_) {}
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PayChain Kenya', R, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(94, 254, 179);
    doc.text('MERCHANT AUDIT REPORT', R, 20, { align: 'right' });
    doc.setTextColor(200, 220, 210);
    doc.text(`Report Ref: ${reportId}`, R, 26, { align: 'right' });

    // ── ACCOUNT DETAILS BLOCK ────────────────────────────────────────────
    let y = 40;
    doc.setTextColor(6, 32, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Account Details', L, y);
    doc.setDrawColor(220, 230, 225);
    doc.setLineWidth(0.3);
    doc.line(L, y + 1.5, R, y + 1.5);

    y += 6;
    const col2 = W / 2 + 4;
    const col3 = W - 90;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 105);
    doc.text('Business:', L, y);
    doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold');
    doc.text(fitText(merchant.businessName || merchant.name || '—', col2 - L - 22), L + 20, y);
    doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal');
    doc.text('Period:', col2, y);
    doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold');
    doc.text(fitText(periodLabel, col3 - col2 - 16), col2 + 16, y);
    doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal');
    doc.text('Issued:', col3, y);
    doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold');
    doc.text(now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }), col3 + 16, y);
    y += 8;

    // ── SUMMARY STRIP ────────────────────────────────────────────────────
    const bySeverity = rows.reduce((acc, r) => { const k = r.severity || 'info'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const adminActions = rows.filter((r) => ['admin', 'officer'].includes(r.actor?.type)).length;
    const summaryItems = [
      { label: 'Total Events', value: String(rows.length), color: [6, 32, 27] },
      { label: 'Admin Actions', value: String(adminActions), color: [40, 80, 120] },
      { label: 'Warnings', value: String(bySeverity.warning || 0), color: [160, 110, 6] },
      { label: 'Critical', value: String(bySeverity.critical || 0), color: [180, 30, 30] },
    ];
    const boxW = (R - L) / summaryItems.length - 2;
    summaryItems.forEach((item, i) => {
      const bx = L + i * (boxW + 2);
      doc.setFillColor(244, 247, 245);
      doc.roundedRect(bx, y, boxW, 15, 2, 2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 110, 105);
      doc.text(item.label.toUpperCase(), bx + boxW / 2, y + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...item.color);
      doc.text(item.value, bx + boxW / 2, y + 11.5, { align: 'center' });
    });
    y += 21;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(6, 32, 27);
    doc.text('Activity Trail', L, y);
    y += 2;

    const body = rows.map((r) => {
      const actorLabel = ['admin', 'officer'].includes(r.actor?.type)
        ? (r.actor?.name || r.actor?.email || r.actor.type)
        : (r.actor?.type === 'system' ? 'System' : (r.actor?.name || 'Merchant'));
      return [
        new Date(r.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
        (r.action || '—').replace(/[._]/g, ' '),
        r.category || '—',
        r.severity || '—',
        actorLabel,
        r.message || '—',
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      margin: { left: L, right: L },
      head: [['DATE/TIME', 'ACTION', 'CATEGORY', 'SEVERITY', 'ACTOR', 'DETAILS']],
      body,
      theme: 'plain',
      headStyles: {
        fillColor: [6, 32, 27], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold',
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }, halign: 'left', lineWidth: 0,
      },
      bodyStyles: {
        fontSize: 7.3, textColor: [30, 40, 35], cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        lineColor: [230, 235, 232], lineWidth: 0.2, valign: 'middle', overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: [246, 249, 247] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 42 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18, fontStyle: 'bold' },
        4: { cellWidth: 32 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const v = String(data.cell.raw);
          if (v === 'critical') data.cell.styles.textColor = [180, 30, 30];
          else if (v === 'warning') data.cell.styles.textColor = [160, 110, 6];
          else if (v === 'success') data.cell.styles.textColor = [6, 120, 60];
        }
      },
      didDrawPage(data) {
        if (data.pageNumber > 1) {
          doc.setFillColor(6, 32, 27);
          doc.rect(0, 0, W, 10, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
          doc.text(`PayChain — ${reportId} — continued`, L, 6.5);
          doc.text(`Page ${data.pageNumber}`, R, 6.5, { align: 'right' });
        }
      },
    });

    // ── FOOTER (every page) ──────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = H - 12;
      doc.setDrawColor(200, 210, 205); doc.setLineWidth(0.3);
      doc.line(L, footerY - 4, R, footerY - 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(140, 150, 145);
      const capNote = totalMatching > rows.length
        ? `Matched ${totalMatching} events — only the most recent ${rows.length} shown; narrow the date range for a complete report. `
        : '';
      doc.text(`${capNote}Generated by PayChain Admin — internal/audit use.`, W / 2, footerY, { align: 'center' });
      doc.text(`© ${now.getFullYear()} Paychain Ltd  •  Ref: ${reportId}  •  Page ${p} of ${totalPages}`, W / 2, footerY + 4.5, { align: 'center' });
    }

    const filename = `PayChain_Audit_Report_${(merchant.businessName || merchant._id).toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}_${periodEnd.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">fact_check</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-1">Generate Audit Report</h3>
        <p className="text-sm text-on-surface-variant mb-5">
          Full activity trail for <strong>{merchant.businessName}</strong> — logins, admin actions, KYC changes, and transactions. Downloads as a PDF.
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
