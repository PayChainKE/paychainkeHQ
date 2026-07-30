import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar - Hidden on mobile by default, fixed on desktop */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content Area. Margin only ever applies at lg+, matching the
          sidebar's own lg:translate-x-0 breakpoint (Sidebar.jsx) — below lg
          the sidebar is always an overlay drawer (open or closed), so it
          must never push the content regardless of isSidebarOpen. */}
      <div className="flex-1 flex flex-col transition-all duration-300 ml-0 lg:ml-[240px]">
        <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
