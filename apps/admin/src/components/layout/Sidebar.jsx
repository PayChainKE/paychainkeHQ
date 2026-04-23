import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const Sidebar = ({ isOpen, onClose }) => {
  const { logout } = useAuth();

  const navItems = [
    { icon: 'dashboard', label: 'Overview', path: '/overview' },
    { icon: 'group', label: 'Merchants', path: '/merchants' },
    { icon: 'hourglass_empty', label: 'Waitlist', path: '/waitlist' },
    { icon: 'analytics', label: 'Insights', path: '/analytics' },
    { icon: 'mail', label: 'Messages', path: '/messages' },
    { icon: 'newspaper', label: 'Newsletter', path: '/newsletter' },
    { icon: 'badge', label: 'Team', path: '/team' },
    { icon: 'account_balance', label: 'Ledger', path: '/ledger' },
    { icon: 'settings', label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-full w-[240px] bg-[#0B1F0F] flex flex-col py-6 px-4 z-50 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between mb-10 px-2 lg:justify-center">
        <div className="flex flex-col items-center gap-2">
          <img src={logo} alt="PayChain Logo" className="h-8 max-w-full w-auto object-contain" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-secondary-fixed opacity-60 uppercase">ADMIN PORTAL</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => window.innerWidth < 1024 && onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13px] font-body font-bold leading-[1.5] tracking-tight ${
                isActive
                  ? 'bg-secondary-container/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-400/50 px-2 font-label">
            <span>System Status</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-[12px] font-medium font-body">
            <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
            <span>Waitlist: 30</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-[12px] font-medium font-body">
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            <span>Merchants: 18</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-[12px] font-medium font-body">
            <span className="material-symbols-outlined text-[16px]">mail</span>
            <span>Messages: 6</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary-container/10 text-white rounded-lg text-[13px] font-medium hover:bg-secondary-container/20 transition-all font-label"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
