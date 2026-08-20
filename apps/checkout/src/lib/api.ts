// Same base-URL convention as the other PayChain frontends: an env override
// takes priority, localhost falls through to Vite's /api proxy (see
// vite.config.ts), everything else hits the real API domain directly.
function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "";

  return "https://api.paychain.co.ke";
}

const API_BASE_URL = getBaseUrl();

export interface CheckoutSession {
  id: string;
  mode: "test" | "live";
  amount: number;
  currency: string;
  description: string | null;
  reference: string | null;
  status: "pending" | "processing" | "success" | "expired";
  merchantName: string;
  prefillPhone: string | null;
  qrCodeDataUri: string;
}

export interface CheckoutStatus {
  status: "pending" | "processing" | "success" | "expired";
  failureReason: string | null;
  callbackUrl: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function fetchCheckoutSession(id: string) {
  return request<{ success: boolean; session: CheckoutSession }>(`/api/public/checkout/${id}`);
}

export function payCheckoutSession(id: string, phone: string) {
  return request<{ success: boolean }>(`/api/public/checkout/${id}/pay`, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function fetchCheckoutStatus(id: string) {
  return request<{ success: boolean } & CheckoutStatus>(`/api/public/checkout/${id}/status`);
}
