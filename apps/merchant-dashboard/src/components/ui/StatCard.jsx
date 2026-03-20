import React from 'react'
export default function StatCard({ title, value, hint }){
  return (
    <div className="stat-card">
      <div style={{fontSize:12,color:'#6B7280'}}>{title}</div>
      <div style={{fontSize:20,fontWeight:700,marginTop:6}}>{value}</div>
      {hint && <div style={{fontSize:12,color:'#9CA3AF',marginTop:6}}>{hint}</div>}
    </div>
  )
}
