import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const WalletAudit = () => {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState([]);
  const [summary, setSummary] = useState({
    totalMerchants: 0,
    activeWallets: 0,
    inactiveWallets: 0,
    noWallet: 0,
    totalUsdcFloat: "0.0000000"
  });

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await api.get('/api/admin/wallet-audit');
        if (res.data.success) {
          setAuditData(res.data.data);
          setSummary(res.data.summary);
        }
      } catch (err) {
        console.error('Failed to fetch wallet audit:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Wallet Audit</h2>
          <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1">
            Real-time on-chain verification of merchant Stellar wallets.
          </p>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant/60">Total Registered Users</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tighter">{summary.totalMerchants}</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-6 rounded-xl border border-[#1E2532] shadow-sm flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-widest text-[#8B98A9]">Fully Activated On-Chain</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white tracking-tighter">{summary.activeWallets}</span>
              <span className="text-[12px] font-bold text-[#35D07F]">Live</span>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant/60">Total Platform USDC Float</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tighter">{summary.totalUsdcFloat}</span>
              <span className="text-[12px] font-bold text-secondary">USDC</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body">
              <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest border-b border-outline-variant/20">
                <tr>
                  <th className="px-6 py-4">Merchant Name</th>
                  <th className="px-6 py-4">Public Key (Testnet)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">XLM Balance</th>
                  <th className="px-6 py-4 text-right">USDC Balance</th>
                  <th className="px-6 py-4 text-center">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-on-surface-variant/40 text-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                        Querying Horizon API...
                      </div>
                    </td>
                  </tr>
                ) : auditData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-on-surface-variant/40 text-sm">
                      No merchant wallets found.
                    </td>
                  </tr>
                ) : (
                  auditData.map((row, idx) => {
                    const isActive = row.status === 'Active';
                    const isPending = row.status === 'Inactive' || row.status === 'Unfunded';
                    const hasWallet = !!row.publicKey;

                    return (
                      <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="text-[13px] font-bold text-on-surface">{row.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[12px] font-mono text-on-surface-variant/80 bg-surface-container px-2 py-1 rounded">
                            {row.publicKey ? `${row.publicKey.slice(0, 6)}...${row.publicKey.slice(-4)}` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest ${
                            isActive ? 'bg-[#D1FADF] text-[#039855]' : 
                            isPending ? 'bg-[#FEF0C7] text-[#DC6803]' : 
                            'bg-surface-container text-on-surface-variant'
                          }`}>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#039855]"></div>}
                            {isPending && <div className="w-1.5 h-1.5 rounded-full bg-[#DC6803]"></div>}
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[13px] font-medium text-on-surface">{row.xlmBalance}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[13px] font-medium text-on-surface">{row.usdcBalance}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasWallet ? (
                            <a 
                              href={`https://stellar.expert/explorer/testnet/account/${row.publicKey}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[12px] font-bold text-secondary hover:text-emerald-700 hover:underline transition-all"
                            >
                              View Log ↗
                            </a>
                          ) : (
                            <span className="text-[12px] text-on-surface-variant/30">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WalletAudit;
