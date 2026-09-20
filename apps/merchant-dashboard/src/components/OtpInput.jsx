import { useRef, useState } from 'react'

// One-time-code entry: six boxes to look at, ONE real input underneath.
//
// A separate input per digit can't be pasted into or auto-filled: a phone's
// SMS suggestion ("From Messages: 123456") and a paste both deliver the whole
// code to a single field. So the boxes are only a display, and a transparent
// input stretched over them takes the typing, the paste and the autofill.
// The code is a plain string, e.g. '123456'.
export default function OtpInput({ value, onChange, length = 6, autoFocus, disabled, label = 'Verification code' }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, length - 1)

  // Keeps only digits, so "123 456", "G-123456" or a code with a line break
  // all work when pasted. No maxLength on the input on purpose: it would cut
  // a pasted "123 456" to "123 45" before this runs.
  const handleChange = (e) => {
    // A phone's SMS suggestion or an IME hands over the whole code in one go,
    // often landing after digits already typed. That chunk is the new code.
    const chunk = String(e.nativeEvent.data || '').replace(/\D/g, '')
    if (chunk.length >= 2) return onChange(chunk.slice(0, length))
    // Otherwise it is typing or deleting. A digit typed on a full code is ignored.
    onChange(e.target.value.replace(/\D/g, '').slice(0, length))
  }

  // A pasted code replaces whatever is there, instead of being tacked on to
  // the end of an old, wrong one.
  const handlePaste = (e) => {
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '')
    if (digits.length < 2) return
    e.preventDefault()
    onChange(digits.length > length ? digits.slice(0, length) : digits)
  }

  // A plain tap puts the caret at the end, so the next digit can't land in
  // the middle. A selected range (select all, then delete or paste) is left
  // alone.
  const pinCaret = (e) => {
    const el = e.target
    if (el.selectionStart === el.selectionEnd) el.setSelectionRange(el.value.length, el.value.length)
  }

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-center gap-2 lg:gap-3" aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const digit = value[i] || ''
          const isActive = focused && !disabled && i === active
          return (
            <div
              key={i}
              className={`
                w-10 h-12 lg:w-12 lg:h-14 rounded-xl flex items-center justify-center font-black text-xl lg:text-2xl
                transition-all duration-200 select-none
                ${digit
                  ? 'bg-emerald-400 text-[#06201B] shadow-[0_0_20px_rgba(52,211,153,0.4)] scale-105'
                  : isActive
                    ? 'bg-white/15 border border-emerald-400/60 shadow-[0_0_0_3px_rgba(52,211,153,0.15)] text-white/20'
                    : 'bg-white/8 text-white/20 border border-white/10'}
              `}
            >
              {digit}
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={(e) => { setFocused(true); pinCaret(e) }}
        onBlur={() => setFocused(false)}
        onSelect={pinCaret}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text caret-transparent"
      />
    </div>
  )
}
