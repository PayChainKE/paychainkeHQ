import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export default function FormField({ label, hint, id, type, ...props }: FormFieldProps) {
  const fieldId = id || props.name;
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={fieldId} className="block mb-4">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      <div className="relative">
        <input
          id={fieldId}
          type={isPassword ? (visible ? "text" : "password") : type}
          {...props}
          className={`w-full px-3 py-2 ${isPassword ? "pr-10" : ""} rounded-lg bg-surface border border-border text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <span className="block text-[12px] text-ink-faint mt-1.5">{hint}</span>}
    </label>
  );
}
