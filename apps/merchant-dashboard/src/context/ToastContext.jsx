import React, { createContext, useContext, useState } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])
  function push(t){ const id = `t_${Date.now()}`; setToasts(s=>[...s,{id,...t}]); setTimeout(()=>setToasts(s=>s.filter(x=>x.id!==id)),4000)}
  const addToast = push
  return <ToastContext.Provider value={{ toasts, push, addToast }}>{children}</ToastContext.Provider>
}

export function useToast(){ return useContext(ToastContext) }

export default ToastContext
