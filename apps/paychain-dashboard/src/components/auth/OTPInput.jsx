import React, { useRef } from 'react';

export default function OTPInput({ length = 6, value = '', onChange }) {
  const refs = useRef([]);

  function handleKey(e, i) {
    const v = e.target.value.replace(/[^0-9]/g, '').slice(-1);
    const next = refs.current[i + 1];
    if (v) {
      refs.current[i].value = v;
      if (next) next.focus();
    } else {
      refs.current[i].value = '';
    }
    const joined = refs.current.map((r) => (r ? r.value : '')).join('');
    onChange && onChange(joined);
  }

  return (
    <div className="flex gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          maxLength={1}
          onChange={(e) => handleKey(e, i)}
          className="w-10 h-10 text-center bg-transparent border border-white/20 rounded-md"
        />
      ))}
    </div>
  );
}
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
