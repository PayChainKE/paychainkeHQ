import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'pending_review', label: 'Needs review' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'frozen', label: 'Frozen' },
];

const TIER = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
};

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' }) : '—');

export default function FieldApprovals() {
  const { admin } = useAuth();
  const canAct = admin?.role === 'owner' || admin?.role === 'admin';
  const [tab, setTab] = useState('pending_review');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending_review: 0, confirmed: 0, frozen: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [freeze, setFreeze] = useState(null); // { item, reason, busy }
  const [toast, setToast] = useState('');
  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/officer/field-approvals', { params: { status: tab } });
      setItems(res.data?.data || []);
      setCounts(res.data?.counts || {});
      setError('');
    } catch (e) { setError(e?.response?.data?.error || 'Could not load on-site approvals.'); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  async function confirm(item) {
    try { await api.post(`/api/officer/field-approvals/${item._id}/confirm`); showToast('Marked as reviewed.'); load(); }
    catch (e) { showToast(e?.response?.data?.error || 'Could not confirm.'); }
  }

  async function doFreeze() {
    setFreeze((f) => ({ ...f, busy: true }));
    try {
      await api.post(`/api/officer/field-approvals/${freeze.item._id}/freeze`, { reason: freeze.reason });
      setFreeze(null); showToast('Account frozen and signed out everywhere.'); load();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not freeze.');
      setFreeze((f) => ({ ...f, busy: false }));
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12 max-w-5xl">
        <div className="rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 p-5 md:p-8">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-2">KYC</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">On-site approvals</h1>
          <p className="text-sm text-emerald-100/70 mt-2 max-w-2xl">
            Merchants an officer approved at a visit are already active. Review each one here — confirm it, or freeze the account if something is wrong.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-full border text-2xs font-bold uppercase tracking-widest ${tab === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary'}`}>
              {t.label} <span className="opacity-70">({counts[t.id] ?? 0})</span>
            </button>
          ))}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}
        {loading && <div className="h-32 bg-surface-container animate-pulse rounded-2xl" />}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-16 text-sm text-on-surface-variant/50">{tab === 'pending_review' ? 'Nothing waiting for review.' : 'Nothing here.'}</div>
        )}

        <div className="space-y-3">
          {items.map((m) => (
            <div key={m._id} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-editorial">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold tracking-tight text-on-surface">{m.businessName}</h3>
                    {m.riskTier && <span className={`px-2 py-0.5 rounded-full border text-2xs font-black uppercase tracking-widest ${TIER[m.riskTier]}`}>{m.riskTier} risk</span>}
                    {m.accountStatus === 'locked' && <span className="px-2 py-0.5 rounded-full border text-2xs font-black uppercase tracking-widest bg-red-50 text-red-700 border-red-200">Locked</span>}
                  </div>
                  <p className="text-xs text-on-surface-variant/60 mt-1">{m.ownerName} · {m.phone} · {m.businessType || 'type not set'}{m.county ? ` · ${m.county}` : ''}</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">
                    Approved by <strong className="text-on-surface">{m.officer?.name || m.officer?.email || 'an officer'}</strong> on {when(m.approvedAt)} EAT · {m.documents} document{m.documents === 1 ? '' : 's'} · {m.photos} site photo{m.photos === 1 ? '' : 's'}
                  </p>
                  {m.reviewNote && <p className="text-xs text-on-surface-variant/60 mt-1 italic">Note: {m.reviewNote}</p>}
                  {m.flags?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {m.flags.map((f) => (
                        <li key={f.code} className={`text-xs flex items-start gap-1.5 ${f.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                          <span className="material-symbols-outlined text-sm">{f.severity === 'critical' ? 'error' : 'warning'}</span>{f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  <Link to={`/kyc-verification/${m._id}`} className="px-4 py-2 rounded-lg border border-outline-variant/40 text-2xs font-bold uppercase tracking-widest text-center hover:bg-surface-container-low">Open application</Link>
                  {canAct && tab === 'pending_review' && (
                    <>
                      <button onClick={() => confirm(m)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-2xs font-bold uppercase tracking-widest">Confirm</button>
                      <button onClick={() => setFreeze({ item: m, reason: '', busy: false })} className="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-2xs font-bold uppercase tracking-widest hover:bg-red-100">Freeze</button>
                    </>
                  )}
                  {canAct && tab === 'confirmed' && (
                    <button onClick={() => setFreeze({ item: m, reason: '', busy: false })} className="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-2xs font-bold uppercase tracking-widest hover:bg-red-100">Freeze</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {freeze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !freeze.busy && setFreeze(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold tracking-tight text-on-surface mb-1">Freeze {freeze.item.businessName}?</h3>
            <p className="text-xs text-on-surface-variant/60 mb-4">The account is locked and signed out on every device immediately. Payments to their Paybill are not affected. You can unlock it later from the Merchants page.</p>
            <textarea value={freeze.reason} onChange={(e) => setFreeze((f) => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Reason (kept on the audit log)" className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setFreeze(null)} disabled={freeze.busy} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low">Cancel</button>
              <button onClick={doFreeze} disabled={freeze.busy || freeze.reason.trim().length < 5} className="px-5 py-2 rounded-lg bg-red-600 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40">{freeze.busy ? 'Freezing…' : 'Freeze account'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>}
    </Layout>
  );
}
