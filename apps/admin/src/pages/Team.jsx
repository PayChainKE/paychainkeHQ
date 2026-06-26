import React from 'react';
import Layout from '../components/layout/Layout';

const Team = () => {
  const teamMembers = [
    { name: 'Maina Kamau', email: 'maina.k@paychain.co.ke', role: 'Super Admin', onboarded: 142, status: 'Active', added: '12 Oct 2023' },
    { name: 'Sarah Njeri', email: 's.njeri@paychain.co.ke', role: 'Admin', onboarded: 89, status: 'Active', added: '04 Nov 2023' },
    { name: 'David Otieno', email: 'd.otieno@paychain.co.ke', role: 'Onboarding Officer', onboarded: 214, status: 'Active', added: '15 Dec 2023' },
    { name: 'Grace Wambui', email: 'grace.w@paychain.co.ke', role: 'Viewer', onboarded: 0, status: 'Away', added: '20 Jan 2024' },
    { name: 'Kevin Musyoka', email: 'k.musyoka@paychain.co.ke', role: 'Onboarding Officer', onboarded: 156, status: 'Active', added: '05 Feb 2024' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
          <div>
            <h2 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-on-surface leading-none">Management Console</h2>
            <p className="text-on-surface-variant/60 mt-2 text-[13px] md:text-[14px] font-body">Reviewing 24 team members across 4 administrative tiers.</p>
          </div>
          <button className="w-full sm:w-auto bg-primary text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:shadow-lg transition-all active:scale-95 shadow-md font-label uppercase tracking-widest">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Member
          </button>
        </div>

        {/* KPI Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 font-body">
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 shadow-sm transition-all hover:scale-[1.01]">
            <span className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Total Members</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-[32px] font-bold text-on-surface tracking-tighter">24</span>
              <span className="text-[10px] md:text-[12px] font-bold text-secondary bg-secondary-container/20 px-2 py-0.5 rounded-lg tracking-tight">+2 today</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 shadow-sm transition-all hover:scale-[1.01]">
            <span className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Active Now</span>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl md:text-[32px] font-bold text-on-surface tracking-tighter">18</span>
              <div className="w-2.5 h-2.5 bg-secondary animate-pulse rounded-full shadow-[0_0_8px_rgba(var(--secondary),0.5)]"></div>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 shadow-sm transition-all hover:scale-[1.01] sm:col-span-2 lg:col-span-1">
            <span className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Officers</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-[32px] font-bold text-on-surface tracking-tighter">06</span>
              <span className="text-[11px] font-bold text-on-surface-variant/40 tracking-tight">Regional Team</span>
            </div>
          </div>
        </div>

        {/* Team Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden font-body">
          <div className="p-4 md:p-6 border-b border-outline-variant/10 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-surface">
            <h3 className="font-bold text-on-surface flex items-center gap-2 uppercase tracking-widest text-[11px] md:text-xs font-label">
              <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
              Active Team
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">search</span>
                <input className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg text-xs md:w-[280px] focus:ring-2 focus:ring-secondary transition-all font-body text-on-surface" placeholder="Search by name or email..." type="text" />
              </div>
              <button className="flex items-center justify-center gap-2 p-2 bg-surface-container-low rounded-lg text-on-surface-variant/60 hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
                <span className="sm:hidden text-xs font-bold uppercase tracking-widest">Filter</span>
              </button>
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 font-label">
                <th className="px-6 py-3 text-left text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Name & Avatar</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Email Address</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Role</th>
                <th className="px-6 py-3 text-center text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Merchants</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Date Added</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {teamMembers.map((member, i) => (
                <tr key={i} className="hover:bg-secondary-container/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary text-xs flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white">
                        {member.name.split(' ')[0][0]}{member.name.split(' ')[1]?.[0] || 'M'}
                      </div>
                      <span className="text-[13px] font-bold text-on-surface tracking-tight">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-on-surface-variant/70 font-medium">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border ${
                      member.role === 'Super Admin' ? 'bg-primary/10 text-primary border-primary/20' :
                      member.role === 'Admin' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                      member.role === 'Onboarding Officer' ? 'bg-tertiary-container/30 text-on-tertiary-container border-tertiary-container/50' :
                      'bg-surface-container text-on-surface-variant/60 border-outline-variant/30'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-[13px] font-bold text-on-surface tracking-tight">{member.onboarded}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-secondary' : 'bg-on-surface-variant/20'}`}></span>
                      <span className={`text-[13px] font-bold tracking-tight ${member.status === 'Active' ? 'text-secondary' : 'text-on-surface-variant/40'}`}>{member.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-on-surface-variant/40 font-bold font-label tracking-tight">{member.added}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-on-surface-variant/20 hover:text-secondary transition-colors">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default Team;
