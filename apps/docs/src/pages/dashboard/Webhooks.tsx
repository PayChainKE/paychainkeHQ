import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import Callout from "@/components/Callout";
import CopyButton from "@/components/CopyButton";
import {
  Webhook,
  WebhookDelivery,
  listWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
} from "@/lib/api";

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DeliveriesPanel({ webhookId }: { webhookId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);

  useEffect(() => {
    listWebhookDeliveries(webhookId).then((res) => {
      if (res.ok) setDeliveries(res.data.data);
    });
  }, [webhookId]);

  if (!deliveries) return <p className="text-[12.5px] text-ink-faint px-4 py-3">Loading…</p>;
  if (deliveries.length === 0) return <p className="text-[12.5px] text-ink-faint px-4 py-3">No deliveries yet.</p>;

  return (
    <div className="divide-y divide-border-subtle">
      {deliveries.map((d) => (
        <div key={d._id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
          <div className="min-w-0">
            <code className="font-mono text-ink">{d.event}</code>
            <span className="text-ink-faint ml-2">{formatDate(d.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {d.lastResponseCode && <span className="text-ink-faint">HTTP {d.lastResponseCode}</span>}
            <span
              className={
                d.status === "delivered"
                  ? "text-brand-bright font-semibold"
                  : d.status === "exhausted" || d.status === "failed"
                  ? "text-red-500 font-semibold"
                  : "text-amber-500 font-semibold"
              }
            >
              {d.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  async function load() {
    const res = await listWebhooks();
    if (res.ok) {
      setWebhooks(res.data.data);
      setAvailableEvents(res.data.availableEvents);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleEvent(evt: string) {
    setEvents((prev) => {
      if (evt === "*") return ["*"];
      const withoutAll = prev.filter((e) => e !== "*");
      return withoutAll.includes(evt) ? withoutAll.filter((e) => e !== evt) : [...withoutAll, evt];
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await createWebhook({ url, events });
    setCreating(false);
    if (!res.ok) {
      setError(res.data.error || "Could not create webhook.");
      return;
    }
    setRevealedSecret(res.data.webhook.secret);
    setUrl("");
    setEvents(["*"]);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this webhook? PayChain will stop sending it events immediately.")) return;
    await deleteWebhook(id);
    load();
  }

  async function handleTest(id: string) {
    setTestResult((r) => ({ ...r, [id]: "sending…" }));
    const res = await testWebhook(id);
    setTestResult((r) => ({
      ...r,
      [id]: res.ok
        ? `${res.data.delivery.status}${res.data.delivery.lastResponseCode ? ` (HTTP ${res.data.delivery.lastResponseCode})` : ""}`
        : res.data.error || "failed",
    }));
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Webhooks</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        Get notified the instant a payment resolves, instead of polling. Full payload shape and signature
        verification on the <Link to="/webhooks" className="text-brand hover:text-brand-bright">reference page</Link>.
      </p>

      {revealedSecret && (
        <div className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4 mb-6">
          <p className="text-[13.5px] font-semibold text-ink mb-2">Signing secret — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2 rounded-lg bg-code-bg border border-code-border px-3 py-2.5">
            <code className="flex-1 font-mono text-[13px] text-code-text truncate">{revealedSecret}</code>
            <CopyButton text={revealedSecret} />
          </div>
          <button onClick={() => setRevealedSecret(null)} className="text-[12.5px] text-ink-faint hover:text-ink mt-2">
            I've saved it, dismiss
          </button>
        </div>
      )}

      {error && <Callout variant="warning">{error}</Callout>}

      <form onSubmit={handleCreate} className="rounded-xl border border-border bg-surface p-4 mb-8">
        <p className="text-[13px] font-semibold text-ink mb-3">Register an endpoint</p>
        <label className="block mb-3">
          <span className="block text-[12px] font-medium text-ink-faint mb-1.5">URL</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/paychain"
            className="w-full px-3 py-2 rounded-lg bg-canvas border border-border text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40"
          />
        </label>
        <span className="block text-[12px] font-medium text-ink-faint mb-1.5">Events</span>
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button"
            onClick={() => toggleEvent("*")}
            className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
              events.includes("*") ? "bg-brand/10 text-brand-bright border-brand/25" : "bg-canvas text-ink-muted border-border"
            }`}
          >
            All events
          </button>
          {availableEvents.map((evt) => (
            <button
              key={evt}
              type="button"
              onClick={() => toggleEvent(evt)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-mono font-medium border transition-colors ${
                events.includes(evt) ? "bg-brand/10 text-brand-bright border-brand/25" : "bg-canvas text-ink-muted border-border"
              }`}
            >
              {evt}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={creating || !url}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          Add webhook
        </button>
      </form>

      <div className="space-y-3">
        {webhooks?.length === 0 && (
          <p className="text-[13px] text-ink-faint">No webhooks registered yet.</p>
        )}
        {webhooks?.map((w) => (
          <div key={w._id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <code className="font-mono text-[13px] text-ink break-all">{w.url}</code>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {w.events.map((e) => (
                    <span key={e} className="px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle text-[11px] font-mono text-ink-faint">{e}</span>
                  ))}
                  <span className={`text-[11px] font-semibold ml-1 ${w.status === "active" ? "text-brand-bright" : "text-ink-faint"}`}>
                    {w.status}
                  </span>
                </div>
                {testResult[w._id] && <p className="text-[12px] text-ink-faint mt-1.5">Test result: {testResult[w._id]}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => handleTest(w._id)} className="flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink">
                  <Send className="w-3.5 h-3.5" />
                  Test
                </button>
                <button
                  onClick={() => setExpanded(expanded === w._id ? null : w._id)}
                  className="flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink"
                >
                  Deliveries
                  {expanded === w._id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => handleDelete(w._id)} className="text-red-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {expanded === w._id && (
              <div className="border-t border-border-subtle">
                <DeliveriesPanel webhookId={w._id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
