// Same base-URL convention as apps/checkout: an env override takes
// priority, localhost falls through to Vite's /api proxy (see
// vite.config.ts), everything else hits the real API domain directly.
function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "";

  return "https://api.paychain.co.ke";
}

const API_BASE_URL = getBaseUrl();

export interface Developer {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string | null;
  status: "pending_verification" | "active" | "suspended";
  isVerified: boolean;
  liveAccess: { approved: boolean; requestedAt: string | null; approvedAt: string | null };
  createdAt: string;
  lastLogin: string | null;
}

export interface ApiKey {
  _id: string;
  mode: "test" | "live";
  keyPrefix: string;
  label: string | null;
  status: "active" | "revoked";
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface Webhook {
  _id: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
}

export interface WebhookDelivery {
  _id: string;
  event: string;
  status: "pending" | "delivered" | "failed" | "exhausted";
  attempts: number;
  lastResponseCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string; code?: string } }> {
  const token = window.localStorage.getItem("paychain-docs-token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// --- Auth (public) ---

export function registerDeveloper(body: { name: string; companyName: string; email: string; phone?: string; password: string }) {
  return request<{ success: boolean; message: string; email: string }>("/api/auth/developer/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyDeveloperOtp(body: { email: string; otp: string }) {
  return request<{ success: boolean; developer: Developer; token: string }>("/api/auth/developer/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resendDeveloperOtp(body: { email: string }) {
  return request<{ success: boolean; message: string }>("/api/auth/developer/resend-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function loginDeveloper(body: { email: string; password: string }) {
  return request<{ success: boolean; developer: Developer; token: string }>("/api/auth/developer/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function logoutDeveloper() {
  return request<{ success: boolean }>("/api/developer/logout", { method: "POST" });
}

// --- Account (private) ---

export function getMe() {
  return request<{ success: boolean; developer: Developer }>("/api/developer/me");
}

export function requestLiveAccess() {
  return request<{ success: boolean; message: string }>("/api/developer/live-access/request", { method: "POST" });
}

// --- API keys (private) ---

export function listApiKeys() {
  return request<{ success: boolean; data: ApiKey[] }>("/api/developer/api-keys");
}

export function createApiKey(body: { mode: "test" | "live"; label?: string }) {
  return request<{ success: boolean; apiKey: ApiKey & { key: string } }>("/api/developer/api-keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function revokeApiKey(id: string) {
  return request<{ success: boolean; apiKey: ApiKey }>(`/api/developer/api-keys/${id}/revoke`, { method: "PATCH" });
}

// --- Merchant linking (private) ---

export function startMerchantLink(body: { merchantEmail: string; merchantPassword: string }) {
  return request<{ success: boolean; message: string }>("/api/developer/link-merchant/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyMerchantLink(body: { merchantEmail: string; otp: string }) {
  return request<{ success: boolean; linkedMerchant: { merchantId: string; businessName: string; linkedAt: string } }>(
    "/api/developer/link-merchant/verify",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function getMerchantLinkStatus() {
  return request<{ success: boolean; linked: boolean; merchant?: { businessName: string; email: string }; linkedAt?: string }>(
    "/api/developer/link-merchant/status"
  );
}

// --- Webhooks (private) ---

export function listWebhooks() {
  return request<{ success: boolean; data: Webhook[]; availableEvents: string[] }>("/api/developer/webhooks");
}

export function createWebhook(body: { url: string; events: string[] }) {
  return request<{ success: boolean; webhook: Webhook & { secret: string } }>("/api/developer/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWebhook(id: string, body: { url?: string; events?: string[]; status?: "active" | "disabled" }) {
  return request<{ success: boolean; webhook: Webhook }>(`/api/developer/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteWebhook(id: string) {
  return request<{ success: boolean }>(`/api/developer/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id: string) {
  return request<{ success: boolean; delivery: { _id: string; status: string; lastResponseCode: number | null; lastError: string | null } }>(
    `/api/developer/webhooks/${id}/test`,
    { method: "POST" }
  );
}

export function listWebhookDeliveries(id: string) {
  return request<{ success: boolean; data: WebhookDelivery[] }>(`/api/developer/webhooks/${id}/deliveries`);
}
