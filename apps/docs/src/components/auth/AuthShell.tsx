import React from "react";
import { Sun, Moon } from "lucide-react";
import Logo from "@/components/Logo";
import { useTheme } from "@/context/ThemeContext";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="h-14 px-4 lg:px-6 flex items-center border-b border-border-subtle">
        <Logo />
        <button
          onClick={toggleTheme}
          className="ml-auto p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-raised transition-colors"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
