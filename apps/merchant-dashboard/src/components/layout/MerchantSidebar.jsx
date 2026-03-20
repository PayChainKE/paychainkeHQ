import React from 'react'
import { NavLink } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { mockMerchant } from '../../mockData/merchant'
import { Copy } from 'lucide-react'

export default function MerchantSidebar(){
  return (
    <aside className="mc-sidebar">
      <div className="mc-brand">PayChain <small style={{display:'block',fontSize:10,background:'var(--brand-accent-light)',padding:'2px 8px',borderRadius:6,color:'var(--brand-primary)',marginTop:6}}>Merchant Portal</small></div>
      <div className="mc-merchant-card">
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <Avatar name={mockMerchant.name} />
          <div>
            <div style={{fontWeight:700}}>{mockMerchant.name}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>{mockMerchant.businessName}</div>
          </div>
        </div>
        <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center'}}>
          <div style={{background:'rgba(29,158,117,0.12)',padding:'6px 8px',borderRadius:20,color:'var(--brand-primary)',fontWeight:700}}>{mockMerchant.tillNumber}</div>
          <button style={{background:'transparent',border:'1px solid rgba(255,255,255,0.06)',padding:6,borderRadius:6,color:'rgba(255,255,255,0.7)'}} onClick={()=>{navigator.clipboard.writeText(mockMerchant.tillNumber);alert('Copied till number')}}><Copy size={14} /></button>
        </div>
      </div>
      <nav className="mc-nav">
        <ul>
          <li><NavLink to="/overview">Overview</NavLink></li>
          <li><NavLink to="/transactions">Collections</NavLink></li>
          <li><NavLink to="/bulk-pay">Bulk Pay</NavLink></li>
          <li><NavLink to="/inflation-shield">Inflation Shield</NavLink></li>
          <li><NavLink to="/cash-advance">Cash Advance</NavLink></li>
          <li><NavLink to="/trust-score">Trust Score</NavLink></li>
          <li><NavLink to="/profile">Profile</NavLink></li>
          <li><NavLink to="/support">Support</NavLink></li>
        </ul>
      </nav>

      <div style={{position:'absolute',bottom:20,left:20,right:20}}>
        <div style={{background:'rgba(255,255,255,0.06)',padding:12,borderRadius:8}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>Available Balance</div>
          <div style={{fontWeight:700,marginTop:6}}>{new Intl.NumberFormat().format(mockMerchant.financials.kesBalance)} KES</div>
          <div style={{color:'var(--brand-accent)',marginTop:6}}>{mockMerchant.financials.usdcBalance} USDC</div>
        </div>
        <div style={{marginTop:10}}>
          <a href="#" onClick={(e)=>{e.preventDefault();localStorage.removeItem('paychain_merchant_session');window.location.href='/login'}} style={{color:'rgba(255,255,255,0.6)',textDecoration:'none'}}>Sign Out</a>
        </div>
      </div>
    </aside>
  )
}
