import React from "react";
import { Info, TriangleAlert, Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  info: { icon: Info, cls: "border-sky-500/20 bg-sky-500/[0.06]", iconCls: "text-sky-300" },
  warning: { icon: TriangleAlert, cls: "border-amber-500/20 bg-amber-500/[0.06]", iconCls: "text-amber-300" },
  tip: { icon: Lightbulb, cls: "border-brand/20 bg-brand/[0.06]", iconCls: "text-brand-bright" },
};

export default function Callout({ variant = "info", title, children }: { variant?: keyof typeof VARIANTS; title?: string; children: React.ReactNode }) {
  const { icon: Icon, cls, iconCls } = VARIANTS[variant];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3.5 mb-6", cls)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", iconCls)} />
      <div className="text-[13.5px] leading-6 text-ink-muted">
        {title && <span className="block font-semibold text-ink mb-1">{title}</span>}
        {children}
      </div>
    </div>
  );
}
