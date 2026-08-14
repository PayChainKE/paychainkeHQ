import { useRef } from 'react'

// 4 individual PIN boxes — same premium feel as the OTP entry. Shared across
// any flow that needs a boxed 4-digit PIN entry (SendMoney, Pay Bills, ...).
// `loading` bounces the filled boxes (staggered, like a dot loader) while a
// PIN-verify request is in flight, and locks them against further edits.
export default function PinBoxes({ value, onChange, autoFocus, loading }) {
  const refs = useRef([])

  const handleChange = (e, i) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const arr = value.split('')
    arr[i] = digit
    const next = arr.join('').slice(0, 4)
    onChange(next)
    if (digit && i < 3) refs.current[i + 1]?.focus()
  }

  const handleKey = (e, i) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const arr = value.split('')
        arr[i] = ''
        onChange(arr.join(''))
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
      }
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted) {
      onChange(pasted.padEnd(4, '').slice(0, 4))
      refs.current[Math.min(pasted.length, 3)]?.focus()
    }
    e.preventDefault()
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={value[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={e => e.target.select()}
          disabled={loading}
          style={loading ? { animationDelay: `${i * 120}ms` } : undefined}
          className={`
            w-14 h-16 rounded-2xl text-center font-black text-2xl outline-none transition-all duration-200
            ${value[i]
              ? `bg-[#00351D] text-white shadow-[0_0_20px_rgba(0,53,29,0.4)] ${loading ? 'animate-bounce' : 'scale-105'}`
              : 'bg-slate-100 border-2 border-slate-200 text-slate-400 focus:border-[#00351D] focus:bg-white focus:shadow-md'}
          `}
        />
      ))}
    </div>
  )
}
