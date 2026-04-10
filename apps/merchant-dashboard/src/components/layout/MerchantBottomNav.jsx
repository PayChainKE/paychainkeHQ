import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Inbox, Users, Shield, CreditCard, Star, User, MessageSquare } from 'lucide-react'

const items = [
  { to: '/overview', label: 'Overview', Icon: Home },
  { to: '/transactions', label: 'Transactions', Icon: Inbox },
  { to: '/bulk-pay', label: 'Bulk Payments', Icon: Users },
  { to: '/inflation-shield', label: 'Inflation Shield', Icon: Shield },
  { to: '/cash-advance', label: 'Cash Advance', Icon: CreditCard },
  { to: '/trust-score', label: 'Trust Score', Icon: Star },
  { to: '/profile', label: 'Profile', Icon: User },
  { to: '/support', label: 'Support', Icon: MessageSquare }
]

export default function MerchantBottomNav(){
  return (
    <nav className="mc-bottom-nav" style={{display:'none'}}>
      {items.map(it=> (
        <NavLink key={it.to} to={it.to} style={{flex:1,textAlign:'center',textDecoration:'none',color:'#374151',paddingTop:8}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',fontSize:11}}>
            <it.Icon size={18} />
            <div style={{marginTop:4,fontSize:11}}>{it.label}</div>
          </div>
        </NavLink>
      ))}
    </nav>
  )
}
