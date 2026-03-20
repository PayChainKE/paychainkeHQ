import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { transactionsData } from '../mockData/transactions'
import { formatDateISO } from '../utils/formatDate'
import { formatKES } from '../utils/formatCurrency'

export default function Transactions(){
  const [q,setQ] = useState('')
  const rows = transactionsData.filter(t=> {
    if (!q) return true
    const s = q.toLowerCase()
    return (t.sender && t.sender.name.toLowerCase().includes(s)) || (t.recipient && t.recipient.name.toLowerCase().includes(s)) || (t.reference && t.reference.toLowerCase().includes(s))
  })
  return (
    <MerchantLayout title="Collections">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3>Collections</h3>
        <div>
          <button className="pc-btn" onClick={()=>{ const rowsToExport = rows.slice(0,200); alert('Export simulated - TODO: exportCSV') }}>Export</button>
        </div>
      </div>

      <div style={{marginTop:12,background:'white',padding:12,borderRadius:12}}>
        <div style={{marginBottom:8}}>
          <input placeholder="Search by name, phone, or reference..." value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)'}} />
        </div>
        <table className="mc-table">
          <thead><tr><th>Date</th><th>Type</th><th>Party</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {rows.slice(0,200).map(tx => (
              <tr key={tx.id}>
                <td>{formatDateISO(tx.timestamp)}</td>
                <td>{tx.type}</td>
                <td>{(tx.sender && tx.sender.name) || (tx.recipient && tx.recipient.name) || ''}</td>
                <td className="mono">{tx.reference || ''}</td>
                <td>{tx.type==='fx_swap' ? `KES ${tx.kesAmount} → ${tx.usdcAmount} USDC` : `KES ${tx.amount}`}</td>
                <td>{tx.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantLayout>
  )
}
