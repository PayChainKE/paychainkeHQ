import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Header = ({ onToggleSidebar }) => {
  const { admin } = useAuth();

  return (
    <header className="sticky top-0 w-full h-[56px] bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 flex justify-between items-center px-4 md:px-6 z-40 font-body">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={onToggleSidebar}
          className="lg:hidden text-on-surface-variant hover:bg-surface-container-low p-2 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        
        <div className="hidden md:flex items-center gap-4">
          <h1 className="text-lg font-bold text-on-surface tracking-tight">Portal Hub</h1>
          <div className="h-4 w-[1px] bg-outline-variant/50"></div>
          <span className="text-xs font-semibold text-on-surface-variant">Admin Console</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-6">
        <button className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-lg transition-colors flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">Sync</span>
        </button>
        
        <div className="flex items-center gap-3 pl-3 md:pl-4 border-l border-outline-variant/50">
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-bold text-on-surface tracking-tight leading-none mb-1">{admin?.name || 'Admin Principal'}</p>
            <p className="text-[9px] text-secondary font-bold tracking-widest uppercase">System Owner</p>
          </div>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary-container flex items-center justify-center overflow-hidden ring-2 ring-surface-container-highest">
            <img
              alt="Admin Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuArjgv90OENXt8EUb7D8axUJWASF7n5H7qBmLCWc57_t0CSZdQxwCc18pI01llZl0BnsJICvN5bnlWXhyeDv9wGotJQIz36wCDc5JcSEts93-0kt6RPHb_HTVUoKHyW93XpEAJqkWcxolIiZyaW_8_Wz89L_dJDhFFtC4x6X9Psd7x0HULGWsMZOngDJy3H6o6rQHfpB78_R79UVTzLKbiqKNot_9yZRU2yHoufqqpBY74jICwNTZxFqN6ElArlXJIuCMycVJ7l2vE"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
