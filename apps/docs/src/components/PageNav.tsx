import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { flatNav } from "@/data/nav";

export default function PageNav() {
  const location = useLocation();
  const index = flatNav.findIndex((item) => item.path === location.pathname);
  if (index === -1) return null;

  const prev = flatNav[index - 1];
  const next = flatNav[index + 1];
  if (!prev && !next) return null;

  return (
    <div className="mt-14 pt-6 border-t border-border-subtle flex items-center justify-between gap-4">
      {prev ? (
        <Link to={prev.path} className="group flex-1 max-w-[48%]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Previous</p>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-muted group-hover:text-brand-bright transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {prev.title}
          </p>
        </Link>
      ) : <div />}
      {next ? (
        <Link to={next.path} className="group flex-1 max-w-[48%] text-right ml-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Next</p>
          <p className="flex items-center justify-end gap-1.5 text-[14px] font-semibold text-ink-muted group-hover:text-brand-bright transition-colors">
            {next.title}
            <ArrowRight className="w-3.5 h-3.5" />
          </p>
        </Link>
      ) : <div />}
    </div>
  );
}
