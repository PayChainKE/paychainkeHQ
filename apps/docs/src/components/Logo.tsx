import React from "react";
import { Link } from "react-router-dom";
import paychainMark from "@/assets/paychain-mark.png";

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      <img src={paychainMark} alt="" className="h-[22px] w-auto object-contain" />
      <span className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold text-ink tracking-tight">paychain</span>
        <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-widest border-l border-border pl-1.5">docs</span>
      </span>
    </Link>
  );
}
