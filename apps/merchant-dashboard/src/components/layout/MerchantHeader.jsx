import React from 'react'
import { Bell } from 'lucide-react'
import { mockMerchant } from '../../mockData/merchant'

export default function MerchantHeader({ title }){
  const unread = mockMerchant.notifications.filter(n=>!n.isRead).length
  return (
    <header className="mc-header">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button style={{display:'none'}}>☰</button>
        <div style={{fontWeight:700}}>{title}</div>
        <div style={{marginLeft:8,color:'#6B7280'}}>{`Till: ${mockMerchant.tillNumber}`}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button style={{background:'transparent',border:0,position:'relative'}}><Bell />{unread>0 && <span style={{position:'absolute',right:2,top:2,width:8,height:8,background:'#EF4444',borderRadius:999}} />}</button>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontSize:13,fontWeight:600}}>{mockMerchant.name}</div>
        </div>
      </div>
    </header>
  )
}
