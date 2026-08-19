// Shared across every controller that responds to caught exceptions
// directly (bypassing server.js's global error handler, which only redacts
// in production for errors that reach it via next(err)) — without this,
// raw internal exception text (library internals, occasionally a fragment
// of a DB error) gets sent straight to the client regardless of
// environment. Originally written for bulkPayController.js during a
// security review of that flow; promoted here so every controller with the
// same `res.status(500).json({ error: err.message })` pattern can share it
// instead of leaving each one to redact independently (or not at all).
//
// Logs the full detail server-side always, and only echoes error.message
// back to the client outside production.
export function serverError(res, status, publicMessage, error, logPrefix) {
  console.error(logPrefix || publicMessage, error);
  const body = { error: publicMessage };
  if (process.env.NODE_ENV !== 'production') {
    body.detail = error?.message || String(error);
  }
  return res.status(status).json(body);
}
