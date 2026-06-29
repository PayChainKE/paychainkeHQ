import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

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

const fmtKES = (n) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const WalletAudit = () => {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState([]);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    totalMerchants: 0,
    activeWallets: 0,
    inactiveWallets: 0,
    noWallet: 0,
    totalUsdcFloat: '0.0000',
    totalKesVolume: 0,
    totalUsdcVolume: 0,
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
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-400">Ledger Cross-Reference</p>
              </div>
              <h2 className="text-[32px] md:text-[48px] font-bold text-white tracking-tighter font-headline leading-tight">
                Live On-Chain Audit
              </h2>
              <p className="text-[13px] md:text-[15px] text-blue-100/60 mt-2 max-w-2xl font-body">
                Cryptographically verifiable record of PayChain master and merchant accounts. Synchronized in real-time with the Stellar Network and M-Pesa.
              </p>
            </div>
            <button 
              onClick={fetchAudit} 
              disabled={loading} 
              className="group self-start md:self-auto flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white text-[12px] font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`}>sync</span>
              Synchronize Ledger
            </button>
          </div>
        </div>

        {/* Global Network Volume Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1512] to-[#06201B] p-6 md:p-8 rounded-3xl border border-emerald-900/40 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-4">
                <span className="material-symbols-outlined text-[14px]">account_balance</span>
                PayChain Master Paybill
              </span>
              <p className="text-[12px] uppercase tracking-widest text-emerald-100/50 font-bold mb-1">Total KES Network Volume</p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums">
                KES <span className="text-emerald-400">{fmtKES(summary.totalKesVolume)}</span>
              </h3>
            </div>
          </div>
          
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0A101D] to-[#0A1630] p-6 md:p-8 rounded-3xl border border-blue-900/40 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-4">
                <span className="material-symbols-outlined text-[14px]">public</span>
                PayChain Stellar Network
              </span>
              <p className="text-[12px] uppercase tracking-widest text-blue-100/50 font-bold mb-1">Total Stablecoin Volume</p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums">
                USDC <span className="text-blue-400">{fmtUSDC(summary.totalUsdcVolume)}</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Merchant Wallet Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm transition-transform hover:-translate-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 block mb-2">Registered Merchants</span>
            <span className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter tabular-nums">{summary.totalMerchants}</span>
          </div>

          <div className="bg-gradient-to-br from-[#0A101D] to-[#0F172A] p-5 rounded-2xl border border-[#1E293B] shadow-lg transition-transform hover:-translate-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 block mb-2">Fully Activated</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl md:text-4xl font-black text-white tracking-tighter tabular-nums">{summary.activeWallets}</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-widest">Live On-Chain</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm transition-transform hover:-translate-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/50 block mb-2">Pending Activation</span>
            <span className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter tabular-nums">
              {(summary.inactiveWallets ?? 0) + (summary.noWallet ?? 0)}
            </span>
          </div>

          <div className="bg-gradient-to-br from-[#061121] to-[#0B1A35] p-5 rounded-2xl border border-[#1A2639] shadow-lg transition-transform hover:-translate-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300/60 block mb-2">Network USDC Float</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black text-white tracking-tighter tabular-nums">{fmtUSDC(summary.totalUsdcFloat)}</span>
              <span className="text-[12px] font-bold text-blue-400">USDC</span>
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
                <p className="text-[12px] text-on-surface-variant/60 font-medium">Real-time balances from the Stellar Horizon API</p>
              </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-body min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container-low/30 border-b border-outline-variant/10">
                    <Th className="pl-6">Merchant Identity</Th>
                    <Th>Stellar Public Key</Th>
                    <Th>Network Status</Th>
                    <Th className="text-right">Native XLM</Th>
                    <Th className="text-right">USDC Reserve</Th>
                    <Th className="text-right">Lifetime KES</Th>
                    <Th className="text-right">Lifetime USDC</Th>
                    <Th className="text-center pr-6">Explorer</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {loading ? (
                    <tr><td colSpan="8" className="px-6 py-16 text-center">
                      <div className="inline-flex flex-col items-center gap-4">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                        </div>
                        <span className="text-[13px] font-bold text-on-surface-variant uppercase tracking-widest">Syncing with Horizon Network...</span>
                      </div>
                    </td></tr>
                  ) : auditData.length === 0 ? (
                    <tr><td colSpan="8" className="px-6 py-12 text-center text-on-surface-variant/40 text-sm font-medium">No merchant wallets provisioned yet.</td></tr>
                  ) : auditData.map((row, i) => <AuditRow key={i} row={row} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

// ── Table row ────────────────────────────────────────────────────────
const AuditRow = ({ row }) => {
  const isActive = row.status === 'Active';
  const isPending = row.status === 'Inactive' || row.status === 'Unfunded';
  const hasWallet = !!row.publicKey;
  return (
    <tr className="hover:bg-surface-container-lowest transition-colors group bg-white">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] uppercase text-white shadow-sm ${isActive ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-slate-300 to-slate-500'}`}>
            {(row.name || 'M').substring(0, 2)}
          </div>
          <span className="text-[14px] font-bold text-on-surface tracking-tight">{row.name}</span>
        </div>
      </td>
      <td className="px-3 py-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
          <span className="material-symbols-outlined text-[14px] text-slate-400">key</span>
          {row.publicKey ? `${row.publicKey.slice(0, 8)}…${row.publicKey.slice(-6)}` : 'Not Provisioned'}
        </span>
      </td>
      <td className="px-3 py-4">
        <StatusPill status={row.status} isActive={isActive} isPending={isPending} />
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-[13px] font-medium text-slate-500 tabular-nums">
          {fmtXLM(row.xlmBalance)}
        </span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-[14px] font-bold text-on-surface tabular-nums">
          {fmtUSDC(row.usdcBalance)}
        </span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-[13px] font-bold text-emerald-600 tabular-nums">
          {fmtKES(row.lifetimeKesVolume || 0)}
        </span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="text-[13px] font-bold text-blue-600 tabular-nums">
          {fmtUSDC(row.lifetimeUsdcVolume || 0)}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {hasWallet ? (
          <a
            href={`https://stellar.expert/explorer/testnet/account/${row.publicKey}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="View on Stellar Expert"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
};

const StatusPill = ({ status, isActive, isPending }) => {
  let styles = "bg-slate-100 text-slate-500 border-slate-200";
  let dot = "bg-slate-400";
  
  if (isActive) {
    styles = "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm";
    dot = "bg-emerald-500 animate-pulse";
  } else if (isPending) {
    styles = "bg-amber-50 text-amber-700 border-amber-200";
    dot = "bg-amber-500";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles}`}>
      {isActive && <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>}
      {isPending && <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>}
      {status}
    </span>
  );
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ${className}`}>{children}</th>
);

export default WalletAudit;
