import React from 'react'

export default function Modal({ children, open, onClose }){
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:80}}>
      <div style={{background:'white',borderRadius:12,padding:20,maxWidth:720,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.14)'}}>
        <button onClick={onClose} style={{float:'right',background:'transparent',border:0}}>✕</button>
        <div style={{clear:'both'}}>{children}</div>
      </div>
    </div>
  )
}
