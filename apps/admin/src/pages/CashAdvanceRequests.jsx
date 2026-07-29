import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { formatKES } from '../utils/formatCurrency';
import { formatDateISO } from '../utils/formatDate';

const STATUS_META = {
  pending: { label: 'Pending review', tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'schedule' },
  reviewing: { label: 'Under review', tone: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'visibility' },
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'verified' },
  declined: { label: 'Declined', tone: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' },
};

const PRIMARY_ACTIONS = [
  { v: 'all', l: 'All requests' },
  { v: 'pending', l: 'Pending' },
  { v: 'reviewing', l: 'Under review' },
  { v: 'approved', l: 'Approved' },
  { v: 'declined', l: 'Declined' },
];

// Underwriting risk bands derived from the merchant's Trust Score at the time
// they applied. Mirrors conventional micro-lending grade nomenclature (A–D)
// so the queue reads like a real credit console, not a raw percentage.
const RISK_BANDS = [
  { min: 85, grade: 'A', label: 'Prime', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', stroke: '#059669' },
  { min: 70, grade: 'B', label: 'Standard', tone: 'text-sky-700 bg-sky-50 border-sky-200', stroke: '#0284c7' },
  { min: 55, grade: 'C', label: 'Watch', tone: 'text-amber-700 bg-amber-50 border-amber-200', stroke: '#d97706' },
  { min: 0, grade: 'D', label: 'Elevated Risk', tone: 'text-rose-700 bg-rose-50 border-rose-200', stroke: '#e11d48' },
];

function riskGradeFor(trustScore) {
  const score = Number(trustScore) || 0;
  return RISK_BANDS.find((band) => score >= band.min) || RISK_BANDS[RISK_BANDS.length - 1];
}

const fmtNum = (value) => Number(value || 0).toLocaleString();

function relativeTime(iso) {
  if (!iso) return 'Just now';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CashAdvanceRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/cash-advance/requests');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRequests(data);
      setSelectedId((prev) => (prev && data.some((r) => r._id === prev) ? prev : data[0]?._id || null));
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load the underwriting queue right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const handleSync = () => fetchRequests();
    window.addEventListener('paychain:sync', handleSync);
    return () => window.removeEventListener('paychain:sync', handleSync);
  }, [fetchRequests]);

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((request) => {
      const status = request.status || 'pending';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (q) {
        const haystack = [
          request.merchantName,
          request.merchantEmail,
          request.paybillAccount,
          request.purpose,
          request.manager,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, statusFilter]);

  const selectedRequest = useMemo(
    () => visibleRequests.find((request) => request._id === selectedId) || visibleRequests[0] || null,
    [visibleRequests, selectedId]
  );

  const metrics = useMemo(() => {
    const base = requests.reduce((acc, request) => {
      const status = request.status || 'pending';
      acc.total += 1;
      acc.amount += Number(request.requestedAmount || 0);
      acc[status] = (acc[status] || 0) + 1;
      acc.trust += Number(request.trustScore || 0);
      acc.approved += status === 'approved' ? Number(request.approvedLimit || request.requestedAmount || 0) : 0;
      return acc;
    }, { total: 0, amount: 0, approved: 0, trust: 0, pending: 0, reviewing: 0, declined: 0 });

    return {
      total: base.total,
      amount: base.amount,
      approvedAmount: base.approved,
      pending: base.pending,
      reviewing: base.reviewing,
      declined: base.declined,
      avgTrust: base.total ? Math.round(base.trust / base.total) : 0,
    };
  }, [requests]);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null); // 'approved' | 'declined' | null
  const [decisionLimit, setDecisionLimit] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionError, setDecisionError] = useState('');

  useEffect(() => {
    setPendingDecision(null);
    setDecisionNotes('');
    setDecisionLimit('');
    setDecisionError('');
  }, [selectedId]);

  const applyDecision = async (id, payload) => {
    setUpdatingStatus(true);
    setDecisionError('');
    try {
      const res = await api.patch(`/api/admin/cash-advance/requests/${id}`, payload);
      const updated = res.data?.data;
      if (updated) {
        setRequests((current) => current.map((r) => (r._id === id ? updated : r)));
      }
      return true;
    } catch (err) {
      setDecisionError(err?.response?.data?.error || 'Failed to update this request.');
      return false;
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDecision = (status) => {
    setDecisionError('');
    setPendingDecision(status);
    setDecisionNotes(status === 'declined' ? (selectedRequest?.notes || '') : '');
    setDecisionLimit(status === 'approved' ? String(selectedRequest?.approvedLimit || selectedRequest?.requestedAmount || '') : '');
  };

  const cancelDecision = () => {
    setPendingDecision(null);
    setDecisionError('');
  };

  const confirmDecision = async () => {
    if (!selectedRequest?._id) return;
    const payload = { status: pendingDecision };

    if (pendingDecision === 'approved') {
      const limit = Number(decisionLimit);
      if (!Number.isFinite(limit) || limit < 0) {
        setDecisionError('Enter a valid credit limit amount.');
        return;
      }
      payload.approvedLimit = limit;
    }
    if (decisionNotes.trim()) payload.reviewNotes = decisionNotes.trim();

    const ok = await applyDecision(selectedRequest._id, payload);
    if (ok) setPendingDecision(null);
  };

  const markUnderReview = () => {
    if (selectedRequest?._id) applyDecision(selectedRequest._id, { status: 'reviewing' });
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <section className="relative overflow-hidden rounded-[28px] border border-outline-variant/30 bg-[linear-gradient(135deg,rgba(9,14,23,0.98),rgba(6,38,33,0.94),rgba(0,53,29,0.9))] text-white shadow-[0_24px_80px_rgba(6,15,12,0.32)]">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(134,248,201,0.16),transparent_28%)]" />
          <div className="relative p-6 md:p-8 lg:p-10">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-2xs font-bold uppercase tracking-[0.22em] text-white/85">
                  <span className="material-symbols-outlined text-sm">account_balance</span>
                  Loan Origination · Credit Operations
                </div>
                <h2 className="mt-4 text-3xl md:text-5xl font-black tracking-tighter leading-[0.95] font-headline">
                  Cash advance underwriting queue
                </h2>
                <p className="mt-3 max-w-2xl text-xs md:text-sm text-white/70">
                  Review each merchant's application, risk-grade it against Trust Score and settlement history, and issue a decision — approve with a credit limit, hold for review, or decline with a reason.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[430px]">
                <MiniMetric label="Applications" value={fmtNum(metrics.total)} icon="receipt_long" />
                <MiniMetric label="Pending" value={fmtNum(metrics.pending)} icon="schedule" />
                <MiniMetric label="Avg Trust Score" value={`${metrics.avgTrust}%`} icon="verified" />
                <MiniMetric label="Approved Exposure" value={formatKES(metrics.approvedAmount)} icon="done_all" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total requested" value={formatKES(metrics.amount)} subtitle="Across the current queue" icon="account_balance_wallet" tone="emerald" />
          <StatCard label="Pending decision" value={fmtNum(metrics.pending)} subtitle="Awaiting an underwriting call" icon="pending_actions" tone="amber" />
          <StatCard label="Under review" value={fmtNum(metrics.reviewing)} subtitle="Currently assigned to an analyst" icon="manage_search" tone="sky" />
          <StatCard label="Declined" value={fmtNum(metrics.declined)} subtitle="Risk or policy mismatch" icon="block" tone="rose" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[24px] border border-outline-variant/40 bg-surface-container-low shadow-editorial overflow-hidden">
            <div className="border-b border-outline-variant/20 px-5 md:px-6 py-4 md:py-5 bg-white/60 backdrop-blur-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg md:text-xl font-black tracking-tight text-on-surface">Application queue</h3>
                  <p className="text-xs text-on-surface-variant/60 mt-1">Sorted by most recent submission. Click a row to open the underwriting file.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="inline-flex rounded-2xl border border-outline-variant/25 bg-surface-container-high p-1 shadow-sm">
                    {PRIMARY_ACTIONS.map((option) => (
                      <button
                        key={option.v}
                        onClick={() => setStatusFilter(option.v)}
                        className={`px-3.5 py-2 rounded-xl text-2xs font-black uppercase tracking-[0.16em] transition-all ${statusFilter === option.v ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant/65 hover:text-on-surface'}`}
                      >
                        {option.l}
                      </button>
                    ))}
                  </div>
                  <label className="relative min-w-[240px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant/45">search</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search merchant, paybill, purpose..."
                      className="w-full rounded-2xl border border-outline-variant/30 bg-white px-10 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-3 text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/45 flex items-center justify-between">
              <span>Underwriting queue</span>
              <span>{loading ? 'Syncing…' : `${visibleRequests.length} visible`}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-surface-container-high/60 text-2xs uppercase tracking-[0.16em] text-on-surface-variant/50">
                  <tr>
                    <Th className="pl-6">Merchant</Th>
                    <Th>Requested</Th>
                    <Th>Risk grade</Th>
                    <Th>Tenor</Th>
                    <Th>Status</Th>
                    <Th className="pr-6 text-right">Submitted</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map((request) => {
                    const id = request._id;
                    const active = selectedRequest && id === selectedRequest._id;
                    const status = request.status || 'pending';
                    const meta = STATUS_META[status] || STATUS_META.pending;
                    const risk = riskGradeFor(request.trustScore);
                    return (
                      <tr
                        key={id}
                        onClick={() => setSelectedId(id)}
                        className={`cursor-pointer border-b border-outline-variant/10 transition-colors ${active ? 'bg-primary/5' : 'hover:bg-surface-container-high/55'}`}
                      >
                        <Td className="pl-6">
                          <div className="flex items-center gap-3 py-4">
                            <Avatar name={request.merchantName} />
                            <div>
                              <p className="font-bold text-xs text-on-surface tracking-tight">{request.merchantName}</p>
                              <p className="text-2xs text-on-surface-variant/55">{request.paybillAccount ? `Acc #${request.paybillAccount} · ` : ''}{request.merchantEmail}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <p className="font-black text-xs text-on-surface">{formatKES(request.requestedAmount)}</p>
                            <p className="text-2xs text-on-surface-variant/55">{request.approvedLimit ? `Limit ${formatKES(request.approvedLimit)}` : 'No limit set'}</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-black uppercase tracking-wide ${risk.tone}`}>
                              {risk.grade} · {risk.label}
                            </span>
                            <p className="mt-1 text-2xs text-on-surface-variant/55">{request.trustScore}% trust score</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <p className="font-black text-xs text-on-surface">{request.tenorDays} days</p>
                            <p className="text-2xs text-on-surface-variant/55">{request.settlementRate}% settlement</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-black uppercase tracking-[0.16em] ${meta.tone}`}>
                              <span className="material-symbols-outlined text-xs">{meta.icon}</span>
                              {meta.label}
                            </span>
                          </div>
                        </Td>
                        <Td className="pr-6 text-right">
                          <div className="py-4">
                            <p className="font-medium text-xs text-on-surface">{relativeTime(request.updatedAt)}</p>
                            <p className="text-2xs text-on-surface-variant/55">{formatDateISO(request.requestedAt)}</p>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && !visibleRequests.length && !error && (
              <div className="px-6 py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/25">{requests.length ? 'search_off' : 'inbox'}</span>
                <p className="mt-3 text-sm font-bold text-on-surface">{requests.length ? 'No requests match this filter.' : 'No cash advance applications yet.'}</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">{requests.length ? 'Try clearing the search or switching the queue status.' : 'Applications will appear here as merchants apply from their dashboard.'}</p>
              </div>
            )}

            {error && (
              <div className="mx-5 md:mx-6 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-3">
                <span>{error}</span>
                <button onClick={fetchRequests} className="shrink-0 text-2xs font-black uppercase tracking-widest text-rose-700 hover:text-rose-900">Retry</button>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-outline-variant/40 bg-surface-container-low shadow-editorial p-5 md:p-6">
              {selectedRequest ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedRequest.merchantName} size="lg" />
                      <div>
                        <p className="text-lg font-black text-on-surface tracking-tight">{selectedRequest.merchantName}</p>
                        <p className="text-xs text-on-surface-variant/60">{selectedRequest.merchantEmail}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-black uppercase tracking-[0.16em] ${STATUS_META[selectedRequest.status || 'pending'].tone}`}>
                      <span className="material-symbols-outlined text-xs">{STATUS_META[selectedRequest.status || 'pending'].icon}</span>
                      {STATUS_META[selectedRequest.status || 'pending'].label}
                    </span>
                  </div>

                  {/* Credit assessment: Trust Score gauge + risk grade */}
                  <div className="mt-5 flex items-center gap-4 rounded-2xl border border-outline-variant/20 bg-white p-4">
                    <TrustGauge score={selectedRequest.trustScore} />
                    <div className="flex-1 min-w-0">
                      <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45 mb-1.5">Credit Assessment</p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-black uppercase tracking-wide ${riskGradeFor(selectedRequest.trustScore).tone}`}>
                        Grade {riskGradeFor(selectedRequest.trustScore).grade} · {riskGradeFor(selectedRequest.trustScore).label}
                      </span>
                      <p className="mt-2 text-2xs text-on-surface-variant/60 leading-relaxed">
                        {selectedRequest.settlementRate}% settlement rate on {fmtNum(selectedRequest.collections30d)} KES collected in the last 30 days.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <DetailBox label="Requested" value={formatKES(selectedRequest.requestedAmount)} />
                    <DetailBox label="Tenor" value={`${selectedRequest.tenorDays} days`} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/20 p-4">
                    <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45">Stated purpose</p>
                    <p className="mt-2 text-xs text-on-surface leading-6">{selectedRequest.purpose}</p>
                  </div>

                  {/* Applicant / business profile captured on the application */}
                  {(selectedRequest.monthlyRevenueEstimate || selectedRequest.yearsInOperation || selectedRequest.businessAddress || selectedRequest.contactPhone) && (
                    <div className="mt-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/20 p-4">
                      <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45 mb-3">Applicant Profile</p>
                      {(selectedRequest.monthlyRevenueEstimate || selectedRequest.yearsInOperation) && (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <DetailBox label="Monthly revenue" value={selectedRequest.monthlyRevenueEstimate ? formatKES(selectedRequest.monthlyRevenueEstimate) : '—'} />
                          <DetailBox label="Years operating" value={selectedRequest.yearsInOperation ?? '—'} />
                        </div>
                      )}
                      <div className="space-y-2.5 text-xs text-on-surface-variant/70">
                        <Row label="Business address" value={selectedRequest.businessAddress} />
                        <Row label="Contact phone" value={selectedRequest.contactPhone} />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-2.5 text-xs text-on-surface-variant/70">
                    <Row label="Account No." value={selectedRequest.paybillAccount ? `#${selectedRequest.paybillAccount}` : '—'} />
                    <Row label="Assigned analyst" value={selectedRequest.manager} />
                    <Row label="Last decision" value={formatDateISO(selectedRequest.updatedAt)} />
                    <Row label="Admin notes" value={selectedRequest.notes} />
                  </div>

                  {pendingDecision ? (
                    <div className="mt-5 rounded-2xl border border-outline-variant/30 bg-white p-4 space-y-3">
                      <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/50">
                        {pendingDecision === 'approved' ? 'Approval details' : 'Decline reason'}
                      </p>
                      {pendingDecision === 'approved' && (
                        <div>
                          <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/45">Approved credit limit (KES)</label>
                          <input
                            type="number"
                            min="0"
                            value={decisionLimit}
                            onChange={(e) => setDecisionLimit(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary/50"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/45">
                          {pendingDecision === 'approved' ? 'Underwriting notes (optional)' : 'Reason for the merchant'}
                        </label>
                        <textarea
                          rows={3}
                          value={decisionNotes}
                          onChange={(e) => setDecisionNotes(e.target.value)}
                          placeholder={pendingDecision === 'approved' ? 'Any conditions or notes for the file…' : 'Explain why this application was declined…'}
                          className="mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-xs text-on-surface outline-none focus:border-primary/50 resize-none"
                        />
                      </div>
                      {decisionError && <p className="text-2xs font-bold text-rose-600">{decisionError}</p>}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={cancelDecision}
                          disabled={updatingStatus}
                          className="flex-1 py-2.5 rounded-xl text-2xs font-black uppercase tracking-widest text-on-surface-variant/60 bg-surface-container-low hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmDecision}
                          disabled={updatingStatus}
                          className={`flex-1 py-2.5 rounded-xl text-2xs font-black uppercase tracking-widest text-white transition-colors disabled:opacity-50 ${pendingDecision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                        >
                          {updatingStatus ? 'Saving…' : pendingDecision === 'approved' ? 'Confirm Approval' : 'Confirm Decline'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <ActionButton tone="emerald" icon="check_circle" label="Approve" onClick={() => openDecision('approved')} disabled={updatingStatus} />
                      <ActionButton tone="sky" icon="visibility" label="Review" onClick={markUnderReview} disabled={updatingStatus} />
                      <ActionButton tone="rose" icon="cancel" label="Decline" onClick={() => openDecision('declined')} disabled={updatingStatus} />
                    </div>
                  )}
                </>
              ) : (
                <EmptyDetail />
              )}
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,245,0.92))] shadow-editorial p-5 md:p-6">
              <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45">Underwriting guidelines</p>
              <ul className="mt-4 space-y-3 text-xs text-on-surface-variant/75 leading-6">
                <li><span className="font-black text-emerald-700">Grade A/B</span> — Trust Score 70+. Fast-track approval; set a limit at or above the requested amount when collections support it.</li>
                <li><span className="font-black text-amber-700">Grade C</span> — Trust Score 55–69. Approve at a reduced limit or hold for review pending stronger settlement history.</li>
                <li><span className="font-black text-rose-700">Grade D</span> — Trust Score below 55. Decline with a clear reason so the merchant knows what to improve.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </Layout>
  );
}

function MiniMetric({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/14 bg-white/10 px-3 py-3 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="flex items-center gap-2 text-white/78 text-2xs font-black uppercase tracking-[0.18em]">
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-lg md:text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon, tone }) {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45">{label}</p>
          <p className="mt-2 text-2xl md:text-3xl font-black tracking-tighter text-on-surface">{value}</p>
          <p className="mt-1 text-xs text-on-surface-variant/60">{subtitle}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${toneMap[tone] || toneMap.emerald}`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

// Trust Score gauge — same stroke-dasharray donut recipe used elsewhere in the
// admin app (Overview/Analytics/Ledger "type mix" charts): viewBox 0 0 36 36,
// radius 15.5, rotated -90deg so the arc starts at 12 o'clock.
function TrustGauge({ score }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const stroke = riskGradeFor(value).stroke;

  return (
    <div className="relative w-[72px] h-[72px] shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={radius} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-on-surface tracking-tight leading-none">{value}</span>
        <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/45 mt-0.5">Score</span>
      </div>
    </div>
  );
}

function Avatar({ name, size = 'md' }) {
  const initials = String(name || 'CA').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CA';
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-11 w-11 text-xs';
  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl ${sizeClass} bg-[linear-gradient(135deg,#0F766E,#14532D)] text-white font-black shadow-[0_12px_24px_rgba(15,118,110,0.24)]`}>
      {initials}
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-white px-4 py-3">
      <p className="text-2xs font-black uppercase tracking-[0.18em] text-on-surface-variant/45">{label}</p>
      <p className="mt-1 text-sm font-black text-on-surface tracking-tight">{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/12 pb-2 last:border-b-0 last:pb-0">
      <span className="font-black uppercase tracking-[0.16em] text-2xs text-on-surface-variant/45">{label}</span>
      <span className="text-right text-on-surface font-medium break-words">{value || '—'}</span>
    </div>
  );
}

function ActionButton({ tone, icon, label, onClick, disabled }) {
  const toneMap = {
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
    sky: 'bg-sky-600 text-white hover:bg-sky-700',
    rose: 'bg-rose-600 text-white hover:bg-rose-700',
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${toneMap[tone] || toneMap.emerald}`}>
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  );
}

function EmptyDetail() {
  return (
    <div className="rounded-[22px] border border-dashed border-outline-variant/30 bg-surface-container-low/50 px-6 py-14 text-center">
      <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">savings</span>
      <p className="mt-3 text-sm font-black text-on-surface">Select a request</p>
      <p className="mt-1 text-xs text-on-surface-variant/60">Open any merchant request to inspect its risk profile and issue a decision.</p>
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`px-3 py-3 text-left font-black ${className}`}>{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={`px-3 align-top ${className}`}>{children}</td>;
}
