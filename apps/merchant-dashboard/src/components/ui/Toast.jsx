import React from 'react'
import { useToast } from '../../context/ToastContext'

export default function ToastHost(){
  const { toasts } = useToast()
  return (
    <div style={{position:'fixed',right:16,top:16,display:'flex',flexDirection:'column',gap:8,zIndex:60}}>
      {toasts.map(t=> (
        <div key={t.id} style={{background:'white',padding:12,borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}> {t.title || t.message} </div>
      ))}
    </div>
  )
}
