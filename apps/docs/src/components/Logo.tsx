import React from "react";
import { Link } from "react-router-dom";

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <path d="M16 6 C21.5 6 26 10.5 26 16 C26 21.5 21.5 26 16 26 L16 6 Z" fill="#00bf63" />
        <path d="M16 6 L9 26" stroke="#08090a" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold text-ink tracking-tight">paychain</span>
        <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-widest border-l border-border pl-1.5">docs</span>
      </span>
    </Link>
  );
}
