import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

// Pulls together what's already built separately (Platform Health's rail
// checks, the Approvals queue, Cash Advance and KYC backlogs) into one bell
// so an admin sees "N things need you" without remembering to check three
// different pages. Reuses /api/admin/ops-health as its only data source —
// that endpoint already computes exactly this; no separate aggregation to
// keep in sync.
const CHECK_META = {
  ncba: { label: 'NCBA unreachable', icon: 'account_balance' },
  stkStuck: { label: 'Stuck STK prompts', icon: 'point_of_sale' },
  stkFailureRate: { label: 'High STK failure rate', icon: 'percent' },
  webhookFailureRate: { label: 'High webhook failure rate', icon: 'webhook' },
  missedCollections: { label: 'Missed NCBA collections', icon: 'receipt_long' },
  stuckPayouts: { label: 'Stuck payouts', icon: 'sync_problem' },
};

const QUEUE_META = [
  { key: 'pendingApprovals', label: 'Pending approvals', icon: 'gpp_maybe', to: '/approvals' },
  { key: 'cashAdvancePending', label: 'Cash advance requests', icon: 'savings', to: '/cash-advance-requests' },
  { key: 'kycPending', label: 'KYC/KYB review', icon: 'verified_user', to: '/kyc-verification' },
];

const NotificationBell = () => {
  const [health, setHealth] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchHealth = useCallback(() => {
    api.get('/api/admin/ops-health').then((res) => setHealth(res.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => {
    const id = setInterval(fetchHealth, 30000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const issues = health ? Object.entries(health.checks || {}).filter(([, c]) => c.status !== 'ok') : [];
  const queues = health ? QUEUE_META.filter((q) => (health.queues?.[q.key] ?? 0) > 0) : [];
  const total = issues.length + queues.reduce((sum, q) => sum + health.queues[q.key], 0);

  const go = (to) => { setOpen(false); navigate(to); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-on-surface-variant hover:bg-surface-container-low active:bg-surface-container-high p-2 rounded-lg transition-colors"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="px-4 py-3 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white flex items-center justify-between">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-300">Notifications</p>
            <button onClick={() => go('/ops-health')} className="text-2xs text-emerald-100/70 hover:text-white font-semibold">Platform Health →</button>
          </div>

          {!health ? (
            <div className="p-6 text-center text-xs text-on-surface-variant/40">Loading…</div>
          ) : total === 0 ? (
            <div className="p-6 text-center">
              <span className="material-symbols-outlined text-2xl text-emerald-500 mb-1 block">check_circle</span>
              <p className="text-xs font-bold text-on-surface">All clear</p>
              <p className="text-2xs text-on-surface-variant/50 mt-0.5">No issues, nothing waiting on you.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {issues.length > 0 && (
                <div className="py-1">
                  <p className="px-4 pt-2 pb-1 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Needs attention</p>
                  {issues.map(([key, c]) => {
                    const meta = CHECK_META[key] || { label: key, icon: 'warning' };
                    return (
                      <button key={key} onClick={() => go('/ops-health')} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors">
                        <span className={`material-symbols-outlined text-lg ${c.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{meta.icon}</span>
                        <span className="text-xs font-semibold text-on-surface flex-1">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {queues.length > 0 && (
                <div className="py-1 border-t border-outline-variant/10">
                  <p className="px-4 pt-2 pb-1 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Waiting on you</p>
                  {queues.map((q) => (
                    <button key={q.key} onClick={() => go(q.to)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors">
                      <span className="material-symbols-outlined text-lg text-on-surface-variant/50">{q.icon}</span>
                      <span className="text-xs font-semibold text-on-surface flex-1">{q.label}</span>
                      <span className="text-xs font-bold text-on-surface tabular-nums">{health.queues[q.key]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
