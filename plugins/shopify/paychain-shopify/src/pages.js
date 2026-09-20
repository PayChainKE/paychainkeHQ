// The one page a customer sees. Plain HTML, no scripts, no external assets.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MESSAGES = {
  notfound: 'We could not find an order matching those details. Check the order number and the email or phone you used at checkout.',
  cancelled: 'That order has been cancelled, so it can no longer be paid.',
  currency: 'This order cannot be paid with M-PESA. Please contact the shop.',
  not_mpesa: 'That order was not placed with M-PESA. Please contact the shop.',
  amount: 'This order total cannot be paid with M-PESA. Please contact the shop.',
  unavailable: 'We could not start the M-PESA payment just now. Please try again in a minute, or contact the shop.',
  review: 'Your payment was received but the order needs a quick manual check. The shop will confirm it shortly.',
  limit: 'Too many attempts. Please wait a few minutes and try again.',
};
export const messageFor = (code) => MESSAGES[code] || MESSAGES.unavailable;

export function layout(title, body, shopName) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f5;color:#14211b;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
main{width:100%;max-width:420px;background:#fff;border:1px solid #dfe6e2;border-radius:14px;padding:28px}
h1{font-size:20px;margin:0 0 4px}p{margin:8px 0;color:#43524a}small{color:#6b7a72}
label{display:block;font-weight:600;font-size:14px;margin:16px 0 6px}
input{width:100%;padding:11px 12px;border:1px solid #c5d0ca;border-radius:9px;font:inherit}input:focus{outline:2px solid #1f9d63;border-color:#1f9d63}
button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:9px;background:#1f9d63;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.err{background:#fdecec;color:#8a1f1f;border-radius:9px;padding:10px 12px;margin:14px 0 0;font-size:14px}.ok{background:#e7f6ee;color:#14603d;border-radius:9px;padding:10px 12px;margin:14px 0 0}
</style></head><body><main>${body}${shopName ? `<p><small>${esc(shopName)}</small></p>` : ''}</main></body></html>`;
}

export function payForm({ shopName, error = '', order = '', contact = '' }) {
  return layout('Pay with M-PESA', `
<h1>Pay with M-PESA</h1>
<p>Enter your order number and the email or phone number you used at checkout.</p>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
<form method="post" action="/pay" autocomplete="off">
<label for="order">Order number</label><input id="order" name="order" value="${esc(order)}" placeholder="#1001" required maxlength="40">
<label for="contact">Email or phone</label><input id="contact" name="contact" value="${esc(contact)}" placeholder="you@example.com or 07XXXXXXXX" required maxlength="120">
<button type="submit">Continue to M-PESA</button>
</form>`, shopName);
}

export function alreadyPaid({ shopName, orderName }) {
  return layout('Order paid', `<h1>Already paid</h1><div class="ok">Order ${esc(orderName)} is paid. Thank you!</div>`, shopName);
}
