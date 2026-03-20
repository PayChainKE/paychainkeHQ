import React from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'

export default function Support(){
  return (
    <MerchantLayout title="Support">
      <div style={{maxWidth:800,margin:20,background:'white',padding:16,borderRadius:12}}>
        <h3>Support</h3>
        <p>If you need help, email <a href="mailto:hello@paychainke.co">hello@paychainke.co</a> or use the chat widget (coming soon).</p>
        <p style={{fontSize:13,color:'#6B7280'}}>For urgent payments issues contact your onboarding officer.</p>
      </div>
    </MerchantLayout>
  )
}
