import React from 'react'

export default function Avatar({ name, size=36 }){
  const initials = name?.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
  return <div style={{width:size,height:size,borderRadius:999,background:'#E6F6EE',color:'#0B4D2E,',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{initials}</div>
}
