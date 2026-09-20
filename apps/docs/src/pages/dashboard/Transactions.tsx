import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import { DeveloperPayment, listPayments } from "@/lib/api";
import { cn } from "@/lib/cn";

const STATUS_CLS: Record<string, string> = {
  success: "bg-brand/10 text-brand-bright border-brand/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function who(p: DeveloperPayment) {
  const c = p.counterparty || {};
  return c.phone || c.accountNumber || c.paybillNumber || c.tillNumber || "";
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-ink focus:outline-none focus:border-brand/50"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export default function Transactions() {
  const [mode, setMode] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DeveloperPayment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let live = true;
    setError(null);
    listPayments({ mode, kind, status, q: term, page, limit: 20 }).then((res) => {
      if (!live) return;
      if (!res.ok) { setError(res.data.error || "Could not load transactions."); setRows([]); return; }
      setRows(res.data.data); setTotal(res.data.total); setPages(res.data.pages);
    });
    return () => { live = false; };
  }, [mode, kind, status, term, page]);

  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Transactions</h1>
      <p className="text-[14px] text-ink-muted mb-6">Every collection and payout made with your API keys, in test and live mode.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference or payment id"
            className="w-full h-9 rounded-lg border border-border bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/50"
          />
        </div>
        <Select label="Mode" value={mode} onChange={reset(setMode)} options={[["", "All modes"], ["live", "Live"], ["test", "Test"]]} />
        <Select label="Type" value={kind} onChange={reset(setKind)} options={[["", "All types"], ["collect", "Collections"], ["payout", "Payouts"]]} />
        <Select label="Status" value={status} onChange={reset(setStatus)} options={[["", "Any status"], ["success", "Successful"], ["pending", "Pending"], ["failed", "Failed"]]} />
      </div>

      {error && <p className="text-[13px] text-red-500 mb-3">{error}</p>}

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {rows === null ? (
          <p className="text-[13px] text-ink-faint px-4 py-6">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-semibold text-ink mb-1">{mode || kind || status || term ? "Nothing matches those filters" : "No transactions yet"}</p>
            {!(mode || kind || status || term) && (
              <p className="text-[13px] text-ink-faint">
                Make a call with a test key and it shows up here. Start with the <Link to="/quickstart" className="text-brand-bright font-semibold hover:underline">Quickstart</Link>.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {rows.map((p) => {
              const isOpen = open === p.id;
              const In = p.kind === "collect" ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={p.id}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-raised transition-colors">
                    <span className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", p.kind === "collect" ? "bg-brand/10 border-brand/20 text-brand-bright" : "bg-surface-raised border-border text-ink-muted")}>
                      <In className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink truncate">{p.reference || (p.kind === "collect" ? "Collection" : "Payout")}</span>
                      <span className="block text-[12px] text-ink-faint truncate">{formatDate(p.createdAt)}{who(p) ? ` · ${who(p)}` : ""}</span>
                    </span>
                    {p.mode === "test" && <span className="hidden sm:inline text-[10.5px] font-bold uppercase tracking-wider text-ink-faint border border-border rounded px-1.5 py-0.5">Test</span>}
                    <span className="text-[13.5px] font-semibold text-ink tabular-nums">{p.currency} {p.amount.toLocaleString()}</span>
                    <span className={cn("text-[11.5px] font-semibold border rounded-full px-2 py-0.5 capitalize", STATUS_CLS[p.status])}>{p.status}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-surface-raised/50 text-[12.5px] grid sm:grid-cols-2 gap-x-6 gap-y-2">
                      <div><span className="text-ink-faint">Payment id</span><div className="flex items-center gap-1.5"><code className="font-mono text-ink break-all">{p.id}</code><CopyButton text={p.id} /></div></div>
                      <div><span className="text-ink-faint">Mode</span><div className="text-ink capitalize">{p.mode}{p.origin === "admin_test" ? " · PayChain check" : ""}</div></div>
                      <div><span className="text-ink-faint">Type</span><div className="text-ink capitalize">{p.kind}</div></div>
                      <div><span className="text-ink-faint">Updated</span><div className="text-ink">{formatDate(p.updatedAt)}</div></div>
                      {p.failureReason && <div className="sm:col-span-2"><span className="text-ink-faint">Why it failed</span><div className="text-red-500">{p.failureReason}</div></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-[12.5px] text-ink-faint">
          <span>{total.toLocaleString()} transaction{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-surface-raised" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 tabular-nums">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-surface-raised" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
