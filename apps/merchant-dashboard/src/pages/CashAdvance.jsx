import React from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'
import { formatKES } from '../utils/formatCurrency'

export default function CashAdvance(){
  const adv = mockMerchant.cashAdvance.currentAdvance
  return (
    <MerchantLayout title="Cash Advance">
      <div style={{background:'white',padding:16,borderRadius:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{fontSize:28,color:'var(--brand-accent)'}}>💵</div>
            <div>
              <div style={{fontWeight:700}}>Active Cash Advance</div>
              <div style={{fontSize:12,color:'#6B7280'}}>Disbursed {adv.disbursedAt}</div>
            </div>
          </div>
          <div style={{fontWeight:700}}>{formatKES(adv.amount)}</div>
        </div>

        <div style={{marginTop:12}}>
          <div style={{height:10,background:'#E5E7EB',borderRadius:6}}><div style={{width:'45%',height:'100%',background:'var(--brand-accent)'}} /></div>
          <div style={{fontSize:13,color:'#6B7280',marginTop:8}}>Repaid: KES {adv.repaidAmount} of KES {adv.amount} ({Math.round(adv.repaidAmount/adv.amount*100)}%)</div>
          <div style={{fontSize:12,color:'#6B7280'}}>Repayment rate: {adv.repaymentRate}% of daily collections • Est. completion: {adv.estimatedCompletionDate}</div>
        </div>
      </div>
    </MerchantLayout>
  )
}
