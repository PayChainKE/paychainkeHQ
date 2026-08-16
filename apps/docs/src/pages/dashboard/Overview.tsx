import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Webhook, Store, ShieldCheck, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";
import { getMerchantLinkStatus } from "@/lib/api";

const CARDS = [
  { icon: KeyRound, title: "API keys", desc: "Create and manage test and live keys.", to: "/dashboard/api-keys" },
  { icon: Webhook, title: "Webhooks", desc: "Register endpoints, send test events.", to: "/dashboard/webhooks" },
  { icon: Store, title: "Merchant", desc: "Link the merchant account your keys operate on.", to: "/dashboard/merchant" },
  { icon: ShieldCheck, title: "Live access", desc: "Request approval to move real money.", to: "/dashboard/live-access" },
];

export default function Overview() {
  const { developer } = useDeveloperAuth();
  const [linked, setLinked] = useState<boolean | null>(null);

  useEffect(() => {
    getMerchantLinkStatus().then((res) => {
      if (res.ok) setLinked(res.data.linked);
    });
  }, []);

  if (!developer) return null;

  const steps = [
    { done: true, label: "Create account" },
    { done: developer.isVerified, label: "Verify email" },
    { done: linked === true, label: "Link a merchant account" },
    { done: null, label: "Create a test-mode key and make your first call" },
  ];

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Welcome back{developer.name ? `, ${developer.name.split(" ")[0]}` : ""}</h1>
      <p className="text-[14px] text-ink-muted mb-8">{developer.companyName} · {developer.email}</p>

      <div className="rounded-xl border border-border bg-surface p-4 mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">Setup checklist</p>
        <div className="space-y-2.5">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              {s.done ? (
                <CheckCircle2 className="w-4 h-4 text-brand-bright shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-ink-faint shrink-0" />
              )}
              <span className={s.done ? "text-[13.5px] text-ink" : "text-[13.5px] text-ink-muted"}>{s.label}</span>
            </div>
          ))}
        </div>
        {linked === false && (
          <Link to="/dashboard/merchant" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-bright mt-4">
            Link a merchant account <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-brand/30 hover:bg-surface-raised transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center shrink-0 group-hover:border-brand/30">
                <Icon className="w-4 h-4 text-brand-bright" />
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink flex items-center gap-1">
                  {c.title}
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                </span>
                <span className="block text-[12.5px] text-ink-faint leading-5 mt-0.5">{c.desc}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
