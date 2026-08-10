import { useState } from 'react';
import { formatters, validators, inputAttrs } from '../utils/validators';

/**
 * Drop-in replacement for <input>. Pass `kind="phoneKE"` (etc.) to get
 * keystroke-level filtering + on-blur validation message.
 *
 * Props:
 *   - kind: validator key (phoneKE, kraPin, email, …)
 *   - value, onChange (controlled)
 *   - optional: when true, empty value is considered valid
 *   - errorClassName: override default error text styling
 *   - className: applied to <input>; red border auto-added on error
 *   - All other props are forwarded to <input>
 */
export function ValidatedInput({
  kind,
  value,
  onChange,
  optional = false,
  className = '',
  errorClassName,
  onBlur,
  ...rest
}) {
  const [touched, setTouched] = useState(false);

  const format = formatters[kind];
  const validate = validators[kind];
  const attrs = inputAttrs[kind] || {};

  function handleChange(e) {
    const raw = e.target.value;
    const next = format ? format(raw) : raw;
    if (next === value) return;
    onChange?.({ ...e, target: { ...e.target, value: next } });
  }

  function handleBlur(e) {
    setTouched(true);
    onBlur?.(e);
  }

  const isEmpty = !value;
  const result = touched && (!isEmpty || !optional) ? validate(value) : { valid: true };
  const showError = touched && !result.valid;

  return (
    <>
      <input
        {...attrs}
        {...rest}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${className} ${showError ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
        aria-invalid={showError || undefined}
      />
      {showError && (
        <p className={errorClassName || 'text-red-600 text-[11px] font-bold mt-1.5 pl-1'}>{result.error}</p>
      )}
    </>
  );
}
