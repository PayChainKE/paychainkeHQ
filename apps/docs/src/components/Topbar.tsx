import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Menu, Search, ArrowUpRight, Sun, Moon, LifeBuoy } from "lucide-react";
import Logo from "./Logo";
import { flatNav } from "@/data/nav";
import { useTheme } from "@/context/ThemeContext";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { developer, loading } = useDeveloperAuth();

  const results = query.trim()
    ? flatNav.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function go(path: string) {
    navigate(path);
    setQuery("");
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border-subtle bg-canvas/85 backdrop-blur-md">
      <div className="h-full px-4 lg:px-6 flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 -ml-1.5 text-ink-muted hover:text-ink" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>

        <Logo />

        <div ref={containerRef} className="relative flex-1 max-w-sm ml-2 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && results[0]) go(results[0].path); }}
            placeholder="Search docs…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
          />

          {open && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full rounded-lg border border-border bg-surface-raised shadow-2xl shadow-black/50 overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.path}
                  onClick={() => go(r.path)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-surface transition-colors border-b border-border-subtle last:border-0"
                >
                  <p className="text-[13px] font-semibold text-ink">{r.title}</p>
                  <p className="text-[11.5px] text-ink-faint truncate">{r.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="ml-auto p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-raised transition-colors"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <Link
          to="/help"
          className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          Help
        </Link>

        <a
          href="https://paychain.co.ke"
          className="hidden md:inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors"
        >
          paychain.co.ke
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>

        {!loading && (
          developer ? (
            <Link
              to="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/25 text-[13px] font-semibold text-brand-bright hover:bg-brand/15 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="inline-flex text-[13px] font-medium text-ink-muted hover:text-ink transition-colors">
                Sign in
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-lg bg-brand text-white text-[13px] font-semibold shadow-sm shadow-brand/30 hover:bg-brand-dim hover:shadow-md hover:shadow-brand/30 transition-all"
              >
                Sign up
              </Link>
            </div>
          )
        )}
      </div>
    </header>
  );
}
