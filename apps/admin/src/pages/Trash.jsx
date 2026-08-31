import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

// Snapshots of the handful of significant, admin-initiated deletions
// (Merchant, Transaction/stuck-payout, Admin/officer-or-team, Expense) —
// see backend/models/DeletedRecord.js and utils/trash.js for exactly which
// delete actions get captured and why the list stays deliberately short.
// Restoring re-inserts the original document with its original _id; it
// does not undo any side effects that deletion had elsewhere (e.g. a
// merchant delete cascades removing their saved payees/payment links,
// which restore does not bring back).
const COLLECTION_META = {
  Merchant:    { label: 'Merchant',    icon: 'storefront',   tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  Transaction: { label: 'Transaction', icon: 'receipt_long',  tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  Admin:       { label: 'Team/Officer', icon: 'badge',         tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  Expense:     { label: 'Expense',     icon: 'calculate',      tone: 'bg-red-50 text-red-700 border-red-200' },
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2.5 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const Trash = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3200); }, []);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/trash', { params: { page, limit: PAGE_SIZE } });
      setItems(res.data?.data || []);
      setTotal(res.data?.total ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoreBusy(true);
    try {
      await api.post(`/api/admin/trash/${restoreTarget._id}/restore`);
      showToast(`Restored "${restoreTarget.label}".`);
      setRestoreTarget(null);
      fetchTrash();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not restore this item.');
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Trash</h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Everything a significant admin action has deleted — merchant accounts, team/officer removals, expenses, and manually-deleted stuck payouts. Restorable for 90 days.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">Nothing in the trash.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <Th>Type</Th>
                      <Th>What</Th>
                      <Th>Deleted By</Th>
                      <Th>Deleted</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {items.map((item) => {
                      const meta = COLLECTION_META[item.collectionName] || { label: item.collectionName, icon: 'delete', tone: 'bg-gray-50 text-gray-600 border-gray-200' };
                      return (
                        <tr key={item._id}>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${meta.tone}`}>
                              <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 font-bold text-on-surface">{item.label}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70">{item.deletedBy?.name || item.deletedBy?.email || '—'}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/60 whitespace-nowrap">{new Date(item.deletedAt).toLocaleString()}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-right">
                            <button
                              onClick={() => setRestoreTarget(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:opacity-90 text-2xs font-bold uppercase tracking-widest transition-all"
                            >
                              <span className="material-symbols-outlined text-[14px]">restore</span>
                              Restore
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

        {restoreTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !restoreBusy && setRestoreTarget(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-700">
                  <span className="material-symbols-outlined text-3xl">restore</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Restore "{restoreTarget.label}"?</h3>
                <p className="text-sm text-on-surface-variant mb-5">
                  Brings this {COLLECTION_META[restoreTarget.collectionName]?.label.toLowerCase() || restoreTarget.collectionName} back exactly as it was right before deletion.
                  {restoreTarget.collectionName === 'Merchant' && ' Their saved payees and payment links from before the deletion are not restored, only the account itself.'}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setRestoreTarget(null)} disabled={restoreBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                  <button onClick={confirmRestore} disabled={restoreBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                    {restoreBusy ? 'Restoring…' : 'Confirm Restore'}
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

export default Trash;
