import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([]);

  function showToast(message, type='info', duration= type === 'error' ? 6000 : 4000){
    const id = Date.now() + Math.random();
    const t = { id, message, type };
    setToasts(prev => [...prev.slice(-3), t]); // max 4 visible
    setTimeout(()=> dismissToast(id), duration);
    return id;
  }

  function dismissToast(id){ setToasts(prev => prev.filter(t=>t.id !== id)); }

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(){ return useContext(ToastContext); }

export default ToastContext;
