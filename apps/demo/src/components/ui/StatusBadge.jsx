import React from 'react'
export default function StatusBadge({ children, color='green' }){
  const bg = color==='green' ? 'rgba(34,197,94,0.1)' : color==='amber' ? '#FFFBEB' : '#FEE2E2'
  const col = color==='green' ? '#16A34A' : color==='amber' ? '#D97706' : '#DC2626'
  return <span style={{background:bg,color:col,padding:'6px 8px',borderRadius:999,fontSize:12,fontWeight:600}}>{children}</span>
}
