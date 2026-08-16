import React from "react";
import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { nav } from "@/data/nav";
import { cn } from "@/lib/cn";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="px-4 py-6 space-y-7">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="px-2 mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-faint">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "block px-2.5 py-1.5 rounded-md text-[13.5px] font-medium transition-colors",
                    isActive
                      ? "bg-brand/10 text-brand-bright"
                      : "text-ink-muted hover:text-ink hover:bg-surface-raised"
                  )
                }
              >
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="hidden lg:block w-60 shrink-0 border-r border-border-subtle sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto custom-scroll">
        <SidebarContent />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-all duration-200",
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div
          className={cn(
            "absolute top-0 left-0 h-full w-72 bg-canvas border-r border-border-subtle overflow-y-auto custom-scroll transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-end px-4 py-3 border-b border-border-subtle">
            <button onClick={onClose} className="p-1.5 text-ink-faint hover:text-ink" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <SidebarContent onNavigate={onClose} />
        </div>
      </div>
    </>
  );
}
