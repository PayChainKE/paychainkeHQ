import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// Standardized USDC display: 4 decimal places, comma-grouped. Industry
// convention for stablecoin balances on Stellar / Ethereum surfaces.
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
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1">On-Chain Audit</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline leading-tight">Wallet Audit</h2>
            <p className="text-[12px] md:text-[14px] text-on-surface-variant mt-1">
              Live cross-reference of merchant Stellar wallets against the Horizon API.
            </p>
          </div>
          <button onClick={fetchAudit} disabled={loading} className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 bg-primary/10 hover:bg-primary/15 text-primary text-[11px] font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-60">
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>

        {/* Summary Grid — 2x2 on mobile, 4-col on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-surface-container-lowest p-4 md:p-5 rounded-xl border border-outline-variant/20 shadow-sm">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Registered Users</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-on-surface tracking-tighter tabular-nums">{summary.totalMerchants}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-1">Across all merchants</p>
          </div>

          <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-4 md:p-5 rounded-xl border border-[#1E2532] shadow-sm">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-[#8B98A9] block mb-1">Fully Activated</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter tabular-nums">{summary.activeWallets}</span>
              <span className="text-[10px] font-bold text-[#35D07F] uppercase tracking-widest">Live</span>
            </div>
            <p className="text-[10px] text-[#8B98A9]/70 mt-1">On-chain & funded</p>
          </div>

          <div className="bg-surface-container-lowest p-4 md:p-5 rounded-xl border border-outline-variant/20 shadow-sm">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Pending</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-on-surface tracking-tighter tabular-nums">
                {(summary.inactiveWallets ?? 0) + (summary.noWallet ?? 0)}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-1">Awaiting activation</p>
          </div>

          <div className="bg-surface-container-lowest p-4 md:p-5 rounded-xl border border-outline-variant/20 shadow-sm">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">USDC Float</span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl md:text-3xl font-black text-on-surface tracking-tighter tabular-nums">{fmtUSDC(summary.totalUsdcFloat)}</span>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">USDC</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-1">Settled across wallets</p>
          </div>
        </div>

        {/* Data — desktop table + mobile cards */}
        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-700 text-sm">{error}</div>
        ) : (
          <>
            {/* Desktop / tablet */}
            <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Horizon cross-reference</p>
                <h3 className="text-base font-bold text-on-surface tracking-tight">Per-merchant wallet status</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left font-body">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <Th>Merchant</Th>
                      <Th>Public Key</Th>
                      <Th>Status</Th>
                      <Th className="text-right">XLM</Th>
                      <Th className="text-right">USDC</Th>
                      <Th className="text-center">Explorer</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="px-3 py-10 text-center text-on-surface-variant/40 text-sm">
                        <div className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span> Querying Horizon API…</div>
                      </td></tr>
                    ) : auditData.length === 0 ? (
                      <tr><td colSpan="6" className="px-3 py-10 text-center text-on-surface-variant/40 text-sm">No merchant wallets found.</td></tr>
                    ) : auditData.map((row, i) => <AuditRow key={i} row={row} />)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {loading ? (
                <div className="p-8 text-center text-on-surface-variant/40 text-sm">
                  <div className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span> Loading…</div>
                </div>
              ) : auditData.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant/40 text-sm">No merchant wallets found.</div>
              ) : auditData.map((row, i) => <AuditCard key={i} row={row} />)}
            </div>
          </>
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
    <tr className="hover:bg-surface-container-low/50 transition-colors group">
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className="text-[13px] font-bold text-on-surface tracking-tight">{row.name}</span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className="text-[11px] font-mono text-on-surface-variant/80 bg-surface-container px-2 py-1 rounded">
          {row.publicKey ? `${row.publicKey.slice(0, 6)}…${row.publicKey.slice(-4)}` : 'N/A'}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <StatusPill status={row.status} isActive={isActive} isPending={isPending} />
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right text-[12px] font-medium text-on-surface tabular-nums">
        {fmtXLM(row.xlmBalance)}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right text-[12px] font-bold text-on-surface tabular-nums">
        {fmtUSDC(row.usdcBalance)}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center">
        {hasWallet ? (
          <a
            href={`https://stellar.expert/explorer/testnet/account/${row.publicKey}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold text-secondary hover:text-emerald-700 hover:underline transition-all"
          >
            View ↗
          </a>
        ) : (
          <span className="text-[11px] text-on-surface-variant/30">—</span>
        )}
      </td>
    </tr>
  );
};

// ── Mobile card ──────────────────────────────────────────────────────
const AuditCard = ({ row }) => {
  const isActive = row.status === 'Active';
  const isPending = row.status === 'Inactive' || row.status === 'Unfunded';
  const hasWallet = !!row.publicKey;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-on-surface truncate">{row.name}</p>
          <p className="text-[10px] font-mono text-on-surface-variant/60 truncate">
            {row.publicKey ? `${row.publicKey.slice(0, 8)}…${row.publicKey.slice(-6)}` : 'No wallet'}
          </p>
        </div>
        <StatusPill status={row.status} isActive={isActive} isPending={isPending} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-surface-container-low rounded-lg px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">XLM</p>
          <p className="text-[12px] font-bold tabular-nums">{fmtXLM(row.xlmBalance)}</p>
        </div>
        <div className="bg-surface-container-low rounded-lg px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">USDC</p>
          <p className="text-[12px] font-bold tabular-nums">{fmtUSDC(row.usdcBalance)}</p>
        </div>
      </div>
      {hasWallet && (
        <a
          href={`https://stellar.expert/explorer/testnet/account/${row.publicKey}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-secondary hover:underline"
        >
          View on explorer
          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
        </a>
      )}
    </div>
  );
};

const StatusPill = ({ status, isActive, isPending }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
    isActive ? 'bg-[#D1FADF] text-[#039855]' :
    isPending ? 'bg-[#FEF0C7] text-[#DC6803]' :
    'bg-surface-container text-on-surface-variant'
  }`}>
    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#039855]"></div>}
    {isPending && <div className="w-1.5 h-1.5 rounded-full bg-[#DC6803]"></div>}
    {status}
  </span>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

export default WalletAudit;
