import React, { useState } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { KeyRound, Webhook, Store, ShieldCheck, LayoutGrid, LogOut, X } from "lucide-react";
import Topbar from "@/components/Topbar";
import { cn } from "@/lib/cn";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";
import { logoutDeveloper } from "@/lib/api";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
  { to: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/dashboard/merchant", label: "Merchant", icon: Store },
  { to: "/dashboard/live-access", label: "Live access", icon: ShieldCheck },
];

function DashboardNav({ onNavigate, developer, onSignOut }: { onNavigate?: () => void; developer: { companyName: string; email: string }; onSignOut: () => void }) {
  const initial = developer.companyName?.trim()?.[0]?.toUpperCase() || "?";
  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2.5 px-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-brand-bright">{initial}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink truncate">{developer.companyName}</p>
          <p className="text-[12px] text-ink-faint truncate">{developer.email}</p>
        </div>
      </div>
      <nav className="space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 -ml-px rounded-r-md border-l-2 text-[13.5px] font-medium transition-colors",
                  isActive ? "border-brand bg-brand/10 text-brand-bright" : "border-transparent text-ink-muted hover:text-ink hover:bg-surface-raised"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <button
        onClick={onSignOut}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13.5px] font-medium text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors mt-6 w-full"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { developer, loading, signOut } = useDeveloperAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen bg-canvas" />;
  }
  if (!developer) {
    return <Navigate to="/login" replace />;
  }

  async function handleSignOut() {
    await logoutDeveloper();
    signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex max-w-[90rem] mx-auto">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-border-subtle sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <DashboardNav developer={developer} onSignOut={handleSignOut} />
        </aside>

        <div className={cn("fixed inset-0 z-40 lg:hidden transition-all duration-200", mobileOpen ? "opacity-100 visible" : "opacity-0 invisible")}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div
            className={cn(
              "absolute top-0 left-0 h-full w-72 bg-canvas border-r border-border-subtle overflow-y-auto transition-transform duration-200",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex items-center justify-end px-4 py-3 border-b border-border-subtle">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-ink-faint hover:text-ink" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <DashboardNav developer={developer} onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>

        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 lg:py-14 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
