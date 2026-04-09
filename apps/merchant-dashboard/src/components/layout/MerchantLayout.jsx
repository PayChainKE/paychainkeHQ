import React, { useState } from 'react'
import MerchantSidebar from './MerchantSidebar'
import MerchantHeader from './MerchantHeader'

export default function MerchantLayout({ children, title = 'Overview' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className="flex min-h-screen bg-[#F0FDF4] overflow-x-hidden">
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
      <div className="flex-1 flex flex-col min-h-screen w-full lg:ml-[240px] transition-all">
        <MerchantHeader title={title} onMenuClick={toggleSidebar} />
        <main className="flex-1 px-4 lg:px-8 pt-4 pb-12 max-w-[1400px] w-full mx-auto space-y-6 lg:space-y-10">
          {children}
        </main>
      </div>
    </div>
  )
}
