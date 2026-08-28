import React from 'react';
import { useToast } from '../../context/ToastContext';

// Was rendering with the undefined `pc-toast*` class names — no CSS
// anywhere in this app ever defined them, so every toast (this app-wide,
// not just one feature) rendered as unstyled, unpositioned text wherever
// <ToastHost/> happened to sit in the document — effectively invisible in
// practice. Fixed-position stack, bottom-right, styled with this app's
// existing Tailwind theme tokens instead.
const TYPE_STYLE = {
  success: 'bg-primary text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-on-surface text-white',
};

export default function ToastHost(){
  const { toasts, dismissToast } = useToast();
  return (
    <div className="fixed bottom-5 right-5 z-9999 flex flex-col gap-2 w-[calc(100vw-2.5rem)] max-w-sm">
      {toasts.map(t=> (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-editorial font-body text-sm font-semibold ${TYPE_STYLE[t.type] || TYPE_STYLE.info}`}
        >
          <div className="flex-1 leading-snug">{t.message}</div>
          <button
            className="shrink-0 text-white/70 hover:text-white text-lg leading-none"
            onClick={()=>dismissToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
