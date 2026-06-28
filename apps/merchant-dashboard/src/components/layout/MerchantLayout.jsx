import React, { useState } from 'react'
import MerchantSidebar from './MerchantSidebar'
import MerchantHeader from './MerchantHeader'
import InstallBanner from '../ui/InstallBanner'
import poweredByLogo from '../../assets/poweredby-logo.png'

export default function MerchantLayout({ children, title = 'Overview' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className="flex min-h-screen bg-[#F0FDF4] overflow-x-hidden">
      <InstallBanner />
      {/* Sidebar - Responsive Drawer */}
      <MerchantSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Global Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[45] lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen w-full lg:ml-[240px] transition-all pt-[64px] lg:pt-[56px]">
        <MerchantHeader title={title} onMenuClick={toggleSidebar} />
        <main className="flex-1 px-4 lg:px-8 pt-4 pb-12 max-w-[1400px] w-full mx-auto space-y-6 lg:space-y-10">
          {children}
        </main>
        
        {/* Full-width Thin branded Footer */}
        <footer className="w-full bg-[#FAFAF9] border-t border-emerald-900/10 py-4 mt-auto transition-colors">
          <div className="px-4 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2 max-w-[1400px] mx-auto">
            <p className="text-emerald-900/60 text-[9px] lg:text-[10px] font-bold tracking-tight">
              &copy; {new Date().getFullYear()} PayChain Financial Services Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="text-emerald-900/40 text-[8px] lg:text-[9px] uppercase tracking-[0.2em] font-black">Powered by</span>
              <img src={poweredByLogo} alt="PayChain Logo" className="h-3 lg:h-3.5 w-auto object-contain" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
