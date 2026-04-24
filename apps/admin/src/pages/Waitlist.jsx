import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/config';

const Waitlist = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/api/waitlist');
        const json = response.data;
        // Map backend fields to frontend expected fields if necessary
        const mapped = json.map(item => ({
          id: item._id,
          name: item.fullName,
          businessName: item.businessName,
          phone: item.phone,
          businessType: item.businessType,
          revenueRange: item.challenge || 'N/A', // Using challenge as revenueRange placeholder if not present
          status: item.status || 'Pending',
          priority: item.priority || false,
          createdAt: item.createdAt
        }));
        setData(mapped);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = filter === 'All'
    ? data
    : data.filter(item => item.status.toLowerCase() === filter.toLowerCase());

  const stats = {
    total: data.length,
    pending: data.filter(d => d.status.toLowerCase() === 'pending').length,
    approved: data.filter(d => d.status.toLowerCase() === 'approved').length,
    contacted: data.filter(d => d.status.toLowerCase() === 'contacted').length,
    converted: data.filter(d => d.status.toLowerCase() === 'converted').length,
    rejected: data.filter(d => d.status.toLowerCase() === 'rejected').length,
  };

  const tabs = [
    { label: `All (${stats.total})`, value: 'All' },
    { label: `Pending (${stats.pending})`, value: 'pending' },
    { label: `Approved (${stats.approved})`, value: 'approved' },
    { label: `Contacted (${stats.contacted})`, value: 'contacted' },
    { label: `Converted (${stats.converted})`, value: 'converted' },
    { label: `Rejected (${stats.rejected})`, value: 'rejected' },
  ];

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-amber-400';
      case 'approved': return 'bg-secondary';
      case 'contacted': return 'bg-primary';
      case 'converted': return 'bg-secondary-fixed-dim';
      case 'rejected': return 'bg-error';
      default: return 'bg-on-surface-variant/40';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'text-amber-700';
      case 'approved': return 'text-secondary';
      case 'contacted': return 'text-primary';
      case 'converted': return 'text-on-secondary-fixed';
      case 'rejected': return 'text-error';
      default: return 'text-on-surface-variant/60';
    }
  };

  return (
    <Layout>
      <div className="space-y-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
          <div className="space-y-1">
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Waitlist Ledger</h2>
            <p className="text-on-surface-variant/60 text-[13px] md:text-[14px] font-body">Managing the digital record of upcoming Kenyan merchant partners.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-low transition-colors shadow-sm uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">file_download</span>
              Export
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-md uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">person_add</span>
              Record
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-outline-variant/10 mb-6 font-body overflow-x-auto no-scrollbar whitespace-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 text-sm transition-colors relative flex-shrink-0 ${
                filter === tab.value
                  ? 'font-bold text-primary'
                  : 'font-medium text-on-surface-variant/60 hover:text-primary'
              }`}
            >
              {tab.label}
              {filter === tab.value && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Table Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-4 bg-surface p-3 rounded-xl border border-outline-variant/20 shadow-editorial gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-sm">search</span>
              <input
                className="pl-9 pr-4 py-2 w-full bg-surface-container-low border-none rounded-lg text-xs focus:ring-2 focus:ring-secondary transition-all font-body text-on-surface"
                placeholder="Search merchants..."
                type="text"
              />
            </div>
            <button className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-on-surface-variant/70 hover:bg-surface-container-low rounded-lg transition-colors font-label tracking-tight">
              <span className="material-symbols-outlined text-sm">filter_list</span>
              Filter
            </button>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30 mr-2 font-label">Bulk Options</p>
            <div className="flex items-center gap-1">
              <button className="p-2 text-on-surface-variant/30 hover:text-secondary hover:bg-secondary-container/10 rounded-lg transition-all">
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </button>
              <button className="p-2 text-on-surface-variant/30 hover:text-error hover:bg-error-container/10 rounded-lg transition-all">
                <span className="material-symbols-outlined text-lg">archive</span>
              </button>
            </div>
          </div>
        </div>

        {/* Waitlist Table Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-editorial overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[14px] text-on-surface-variant/60 font-medium">Fetching merchant applications...</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center text-error font-medium">{error}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-4 py-3 w-10">
                    <input className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox" />
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">#</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Merchant</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Phone</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Type</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Revenue Range</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Priority</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 font-body">
                {filteredData.map((m, i) => (
                  <tr key={m.id} className="hover:bg-secondary-container/5 transition-colors cursor-default group">
                    <td className="px-4 py-3"><input className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox" /></td>
                    <td className="px-4 py-3 text-[13px] font-medium text-on-surface-variant/40">{String(i + 1).padStart(3, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center text-primary text-xs font-bold ring-2 ring-white uppercase shadow-sm">
                          {(m.name || 'Merchant').split(' ')[0]?.[0] || ''}{(m.name || 'Merchant').split(' ')[1]?.[0] || (m.name?.[1] || 'M')}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-on-surface tracking-tight leading-tight">{m.name}</span>
                          <span className="text-[12px] text-on-surface-variant/60">{m.businessName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-on-surface-variant border-outline-variant/5">{m.phone}</td>
                    <td className="px-4 py-3 border-outline-variant/5">
                      <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-bold tracking-tight uppercase">{m.businessType}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-on-surface tracking-tight border-outline-variant/5">{m.revenueRange}</td>
                    <td className="px-4 py-3 border-outline-variant/5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(m.status)}`}></span>
                        <span className={`text-[12px] font-bold tracking-tight ${getStatusTextColor(m.status)}`}>{m.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-outline-variant/5">
                      <span className={`material-symbols-outlined text-[18px] ${m.priority ? 'text-[#F59E0B]' : 'text-on-surface-variant/10'}`} style={{ fontVariationSettings: m.priority ? "'FILL' 1" : "" }}>star</span>
                    </td>
                    <td className="px-4 py-3 text-right border-outline-variant/5">
                      <button className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors opacity-0 group-hover:opacity-100 text-on-surface-variant/30 hover:text-secondary">
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center text-on-surface-variant/40 font-medium">No merchants found in this category.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {/* Pagination */}
          <div className="px-6 py-4 bg-surface flex items-center justify-between border-t border-outline-variant/10 font-body">
            <p className="text-[12px] text-on-surface-variant/60">Showing {filteredData.length} entries in pipeline</p>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/30 hover:text-secondary transition-colors">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="w-6 h-6 flex items-center justify-center bg-primary text-on-primary text-[12px] font-bold rounded-lg tracking-tight">1</button>
              <button className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/30 hover:text-secondary transition-colors">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Style Bento Stats Below Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pb-12 font-body">
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-sm transition-all hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Total Pipeline</p>
              <span className="material-symbols-outlined text-secondary text-lg">trending_up</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">KES 42.5M</p>
            <p className="text-[10px] md:text-[11px] text-secondary mt-1 font-bold tracking-tight">+12.3% this month</p>
          </div>
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-sm transition-all hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Avg. Revenue</p>
              <span className="material-symbols-outlined text-secondary text-lg">payments</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">KES 850k</p>
            <p className="text-[11px] text-on-surface-variant/60 mt-1 font-medium">Per merchant</p>
          </div>
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-sm transition-all hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Velocity</p>
              <span className="material-symbols-outlined text-primary text-lg">speed</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">3.4 Days</p>
            <p className="text-[10px] md:text-[11px] text-primary mt-1 font-bold tracking-tight">-0.8d vs last week</p>
          </div>
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-sm transition-all hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Top Sector</p>
              <span className="material-symbols-outlined text-amber-500 text-lg">category</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tighter">Agri-Tech</p>
            <p className="text-[10px] md:text-[11px] text-on-surface-variant/60 mt-1 font-medium">28% sector share</p>
          </div>
        </div>
      </div>
      
      {/* Floating Action Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </Layout>
  );
};

export default Waitlist;
