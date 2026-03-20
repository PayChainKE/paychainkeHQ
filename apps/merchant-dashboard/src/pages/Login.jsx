import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import '../index.css'

export default function Login(){
  const { login } = useMerchantAuth()
  const [phone, setPhone] = useState('0712847291')
  const [password, setPassword] = useState('TempPass2026!')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e){
    e.preventDefault(); setLoading(true); setErr('')
    const res = await login(phone, password)
    setLoading(false)
    if (res.success){
      if (res.firstLogin) nav('/set-password')
      else nav('/overview')
    } else setErr(res.error)
  }

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <div style={{flex:'0 0 45%',background:'#0B1F0F',color:'white',padding:40,display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:700,fontSize:20}}>PayChain</div>
          <div style={{marginTop:12,fontSize:12,color:'rgba(255,255,255,0.7)'}}>Merchant Portal</div>
        </div>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:40,fontWeight:700,opacity:0.95}}>Collect.<br/>Pay.<br/>Grow.</div>
          <div style={{marginTop:20,color:'rgba(255,255,255,0.65)'}}>
            <div>• Verified M-PESA collections</div>
            <div>• Working capital, no collateral</div>
            <div>• Your data builds your credit</div>
          </div>
        </div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>Merchant access is by invitation only.</div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{maxWidth:380,width:'100%',background:'white',padding:24,borderRadius:12}}>
          <h2 style={{margin:0}}>Sign in to your account</h2>
          <p style={{color:'#6B7280'}}>Enter your M-PESA phone number and the password provided by your PayChain onboarding officer.</p>

          <div style={{background:'#E1F5EE',borderLeft:'3px solid #1D9E75',padding:10,borderRadius:'0 6px 6px 0'}}>
            <div style={{color:'#065F46',fontSize:12}}>Don't have an account? Access is provided by your PayChain onboarding officer after approval.</div>
          </div>

          <form onSubmit={onSubmit} style={{marginTop:16}}>
            <label>Phone Number (M-PESA)
              <div style={{display:'flex',marginTop:6}}>
                <div style={{background:'var(--brand-primary)',color:'white',padding:'10px 12px',borderRadius:'8px 0 0 8px'}}>+254</div>
                <input style={{flex:1,padding:10,border:'1px solid var(--border)',borderRadius:'0 8px 8px 0'}} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="712 847 291" />
              </div>
            </label>

            <label style={{display:'block',marginTop:12}}>Password
              <input type="password" style={{width:'100%',padding:10,marginTop:6,border:'1px solid var(--border)',borderRadius:8}} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" />
            </label>

            {err && <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',padding:10,borderRadius:6,color:'#991B1B',marginTop:12}}>{err}</div>}

            <button className="pc-btn" style={{width:'100%',marginTop:12,height:48}} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
          </form>

          <div style={{textAlign:'center',marginTop:12,fontSize:12,color:'#6B7280'}}>Forgot your password? Contact the PayChain team at <a href="mailto:hello@paychainke.co">hello@paychainke.co</a></div>
        </div>
      </div>
    </div>
  )
}
