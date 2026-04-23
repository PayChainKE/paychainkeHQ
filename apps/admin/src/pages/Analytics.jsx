import React from 'react';
import Layout from '../components/layout/Layout';
// Using hardcoded values for charts based on stitch design
// In a real app we'd use analyticsData

const Analytics = () => {
  return (
    <Layout>
      <div className="space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">System Analytics</h2>
            <p className="text-on-surface-variant/60 text-[13px] md:text-[14px] mt-1 font-body">Deep insights into ecosystem growth and merchant health.</p>
          </div>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg shadow-sm hover:bg-surface-container-low transition-all uppercase tracking-widest font-label">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            Filter Range
          </button>
        </div>

        {/* Growth Metrics Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface-variant/40 font-label">GROWTH METRICS</span>
          <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="flex gap-2 mb-6">
            <button className="px-3 py-1.5 text-xs font-bold bg-primary-container text-white rounded-lg tracking-tight font-label">Last 30 Days</button>
            <button className="px-3 py-1.5 text-xs font-bold text-on-surface-variant/60 hover:bg-surface-container-low rounded-lg tracking-tight font-label">Last 12 Months</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-4 md:p-6 border border-outline-variant/20 shadow-editorial overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest font-label">Signups Over Time</h4>
                  <p className="text-[11px] text-on-surface-variant/40 font-body">Daily registration volume across all regions</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                    <span className="text-[11px] text-on-surface-variant/60 font-medium">Merchant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/60"></span>
                    <span className="text-[11px] text-on-surface-variant/60 font-medium">Waitlist</span>
                  </div>
                </div>
              </div>
              <div className="h-[200px] md:h-[240px] w-full chart-grid relative flex items-end justify-between gap-1 md:gap-2">
                {[30, 45, 40, 65, 55, 80, 70, 90, 85, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-secondary/80 rounded-t-sm transition-all hover:bg-secondary" style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[9px] font-bold text-on-surface-variant/30 px-2 uppercase tracking-widest font-label overflow-hidden">
                <span>01 Nov</span>
                <span className="hidden sm:inline">08 Nov</span>
                <span>15 Nov</span>
                <span className="hidden sm:inline">22 Nov</span>
                <span>29 Nov</span>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {[
                { label: 'New Signups', value: '1,248', change: '12.4%', up: true },
                { label: 'New Merchants', value: '342', change: '8.2%', up: true },
                { label: 'Approvals', value: '291', change: '15.1%', up: true },
                { label: 'Conversions', value: '24.5%', change: '2.1%', up: false }
              ].map((stat, i) => (
                <div key={i} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-sm transition-all hover:scale-[1.02]">
                  <div>
                    <span className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1 block font-label">{stat.label}</span>
                    <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">{stat.value}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tracking-tight ${stat.up ? 'bg-secondary-container/20 text-secondary' : 'bg-error-container/20 text-error'}`}>
                    <span className="material-symbols-outlined text-[14px]">{stat.up ? 'trending_up' : 'trending_down'}</span>
                    <span>{stat.change}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* intelligence section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="sm:col-span-2 lg:col-span-3 mb-2">
            <h3 className="text-xl font-semibold text-on-surface">Merchant Intelligence</h3>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm">
            <h4 className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-6 font-label">Type Distribution</h4>
            <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-surface-container" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray="75, 100" strokeLinecap="round" strokeWidth="4"></circle>
                <circle className="stroke-secondary" cx="18" cy="18" fill="none" r="16" strokeDasharray="25, 100" strokeDashoffset="-75" strokeLinecap="round" strokeWidth="4"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center font-body">
                <span className="text-lg md:text-xl font-bold text-on-surface tracking-tighter">1.8k</span>
                <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Total</span>
              </div>
            </div>
            <div className="space-y-4 font-body">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span><span className="text-on-surface-variant/70">Enterprise</span></div>
                <span className="font-bold text-on-surface">75%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span><span className="text-on-surface-variant/70">SMBs</span></div>
                <span className="font-bold text-on-surface">25%</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm">
            <h4 className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-6 font-label">Trust Score Spread</h4>
            <div className="h-32 md:h-40 flex items-end justify-between gap-1.5 md:gap-2 px-2">
              {[10, 25, 45, 85, 60].map((h, i) => (
                <div key={i} className={`w-full rounded-t-sm transition-all ${i === 3 ? 'bg-secondary' : i === 4 ? 'bg-primary' : 'bg-surface-container-high hover:bg-secondary-container/40'}`} style={{ height: `${h}%` }}></div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-1 font-label">
              <span>Poor</span><span>Fair</span><span>Good</span><span>High</span><span>Elite</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm sm:col-span-2 lg:col-span-1">
            <h4 className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-6 font-label">Monthly Velocity</h4>
            <div className="space-y-4 font-body">
              {[
                { label: '0 - 50k', val: 12, color: 'bg-primary/40' },
                { label: '50k - 200k', val: 34, color: 'bg-secondary-container' },
                { label: '200k - 1M', val: 42, color: 'bg-secondary' },
                { label: '1M+', val: 12, color: 'bg-primary' }
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[11px] font-bold mb-1.5 uppercase tracking-wide">
                    <span className="text-on-surface-variant/60">{item.label}</span>
                    <span className="text-on-surface">{item.val}%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Monthly Summary Table */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
          <div className="p-6 flex items-center justify-between border-b border-outline-variant/10">
            <h3 className="text-lg font-semibold text-on-surface tracking-tight">Monthly Performance Summary</h3>
            <button className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low font-label">
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Month</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Signups</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Cumulative</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Collected</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Est. Revenue</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Conv Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {[
                  { month: 'November 2023', signups: '1,248', cum: '14,203', total: 'KES 12.4M', rev: 'KES 310k', rate: '24.5%' },
                  { month: 'October 2023', signups: '1,102', cum: '12,955', total: 'KES 11.2M', rev: 'KES 280k', rate: '23.8%' },
                  { month: 'September 2023', signups: '985', cum: '11,853', total: 'KES 10.1M', rev: 'KES 252k', rate: '22.1%' },
                  { month: 'August 2023', signups: '890', cum: '10,868', total: 'KES 9.4M', rev: 'KES 235k', rate: '21.5%' },
                  { month: 'July 2023', signups: '1,340', cum: '9,978', total: 'KES 13.1M', rev: 'KES 327k', rate: '26.2%' }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-secondary-container/5 transition-all">
                    <td className="px-6 py-4 text-[13px] font-bold text-on-surface tracking-tight">{row.month}</td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant">{row.signups}</td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant">{row.cum}</td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant font-bold">{row.total}</td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant font-bold">{row.rev}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-secondary-container/20 text-secondary rounded-lg text-[11px] font-bold tracking-tight">{row.rate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Analytics;
