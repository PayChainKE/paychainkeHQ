import React, { createContext, useContext, useEffect, useState } from "react";

export type CodeLangId = "curl" | "node" | "python" | "php" | "ruby";

const VALID_LANG_IDS: CodeLangId[] = ["curl", "node", "python", "php", "ruby"];

const STORAGE_KEY = "paychain-docs-lang";

interface CodeLangContextValue {
  lang: CodeLangId;
  setLang: (lang: CodeLangId) => void;
}

const CodeLangContext = createContext<CodeLangContextValue | null>(null);

// Global, not per-snippet: pick "Python" once on any code block and every
// other code block on the page (and every page after, via localStorage)
// switches with it — the behavior Stripe/Twilio docs train developers to
// expect, instead of re-picking a language tab-by-tab down the page.
export function CodeLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<CodeLangId>(() => {
    if (typeof window === "undefined") return "curl";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return VALID_LANG_IDS.includes(stored as CodeLangId) ? (stored as CodeLangId) : "curl";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return (
    <CodeLangContext.Provider value={{ lang, setLang: setLangState }}>
      {children}
    </CodeLangContext.Provider>
  );
}

export function useCodeLang() {
  const ctx = useContext(CodeLangContext);
  if (!ctx) throw new Error("useCodeLang must be used within a CodeLangProvider");
  return ctx;
}
