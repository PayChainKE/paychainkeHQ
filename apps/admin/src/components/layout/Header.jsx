import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { triggerSync } from '../../utils/syncBus';

export { triggerSync };

const Header = ({ onToggleSidebar }) => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close profile menu on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function handleSync() {
    setSyncing(true);
    triggerSync();
    setTimeout(() => setSyncing(false), 700);
  }

  const displayName = admin?.name?.trim() || (admin?.email ? admin.email.split('@')[0] : 'Admin');
  const roleLabel = (admin?.role || 'owner').toUpperCase();
  const initials = (() => {
    if (admin?.name) {
      const parts = admin.name.trim().split(/\s+/);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
    }
    return (admin?.email || 'A')[0].toUpperCase();
  })();

  return (
    <header className="sticky top-0 w-full h-[56px] bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 flex justify-between items-center px-4 md:px-6 z-40 font-body">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-on-surface-variant hover:bg-surface-container-low p-2 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-on-surface-variant hover:bg-surface-container-low active:bg-surface-container-high p-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
          title="Refresh current page data"
        >
          <span className={`material-symbols-outlined text-xl ${syncing ? 'animate-spin' : ''}`}>refresh</span>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">{syncing ? 'Syncing…' : 'Sync'}</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-3 pl-3 pr-2 py-1.5 border-l border-outline-variant/50 hover:bg-surface-container-low rounded-r-lg transition-colors"
          >
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-on-surface tracking-tight leading-none mb-1 max-w-[140px] truncate">{displayName}</p>
              <p className="text-2xs text-primary font-bold tracking-widest uppercase">{roleLabel}</p>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary text-white flex items-center justify-center overflow-hidden ring-2 ring-surface-container-highest font-bold text-xs uppercase shadow-sm">
              {admin?.avatarUrl ? (
                <img src={admin.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : initials}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-64 bg-white rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
              <div className="px-4 py-3 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white">
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-300">Signed in as</p>
                <p className="text-sm font-bold mt-0.5 truncate">{displayName}</p>
                <p className="text-2xs text-emerald-100/70 truncate">{admin?.email}</p>
              </div>
              <div className="py-1">
                <MenuItem icon="account_circle" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                  Profile & Settings
                </MenuItem>
                <MenuItem icon="analytics" onClick={() => { setMenuOpen(false); navigate('/analytics'); }}>
                  Insights
                </MenuItem>
                <MenuItem icon="badge" onClick={() => { setMenuOpen(false); navigate('/team'); }}>
                  Team
                </MenuItem>
              </div>
              <div className="h-px bg-outline-variant/20"></div>
              <div className="py-1">
                <MenuItem
                  icon="logout"
                  tone="red"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  Sign out
                </MenuItem>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const MenuItem = ({ icon, tone, onClick, children }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-left transition-colors ${
      tone === 'red' ? 'text-red-700 hover:bg-red-50' : 'text-on-surface hover:bg-surface-container-low'
    }`}
  >
    <span className="material-symbols-outlined text-lg">{icon}</span>
    {children}
  </button>
);

export default Header;
