import React from 'react';
import Layout from '../components/layout/Layout';

const Settings = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-2 px-4 space-y-8">
        {/* Account Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Account Profile</h3>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm font-body">
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between mb-8 md:mb-10 gap-8 md:gap-0">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-surface shadow-sm bg-primary-container text-on-primary-container text-2xl font-bold flex items-center justify-center">
                    AP
                  </div>
                  <button className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-on-primary border-2 border-surface shadow-md hover:opacity-90 transition-all">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
                <div>
                  <div className="flex flex-col md:flex-row items-center gap-3 mb-1">
                    <h4 className="text-xl md:text-2xl font-bold tracking-tighter text-on-surface">Admin Principal</h4>
                    <span className="px-2 py-0.5 bg-secondary-container/20 text-secondary text-[10px] font-bold rounded-lg uppercase tracking-widest font-label w-fit">System Owner</span>
                  </div>
                  <p className="text-on-surface-variant/60 text-sm font-medium">admin.principal@paychain.ke</p>
                  <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] text-on-surface-variant/40 font-medium">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      Last login: Oct 24, 14:32
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] text-secondary font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                      Connected
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-outline-variant/10">
              <h5 className="text-sm font-bold mb-6 uppercase tracking-widest font-label text-on-surface">Security Settings</h5>
              <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">New Password</label>
                  <input className="w-full px-4 py-3 rounded-lg bg-surface border border-outline-variant/30 focus:border-secondary focus:ring-0 transition-all text-sm font-body text-on-surface" placeholder="••••••••••••" type="password" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Confirm Password</label>
                  <input className="w-full px-4 py-3 rounded-lg bg-surface border border-outline-variant/30 focus:border-secondary focus:ring-0 transition-all text-sm font-body text-on-surface" placeholder="••••••••••••" type="password" />
                </div>
                <div className="sm:col-span-2 flex justify-center sm:justify-end">
                  <button className="w-full sm:w-auto px-6 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 font-label uppercase tracking-widest" type="button">
                    <span className="material-symbols-outlined text-[18px]">key</span>
                    Update Credentials
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Grid Layout for Subsections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">Data & Exports</h3>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 shadow-sm h-full font-body">
              <p className="text-xs text-on-surface-variant/60 mb-6 font-medium">Generate CSV/XLSX reports for auditing and system analysis.</p>
              <div className="space-y-3">
                {['Waitlist', 'Merchants', 'Messages'].map((type) => (
                  <button key={type} className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-outline-variant/20 hover:bg-surface-container-low transition-all text-sm font-bold group text-[11px] text-on-surface-variant/60 uppercase tracking-widest font-label">
                    <span className="flex items-center gap-3">Export All {type}</span>
                    <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:text-secondary transition-colors">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>dns</span>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-label">System Information</h3>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 shadow-sm h-full font-body">
              <div className="space-y-4">
                {[
                  { label: 'Environment', value: 'Production (AWS-K4)' },
                  { label: 'Frontend', value: 'Healthy', status: true },
                  { label: 'API Status', value: '99.9% Uptime', status: true },
                  { label: 'System Version', value: 'v2.4.12-stable' }
                ].map((info, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant/5 last:border-0">
                    <span className="text-[12px] text-on-surface-variant/60 font-bold uppercase tracking-tight font-label">{info.label}</span>
                    {info.status ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> {info.value}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-on-surface tracking-tight">{info.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Danger Zone Section */}
        <section className="space-y-4 pt-6">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-error font-label">Danger Zone</h3>
          </div>
          <div className="bg-error-container/10 rounded-xl p-6 md:p-8 border-2 border-error-container/30 flex flex-col lg:flex-row lg:items-center justify-between gap-8 font-body">
            <div className="space-y-1 max-w-lg text-center lg:text-left">
              <h4 className="text-error font-bold tracking-tight uppercase text-[12px] font-label">Critical Actions</h4>
              <p className="text-on-error-container/60 text-sm font-medium">These actions are destructive and cannot be undone. Ensuring ledger backups is recommended.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="flex-1 px-5 py-3 rounded-lg bg-surface border border-error-container/30 text-error text-[11px] font-bold hover:bg-error-container/5 transition-all flex items-center justify-center gap-2 font-label uppercase tracking-widest">
                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                Bulk Wipe
              </button>
              <button className="flex-1 px-5 py-3 rounded-lg bg-error text-on-error text-[11px] font-bold hover:opacity-90 shadow-md transition-all flex items-center justify-center gap-2 font-label uppercase tracking-widest">
                <span className="material-symbols-outlined text-[18px]">layers_clear</span>
                Reset Data
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Settings;
