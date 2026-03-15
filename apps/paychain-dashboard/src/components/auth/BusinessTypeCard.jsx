import React from 'react';

export default function BusinessTypeCard({ title, subtitle, badge, selected, onSelect, icon }) {
  return (
    <button onClick={onSelect} className={`p-6 border rounded-2xl w-full text-left ${selected ? 'border-emerald-400 bg-emerald-600/6' : 'border-white/10'}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl">{icon}</div>
        <div>
          <div className="font-semibold">{title} <span className="text-xs text-slate-300">{badge}</span></div>
          <div className="text-sm text-slate-400 mt-2">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}
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
