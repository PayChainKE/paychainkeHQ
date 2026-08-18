import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';
import { formatKES } from '../utils/formatCurrency';

const fmtUSDC = (n) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '0.0000';
  return v.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

const fmtXLM = (n) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '0.0000';
  return v.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

function relTime(iso) {
  if (!iso) return null;
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  if (days < 30)   return `${days}d ago`;
  if (days < 365)  return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmtSince(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const PAGE_SIZE = 25;

const WalletAudit = () => {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedKey, setCopiedKey] = useState('');
  const [summary, setSummary] = useState({
    totalMerchants: 0,
    activeWallets: 0,
    inactiveWallets: 0,
    noWallet: 0,
    errorCount: 0,
    discrepancyCount: 0,
    totalUsdcFloat: '0.0000',
    totalKesVolume: 0,
    totalUsdcVolume: 0,
    network: 'testnet',
  });

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/wallet-audit');
      if (res.data?.success) {
        setAuditData(res.data.data || []);
        setSummary(res.data.summary || summary);
      } else {
        setError(res.data?.error || 'Could not load wallet audit.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load wallet audit.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAudit(); }, [fetchAudit]);
  useEffect(() => {
    const h = () => fetchAudit();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchAudit]);

  useEffect(() => { setPage(1); }, [search]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return auditData;
    return auditData.filter((row) =>
      [row.name, row.email, row.publicKey].filter(Boolean).some((f) => f.toLowerCase().includes(q))
    );
  }, [auditData, search]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, page]);

  async function copyKey(key) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 1500);
    } catch { /* noop */ }
  }

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-[#061121] border border-[#1A2639] shadow-[0_30px_80px_-20px_rgba(6,17,33,0.8)] p-6 md:p-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[80px]"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-blue-400">Ledger Cross-Reference</p>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-tight">
                Live On-Chain Audit
              </h2>
              <p className="text-xs md:text-sm text-blue-100/60 mt-2 max-w-2xl font-body">
                Cryptographically verifiable record of PayChain master and merchant accounts. Synchronized in real-time with the Stellar Network and M-Pesa.
              </p>
            </div>
            <button 
              onClick={fetchAudit} 
              disabled={loading} 
              className="group self-start md:self-auto flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-lg group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`}>sync</span>
              Synchronize Ledger
            </button>
          </div>
        </div>

        {/* Global Network Volume Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1512] to-[#06201B] p-6 md:p-8 rounded-3xl border border-emerald-900/40 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-2xs font-bold uppercase tracking-[0.2em] rounded-full mb-4">
                <span className="material-symbols-outlined text-sm">account_balance</span>
                PayChain Master Paybill
              </span>
              <p className="text-xs uppercase tracking-widest text-emerald-100/50 font-bold mb-1">Total KES Network Volume</p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums">
                <span className="text-emerald-400">{formatKES(summary.totalKesVolume)}</span>
              </h3>
            </div>
          </div>
          
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0A101D] to-[#0A1630] p-6 md:p-8 rounded-3xl border border-blue-900/40 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 text-2xs font-bold uppercase tracking-[0.2em] rounded-full mb-4">
                <span className="material-symbols-outlined text-sm">public</span>
                PayChain Stellar Network
              </span>
              <p className="text-xs uppercase tracking-widest text-blue-100/50 font-bold mb-1">Total Stablecoin Volume</p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums">
                USDC <span className="text-blue-400">{fmtUSDC(summary.totalUsdcVolume)}</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Merchant Wallet Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm transition-transform hover:-translate-y-1">
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 block mb-2">Registered Merchants</span>
            <span className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter tabular-nums">{summary.totalMerchants}</span>
          </div>

          <div className="bg-gradient-to-br from-[#0A101D] to-[#0F172A] p-5 rounded-2xl border border-[#1E293B] shadow-lg transition-transform hover:-translate-y-1">
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-slate-400 block mb-2">Fully Activated</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl md:text-4xl font-black text-white tracking-tighter tabular-nums">{summary.activeWallets}</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-2xs font-bold rounded uppercase tracking-widest">Live On-Chain</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm transition-transform hover:-translate-y-1">
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 block mb-2">Pending Activation</span>
            <span className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter tabular-nums">
              {(summary.inactiveWallets ?? 0) + (summary.noWallet ?? 0)}
            </span>
          </div>

          <div className={`p-5 rounded-2xl border shadow-sm transition-transform hover:-translate-y-1 ${(summary.discrepancyCount || 0) > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-surface-container-lowest border-outline-variant/20'}`}>
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 block mb-2">Discrepancies</span>
            <div className="flex items-center gap-2">
              <span className={`text-3xl md:text-4xl font-black tracking-tighter tabular-nums ${(summary.discrepancyCount || 0) > 0 ? 'text-rose-600' : 'text-on-surface'}`}>{summary.discrepancyCount || 0}</span>
              {(summary.errorCount || 0) > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-2xs font-bold rounded uppercase tracking-widest">{summary.errorCount} unchecked</span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#061121] to-[#0B1A35] p-5 rounded-2xl border border-[#1A2639] shadow-lg transition-transform hover:-translate-y-1">
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-blue-300/60 block mb-2">Network USDC Float</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black text-white tracking-tighter tabular-nums">{fmtUSDC(summary.totalUsdcFloat)}</span>
              <span className="text-xs font-bold text-blue-400">USDC</span>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-500 text-sm font-bold backdrop-blur-sm">
            {error}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-editorial overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 bg-white/50 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-on-surface tracking-tight">Merchant Treasury Audit</h3>
                <p className="text-xs text-on-surface-variant/60 font-medium">Live Stellar Horizon balances, reconciled against PayChain's recorded balances</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant/40">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, email, public key…"
                  className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-0"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-body min-w-[960px]">
                <thead>
                  <tr className="bg-surface-container-low/30 border-b border-outline-variant/10">
                    <Th className="pl-6">Merchant Identity</Th>
                    <Th>Stellar Public Key</Th>
                    <Th>Network Status</Th>
                    <Th className="text-right">Native XLM</Th>
                    <Th className="text-right">USDC Reserve</Th>
                    <Th>Last Active</Th>
                    <Th className="text-right">Lifetime KES</Th>
                    <Th className="text-right">Lifetime USDC</Th>
                    <Th className="text-center pr-6">Explorer</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {loading ? (
                    <tr><td colSpan="9" className="px-6 py-16 text-center">
                      <div className="inline-flex flex-col items-center gap-4">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Syncing with Horizon Network...</span>
                      </div>
                    </td></tr>
                  ) : filteredData.length === 0 ? (
                    <tr><td colSpan="9" className="px-6 py-12 text-center text-on-surface-variant/40 text-sm font-medium">
                      {auditData.length === 0 ? 'No merchant wallets provisioned yet.' : 'No wallets match this search.'}
                    </td></tr>
                  ) : pagedData.map((row) => (
                    <AuditRow key={row.merchantId || row.publicKey || row.email} row={row} network={summary.network} copiedKey={copiedKey} onCopy={copyKey} />
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredData.length > 0 && (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={filteredData.length} onPage={setPage} />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

// ── Table row ────────────────────────────────────────────────────────
const AuditRow = ({ row, network, copiedKey, onCopy }) => {
  const isActive = row.status === 'Active';
  const hasWallet = !!row.publicKey;
  const since = fmtSince(row.registeredAt);
  const lastActive = relTime(row.lastActiveTime);
  return (
    <tr className="hover:bg-surface-container-lowest transition-colors group bg-white">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-2xs uppercase text-white shadow-sm ${isActive ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-slate-300 to-slate-500'}`}>
            {(row.name || 'M').substring(0, 2)}
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface tracking-tight">{row.name}</p>
            {since && <p className="text-2xs text-on-surface-variant/50">Since {since}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        {row.publicKey ? (
          <button
            onClick={() => onCopy(row.publicKey)}
            title="Copy full public key"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-slate-400">key</span>
            {`${row.publicKey.slice(0, 8)}…${row.publicKey.slice(-6)}`}
            <span className="material-symbols-outlined text-sm">{copiedKey === row.publicKey ? 'check' : 'content_copy'}</span>
          </button>
        ) : (
          <span className="text-xs font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">Not Provisioned</span>
        )}
      </td>
      <td className="px-3 py-4">
        <StatusPill status={row.status} />
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {fmtXLM(row.xlmBalance)}
        </span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-sm font-bold text-on-surface tabular-nums">
          {fmtUSDC(row.usdcBalance)}
        </span>
        {row.hasDiscrepancy && (
          <div className="flex items-center justify-end gap-1 mt-0.5" title={`PayChain records ${fmtUSDC(row.dbUsdcBalance)} USDC — off by ${fmtUSDC(Math.abs(row.usdcDiscrepancy))}`}>
            <span className="material-symbols-outlined text-rose-500 text-xs">warning</span>
            <span className="text-2xs font-bold text-rose-600">Mismatch vs DB ({fmtUSDC(row.dbUsdcBalance)})</span>
          </div>
        )}
      </td>
      <td className="px-3 py-4">
        <span className="text-xs font-medium text-slate-500">{lastActive || '—'}</span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-xs font-bold text-emerald-600 tabular-nums">
          {formatKES(row.lifetimeKesVolume || 0)}
        </span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-xs font-bold text-blue-600 tabular-nums">
          {fmtUSDC(row.lifetimeUsdcVolume || 0)}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {hasWallet ? (
          <a
            href={`https://stellar.expert/explorer/${network || 'testnet'}/account/${row.publicKey}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="View on Stellar Expert"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </a>
        ) : (
          <span className="text-2xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
};

// Every possible backend status gets its own distinct tone — critically,
// "Error" (we failed to check) and "No Wallet" (merchant never set one up)
// must not look the same: one is a data-quality warning, the other is normal.
const STATUS_STYLES = {
  Active:     { styles: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm', dot: 'bg-emerald-500 animate-pulse' },
  Inactive:   { styles: 'bg-amber-50 text-amber-700 border-amber-200',                  dot: 'bg-amber-500' },
  Unfunded:   { styles: 'bg-amber-50 text-amber-700 border-amber-200',                  dot: 'bg-amber-500' },
  'No Wallet':{ styles: 'bg-slate-100 text-slate-500 border-slate-200',                 dot: 'bg-slate-400' },
  Error:      { styles: 'bg-rose-50 text-rose-700 border-rose-200',                     dot: 'bg-rose-500' },
};

const StatusPill = ({ status }) => {
  const { styles, dot } = STATUS_STYLES[status] || STATUS_STYLES['No Wallet'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${styles}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>
      {status === 'Error' && <span className="material-symbols-outlined text-xs">warning</span>}
      {status}
    </span>
  );
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-4 text-2xs font-black uppercase tracking-[0.15em] text-slate-400 ${className}`}>{children}</th>
);

export default WalletAudit;
