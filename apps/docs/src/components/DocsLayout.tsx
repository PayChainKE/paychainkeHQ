import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import PageNav from "./PageNav";
import Footer from "./Footer";

interface TocEntry {
  id: string;
  text: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const headings = Array.from(container.querySelectorAll("h2")) as HTMLElement[];
    const entries: TocEntry[] = headings.map((h) => {
      const id = h.id || slugify(h.textContent || "");
      h.id = id;
      return { id, text: h.textContent || "" };
    });
    setToc(entries);

    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.filter((o) => o.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -70% 0px" }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [location.pathname, children]);

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex max-w-[90rem] mx-auto">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 lg:py-14">
          <div ref={contentRef} className="max-w-prose prose-docs">
            {children}
          </div>
          <div className="max-w-prose">
            <PageNav />
          </div>
        </main>

        {toc.length > 0 && (
          <aside className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto custom-scroll py-14 pr-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">On this page</p>
            <div className="space-y-2 border-l border-border-subtle">
              {toc.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className={`block pl-3 -ml-px text-[12.5px] leading-tight border-l ${
                    activeId === entry.id
                      ? "border-brand text-brand-bright font-medium"
                      : "border-transparent text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  {entry.text}
                </a>
              ))}
            </div>
          </aside>
        )}
      </div>
      <Footer />
    </div>
  );
}
