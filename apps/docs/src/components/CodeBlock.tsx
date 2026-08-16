import React from "react";
import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/cn";
import CopyButton from "./CopyButton";

interface CodeBlockProps {
  code: string;
  lang?: "bash" | "json" | "js" | "javascript" | "python" | "text";
  label?: string;
  className?: string;
}

export default function CodeBlock({ code, lang = "text", label, className }: CodeBlockProps) {
  const trimmed = code.replace(/^\n/, "").replace(/\n$/, "");

  return (
    <div className={cn("group relative rounded-xl border border-code-border bg-code-bg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-code-border-subtle bg-code-header/60">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-code-faint">
          {label || lang}
        </span>
        <CopyButton text={trimmed} />
      </div>
      <pre className="overflow-x-auto custom-scroll px-4 py-4 text-[13px] leading-6 text-code-text">
        <code
          className="font-mono"
          dangerouslySetInnerHTML={{ __html: highlight(trimmed, lang) }}
        />
      </pre>
    </div>
  );
}
