import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// One "is everything working right now" view — rail reachability, STK/webhook
// failure rates, and stuck-payment backlogs — so an admin doesn't have to
// separately check StkMonitor, Pool Reconciliation and Developers to notice
// something's actually broken vs. just quiet. Every number here is a plain
// read; nothing on this page can change platform state.
const STATUS_META = {
  ok:       { label: 'OK',       icon: 'check_circle', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warn:     { label: 'Watch',    icon: 'warning',       tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { label: 'Attention', icon: 'error',        tone: 'bg-red-50 text-red-700 border-red-200' },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.warn;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${meta.tone}`}>
      <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
};

const Tile = ({ title, status, headline, detail, icon }) => {
  const meta = STATUS_META[status] || STATUS_META.warn;
  return (
    <div className={`rounded-xl border p-4 ${status === 'ok' ? 'border-outline-variant/30 bg-surface-container-lowest' : meta.tone.split(' ').filter((c) => c.startsWith('border')).join(' ') + ' bg-surface-container-lowest'}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="material-symbols-outlined text-xl text-on-surface-variant/50">{icon}</span>
        <StatusBadge status={status} />
      </div>
      <p className="text-2xl font-bold text-on-surface tracking-tight">{headline}</p>
      <p className="text-xs font-bold text-on-surface-variant/70 mt-0.5">{title}</p>
      {detail && <p className="text-2xs text-on-surface-variant/50 mt-1">{detail}</p>}
    </div>
  );
};

const QueueCard = ({ label, count, to, icon }) => (
  <Link to={to} className="flex items-center justify-between px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
    <span className="flex items-center gap-2 text-xs font-bold text-on-surface">
      <span className="material-symbols-outlined text-lg text-on-surface-variant/50">{icon}</span>
      {label}
    </span>
    <span className="text-lg font-bold text-on-surface tabular-nums">{count}</span>
  </Link>
);

const pct = (r) => `${Math.round(r * 100)}%`;

const OpsHealth = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/ops-health');
      setData(res.data);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load platform health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => {
    const id = setInterval(fetchHealth, 30000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const c = data?.checks;
  const overallMeta = STATUS_META[data?.overall] || STATUS_META.ok;

  return (
    <Layout>
      <div className="space-y-6 pb-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Platform Health</h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Real-time reachability and failure rates across NCBA, STK/M-Pesa and developer webhooks, plus the backlogs waiting on an admin. Refreshes every 30 seconds.
            </p>
          </div>
          {data && (
            <div className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border ${overallMeta.tone}`}>
              <span className="material-symbols-outlined text-2xl">{overallMeta.icon}</span>
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest">{data.overall === 'ok' ? 'All systems normal' : data.overall === 'warn' ? 'Needs a look' : 'Needs attention'}</p>
                <p className="text-2xs opacity-70">as of {new Date(data.checkedAt).toLocaleTimeString()}</p>
              </div>
            </div>
          )}
        </div>

        {loading && <div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading…</div>}
        {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{error}</div>}

        {c && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Tile
                title="NCBA Open Banking"
                icon="account_balance"
                status={c.ncba.status}
                headline={c.ncba.reachable ? `${c.ncba.latencyMs}ms` : 'Unreachable'}
                detail={c.ncba.reachable ? 'Live balance pull succeeded' : (c.ncba.error || 'Could not reach NCBA')}
              />
              <Tile
                title="Stuck STK prompts"
                icon="point_of_sale"
                status={c.stkStuck.status}
                headline={c.stkStuck.count}
                detail={`Pending longer than ${c.stkStuck.thresholdMinutes} minutes`}
              />
              <Tile
                title="STK failure rate (24h)"
                icon="percent"
                status={c.stkFailureRate.status}
                headline={pct(c.stkFailureRate.rate)}
                detail={`${c.stkFailureRate.failed} failed / ${c.stkFailureRate.success} succeeded`}
              />
              <Tile
                title="Webhook failure rate (24h)"
                icon="webhook"
                status={c.webhookFailureRate.status}
                headline={c.webhookFailureRate.total ? pct(c.webhookFailureRate.rate) : '—'}
                detail={c.webhookFailureRate.total ? `${c.webhookFailureRate.failed} of ${c.webhookFailureRate.total} deliveries` : 'No deliveries in window'}
              />
              <Tile
                title="Missed NCBA collections"
                icon="receipt_long"
                status={c.missedCollections.status}
                headline={c.missedCollections.count}
                detail="Confirmed on NCBA's statement, not yet credited"
              />
              <Tile
                title="Stuck payouts"
                icon="sync_problem"
                status={c.stuckPayouts.status}
                headline={c.stuckPayouts.count}
                detail="Needs manual review in NCBA Payouts"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold text-on-surface mb-3">Waiting on an admin</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <QueueCard label="Pending approvals" count={data.queues.pendingApprovals} to="/approvals" icon="gpp_maybe" />
                <QueueCard label="Cash advance requests" count={data.queues.cashAdvancePending} to="/cash-advance-requests" icon="savings" />
                <QueueCard label="KYC/KYB review" count={data.queues.kycPending} to="/kyc-verification" icon="verified_user" />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default OpsHealth;
