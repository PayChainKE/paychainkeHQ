import React, { useState } from 'react'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/MerchantLayout'

function strength(password){
  let score=0
  if (password.length>=8) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

export default function SetPassword(){
  const { setNewPassword } = useMerchantAuth()
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e){
    e.preventDefault()
    if (pass !== confirm) return alert('Passwords do not match')
    if (strength(pass) < 3) return alert('Password not strong enough')
    setLoading(true)
    await setNewPassword(pass)
    setLoading(false)
    alert('Password set!')
    nav('/overview')
  }

  const s = strength(pass)
  const labels = ['Weak','Fair','Good','Strong']

  return (
    <Layout>
      <div style={{maxWidth:480,margin:'40px auto',background:'white',padding:32,borderRadius:16}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:32,color:'var(--brand-accent)'}}>🔒</div>
          <h2>Set your password</h2>
          <p style={{color:'#6B7280'}}>Welcome. You must set a new password before accessing your dashboard.</p>
        </div>

        <div style={{marginTop:20,background:'var(--brand-accent-light)',padding:12,borderRadius:8}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:36,height:36,borderRadius:999,background:'#E6F6EE',display:'flex',alignItems:'center',justifyContent:'center'}}>JK</div>
            <div>
              <div style={{fontWeight:600}}>James Kamau</div>
              <div style={{fontSize:12,color:'#6B7280'}}>Kamau General Store</div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{marginTop:16}}>
          <label>New Password
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%',padding:10,marginTop:6,borderRadius:8,border:'1px solid var(--border)'}} />
          </label>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            {[0,1,2,3].map(i=> <div key={i} style={{flex:1,height:6,background:i<=s-1? (s<3? '#F59E0B':'#22C55E'):'#EEE',borderRadius:4}} />)}</div>
          <div style={{fontSize:12,color:'#6B7280',marginTop:6}}>{labels[Math.max(0,s-1)] || 'Weak'}</div>

          <label style={{display:'block',marginTop:12}}>Confirm New Password
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={{width:'100%',padding:10,marginTop:6,borderRadius:8,border:'1px solid var(--border)'}} />
          </label>

          <button className="pc-btn" style={{width:'100%',marginTop:16,height:48}} disabled={loading || s<3 || pass!==confirm}>{loading?'Setting password...':'Set Password & Continue →'}</button>
          <div style={{fontSize:11,color:'#6B7280',textAlign:'center',marginTop:10}}>Your password is encrypted and never stored in plain text.</div>
        </form>
      </div>
    </Layout>
  )
}
