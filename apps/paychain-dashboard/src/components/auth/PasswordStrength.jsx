import React from 'react';
import { getPasswordStrength } from '@/hooks/useAuthForm';

export default function PasswordStrength({ password }) {
  const s = getPasswordStrength(password);
  const width = s === 'weak' ? 'w-1/3' : s === 'fair' ? 'w-2/3' : 'w-full';
  const color = s === 'weak' ? 'bg-red-500' : s === 'fair' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-2">
      <div className="h-2 bg-white/5 rounded-xl w-full">
        <div className={`${width} ${color} h-2 rounded-xl`} />
      </div>
      <div className="text-xs mt-1 text-slate-300">Strength: {s}</div>
    </div>
  );
}
