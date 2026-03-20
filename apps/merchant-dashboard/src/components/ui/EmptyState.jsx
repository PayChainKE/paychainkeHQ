import React from 'react'

export default function EmptyState({ title, subtitle, action }){
  return (
    <div style={{textAlign:'center',padding:40,background:'white',borderRadius:12}}>
      <div style={{fontSize:20,fontWeight:600}}>{title}</div>
      {subtitle && <div style={{color:'#6B7280',marginTop:8}}>{subtitle}</div>}
      {action && <div style={{marginTop:12}}>{action}</div>}
    </div>
  )
}
