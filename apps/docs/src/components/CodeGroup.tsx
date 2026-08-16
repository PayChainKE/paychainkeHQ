import React from "react";
import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/cn";
import { useCodeLang, CodeLangId } from "@/context/CodeLangContext";
import CopyButton from "./CopyButton";

export interface CodeGroupTab {
  id: CodeLangId;
  label: string;
  lang: "bash" | "js" | "python";
  code: string;
}

// The multi-language snippet switcher — pick "Node.js" once here and every
// CodeGroup on the page (and every page after, via CodeLangProvider's
// localStorage) switches with it. Falls back to this group's first tab if
// the globally-selected language isn't offered here (e.g. a Node-only
// snippet while "Python" is selected elsewhere).
export default function CodeGroup({ tabs, className }: { tabs: CodeGroupTab[]; className?: string }) {
  const { lang, setLang } = useCodeLang();
  const active = tabs.find((t) => t.id === lang) || tabs[0];
  const trimmed = active.code.replace(/^\n/, "").replace(/\n$/, "");

  return (
    <div className={cn("rounded-xl border border-border bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-raised/60 pr-3">
        <div className="flex items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLang(tab.id)}
              className={cn(
                "px-3.5 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
                tab.id === active.id
                  ? "text-ink border-brand"
                  : "text-ink-faint border-transparent hover:text-ink-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton text={trimmed} />
      </div>
      <pre className="overflow-x-auto custom-scroll px-4 py-4 text-[13px] leading-6">
        <code className="font-mono" dangerouslySetInnerHTML={{ __html: highlight(trimmed, active.lang) }} />
      </pre>
    </div>
  );
}
