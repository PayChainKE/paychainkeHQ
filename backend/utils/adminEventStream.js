// Server-Sent Events fan-out for the admin dashboard. One in-memory Set of
// open connections — this process is the only backend instance (no Redis/
// pub-sub layer exists in this codebase), so a plain Set is the whole
// implementation. Every admin browser tab that's logged in holds one
// connection open; broadcastAdminEvent writes to all of them at once.
const clients = new Set();

// Keeps the connection alive through Render's reverse-proxy idle timeout —
// a ':' comment line is valid SSE and ignored by EventSource, so it never
// reaches app code as a message.
const HEARTBEAT_MS = 20_000;

export function registerAdminEventClient(res) {
  clients.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, HEARTBEAT_MS);

  return function unregister() {
    clearInterval(heartbeat);
    clients.delete(res);
  };
}

export function broadcastAdminEvent(type, payload) {
  const chunk = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(chunk);
    } catch {
      clients.delete(res);
    }
  }
}
