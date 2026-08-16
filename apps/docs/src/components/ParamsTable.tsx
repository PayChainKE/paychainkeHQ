import React from "react";

export interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export default function ParamsTable({ params }: { params: Param[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-6">
      <table className="w-full text-left">
        <tbody className="divide-y divide-border-subtle">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="align-top w-1/3 px-4 py-3 bg-surface/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[13px] text-ink font-semibold">{p.name}</code>
                  <span className="text-[11px] text-ink-faint font-mono">{p.type}</span>
                </div>
                {p.required && (
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-bright">required</span>
                )}
              </td>
              <td className="px-4 py-3 text-[13.5px] leading-6 text-ink-muted">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
