import React, { useRef } from 'react';

export default function OTPInput({ length = 6, value = '', onChange }) {
  const refs = useRef([]);

  function handleChange(i, v) {
    const next = value.split('').slice(0, length);
    next[i] = v.replace(/[^0-9]/g, '').slice(-1) || '';
    onChange(next.join(''));
    if (v && refs.current[i + 1]) refs.current[i + 1].focus();
  }

  return (
    <div className="flex gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          className="w-10 h-12 text-center rounded-xl bg-white/5 border border-white/15"
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
        />
      ))}
    </div>
  );
}
