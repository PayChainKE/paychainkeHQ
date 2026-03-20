import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'

export default function InflationShield(){
  const [kes, setKes] = useState(0)
  const rate = 130.00
  const feeRate = 0.005
  const fee = Math.round(kes * feeRate)
  const usdc = ((kes - fee) / rate).toFixed(2)

  return (
    <MerchantLayout title="Inflation Shield">
      <div style={{maxWidth:720}}>
        <div style={{background:'white',padding:16,borderRadius:12}}>
          <h3>Swap KES to USDC</h3>
          <div style={{marginTop:8}}>1 USDC = KES {rate.toFixed(2)} • Fee: 0.5%</div>
          <div style={{marginTop:12}}>
            <label>You send (KES)
              <input type="number" value={kes} onChange={e=>setKes(Number(e.target.value))} style={{width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)'}} />
            </label>
            <div style={{marginTop:8}}>You receive: <strong>{usdc} USDC</strong></div>
            <div style={{marginTop:8,background:'#F8F7F4',padding:8,borderRadius:8}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><div>Amount</div><div>{formatKES(kes)}</div></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><div>Fee (0.5%)</div><div>-{formatKES(fee)}</div></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}><div>You receive</div><div>{formatUSDC(usdc)}</div></div>
            </div>
            <button className="pc-btn" style={{marginTop:12}} disabled={kes<100}>Confirm Swap</button>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
