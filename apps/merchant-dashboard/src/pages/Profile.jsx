import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'
import { useToast } from '../context/ToastContext'

export default function Profile(){
  const [name,setName] = useState(mockMerchant.name)
  const [email,setEmail] = useState(mockMerchant.email)
  const toast = useToast()

  async function save(){
    // TODO: PATCH /api/merchant/profile
    await new Promise(r=>setTimeout(r,700))
    toast.push({message:'Profile updated'})
  }

  return (
    <MerchantLayout title="Profile">
      <div style={{display:'flex',gap:16}}>
        <div style={{flex:1,background:'white',padding:12,borderRadius:12}}>
          <h3>Business Information</h3>
          <div>Business: {mockMerchant.businessName}</div>
          <div>Till Number: {mockMerchant.tillNumber}</div>
          <div>Member Since: {mockMerchant.joinedAt}</div>
        </div>

        <div style={{width:420,background:'white',padding:12,borderRadius:12}}>
          <h3>Personal Information</h3>
          <label>Full Name<input value={name} onChange={e=>setName(e.target.value)} style={{width:'100%',padding:8,marginTop:6}}/></label>
          <label style={{display:'block',marginTop:8}}>Email<input value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:8,marginTop:6}}/></label>
          <div style={{marginTop:12}}><button className="pc-btn" onClick={save}>Save Changes</button></div>
        </div>
      </div>
    </MerchantLayout>
  )
}
