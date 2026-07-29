import React from 'react';

const Header = ({ onToggleSidebar }) => {
  return (
    <header className="sticky top-0 w-full h-[56px] bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 flex items-center px-4 md:px-6 z-40 font-body">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden text-on-surface-variant hover:bg-surface-container-low p-2 rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
    </header>
  );
};

export default Header;
