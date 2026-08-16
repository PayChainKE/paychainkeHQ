// Global "sync" event bus — dispatching 'paychain:sync' tells every page
// currently listening (see Header.jsx's manual Sync button, and the live
// SSE push in context/AuthContext.jsx) to re-fetch its own data. Kept in
// its own module (rather than living inside Header.jsx, where it
// originated) so both Header.jsx and AuthContext.jsx can import it without
// creating a circular dependency between the two.
export function triggerSync() {
  window.dispatchEvent(new CustomEvent('paychain:sync'));
}
