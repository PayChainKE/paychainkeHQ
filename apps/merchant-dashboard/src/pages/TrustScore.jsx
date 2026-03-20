import React from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'

export default function TrustScore(){
  const score = mockMerchant.trustScore.current
  const pct = `${score}%`
  return (
    <MerchantLayout title="Trust Score">
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <div style={{width:200,background:'white',padding:16,borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{width:120,height:120,borderRadius:999,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(180deg,#E6F6EE,#fff)'}}>
            <div style={{fontSize:28,fontWeight:700,color:'var(--brand-accent)'}}>{score}</div>
          </div>
          <div style={{marginTop:8}}>Cash Advance Eligible ✓</div>
        </div>
        <div style={{flex:1,background:'white',padding:12,borderRadius:12}}>
          <h3>What's building your score</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {Object.entries(mockMerchant.trustScore.factors).map(([k,v])=> (
              <div key={k} style={{background:'#F8F7F4',padding:12,borderRadius:8}}>
                <div style={{fontSize:11,textTransform:'uppercase',color:'#6B7280'}}>{k.replace(/([A-Z])/g,' $1')}</div>
                <div style={{fontSize:20,fontWeight:700,marginTop:6}}>{v}</div>
                <div style={{height:6,background:'#eee',marginTop:8,borderRadius:4}}><div style={{width:`${v}%`,height:'100%',background:'var(--brand-accent)'}} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
