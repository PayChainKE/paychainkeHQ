import React, { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import logo from '../../assets/logo.png';

// Grouped navigation. Every item in a section renders flat under the section
// label — no parent/child nesting. The order within a section reflects the
// information hierarchy (most-used first) but all entries share equal weight.
const NAV_SECTIONS = [
  {
    title: 'Business Core',
    items: [
      { icon: 'dashboard',    label: 'Overview', path: '/overview' },
      { icon: 'analytics',    label: 'Insights', path: '/analytics' },
      { icon: 'trending_up',  label: 'Revenue',  path: '/revenue'  },
    ],
  },
  {
    title: 'Merchant Relations',
    items: [
      { icon: 'group',           label: 'Merchants', path: '/merchants' },
      { icon: 'hourglass_empty', label: 'Waitlist',  path: '/waitlist'  },
    ],
  },
  {
    title: 'Financials & Compliance',
    items: [
      { icon: 'account_balance', label: 'Ledger',                 path: '/ledger'                 },
      { icon: 'receipt_long',    label: 'Invoices',                path: '/invoices'               },
      { icon: 'savings',         label: 'Cash Advance Requests', path: '/cash-advance-requests' },
      { icon: 'security',        label: 'Wallet Audit',           path: '/wallet-audit'           },
      { icon: 'fact_check',      label: 'Audit Log',              path: '/audit-log'              },
    ],
  },
  {
    title: 'Communications',
    items: [
      { icon: 'support_agent', label: 'Call Centre', path: '/call-centre' },
      { icon: 'mail',          label: 'Messages',    path: '/messages'    },
      { icon: 'newspaper',     label: 'Newsletter',  path: '/newsletter'  },
    ],
  },
  {
    title: 'System Administration',
    items: [
      { icon: 'badge',    label: 'Team',     path: '/team'     },
      { icon: 'settings', label: 'Settings', path: '/settings' },
    ],
  },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { logout } = useAuth();
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/system-status');
      if (res.data?.success) setStatus(res.data.data);
    } catch (e) {
      // Stay silent — sidebar should not break on a transient failure.
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    const h = () => fetchStatus();
    window.addEventListener('paychain:sync', h);
    return () => { clearInterval(id); window.removeEventListener('paychain:sync', h); };
  }, [fetchStatus]);

  const statRows = [
    { icon: 'storefront', label: 'Merchants', value: status?.merchants?.total, badge: status?.merchants?.flagged, badgeTone: 'red',     path: '/merchants' },
    { icon: 'mail',       label: 'Messages',  value: status?.messages?.total,  badge: status?.messages?.unread,   badgeTone: 'emerald', path: '/messages'  },
  ];

  const badgeToneMap = {
    amber:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
    red:     'bg-red-500/20 text-red-300 border-red-500/40',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  };

  const handleNavClick = () => { if (window.innerWidth < 1024) onClose(); };

  return (
    <aside className={`fixed left-0 top-0 h-full w-[240px] bg-[#162723] flex flex-col py-5 px-3 z-50 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-editorial' : '-translate-x-full'}`}>
      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 px-2 lg:justify-center">
        <div className="flex flex-col items-center gap-1.5">
          <img src={logo} alt="PayChain Logo" className="h-8 max-w-full w-auto object-contain" />
          <span className="text-[9px] font-bold tracking-[0.22em] text-secondary-fixed opacity-60 uppercase">ADMIN PORTAL</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white absolute right-3 top-5">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* ── Grouped navigation ───────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar pr-1 -mr-1">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title} className={sIdx === 0 ? '' : 'mt-4'}>
            <div className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.18em] text-[#c0c9c0]/40 uppercase font-label">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[12.5px] font-body font-bold leading-tight tracking-tight relative ${
                      isActive
                        ? 'bg-[#0E3D2E] text-[#5EFEB3] shadow-[0_0_15px_rgba(94,254,179,0.05)] after:absolute after:left-0 after:top-1 after:bottom-1 after:w-[3px] after:bg-[#5EFEB3] after:rounded-full'
                        : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-900/30'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── System Status + sign-out ─────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-[#c0c9c0]/40 px-2 font-label">
            <span>System Status</span>
            <button
              onClick={fetchStatus}
              title="Refresh"
              className="text-[#c0c9c0]/40 hover:text-emerald-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
            </button>
          </div>
          {statRows.map((row) => (
            <NavLink
              key={row.label}
              to={row.path}
              onClick={handleNavClick}
              className="flex items-center gap-2 px-2 py-1 text-slate-400 text-[11px] font-medium font-body rounded-md hover:bg-emerald-900/30 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] opacity-70">{row.icon}</span>
              <span className="flex-1">{row.label}</span>
              {loadingStatus ? (
                <span className="inline-block w-6 h-3 bg-white/10 rounded animate-pulse"></span>
              ) : (
                <>
                  <span className="tabular-nums font-bold text-white/80">{(row.value ?? 0).toLocaleString()}</span>
                  {row.badge > 0 && (
                    <span className={`tabular-nums text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeToneMap[row.badgeTone]}`}>
                      {row.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2 bg-secondary-container/10 text-white rounded-lg text-[12px] font-medium hover:bg-secondary-container/20 transition-all font-label"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
