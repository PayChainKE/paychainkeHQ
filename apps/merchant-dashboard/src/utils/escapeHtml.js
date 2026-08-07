// Only needed where merchant-controlled text (e.g. businessName) is
// interpolated into a raw HTML string outside React's JSX (which escapes
// by default) — currently the print-window templates built via
// document.write in MyAccounts.jsx and Wallet.jsx.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}
