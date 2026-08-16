import React from "react";
import { cn } from "@/lib/cn";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  POST: "bg-brand/10 text-brand-bright border-brand/25",
  PATCH: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-300 border-red-500/20",
};

export default function Endpoint({ method, path, auth }: { method: string; path: string; auth?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 mb-6">
      <span className={cn("shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide", METHOD_STYLES[method] || METHOD_STYLES.GET)}>
        {method}
      </span>
      <code className="font-mono text-[13px] text-ink">{path}</code>
      {auth && (
        <span className="ml-auto text-[11px] font-medium text-ink-faint">{auth}</span>
      )}
    </div>
  );
}
