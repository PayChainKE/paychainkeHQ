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

const seedRequests = [
  {
    id: 'car-1041',
    merchantName: 'Kijani Fresh Market Ltd',
    merchantEmail: 'finance@kijani.co.ke',
    paybillAccount: '542900',
    requestedAmount: 850000,
    approvedLimit: 1200000,
    tenorDays: 21,
    trustScore: 86,
    collections30d: 2860000,
    settlementRate: 98,
    purpose: 'Stock expansion before the weekend retail cycle',
    requestedAt: '2026-07-02T08:12:00.000Z',
    updatedAt: '2026-07-02T09:04:00.000Z',
    status: 'pending',
    priority: 'high',
    manager: 'A. Njoroge',
    notes: 'Healthy settlement pattern; requested for perishable inventory restock.',
  },
  {
    id: 'car-1042',
    merchantName: 'Mtaa Pharmacy Network',
    merchantEmail: 'ops@mtaapharma.co.ke',
    paybillAccount: '773110',
    requestedAmount: 420000,
    approvedLimit: 700000,
    tenorDays: 14,
    trustScore: 91,
    collections30d: 1684000,
    settlementRate: 99,
    purpose: 'Supplier prepayment for medical consumables',
    requestedAt: '2026-07-01T16:45:00.000Z',
    updatedAt: '2026-07-02T07:25:00.000Z',
    status: 'reviewing',
    priority: 'medium',
    manager: 'J. Mwangi',
    notes: 'Strong trust score and recurring collections across 3 locations.',
  },
  {
    id: 'car-1043',
    merchantName: 'Northstar Hardware',
    merchantEmail: 'accounts@northstarhardware.co.ke',
    paybillAccount: '610452',
    requestedAmount: 1350000,
    approvedLimit: 1400000,
    tenorDays: 30,
    trustScore: 78,
    collections30d: 4125000,
    settlementRate: 96,
    purpose: 'Import deposit for seasonal inventory',
    requestedAt: '2026-07-01T11:18:00.000Z',
    updatedAt: '2026-07-01T15:51:00.000Z',
    status: 'approved',
    priority: 'high',
    manager: 'K. Chebet',
    notes: 'Approved with standard fee after liquidity check passed.',
  },
  {
    id: 'car-1044',
    merchantName: 'Soko Digital Studio',
    merchantEmail: 'hello@sokodigital.co.ke',
    paybillAccount: '900118',
    requestedAmount: 260000,
    approvedLimit: 300000,
    tenorDays: 10,
    trustScore: 63,
    collections30d: 740000,
    settlementRate: 88,
    purpose: 'Cash buffer for campaign media spend',
    requestedAt: '2026-06-30T13:32:00.000Z',
    updatedAt: '2026-07-01T10:08:00.000Z',
    status: 'declined',
    priority: 'low',
    manager: 'M. Wanjiku',
    notes: 'Declined pending stronger repayment history and lower concentration risk.',
  },
];

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
  const [requests, setRequests] = useState(seedRequests);
  const [selectedId, setSelectedId] = useState(seedRequests[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('preview');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/cash-advance/requests');
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      if (data.length) {
        setRequests(data);
        setSource('live');
        setSelectedId(data[0]?._id || data[0]?.id || null);
        return;
      }
      setSource('preview');
      setError('No cash advance requests returned yet. Showing preview data.');
    } catch (err) {
      setSource('preview');
      setError(err?.response?.status === 404 ? 'Cash advance API is not connected yet. Showing preview data.' : 'Unable to load live requests right now. Showing preview data.');
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
    () => visibleRequests.find((request) => (request._id || request.id) === selectedId) || visibleRequests[0] || requests[0] || null,
    [visibleRequests, selectedId, requests]
  );

  const metrics = useMemo(() => {
    const base = requests.reduce((acc, request) => {
      const status = request.status || 'pending';
      acc.total += 1;
      acc.amount += Number(request.requestedAmount || 0);
      acc[status] = (acc[status] || 0) + 1;
      acc.trust += Number(request.trustScore || 0);
      acc.approved += status === 'approved' ? Number(request.requestedAmount || 0) : 0;
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

  const updateStatus = (nextStatus) => {
    const id = selectedRequest?._id || selectedRequest?.id;
    if (!id) return;
    setRequests((current) => current.map((request) => {
      const requestId = request._id || request.id;
      return requestId === id ? { ...request, status: nextStatus, updatedAt: new Date().toISOString() } : request;
    }));
  };

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <section className="relative overflow-hidden rounded-[28px] border border-outline-variant/30 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(7,47,41,0.92),rgba(3,105,82,0.78))] text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(94,254,179,0.2),transparent_26%)]" />
          <div className="relative p-6 md:p-8 lg:p-10">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
                  <span className="material-symbols-outlined text-[15px]">savings</span>
                  Credit operations
                </div>
                <h2 className="mt-4 text-[28px] md:text-[42px] font-black tracking-tighter leading-[0.95] font-headline">
                  Cash advance requests for merchant review
                </h2>
                <p className="mt-3 max-w-2xl text-[13px] md:text-[15px] text-white/72">
                  A focused queue for admin teams to inspect every merchant asking for cash advance, compare risk signals, and move requests from pending to approved in one place.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[430px]">
                <MiniMetric label="Requests" value={fmtNum(metrics.total)} icon="receipt_long" />
                <MiniMetric label="Pending" value={fmtNum(metrics.pending)} icon="schedule" />
                <MiniMetric label="Avg trust" value={`${metrics.avgTrust}%`} icon="verified" />
                <MiniMetric label="Approved" value={formatKES(metrics.approvedAmount)} icon="done_all" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total requested" value={formatKES(metrics.amount)} subtitle="Across the current queue" icon="account_balance_wallet" tone="emerald" />
          <StatCard label="Pending review" value={fmtNum(metrics.pending)} subtitle="Requires an admin decision" icon="pending_actions" tone="amber" />
          <StatCard label="Under review" value={fmtNum(metrics.reviewing)} subtitle="Currently assigned" icon="manage_search" tone="sky" />
          <StatCard label="Declined" value={fmtNum(metrics.declined)} subtitle="Risk or policy mismatch" icon="block" tone="rose" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[24px] border border-outline-variant/40 bg-surface-container-low shadow-[0_18px_45px_rgba(15,23,42,0.08)] overflow-hidden">
            <div className="border-b border-outline-variant/20 px-5 md:px-6 py-4 md:py-5 bg-white/60 backdrop-blur-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[18px] md:text-[20px] font-black tracking-tight text-on-surface">Request queue</h3>
                  <p className="text-[12px] text-on-surface-variant/60 mt-1">Review each merchant’s request, trust profile, and repayment outlook.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="inline-flex rounded-2xl border border-outline-variant/25 bg-surface-container-high p-1 shadow-sm">
                    {PRIMARY_ACTIONS.map((option) => (
                      <button
                        key={option.v}
                        onClick={() => setStatusFilter(option.v)}
                        className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.16em] transition-all ${statusFilter === option.v ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant/65 hover:text-on-surface'}`}
                      >
                        {option.l}
                      </button>
                    ))}
                  </div>
                  <label className="relative min-w-[240px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/45">search</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search merchant, paybill, purpose..."
                      className="w-full rounded-2xl border border-outline-variant/30 bg-white px-10 py-2.5 text-[13px] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/45 flex items-center justify-between">
              <span>{source === 'live' ? 'Live queue' : 'Preview queue'}</span>
              <span>{loading ? 'Syncing…' : `${visibleRequests.length} visible`}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-surface-container-high/60 text-[10px] uppercase tracking-[0.16em] text-on-surface-variant/50">
                  <tr>
                    <Th className="pl-6">Merchant</Th>
                    <Th>Requested</Th>
                    <Th>Trust</Th>
                    <Th>Tenor</Th>
                    <Th>Status</Th>
                    <Th className="pr-6 text-right">Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map((request) => {
                    const id = request._id || request.id;
                    const active = selectedRequest && id === (selectedRequest._id || selectedRequest.id);
                    const status = request.status || 'pending';
                    const meta = STATUS_META[status] || STATUS_META.pending;
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
                              <p className="font-bold text-[13px] text-on-surface tracking-tight">{request.merchantName}</p>
                              <p className="text-[11px] text-on-surface-variant/55">Paybill #{request.paybillAccount} · {request.merchantEmail}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <p className="font-black text-[13px] text-on-surface">{formatKES(request.requestedAmount)}</p>
                            <p className="text-[11px] text-on-surface-variant/55">Limit {formatKES(request.approvedLimit)}</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <p className="font-black text-[13px] text-on-surface">{request.trustScore}%</p>
                            <p className="text-[11px] text-on-surface-variant/55">{fmtNum(request.collections30d)} collected</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <p className="font-black text-[13px] text-on-surface">{request.tenorDays} days</p>
                            <p className="text-[11px] text-on-surface-variant/55">{request.settlementRate}% settlement</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${meta.tone}`}>
                              <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                              {meta.label}
                            </span>
                            <p className="mt-1 text-[11px] text-on-surface-variant/55 capitalize">{request.priority} priority</p>
                          </div>
                        </Td>
                        <Td className="pr-6 text-right">
                          <div className="py-4">
                            <p className="font-medium text-[12px] text-on-surface">{relativeTime(request.updatedAt)}</p>
                            <p className="text-[11px] text-on-surface-variant/55">{formatDateISO(request.requestedAt)}</p>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!visibleRequests.length && (
              <div className="px-6 py-16 text-center">
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant/25">search_off</span>
                <p className="mt-3 text-[14px] font-bold text-on-surface">No requests match this filter.</p>
                <p className="text-[12px] text-on-surface-variant/60 mt-1">Try clearing the search or switching the queue status.</p>
              </div>
            )}

            {error && (
              <div className="mx-5 md:mx-6 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                {error}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-outline-variant/40 bg-surface-container-low shadow-[0_18px_45px_rgba(15,23,42,0.08)] p-5 md:p-6">
              {selectedRequest ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedRequest.merchantName} size="lg" />
                      <div>
                        <p className="text-[18px] font-black text-on-surface tracking-tight">{selectedRequest.merchantName}</p>
                        <p className="text-[12px] text-on-surface-variant/60">{selectedRequest.merchantEmail}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_META[selectedRequest.status || 'pending'].tone}`}>
                      <span className="material-symbols-outlined text-[12px]">{STATUS_META[selectedRequest.status || 'pending'].icon}</span>
                      {STATUS_META[selectedRequest.status || 'pending'].label}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <DetailBox label="Requested" value={formatKES(selectedRequest.requestedAmount)} />
                    <DetailBox label="Tenor" value={`${selectedRequest.tenorDays} days`} />
                    <DetailBox label="Trust score" value={`${selectedRequest.trustScore}%`} />
                    <DetailBox label="Collections 30d" value={formatKES(selectedRequest.collections30d)} />
                  </div>

                  <div className="mt-5 rounded-2xl bg-surface-container-high/60 border border-outline-variant/20 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/45">Request purpose</p>
                    <p className="mt-2 text-[13px] text-on-surface leading-6">{selectedRequest.purpose}</p>
                  </div>

                  <div className="mt-4 space-y-3 text-[12px] text-on-surface-variant/70">
                    <Row label="Paybill" value={`#${selectedRequest.paybillAccount}`} />
                    <Row label="Assigned analyst" value={selectedRequest.manager} />
                    <Row label="Reviewed" value={formatDateISO(selectedRequest.updatedAt)} />
                    <Row label="Notes" value={selectedRequest.notes} />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ActionButton tone="emerald" icon="check_circle" label="Approve" onClick={() => updateStatus('approved')} />
                    <ActionButton tone="sky" icon="visibility" label="Review" onClick={() => updateStatus('reviewing')} />
                    <ActionButton tone="rose" icon="cancel" label="Decline" onClick={() => updateStatus('declined')} />
                  </div>
                </>
              ) : (
                <EmptyDetail />
              )}
            </div>

            <div className="rounded-[24px] border border-outline-variant/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,245,0.92))] shadow-[0_18px_45px_rgba(15,23,42,0.08)] p-5 md:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/45">Queue notes</p>
              <ul className="mt-4 space-y-3 text-[13px] text-on-surface-variant/75 leading-6">
                <li>Review requests against trust score, payment velocity, and recent collections.</li>
                <li>Use the detail drawer to move a merchant between pending, review, approved, or declined.</li>
                <li>Replace the preview endpoint with your live backend path when the credit workflow ships.</li>
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
      <div className="flex items-center gap-2 text-white/78 text-[10px] font-black uppercase tracking-[0.18em]">
        <span className="material-symbols-outlined text-[15px]">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-[18px] md:text-[21px] font-black tracking-tight">{value}</div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon, tone }) {
  const toneMap = {
    emerald: 'from-emerald-500/15 to-emerald-50',
    amber: 'from-amber-500/15 to-amber-50',
    sky: 'from-sky-500/15 to-sky-50',
    rose: 'from-rose-500/15 to-rose-50',
  };

  return (
    <div className={`rounded-[22px] border border-outline-variant/35 bg-gradient-to-br ${toneMap[tone] || toneMap.emerald} p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50">{label}</p>
          <p className="mt-2 text-[26px] md:text-[30px] font-black tracking-tighter text-on-surface">{value}</p>
          <p className="mt-1 text-[12px] text-on-surface-variant/60">{subtitle}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-on-surface shadow-sm">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 'md' }) {
  const initials = String(name || 'CA').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CA';
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-[15px]' : 'h-11 w-11 text-[12px]';
  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl ${sizeClass} bg-[linear-gradient(135deg,#0F766E,#14532D)] text-white font-black shadow-[0_12px_24px_rgba(15,118,110,0.24)]`}>
      {initials}
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/45">{label}</p>
      <p className="mt-1 text-[14px] font-black text-on-surface tracking-tight">{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/12 pb-2 last:border-b-0 last:pb-0">
      <span className="font-black uppercase tracking-[0.16em] text-[10px] text-on-surface-variant/45">{label}</span>
      <span className="text-right text-on-surface font-medium break-words">{value || '—'}</span>
    </div>
  );
}

function ActionButton({ tone, icon, label, onClick }) {
  const toneMap = {
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
    sky: 'bg-sky-600 text-white hover:bg-sky-700',
    rose: 'bg-rose-600 text-white hover:bg-rose-700',
  };

  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[12px] font-black uppercase tracking-[0.16em] transition-colors ${toneMap[tone] || toneMap.emerald}`}>
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  );
}

function EmptyDetail() {
  return (
    <div className="rounded-[22px] border border-dashed border-outline-variant/30 bg-surface-container-low/50 px-6 py-14 text-center">
      <span className="material-symbols-outlined text-[42px] text-on-surface-variant/20">savings</span>
      <p className="mt-3 text-[15px] font-black text-on-surface">Select a request</p>
      <p className="mt-1 text-[12px] text-on-surface-variant/60">Open any merchant request to inspect its risk profile and next action.</p>
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`px-3 py-3 text-left font-black ${className}`}>{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={`px-3 align-top ${className}`}>{children}</td>;
}