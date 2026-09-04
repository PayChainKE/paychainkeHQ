import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Ban } from "lucide-react";
import Callout from "@/components/Callout";
import CopyButton from "@/components/CopyButton";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";
import { ApiKey, listApiKeys, createApiKey, revokeApiKey } from "@/lib/api";

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ApiKeys() {
  const { developer } = useDeveloperAuth();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [mode, setMode] = useState<"test" | "live">("test");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function load() {
    const res = await listApiKeys();
    if (res.ok) setKeys(res.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await createApiKey({ mode, label: label || undefined });
    setCreating(false);
    if (!res.ok) {
      setError(res.data.error || "Could not create key.");
      return;
    }
    setRevealedKey(res.data.apiKey.key);
    setLabel("");
    load();
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this key? Any integration using it will start failing immediately.")) return;
    await revokeApiKey(id);
    load();
  }

  const liveApproved = developer?.liveAccess?.approved;

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">API keys</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        Test keys work immediately: everything's simulated. Live keys need approval; see{" "}
        <Link to="/dashboard/live-access" className="text-brand hover:text-brand-bright">Live access</Link>.
      </p>

      {revealedKey && (
        <div className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4 mb-6">
          <p className="text-[13.5px] font-semibold text-ink mb-2">Your new key: copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2 rounded-lg bg-code-bg border border-code-border px-3 py-2.5">
            <code className="flex-1 font-mono text-[13px] text-code-text truncate">{revealedKey}</code>
            <CopyButton text={revealedKey} />
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-[12.5px] text-ink-faint hover:text-ink mt-2">
            I've saved it, dismiss
          </button>
        </div>
      )}

      {error && <Callout variant="warning">{error}</Callout>}

      <form onSubmit={handleCreate} className="rounded-xl border border-border bg-surface p-4 mb-8">
        <p className="text-[13px] font-semibold text-ink mb-3">Create a new key</p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block">
            <span className="block text-[12px] font-medium text-ink-faint mb-1.5">Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "test" | "live")}
              className="px-3 py-2 rounded-lg bg-canvas border border-border text-[13.5px] text-ink focus:outline-none focus:border-brand/40"
            >
              <option value="test">Test</option>
              <option value="live" disabled={!liveApproved}>Live {!liveApproved ? "(needs approval)" : ""}</option>
            </select>
          </label>
          <label className="flex-1 min-w-[10rem]">
            <span className="block text-[12px] font-medium text-ink-faint mb-1.5">Label (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="local dev"
              className="w-full px-3 py-2 rounded-lg bg-canvas border border-border text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Create key
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle bg-surface/60">
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Key</th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Mode</th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Last used</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {keys?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-faint">No keys yet, create one above.</td></tr>
            )}
            {keys?.map((k) => (
              <tr key={k._id}>
                <td className="px-4 py-3">
                  <code className="font-mono text-[13px] text-ink">{k.keyPrefix}…</code>
                  {k.label && <span className="block text-[12px] text-ink-faint mt-0.5">{k.label}</span>}
                </td>
                <td className="px-4 py-3 text-[13px] text-ink-muted capitalize">{k.mode}</td>
                <td className="px-4 py-3">
                  <span className={`text-[12px] font-semibold ${k.status === "active" ? "text-brand-bright" : "text-ink-faint"}`}>
                    {k.status === "active" ? "Active" : "Revoked"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ink-faint">{formatDate(k.lastUsedAt)}</td>
                <td className="px-4 py-3 text-right">
                  {k.status === "active" && (
                    <button
                      onClick={() => handleRevoke(k._id)}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-red-500 hover:text-red-400"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
