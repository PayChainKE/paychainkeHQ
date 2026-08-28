// Server-Sent Events fan-out for the merchant dashboard/web app — same
// pattern as utils/adminEventStream.js, but keyed per merchantId rather
// than one flat broadcast-to-everyone Set, since a merchant should only
// ever receive events about their own account. One in-memory Map (this
// process is the only backend instance — no Redis/pub-sub layer exists in
// this codebase, same caveat as the admin version) from merchantId to the
// Set of that merchant's open connections (they may have multiple tabs/
// devices open at once).
const clientsByMerchant = new Map();

// Keeps the connection alive through Render's reverse-proxy idle timeout —
// a ':' comment line is valid SSE and ignored by EventSource, so it never
// reaches app code as a message.
const HEARTBEAT_MS = 20_000;

export function registerMerchantEventClient(merchantId, res) {
  const key = String(merchantId);
  if (!clientsByMerchant.has(key)) clientsByMerchant.set(key, new Set());
  const set = clientsByMerchant.get(key);
  set.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      set.delete(res);
      if (!set.size) clientsByMerchant.delete(key);
    }
  }, HEARTBEAT_MS);

  return function unregister() {
    clearInterval(heartbeat);
    set.delete(res);
    if (!set.size) clientsByMerchant.delete(key);
  };
}

// type is a short event name the frontend can key off of ('transaction',
// 'notification', 'profile') — payload is deliberately kept minimal (never
// the full merchant/transaction document) since it only needs to tell the
// dashboard "something changed, go refetch," not carry the actual data.
export function broadcastMerchantEvent(merchantId, type, payload = {}) {
  if (!merchantId) return;
  const set = clientsByMerchant.get(String(merchantId));
  if (!set || !set.size) return;
  const chunk = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(chunk);
    } catch {
      set.delete(res);
    }
  }
}
