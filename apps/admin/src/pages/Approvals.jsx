import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const STATUS_META = {
  pending:  { label: 'Pending',  tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  executed: { label: 'Executed', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', tone: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:   { label: 'Failed',   tone: 'bg-red-50 text-red-700 border-red-200' },
};

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, tone: 'bg-gray-50 text-gray-600 border-gray-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${meta.tone}`}>{meta.label}</span>;
};

const Approvals = () => {
  const { admin } = useAuth();
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveBusy, setApproveBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3600); }, []);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/approvals');
      setPending(res.data?.pending || []);
      setRecent(res.data?.recent || []);
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not load approvals.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);
  // Someone else may act on a request while this admin has the page open —
  // poll gently rather than requiring a manual refresh.
  useEffect(() => {
    const id = setInterval(fetchApprovals, 20000);
    return () => clearInterval(id);
  }, [fetchApprovals]);

  async function confirmApprove() {
    if (!approveTarget) return;
    setApproveBusy(true);
    try {
      await api.post(`/api/admin/approvals/${approveTarget.id}/approve`);
      showToast(`Approved — "${approveTarget.summary}" has been carried out.`);
      setApproveTarget(null);
      fetchApprovals();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not approve this request.');
    } finally {
      setApproveBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejectBusy(true);
    try {
      await api.post(`/api/admin/approvals/${rejectTarget.id}/reject`, { reason: rejectReason.trim() || undefined });
      showToast(`Rejected — "${rejectTarget.summary}" will not run.`);
      setRejectTarget(null);
      setRejectReason('');
      fetchApprovals();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not reject this request.');
    } finally {
      setRejectBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Approvals</h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Money-moving admin actions (manual collection credits, revenue write-offs) are queued here instead of running immediately.
            A different owner/admin from whoever requested it must approve before anything actually moves — no single admin can carry these out alone.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface">Pending ({pending.length})</h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">Nothing waiting on approval.</div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {pending.map((a) => {
                const isOwnRequest = String(a.requestedBy?.id) === String(admin?._id);
                return (
                  <div key={a.id} className="px-4 py-3.5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusPill status={a.status} />
                        {a.isExpired && <span className="text-2xs font-bold uppercase tracking-widest text-red-600">Expired</span>}
                        <span className="text-2xs text-on-surface-variant/50">{a.actionLabel}</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface">{a.summary}</p>
                      <p className="text-2xs text-on-surface-variant/60 mt-1">
                        Requested by {a.requestedBy?.name || a.requestedBy?.email || 'an admin'} · {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isOwnRequest ? (
                        <span className="text-2xs text-on-surface-variant/50 italic max-w-[160px] text-right">You requested this — another admin must approve it.</span>
                      ) : (
                        <>
                          <button
                            onClick={() => setRejectTarget(a)}
                            className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant/70 hover:bg-surface-container-low text-2xs font-bold uppercase tracking-widest"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setApproveTarget(a)}
                            disabled={a.isExpired}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-40 text-2xs font-bold uppercase tracking-widest"
                          >
                            Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/20">
            <h2 className="text-sm font-bold text-on-surface">Recent decisions</h2>
          </div>
          {recent.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant/40 text-sm">Nothing decided yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {recent.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusPill status={a.status} />
                      <span className="text-2xs text-on-surface-variant/50">{a.actionLabel}</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface">{a.summary}</p>
                    <p className="text-2xs text-on-surface-variant/60 mt-1">
                      Requested by {a.requestedBy?.name || a.requestedBy?.email || 'an admin'}
                      {a.decidedBy && <> · {a.status === 'rejected' ? 'rejected' : 'approved'} by {a.decidedBy.name || a.decidedBy.email} · {new Date(a.decidedAt).toLocaleString()}</>}
                    </p>
                    {a.rejectionReason && <p className="text-2xs text-on-surface-variant/70 mt-0.5 italic">"{a.rejectionReason}"</p>}
                    {a.executionError && <p className="text-2xs text-red-600 mt-0.5">{a.executionError}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>
        )}

        {approveTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !approveBusy && setApproveTarget(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-700">
                  <span className="material-symbols-outlined text-3xl">gpp_good</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Approve this action?</h3>
                <p className="text-sm text-on-surface-variant mb-5">
                  "{approveTarget.summary}" will run immediately once you approve — requested by {approveTarget.requestedBy?.name || approveTarget.requestedBy?.email || 'an admin'}. This cannot be undone from here.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setApproveTarget(null)} disabled={approveBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                  <button onClick={confirmApprove} disabled={approveBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                    {approveBusy ? 'Approving…' : 'Approve & Run'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !rejectBusy && setRejectTarget(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-7">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-red-100 text-red-700">
                  <span className="material-symbols-outlined text-3xl">block</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Reject this action?</h3>
                <p className="text-sm text-on-surface-variant mb-3">"{rejectTarget.summary}" will not run. Optionally tell the requester why.</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface mb-5"
                />
                <div className="flex gap-3">
                  <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} disabled={rejectBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                  <button onClick={confirmReject} disabled={rejectBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                    {rejectBusy ? 'Rejecting…' : 'Reject'}
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

export default Approvals;
