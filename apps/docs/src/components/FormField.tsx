import React from "react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export default function FormField({ label, hint, id, ...props }: FormFieldProps) {
  const fieldId = id || props.name;
  return (
    <label htmlFor={fieldId} className="block mb-4">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      <input
        id={fieldId}
        {...props}
        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
      />
      {hint && <span className="block text-[12px] text-ink-faint mt-1.5">{hint}</span>}
    </label>
  );
}
