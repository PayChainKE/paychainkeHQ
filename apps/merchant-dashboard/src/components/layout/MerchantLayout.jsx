import React from 'react'
import MerchantSidebar from './MerchantSidebar'
import MerchantHeader from './MerchantHeader'

export default function MerchantLayout({ children, title='Overview' }){
  return (
    <div className="mc-app">
      <MerchantSidebar />
      <div className="mc-main">
        <MerchantHeader title={title} />
        <main className="mc-content">{children}</main>
      </div>
      <div className="mc-bottom-nav" />
    </div>
  )
}
