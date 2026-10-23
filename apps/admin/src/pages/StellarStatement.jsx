import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { formatKES } from '../utils/formatCurrency';

// Stellar Instaward evidence: every on-chain Stellar movement (auto-settlement
// splits + redemptions) across the pilot accounts, exportable as CSV (from the
// backend, see stellarStatementController.js) or PDF (built here) — both with
// working StellarExpert links. Read-only.

const KIND_LABEL = { split_settlement: 'Auto-settlement to Stellar', redemption: 'Redemption to M-Pesa (simulated)' };
const STATUS_STYLE = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  unconfirmed: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};
const shortHash = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '');
const fmtUsdc = (v) => `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} USDC`;
const fmtDate = (d) => new Date(d).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function StellarStatement() {
  const [filters, setFilters] = useState({ merchantId: '', from: '', to: '', onChainOnly: false });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const params = useCallback(() => ({
    ...(filters.merchantId ? { merchantId: filters.merchantId } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.onChainOnly ? { onChainOnly: 'true' } : {}),
  }), [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/api/admin/stellar/statement', { params: params() })
      .then((res) => { if (!cancelled) setData(res.data?.data || null); })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error || 'Could not load the statement.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params]);

  async function downloadCsv() {
    setExporting('csv');
    try {
      const res = await api.get('/api/admin/stellar/statement.csv', { params: params(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `paychain-stellar-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Could not export the CSV.');
    } finally {
      setExporting('');
    }
  }

  function downloadPdf() {
    if (!data) return;
    setExporting('pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const L = 12;
      const R = W - 12;
      const merchantLabel = filters.merchantId
        ? (data.pilots.find((p) => p._id === filters.merchantId)?.businessName || 'One pilot')
        : `All ${data.pilots.length} pilot accounts`;
      const period = filters.from || filters.to ? `${filters.from || 'start'} to ${filters.to || 'today'}` : 'All time';

      doc.setFillColor(6, 32, 27);
      doc.rect(0, 0, W, 26, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
      doc.text('PayChain — Stellar Transaction Statement', L, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`Stellar ${data.network} · ${merchantLabel} · ${period}${filters.onChainOnly ? ' · on-chain only' : ''}`, L, 19);
      doc.text(`Generated ${fmtDate(new Date())} (Nairobi)`, R, 19, { align: 'right' });

      const t = data.totals;
      doc.setTextColor(30, 40, 35); doc.setFontSize(9);
      const summary = [
        ['Entries', String(t.entries)],
        ['With Stellar tx hash', String(t.onChain)],
        ['Settled to Stellar (completed)', `${formatKES(t.settledKes)} → ${fmtUsdc(t.settledUsdc)}`],
        ['Redeemed to M-Pesa (completed, simulated B2C)', `${fmtUsdc(t.redeemedUsdc)} → ${formatKES(t.redeemedKes)}`],
      ];
      autoTable(doc, {
        startY: 31, margin: { left: L, right: L }, body: summary, theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 4 } },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
      });

      const rows = data.entries.map((e) => [
        fmtDate(e.createdAt),
        e.businessName,
        KIND_LABEL[e.kind] || e.kind,
        e.status,
        formatKES(e.kesAmount || 0),
        fmtUsdc(e.usdcAmount),
        e.stellarTxHash ? shortHash(e.stellarTxHash) : '—',
        e.receiptHash ? shortHash(e.receiptHash) : '—',
      ]);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 5,
        margin: { left: L, right: L },
        head: [['Date (Nairobi)', 'Merchant', 'Type', 'Status', 'KES', 'USDC', 'Stellar tx (click to verify)', 'Receipt hash']],
        body: rows,
        theme: 'plain',
        headStyles: { fillColor: [6, 32, 27], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', cellPadding: 2.5 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 40, 35], cellPadding: 2.2, lineColor: [230, 235, 232], lineWidth: 0.2, valign: 'middle' },
        alternateRowStyles: { fillColor: [246, 249, 247] },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { font: 'courier' }, 7: { font: 'courier' } },
        didParseCell(cell) {
          if (cell.section !== 'body') return;
          const entry = data.entries[cell.row.index];
          if (cell.column.index === 3) {
            cell.cell.styles.textColor = entry.status === 'completed' ? [6, 120, 60] : entry.status === 'failed' ? [180, 30, 30] : [160, 110, 6];
          }
          if (cell.column.index === 6 && entry.stellarExpertUrl) cell.cell.styles.textColor = [29, 78, 216];
        },
        didDrawCell(cell) {
          if (cell.section !== 'body' || cell.column.index !== 6) return;
          const url = data.entries[cell.row.index].stellarExpertUrl;
          if (url) doc.link(cell.cell.x, cell.cell.y, cell.cell.width, cell.cell.height, { url });
        },
      });

      // Full links, so a printed copy still carries every verifiable URL.
      const linked = data.entries.filter((e) => e.stellarExpertUrl);
      if (linked.length) {
        let y = doc.lastAutoTable.finalY + 8;
        const pageH = doc.internal.pageSize.getHeight();
        if (y > pageH - 30) { doc.addPage(); y = 16; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(6, 32, 27);
        doc.text('StellarExpert verification links', L, y);
        y += 5;
        doc.setFont('courier', 'normal'); doc.setFontSize(7);
        for (const e of linked) {
          if (y > pageH - 12) { doc.addPage(); y = 16; }
          doc.setTextColor(30, 40, 35);
          doc.text(`${fmtDate(e.createdAt)}  ${e.businessName.slice(0, 28).padEnd(28)}  `, L, y);
          doc.setTextColor(29, 78, 216);
          doc.textWithLink(e.stellarExpertUrl, L + 92, y, { url: e.stellarExpertUrl });
          y += 4.2;
        }
      }

      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 150, 145);
        doc.text(`PayChain · Stellar ${data.network} statement · page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }
      doc.save(`paychain-stellar-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      setError('Could not build the PDF.');
    } finally {
      setExporting('');
    }
  }

  const t = data?.totals;
  const input = 'bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface tracking-tight font-headline">Stellar Statement</h2>
            <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
              Every on-chain Stellar movement across the pilot accounts — auto-settlement splits and redemptions — with links to verify each transaction on StellarExpert. Stellar {data?.network || 'testnet'}; M-Pesa disbursements are simulated.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadCsv} disabled={!data || !!exporting} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-container border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-high disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">{exporting === 'csv' ? 'progress_activity' : 'download'}</span>
              {exporting === 'csv' ? 'Preparing…' : 'Download CSV'}
            </button>
            <button onClick={downloadPdf} disabled={!data || !!exporting} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-700 text-white text-2xs font-bold uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">{exporting === 'pdf' ? 'progress_activity' : 'picture_as_pdf'}</span>
              {exporting === 'pdf' ? 'Building…' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Pilot account</span>
            <select value={filters.merchantId} onChange={(e) => setFilters((f) => ({ ...f, merchantId: e.target.value }))} className={`${input} min-w-56`}>
              <option value="">All pilot accounts</option>
              {(data?.pilots || []).map((p) => <option key={p._id} value={p._id}>{p.businessName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={input} />
          </label>
          <label className="flex items-center gap-2 text-xs text-on-surface py-2">
            <input type="checkbox" checked={filters.onChainOnly} onChange={(e) => setFilters((f) => ({ ...f, onChainOnly: e.target.checked }))} className="accent-emerald-700" />
            On-chain only (hide failed attempts)
          </label>
        </div>

        {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}

        {t && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Entries', t.entries, `${t.onChain} with a Stellar tx hash`],
              ['Settled to Stellar', formatKES(t.settledKes), fmtUsdc(t.settledUsdc)],
              ['Redeemed to M-Pesa', fmtUsdc(t.redeemedUsdc), `${formatKES(t.redeemedKes)} (simulated B2C)`],
              ['Pilot accounts', data.pilots.length, `Stellar ${data.network}`],
            ].map(([label, value, sub]) => (
              <div key={label} className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-4 py-3">
                <div className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</div>
                <div className="text-lg font-bold text-on-surface tabular-nums mt-1">{value}</div>
                <div className="text-2xs text-on-surface-variant mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant text-xs">Loading…</div>
          ) : !data || data.entries.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant text-xs">No Stellar activity for these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                  <tr className="text-2xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-3 py-3">Merchant</th>
                    <th className="text-left px-3 py-3">Type</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-right px-3 py-3">KES</th>
                    <th className="text-right px-3 py-3">USDC</th>
                    <th className="text-left px-4 py-3">Stellar transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e._id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/60">
                      <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{fmtDate(e.createdAt)}</td>
                      <td className="px-3 py-3 font-semibold text-on-surface">{e.businessName}</td>
                      <td className="px-3 py-3 text-on-surface-variant">
                        {KIND_LABEL[e.kind] || e.kind}
                        {e.kind === 'split_settlement' && e.splitPercent != null && <span className="text-2xs"> · {e.splitPercent}%</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded border text-2xs font-bold uppercase tracking-wide ${STATUS_STYLE[e.status] || ''}`}>{e.status}</span>
                        {e.errorMessage && <div className="text-2xs text-red-600 mt-1 max-w-56">{e.errorMessage}</div>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatKES(e.kesAmount || 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtUsdc(e.usdcAmount)}</td>
                      <td className="px-4 py-3">
                        {e.stellarExpertUrl ? (
                          <a href={e.stellarExpertUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-blue-700 hover:underline">
                            {shortHash(e.stellarTxHash)}
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        ) : <span className="text-on-surface-variant/50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data?.truncated && <div className="px-4 py-2 text-2xs text-amber-700 border-t border-outline-variant/40">Showing the newest 5,000 entries — narrow the dates to see older ones.</div>}
        </div>
      </div>
    </Layout>
  );
}
