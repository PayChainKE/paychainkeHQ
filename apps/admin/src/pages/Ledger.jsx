import React from 'react';
import Layout from '../components/layout/Layout';

const Ledger = () => {
  const transactions = [
    { id: 'TX-9921', date: '2024-10-26 14:32', type: 'Merchant Payout', amount: 'KES 428,000.00', status: 'Approved', entity: 'Njoroge Stores' },
    { id: 'TX-9920', date: '2024-10-26 13:15', type: 'Card Transaction', amount: 'KES 12,450.00', status: 'Pending', entity: 'Mama Lydia Cafe' },
    { id: 'TX-9919', date: '2024-10-26 12:44', type: 'M-PESA Settlement', amount: 'KES 89,200.00', status: 'Approved', entity: 'Otieno Wholesale' },
    { id: 'TX-9918', date: '2024-10-26 10:20', type: 'Fee Collection', amount: 'KES 1,224.00', status: 'Success', entity: 'System' },
    { id: 'TX-9917', date: '2024-10-26 09:12', type: 'Merchant Payout', amount: 'KES 1,240,000.00', status: 'Flagged', entity: 'Bright Aqua Ltd' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div>
            <h2 className="text-[24px] md:text-[28px] font-semibold text-on-surface tracking-tight">Equatorial Ledger</h2>
            <p className="text-on-surface-variant/60 text-[13px] md:text-[14px] mt-1 font-body">Real-time authoritative record of all ecosystem transactions.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none bg-surface-container-lowest border border-outline-variant/30 text-on-surface px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:bg-surface-container-low font-label uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print
            </button>
            <button className="flex-1 sm:flex-none bg-primary text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:opacity-90 font-label uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px]">reconcile</span>
              Reconcile
            </button>
          </div>
        </div>

        {/* Ledger KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 font-body">
          {[
            { label: 'Today\'s Volume', val: 'KES 8.42M', trend: '+12.4%', up: true },
            { label: 'Settlement Ratio', val: '98.2%', trend: '+0.4%', up: true },
            { label: 'Total Fees', val: 'KES 214.5K', trend: '+8.1%', up: true },
            { label: 'Flagged Txns', val: '04', trend: '-2', up: false }
          ].map((kpi, i) => (
            <div key={i} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm transition-all hover:scale-[1.01]">
              <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-2 font-label">{kpi.label}</p>
              <div className="flex items-baseline gap-2 md:gap-3">
                <span className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">{kpi.val}</span>
                <span className={`text-[9px] md:text-[11px] font-bold px-2 py-0.5 rounded-lg ${kpi.up ? 'bg-secondary-container/20 text-secondary' : 'bg-error-container/20 text-error'}`}>
                  {kpi.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* High Density Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
          <div className="p-4 md:p-6 border-b border-outline-variant/10 bg-surface flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <h3 className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-on-surface font-label">Financial Audit Trail</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
                <input className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg text-xs md:w-64 font-body text-on-surface" placeholder="Search reference..." />
              </div>
              <button className="flex items-center justify-center gap-2 p-2 hover:bg-surface-container-low text-on-surface-variant/40 rounded-lg transition-colors border border-outline-variant/10 sm:border-none">
                <span className="material-symbols-outlined">filter_list</span>
                <span className="sm:hidden text-xs font-bold uppercase tracking-widest">Filter</span>
              </button>
            </div>
          </div>
          <table className="w-full text-left font-body">
            <thead>
              <tr className="bg-surface-container-low font-label">
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Ref ID</th>
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Entity</th>
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Txn Type</th>
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-outline-variant/5">
              {transactions.map((txn, i) => (
                <tr key={i} className="hover:bg-secondary-container/5 transition-colors group">
                  <td className="px-6 py-4 font-mono font-bold text-on-surface-variant/60">{txn.id}</td>
                  <td className="px-6 py-4 text-on-surface-variant/40">{txn.date}</td>
                  <td className="px-6 py-4 font-bold text-on-surface tracking-tight">{txn.entity}</td>
                  <td className="px-6 py-4 text-on-surface-variant/70">{txn.type}</td>
                  <td className="px-6 py-4 font-bold text-on-surface tracking-tight">{txn.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight uppercase border ${
                      txn.status === 'Approved' || txn.status === 'Success' ? 'bg-secondary-container/20 text-secondary border-secondary-container/50' :
                      txn.status === 'Flagged' ? 'bg-error-container/20 text-error border-error-container/50' :
                      'bg-surface-container text-on-surface-variant/60 border-outline-variant/30'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-on-surface-variant/20 hover:text-secondary transition-colors"><span className="material-symbols-outlined text-[20px]">open_in_new</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-surface flex justify-between items-center border-t border-outline-variant/10">
            <span className="text-[11px] font-bold text-on-surface-variant/30 uppercase tracking-widest font-label">Consolidated Ledger v2.4</span>
            <div className="flex gap-1">
              <button className="w-8 h-8 rounded-lg bg-primary text-white font-bold text-xs">1</button>
              <button className="w-8 h-8 rounded-lg bg-surface border border-outline-variant/30 text-on-surface-variant/60 font-bold text-xs hover:bg-surface-container-low transition-all">2</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Ledger;
