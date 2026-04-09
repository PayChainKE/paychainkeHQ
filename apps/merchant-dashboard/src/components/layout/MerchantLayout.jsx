import React from 'react'
import MerchantSidebar from './MerchantSidebar'
import MerchantHeader from './MerchantHeader'

export default function MerchantLayout({ children, title = 'Overview' }) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Monolith Sidebar - Fixed */}
      <MerchantSidebar />
      
      {/* Main Content Area - Scrolled */}
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <MerchantHeader title={title} />
        <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
          {children}
        </main>
      </div>
    </div>
  )
}
