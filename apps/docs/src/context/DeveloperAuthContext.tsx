import React, { createContext, useContext, useEffect, useState } from "react";
import { Developer, getMe } from "@/lib/api";

const TOKEN_KEY = "paychain-docs-token";

interface DeveloperAuthContextValue {
  developer: Developer | null;
  token: string | null;
  // Undetermined on first render (haven't checked a stored token yet) —
  // callers gate on this instead of flashing a logged-out state for a
  // frame before the /me check resolves.
  loading: boolean;
  signIn: (token: string, developer: Developer) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const DeveloperAuthContext = createContext<DeveloperAuthContextValue | null>(null);

export function DeveloperAuthProvider({ children }: { children: React.ReactNode }) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setDeveloper(null);
      setLoading(false);
      return;
    }
    const res = await getMe();
    if (res.ok) {
      setDeveloper(res.data.developer);
    } else {
      // Expired/revoked/invalid — same handling for all three: drop the
      // stale session rather than leave the UI claiming to be signed in.
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setDeveloper(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function signIn(newToken: string, newDeveloper: Developer) {
    window.localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setDeveloper(newDeveloper);
  }

  function signOut() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setDeveloper(null);
  }

  return (
    <DeveloperAuthContext.Provider value={{ developer, token, loading, signIn, signOut, refresh }}>
      {children}
    </DeveloperAuthContext.Provider>
  );
}

export function useDeveloperAuth() {
  const ctx = useContext(DeveloperAuthContext);
  if (!ctx) throw new Error("useDeveloperAuth must be used within a DeveloperAuthProvider");
  return ctx;
}
