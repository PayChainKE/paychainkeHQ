import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { exportCSV } from '../utils/exportCSV';

export default function Newsletter() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/newsletter');
        if (!response.ok) throw new Error('Failed to fetch subscribers');
        const data = await response.json();
        setSubscribers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
          <div className="space-y-1">
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Newsletter Repository</h2>
            <p className="text-on-surface-variant/60 text-[13px] md:text-[14px] font-body">Managing your core audience and outreach communication stream.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => {
                const cleaned = subscribers.map(s => ({
                  'Email Address': s.email,
                  'Status': s.status || 'active',
                  'Date Subscribed': new Date(s.subscribedAt).toLocaleString()
                }));
                exportCSV('newsletter_subscribers.csv', cleaned);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-low transition-colors shadow-sm uppercase tracking-widest font-label"
            >
              <span className="material-symbols-outlined text-sm">file_download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
            <span className="text-[12px] font-medium text-on-surface-variant/60 font-body uppercase tracking-widest">Total Subscribers</span>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-semibold text-on-surface tracking-tighter">{subscribers.length}</span>
              <span className="text-[12px] font-bold text-secondary tracking-tight">Real-time</span>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-editorial overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[14px] text-on-surface-variant/60 font-medium">Synchronizing audience data...</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center text-error font-medium">{error}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Email Address</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Subscription Date</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 font-body">
                {subscribers.map((s) => (
                  <tr key={s._id} className="hover:bg-secondary-container/5 transition-colors cursor-default group">
                    <td className="px-6 py-4 font-bold text-[14px] text-on-surface tracking-tight">{s.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
                        s.status === 'active' ? 'bg-secondary-container/20 text-secondary' : 'bg-on-surface-variant/10 text-on-surface-variant'
                      }`}>
                        {s.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant/60">{new Date(s.subscribedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors opacity-0 group-hover:opacity-100 text-on-surface-variant/30">
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {subscribers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-on-surface-variant/40 font-medium">No subscribers found in the database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
