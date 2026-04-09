import React from 'react'

export default function StatCard({ title, value, hint, isPrimary = false }) {
  return (
    <div className={`
      flex-1 min-w-[200px] p-8 rounded-[24px] editorial-shadow transition-all duration-300 group cursor-default
      ${isPrimary 
        ? 'bg-[#0b4d2e] text-white border-b-[6px] border-transparent hover:border-[#86f8c9]' 
        : 'bg-white border-b-[6px] border-transparent hover:border-[#00351d]'}
    `}>
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${isPrimary ? 'text-white/60' : 'text-on-surface-variant'}`}>
        {title}
      </p>
      <p className={`font-headline text-[28px] leading-none ${isPrimary ? 'text-white' : 'text-primary'}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-[11px] mt-2 font-medium tracking-tight ${isPrimary ? 'text-[#86f8c9]' : 'text-on-surface-variant'}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
