import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { payees, bulkPayHistory } from '../mockData/bulkPay'
import { formatKES } from '../utils/formatCurrency'

export default function BulkPay(){
  const [selected, setSelected] = useState({})
  const toggle = id => setSelected(s=> ({...s,[id]: !s[id]}))
  const total = Object.keys(selected).filter(k=>selected[k]).reduce((sum,k)=>{
    const p = payees.find(x=>x.id===k); return sum + (p.amount || p.salary || 0)
  },0)

  return (
    <MerchantLayout title="Bulk Pay">
      <div style={{display:'flex',gap:16}}>
        <div style={{width:380}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3>Saved Payees</h3>
            <button className="pc-btn">Add Payee +</button>
          </div>
          <div style={{marginTop:8}}>
            {payees.map(p=> (
              <div key={p.id} style={{background:'white',padding:12,borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{fontSize:12,color:'#6B7280'}}>{p.type} • {p.phone || p.accountNumber}</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <div>{formatKES(p.amount || p.salary || 0)}</div>
                  <input type="checkbox" checked={!!selected[p.id]} onChange={()=>toggle(p.id)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{flex:1}}>
          <div style={{background:'white',padding:12,borderRadius:8}}>
            <h3>Create Bulk Payment</h3>
            <div style={{marginTop:12}}>Selected: {Object.keys(selected).filter(k=>selected[k]).length} • Total: {formatKES(total)}</div>
            <div style={{marginTop:12}}>Balance available: {formatKES(184250)}</div>
            <button className="pc-btn" style={{marginTop:12}} disabled={total===0 || total>184250}>Confirm & Send {formatKES(total)}</button>
          </div>

          <div style={{marginTop:12}}>
            <h4>Recent Batches</h4>
            {bulkPayHistory.map(b=> (
              <div key={b.id} style={{background:'white',padding:12,borderRadius:8,marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><div style={{fontWeight:700}}>{b.label}</div><div>{formatKES(b.totalAmount)}</div></div>
                <div style={{fontSize:12,color:'#6B7280'}}>{b.executedAt} • {b.recipientCount} recipients</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
