import React from 'react';

export default function BusinessTypeCard({ title, sub, badge, selected, onSelect }) {
  return (
    <button onClick={onSelect} className={`p-6 rounded-2xl border ${selected? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10'} w-full text-left` }>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-lg">{title}</div>
          <div className="text-sm text-slate-300">{sub}</div>
        </div>
        <div className="text-xs px-2 py-1 rounded-md bg-white/5">{badge}</div>
      </div>
    </button>
  );
}
