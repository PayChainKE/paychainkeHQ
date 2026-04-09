import React from 'react'
import MerchantSidebar from './MerchantSidebar'
import MerchantHeader from './MerchantHeader'

export default function MerchantLayout({ children, title = 'Overview' }) {
  return (
    <div className="flex min-h-screen bg-[#F0FDF4]">
      {/* Monolith Sidebar - Fixed */}
      <MerchantSidebar />
      
      {/* Main Content Area - Scrolled */}
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <MerchantHeader title={title} />
        <main className="flex-1 px-8 pt-4 pb-12 max-w-[1400px] w-full mx-auto space-y-10">
          {children}
        </main>
      </div>
    </div>
  )
}
