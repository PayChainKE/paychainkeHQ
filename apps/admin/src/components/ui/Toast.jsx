import React from 'react';
import { useToast } from '../../context/ToastContext';

export default function ToastHost(){
  const { toasts, dismissToast } = useToast();
  return (
    <div className="pc-toast-host">
      {toasts.map(t=> (
        <div key={t.id} className={`pc-toast pc-toast-${t.type}`}>
          <div className="pc-toast-message">{t.message}</div>
          <button className="pc-toast-close" onClick={()=>dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
