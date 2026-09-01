import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { formatKES } from '../utils/formatCurrency';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2.5 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * Every real NCBA/KRA-side charge on the pooled account with no matching
 * PayChain transfer behind it — Excise Duty (KRA's tax on bank transfer
 * fees), an SMS fee, anything else NCBA or KRA has deducted directly. Most
 * are found automatically by the hourly reconciliation sweep
 * (backend/services/bankChargeReconciliationService.js); an admin can also
 * record one by hand for anything the sweep misses. This is the same
 * BankAccountCharge data PoolReconciliation.jsx shows in a small scrollable
 * summary box — this page is the full, paginated, searchable view of it,
 * styled like the platform's other transaction-style tables.
 */
const BankCharges = () => {
  const { admin: currentAdmin } = useAuth();
  const canManage = currentAdmin?.role === 'owner' || currentAdmin?.role === 'admin';

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // How much of PayChain's gross accrued revenue these charges have eaten
  // that hasn't been written off yet (see backend/models/RevenueWriteOff.js
  // and revenueSweepService.js#computeUnsweptRevenue) — pulled from the
  // same endpoint the Revenue page's "Held in FBO · Unswept" card reads,
  // so this always agrees with what's shown there.
  const [deficit, setDeficit] = useState(0);
  const [deficitLoading, setDeficitLoading] = useState(true);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffBusy, setWriteOffBusy] = useState(false);
  const [writeOffError, setWriteOffError] = useState('');

  const fetchDeficit = useCallback(async () => {
    setDeficitLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/pool-balance/expected');
      setDeficit(res.data?.data?.bankChargesDeficit ?? 0);
    } catch (e) {
      setDeficit(0);
    } finally {
      setDeficitLoading(false);
    }
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [clearTarget, setClearTarget] = useState(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3200); }, []);

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/pool-account/charges', { params: { page, limit: PAGE_SIZE } });
      setItems(res.data?.data || []);
      setTotal(res.data?.total ?? 0);
      setTotalAmount(res.data?.totalAmount ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchCharges(); }, [fetchCharges]);
  useEffect(() => { fetchDeficit(); }, [fetchDeficit]);

  async function confirmWriteOff() {
    setWriteOffBusy(true);
    setWriteOffError('');
    try {
      await api.post('/api/admin/revenue/pool-account/write-off-deficit', { reason: writeOffReason || undefined });
      showToast('Deficit written off — unswept revenue no longer carries it.');
      setShowWriteOff(false);
      setWriteOffReason('');
      fetchDeficit();
    } catch (e) {
      setWriteOffError(e?.response?.data?.error || 'Could not write off the deficit.');
    } finally {
      setWriteOffBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setDate(todayIso());
    setAmount('');
    setDescription('');
    setReference('');
    setFormError('');
  }

  function cancelForm() {
    setShowForm(false);
    resetForm();
  }

  function startEdit(charge) {
    setEditingId(charge._id);
    setDate(new Date(charge.chargedAt).toISOString().slice(0, 10));
    setAmount(String(charge.amount));
    setDescription(charge.description || '');
    setReference(charge.reference || '');
    setFormError('');
    setShowForm(true);
  }

  async function submitCharge(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { chargedAt: date, amount: Number(amount), description, reference: reference || undefined };
      if (editingId) {
        await api.patch(`/api/admin/revenue/pool-account/charges/${editingId}`, payload);
        showToast('Charge updated.');
      } else {
        await api.post('/api/admin/revenue/pool-account/charges', payload);
        showToast('Charge recorded.');
      }
      cancelForm();
      setPage(1);
      fetchCharges();
    } catch (e2) {
      setFormError(e2?.response?.data?.error || 'Could not save this charge.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmClear() {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      await api.patch(`/api/admin/revenue/pool-account/charges/${clearTarget._id}/archive`);
      showToast('Charge cleared from this list.');
      setClearTarget(null);
      fetchCharges();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not clear this charge.');
    } finally {
      setClearBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Bank &amp; Tax Charges</h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Real money NCBA and KRA have deducted from PayChain's pooled account with no matching PayChain transfer behind it —
              Excise Duty (KRA's tax on bank transfer fees), SMS fees, and anything else spotted on NCBA Connect Plus or the account
              statement. An hourly sweep finds and records most of these automatically; add one by hand for anything it misses. These
              reduce PayChain's own unswept revenue — never merchant money.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => (showForm ? cancelForm() : setShowForm(true))}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
              {showForm ? 'Cancel' : 'Record Charge'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">Total Recorded</p>
            <p className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatKES(totalAmount)}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">Charges Recorded</p>
            <p className="text-2xl font-bold text-on-surface tabular-nums mt-1">{total.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5 flex flex-col gap-2">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">Not Yet Covered by Revenue</p>
            {deficitLoading ? (
              <p className="text-2xl font-bold text-on-surface-variant/30 tabular-nums mt-1">…</p>
            ) : (
              <p className={`text-2xl font-bold tabular-nums mt-1 ${deficit > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatKES(deficit)}</p>
            )}
            <p className="text-2xs text-on-surface-variant/50 -mt-1">
              How much of these charges PayChain's accrued fee revenue hasn't yet caught up to. Shown separately from Unswept
              Revenue on the Revenue page — never silently subtracted from it.
            </p>
            {canManage && deficit > 0 && !deficitLoading && (
              <button
                onClick={() => setShowWriteOff(true)}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-2xs font-bold uppercase tracking-widest hover:bg-amber-50 transition-colors w-fit"
              >
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                Write Off Deficit
              </button>
            )}
          </div>
        </div>

        {showForm && canManage && (
          <form onSubmit={submitCharge} className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            {editingId && <p className="basis-full text-2xs font-bold uppercase tracking-widest text-amber-700">Correcting this charge — unswept revenue updates on save.</p>}
            <div className="flex flex-col gap-1">
              <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Date charged</label>
              <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)}
                className="bg-surface-container border border-outline-variant/40 rounded-md px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Amount (KES)</label>
              <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" className="w-32 bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Description</label>
              <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Excise Duty, per NCBA Connect Plus" className="w-full bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Reference (optional)</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="NCBA ref" className="w-full bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-on-surface text-surface-container-lowest text-2xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? 'Saving…' : editingId ? 'Save Correction' : 'Record'}
            </button>
            {formError && <p className="text-2xs text-red-600 basis-full">{formError}</p>}
          </form>
        )}

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">No bank charges recorded yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th>Reference</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Source</Th>
                      {canManage && <Th className="text-right">Edit / Clear</Th>}
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {items.map((c) => (
                      <tr key={c._id}>
                        <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant whitespace-nowrap">{fmtDateTime(c.chargedAt)}</td>
                        <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface">{c.description}</td>
                        <td className="px-3 py-2.5 border-b border-outline-variant/5 font-mono text-2xs text-on-surface-variant">{c.reference || '—'}</td>
                        <td className="px-3 py-2.5 border-b border-outline-variant/5 text-right tabular-nums font-bold text-red-600">{formatKES(c.amount)}</td>
                        <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant">
                          {c.source === 'auto_detected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">
                              <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                              Auto-detected
                            </span>
                          ) : (c.recordedBy?.name || c.recordedBy?.email || 'Manual')}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-right whitespace-nowrap">
                            <button onClick={() => startEdit(c)} title="Correct this charge's amount, date, description, or reference" className="text-on-surface-variant/50 hover:text-on-surface transition-colors mr-2">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => setClearTarget(c)} title="Clear from this list — still counted against unswept revenue" className="text-on-surface-variant/50 hover:text-red-600 transition-colors">
                              <span className="material-symbols-outlined text-lg">clear</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
            </>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>
        )}

        {clearTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !clearBusy && setClearTarget(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-700">
                  <span className="material-symbols-outlined text-3xl">clear</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Clear this charge from the list?</h3>
                <p className="text-sm text-on-surface-variant mb-5">
                  "{clearTarget.description}" — {formatKES(clearTarget.amount)}. This only removes it from view; it still counts against PayChain's unswept revenue, same as before.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setClearTarget(null)} disabled={clearBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                  <button onClick={confirmClear} disabled={clearBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
                    {clearBusy ? 'Clearing…' : 'Confirm Clear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWriteOff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !writeOffBusy && setShowWriteOff(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-700">
                  <span className="material-symbols-outlined text-3xl">receipt_long</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Write off {formatKES(deficit)}?</h3>
                <p className="text-sm text-on-surface-variant mb-4">
                  These charges themselves stay recorded exactly as they are — this only stops that KES {deficit ? formatKES(deficit) : ''} from
                  dragging down PayChain's running Unswept Revenue figure going forward. It's a one-time accounting decision, not a
                  correction — audit-logged under your account.
                </p>
                <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Reason (optional)</label>
                <textarea
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  placeholder="e.g. Pre-tariff-fix Excise Duty shortfall, absorbed as a one-time cost."
                  rows={2}
                  className="w-full mt-1 mb-4 bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
                {writeOffError && <p className="text-2xs text-red-600 mb-3">{writeOffError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setShowWriteOff(false)} disabled={writeOffBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                  <button onClick={confirmWriteOff} disabled={writeOffBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
                    {writeOffBusy ? 'Writing off…' : 'Confirm Write Off'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BankCharges;
