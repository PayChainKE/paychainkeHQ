import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const NAV_ITEMS = [
  { icon: 'fact_check',   label: 'Queue',          path: '/queue' },
  { icon: 'person_add',   label: 'New Application', path: '/applications/new' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { admin, logout } = useAuth();
  const handleNavClick = () => { if (window.innerWidth < 1024) onClose(); };

  return (
    <aside className={`fixed left-0 top-0 h-full w-[240px] bg-[#162723] flex flex-col py-5 px-3 z-50 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-editorial' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between mb-6 px-2 lg:justify-center">
        <div className="flex flex-col items-center gap-1.5">
          <img src={logo} alt="PayChain Logo" className="h-8 max-w-full w-auto object-contain" />
          <span className="text-2xs font-bold tracking-[0.22em] text-secondary-fixed opacity-60 uppercase">OFFICER PORTAL</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white absolute right-3 top-5">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar pr-1 -mr-1">
        <div className="px-3 mb-1.5 text-2xs font-bold tracking-[0.18em] text-[#c0c9c0]/40 uppercase font-label">
          Merchant Onboarding
        </div>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-xs font-body font-bold leading-tight tracking-tight relative ${
                  isActive
                    ? 'bg-[#0E3D2E] text-[#5EFEB3] shadow-[0_0_15px_rgba(94,254,179,0.05)] after:absolute after:left-0 after:top-1 after:bottom-1 after:w-[3px] after:bg-[#5EFEB3] after:rounded-full'
                    : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-900/30'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
        <div className="px-2">
          <p className="text-xs font-bold text-white truncate">{admin?.name || admin?.email}</p>
          <p className="text-2xs text-[#c0c9c0]/50 uppercase tracking-widest">{admin?.role}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2 bg-secondary-container/10 text-white rounded-lg text-xs font-medium hover:bg-secondary-container/20 transition-all font-label"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
