import React from 'react';

// Each reason completes the sentence the merchant reads, so presets and custom
// text stay grammatical: "...temporarily paused due to ___."
export const DEFAULT_REASON = 'scheduled system maintenance';
export const NCBA_REASON = 'system maintenance being done by our banking partner, NCBA';
const PRESETS = [
  DEFAULT_REASON,
  NCBA_REASON,
  'a scheduled system upgrade',
  'a planned service update',
  'a temporary service interruption',
];
const CUSTOM = '__custom';
const MAX_LENGTH = 160;

export default function InboundBlockReasonPicker({ value, onChange }) {
  const [custom, setCustom] = React.useState(!PRESETS.includes(value));
  const inputClass = 'w-full px-3 py-2 text-sm border border-outline-variant/40 rounded-lg bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

  return (
    <div className="mb-4">
      <label htmlFor="inbound-block-reason" className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70 mb-1.5">Reason shown to merchants</label>
      <select
        id="inbound-block-reason"
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          const isCustom = e.target.value === CUSTOM;
          setCustom(isCustom);
          onChange(isCustom ? '' : e.target.value);
        }}
        className={inputClass}
      >
        {PRESETS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        <option value={CUSTOM}>Write my own…</option>
      </select>
      {custom && (
        <input
          type="text"
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. end-of-year system maintenance"
          aria-label="Custom reason"
          className={`${inputClass} mt-2`}
        />
      )}
      <p className="text-[12px] text-on-surface-variant mt-2">
        Merchants will read: "Payment collection on your PayChain account is temporarily paused due to <strong>{value.trim() || DEFAULT_REASON}</strong>."
      </p>
    </div>
  );
}
