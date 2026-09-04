/*!
 * PayChain Embed Button — paste-and-go checkout for any website
 * (Wix, Shopify, WordPress, Squarespace, a plain HTML page — anywhere a
 * <script> tag can be added).
 *
 * Usage — one fixed-amount Payment Link:
 *   <script src="https://app.paychain.co.ke/paychain-button.js" defer></script>
 *   <div data-paychain-link="a1b2c3d4"></div>
 *
 * Usage — a multi-product Checkout Page (customer picks products/quantities,
 * a cart total is computed, then they pay):
 *   <script src="https://app.paychain.co.ke/paychain-button.js" defer></script>
 *   <div data-paychain-checkout="a1b2c3d4"></div>
 *
 * The div's content is replaced with a working "Pay with PayChain" button.
 * Clicking it opens an INLINE checkout modal directly on top of the host
 * page — no popup window, no navigation away. The modal renders its own UI
 * (built here, in this script) and talks to PayChain's API directly via
 * fetch(), rather than framing PayChain's real hosted checkout pages in an
 * iframe — deliberately: an iframe would need those pages to opt out of
 * clickjacking protection (X-Frame-Options / frame-ancestors) for every
 * visitor, not just legitimate embeds. Nothing of PayChain's is ever framed
 * here; this script *is* the checkout UI. Every element is rendered inside
 * a Shadow DOM root so none of the host site's CSS can bleed in (or out).
 *
 * A bare payment link/checkout page URL (https://app.paychain.co.ke/pay/...
 * or /checkout/...) still works exactly as before for anyone who opens it
 * directly (e.g. shared via SMS/WhatsApp with no embed involved) — this
 * script is a second, richer presentation of the same backend flow, not a
 * replacement for those pages.
 *
 * Optional attributes on the same element:
 *   data-paychain-label="Pay KES 2,500"   — override the button text
 *   data-paychain-theme="light"           — "dark" (default) or "light"
 */
(function () {
  var API_URL = 'https://api.paychain.co.ke';

  // The real PayChain mark (transparent PNG, inlined as a data URI since
  // this is a standalone script with no bundler to resolve an asset import)
  // — used everywhere the brand mark appears: the trigger button, the
  // modal's header, and the "Secured by PayChain" line.
  var LOGO_DATA_URI = 'data:image/png;base64,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';

  var CHECK_SVG =
    '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="12" fill="#00bf63"/>' +
    '<path d="M7 12.5l3 3 7-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var ERROR_SVG =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="12" fill="#FEE2E2"/>' +
    '<path d="M12 7v6M12 16.5v.01" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/></svg>';

  // ---------------------------------------------------------------------
  // Trigger button (light DOM — needs to inherit the host page's normal
  // text flow/positioning, so it isn't shadow-isolated like the modal is).
  // ---------------------------------------------------------------------
  var STYLE_ID = 'paychain-embed-style';
  function injectButtonStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.paychain-embed-btn{display:inline-flex;align-items:center;gap:8px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'font-size:14px;font-weight:700;line-height:1;padding:13px 20px;border-radius:10px;' +
      'border:1.5px solid transparent;cursor:pointer;text-decoration:none;' +
      'transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease;}' +
      '.paychain-embed-btn:hover{transform:translateY(-1px);}' +
      '.paychain-embed-btn:active{transform:translateY(0) scale(.98);}' +
      '.paychain-embed-btn.pc-dark{background:#0c4a3a;color:#ffffff;box-shadow:0 8px 20px -10px rgba(12,74,58,.55);}' +
      '.paychain-embed-btn.pc-dark:hover{background:#0f5a46;}' +
      '.paychain-embed-btn.pc-light{background:#ffffff;color:#0c4a3a;border-color:#d7e8e1;box-shadow:0 2px 8px -4px rgba(0,0,0,.15);}' +
      '.paychain-embed-btn.pc-light:hover{background:#f4faf7;}' +
      '.paychain-embed-btn img{flex:none;height:16px;width:auto;display:block;}';
    document.head.appendChild(style);
  }

  function mount(el) {
    if (el.__paychainMounted) return;
    var linkId = (el.getAttribute('data-paychain-link') || '').trim();
    var pageId = (el.getAttribute('data-paychain-checkout') || '').trim();
    if (!linkId && !pageId) return;
    el.__paychainMounted = true;

    var label = el.getAttribute('data-paychain-label') || 'Pay with PayChain';
    var theme = el.getAttribute('data-paychain-theme') === 'light' ? 'pc-light' : 'pc-dark';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'paychain-embed-btn ' + theme;
    btn.innerHTML = '<img src="' + LOGO_DATA_URI + '" alt="" />' + '<span>' + label.replace(/</g, '&lt;') + '</span>';
    btn.addEventListener('click', function () {
      openModal(linkId ? { mode: 'link', linkId: linkId } : { mode: 'checkout', pageId: pageId });
    });

    el.innerHTML = '';
    el.appendChild(btn);
  }

  function scan() {
    injectButtonStyleOnce();
    var els = document.querySelectorAll('[data-paychain-link],[data-paychain-checkout]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Site builders (Wix/Shopify section editors especially) sometimes inject
  // this snippet's container into the page after the script has already
  // run — a lightweight rescan covers that without requiring a full
  // MutationObserver.
  window.PayChainEmbed = { scan: scan };

  // ---------------------------------------------------------------------
  // Inline checkout modal
  // ---------------------------------------------------------------------

  function fmtKES(n) {
    if (n == null || !isFinite(n)) return 'Ksh 0.00';
    return 'Ksh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function fetchJSON(url, options) {
    var res;
    try {
      res = await fetch(url, options);
    } catch (e) {
      throw new Error('Network error — check your connection and try again.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error body — data stays null */ }
    if (!res.ok) {
      throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    }
    return data;
  }

  var MODAL_CSS =
    '*{box-sizing:border-box;}' +
    '.pcm-backdrop{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,20,16,.55);' +
    'display:flex;align-items:center;justify-content:center;padding:16px;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}' +
    '.pcm-card{background:#fff;width:100%;max-width:400px;max-height:calc(100vh - 32px);overflow-y:auto;' +
    'border-radius:28px;box-shadow:0 30px 60px -20px rgba(0,0,0,.4);position:relative;}' +
    '.pcm-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0 20px;}' +
    '.pcm-brand{display:flex;align-items:center;gap:8px;color:#667a70;font-size:11px;font-weight:800;' +
    'text-transform:uppercase;letter-spacing:.08em;}' +
    '.pcm-close{width:32px;height:32px;border-radius:999px;border:none;background:#F1F4F2;color:#4b5a54;' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;line-height:1;flex:none;}' +
    '.pcm-close:hover{background:#E5EAE7;}' +
    '.pcm-body{padding:16px 24px 24px 24px;}' +
    '.pcm-title{font-size:20px;font-weight:800;color:#0f1a15;margin:8px 0 2px 0;text-align:center;}' +
    '.pcm-subtitle{font-size:12px;color:#7c8c85;text-align:center;margin:0 0 20px 0;font-weight:600;' +
    'text-transform:uppercase;letter-spacing:.06em;}' +
    '.pcm-center{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;}' +
    '.pcm-spinner{width:32px;height:32px;border-radius:999px;border:3px solid #d7e8e1;border-top-color:#0c4a3a;' +
    'animation:pcm-spin 0.8s linear infinite;}' +
    '@keyframes pcm-spin{to{transform:rotate(360deg);}}' +
    '.pcm-amount-wrap{text-align:center;margin-bottom:24px;}' +
    '.pcm-amount-label{font-size:12px;color:#7c8c85;font-weight:700;margin-bottom:4px;}' +
    '.pcm-amount{font-size:38px;font-weight:800;color:#0c4a3a;letter-spacing:-0.02em;line-height:1;}' +
    '.pcm-amount-fee{font-size:11px;color:#93a39c;margin-top:6px;font-weight:600;}' +
    '.pcm-field{margin-bottom:14px;}' +
    '.pcm-label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;' +
    'color:#0c4a3a99;margin-bottom:6px;padding-left:2px;}' +
    '.pcm-input{width:100%;background:#F6F8F7;border:1.5px solid #E5EAE7;border-radius:14px;padding:13px 14px;' +
    'font-size:15px;font-weight:600;color:#101915;outline:none;font-family:inherit;}' +
    '.pcm-input:focus{border-color:#0c4a3a;background:#fff;}' +
    '.pcm-btn{width:100%;border:none;border-radius:16px;padding:15px 16px;font-size:15px;font-weight:800;' +
    'cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;' +
    'transition:opacity .15s ease,transform .1s ease;}' +
    '.pcm-btn:active{transform:scale(.98);}' +
    '.pcm-btn[disabled]{opacity:.5;cursor:not-allowed;}' +
    '.pcm-btn-primary{background:#00351D;color:#fff;box-shadow:0 10px 24px -10px rgba(0,53,29,.5);}' +
    '.pcm-btn-secondary{background:#F1F4F2;color:#0f1a15;margin-top:10px;}' +
    '.pcm-btn-spinner{width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.35);' +
    'border-top-color:#fff;animation:pcm-spin .8s linear infinite;}' +
    '.pcm-status{padding:12px 14px;border-radius:14px;font-size:13px;font-weight:600;text-align:center;' +
    'margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px;}' +
    '.pcm-status-info{background:#ECFDF5;color:#065F46;}' +
    '.pcm-status-error{background:#FEF2F2;color:#991B1B;}' +
    '.pcm-product{display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;' +
    'border:1.5px solid #E5EAE7;margin-bottom:10px;}' +
    '.pcm-product.pcm-active{border-color:#0c4a3a55;background:#0c4a3a0a;}' +
    '.pcm-product.pcm-soldout{opacity:.55;}' +
    '.pcm-product-info{flex:1;min-width:0;}' +
    '.pcm-product-name{font-size:14px;font-weight:700;color:#101915;overflow:hidden;text-overflow:ellipsis;' +
    'white-space:nowrap;}' +
    '.pcm-product-desc{font-size:11px;color:#8a9a92;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.pcm-product-price{font-size:13px;font-weight:800;color:#0c4a3a;margin-top:2px;}' +
    '.pcm-badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-left:8px;}' +
    '.pcm-badge-soldout{color:#DC2626;}' +
    '.pcm-badge-low{color:#B45309;}' +
    '.pcm-qty{display:flex;align-items:center;gap:8px;flex:none;}' +
    '.pcm-qty-btn{width:30px;height:30px;border-radius:999px;border:none;background:#F1F4F2;color:#4b5a54;' +
    'font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
    'font-family:inherit;line-height:1;}' +
    '.pcm-qty-btn[disabled]{opacity:.35;cursor:not-allowed;}' +
    '.pcm-qty-btn.pcm-qty-plus{background:#0c4a3a1a;color:#0c4a3a;}' +
    '.pcm-qty-count{width:20px;text-align:center;font-weight:800;font-size:14px;color:#101915;}' +
    '.pcm-subtotal-row{display:flex;align-items:center;justify-content:space-between;padding:16px 4px;' +
    'border-top:1px solid #EEF1EF;margin-top:6px;margin-bottom:16px;}' +
    '.pcm-subtotal-label{font-size:12px;color:#7c8c85;font-weight:700;text-transform:uppercase;' +
    'letter-spacing:.05em;}' +
    '.pcm-subtotal-amount{font-size:22px;font-weight:800;color:#0c4a3a;}' +
    '.pcm-check-wrap{display:flex;flex-direction:column;align-items:center;padding:20px 0 8px 0;}' +
    '.pcm-success-title{font-size:19px;font-weight:800;color:#101915;margin:14px 0 4px 0;}' +
    '.pcm-success-sub{font-size:13px;color:#7c8c85;text-align:center;margin-bottom:20px;}' +
    '.pcm-lock{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:18px;' +
    'color:#93a39c;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;}' +
    '.pcm-lock img{height:11px;width:auto;opacity:.7;}';

  function openModal(opts) {
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    var hostEl = document.createElement('div');
    hostEl.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;';
    document.body.appendChild(hostEl);
    var shadow = hostEl.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    styleEl.textContent = MODAL_CSS;
    shadow.appendChild(styleEl);
    var root = document.createElement('div');
    shadow.appendChild(root);

    var state = {
      mode: opts.mode,
      pageId: opts.pageId || null,
      linkId: opts.linkId || null,
      page: null,
      quantities: {},
      buyerName: '',
      phone: '',
      linkDetails: null,
      stage: 'loading', // loading | error | cart | pay | success
      loadError: '',
      isCheckingOut: false,
      cartError: '',
      payStatus: 'idle', // idle | submitting | polling | failed
      payMessage: '',
      payError: '',
      pollTimer: null,
      pollAttempts: 0,
    };

    function close() {
      if (state.pollTimer) clearInterval(state.pollTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (hostEl.parentNode) hostEl.parentNode.removeChild(hostEl);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);

    function cartLines() {
      if (!state.page) return [];
      var lines = [];
      for (var i = 0; i < state.page.items.length; i++) {
        var item = state.page.items[i];
        var qty = state.quantities[item.itemId] || 0;
        if (qty > 0) lines.push({ item: item, quantity: qty });
      }
      return lines;
    }

    function cartSubtotal() {
      var lines = cartLines();
      var sum = 0;
      for (var i = 0; i < lines.length; i++) sum += lines[i].item.unitPrice * lines[i].quantity;
      return sum;
    }

    function setQty(itemId, qty, cap) {
      var ceiling = cap == null ? 100 : Math.min(100, cap);
      state.quantities[itemId] = Math.max(0, Math.min(ceiling, qty));
      render();
    }

    async function loadCart() {
      try {
        var data = await fetchJSON(API_URL + '/api/transactions/checkout-page/' + encodeURIComponent(state.pageId) + '/public');
        state.page = data;
        state.stage = 'cart';
      } catch (e) {
        state.stage = 'error';
        state.loadError = e.message;
      }
      render();
    }

    async function loadLinkDetails(linkId) {
      var data = await fetchJSON(API_URL + '/api/transactions/payment-link/' + encodeURIComponent(linkId));
      state.linkId = linkId;
      state.linkDetails = data;
      state.stage = 'pay';
    }

    async function loadLinkMode() {
      try {
        await loadLinkDetails(state.linkId);
      } catch (e) {
        state.stage = 'error';
        state.loadError = e.message;
      }
      render();
    }

    async function startCartCheckout() {
      var lines = cartLines();
      if (lines.length === 0 || state.isCheckingOut) return;
      if (state.page.collectBuyerName && !state.buyerName.trim()) {
        state.cartError = 'Enter your name to continue.';
        render();
        return;
      }
      state.isCheckingOut = true;
      state.cartError = '';
      render();
      try {
        var body = { items: lines.map(function (l) { return { itemId: l.item.itemId, quantity: l.quantity }; }) };
        if (state.page.collectBuyerName) body.buyerName = state.buyerName.trim();
        var res = await fetchJSON(API_URL + '/api/transactions/checkout-page/' + encodeURIComponent(state.pageId) + '/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        await loadLinkDetails(res.linkId);
      } catch (e) {
        state.cartError = e.message;
        state.isCheckingOut = false;
      }
      render();
    }

    async function submitPayment() {
      if (!state.phone.trim() || state.payStatus === 'submitting' || state.payStatus === 'polling') return;
      state.payStatus = 'submitting';
      state.payError = '';
      state.payMessage = 'Initiating secure STK Push...';
      render();
      try {
        var res = await fetchJSON(API_URL + '/api/transactions/payment-link/' + encodeURIComponent(state.linkId) + '/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: state.phone.trim() }),
        });
        state.payStatus = 'polling';
        state.payMessage = 'Awaiting M-PESA PIN on your phone...';
        state.pollAttempts = 0;
        render();
        state.pollTimer = setInterval(function () { pollStatus(res.checkoutRequestId); }, 3000);
      } catch (e) {
        state.payStatus = 'failed';
        state.payError = e.message;
        state.payMessage = '';
        render();
      }
    }

    async function pollStatus(checkoutRequestId) {
      state.pollAttempts++;
      try {
        var data = await fetchJSON(API_URL + '/api/transactions/public-stk-status/' + encodeURIComponent(checkoutRequestId));
        if (data.status === 'success') {
          clearInterval(state.pollTimer);
          state.stage = 'success';
          render();
        } else if (data.status === 'failed') {
          clearInterval(state.pollTimer);
          state.payStatus = 'failed';
          state.payError = data.resultDesc || 'Payment was cancelled or declined.';
          state.payMessage = '';
          render();
        } else if (state.pollAttempts >= 20) {
          clearInterval(state.pollTimer);
          state.payStatus = 'failed';
          state.payError = "We couldn't confirm your payment. If M-PESA deducted your money, it will still reach the merchant — check your M-PESA messages.";
          state.payMessage = '';
          render();
        }
      } catch (e) {
        // A single failed poll shouldn't kill the flow — keep trying until
        // the attempt cap above.
      }
    }

    function retryPay() {
      state.payStatus = 'idle';
      state.payError = '';
      state.payMessage = '';
      render();
    }

    function renderHeader(showBack) {
      return (
        '<div class="pcm-header">' +
        '<div class="pcm-brand"><img src="' + LOGO_DATA_URI + '" alt="" style="height:16px;width:auto;" /><span>PayChain</span></div>' +
        '<button type="button" class="pcm-close" data-pcm-close aria-label="Close">&times;</button>' +
        '</div>'
      );
    }

    function renderLoading() {
      return renderHeader() + '<div class="pcm-center"><div class="pcm-spinner"></div></div>';
    }

    function renderError() {
      return (
        renderHeader() +
        '<div class="pcm-body">' +
        '<div class="pcm-center">' + ERROR_SVG +
        '<p class="pcm-title" style="margin-top:14px;">Not available</p>' +
        '<p class="pcm-success-sub">' + escapeHtml(state.loadError) + '</p>' +
        '</div></div>'
      );
    }

    function renderCart() {
      var page = state.page;
      var lines = cartLines();
      var subtotal = cartSubtotal();
      var itemsHtml = page.items.map(function (item) {
        var qty = state.quantities[item.itemId] || 0;
        var soldOut = item.remaining === 0;
        var classes = 'pcm-product' + (soldOut ? ' pcm-soldout' : qty > 0 ? ' pcm-active' : '');
        var badge = '';
        if (soldOut) badge = '<span class="pcm-badge pcm-badge-soldout">Sold out</span>';
        else if (item.remaining != null && item.remaining <= 10) badge = '<span class="pcm-badge pcm-badge-low">' + item.remaining + ' left</span>';
        var atCap = item.remaining != null && qty >= item.remaining;
        return (
          '<div class="' + classes + '">' +
          '<div class="pcm-product-info">' +
          '<div class="pcm-product-name">' + escapeHtml(item.name) + badge + '</div>' +
          (item.description ? '<div class="pcm-product-desc">' + escapeHtml(item.description) + '</div>' : '') +
          '<div class="pcm-product-price">' + fmtKES(item.unitPrice) + '</div>' +
          '</div>' +
          '<div class="pcm-qty">' +
          '<button type="button" class="pcm-qty-btn" data-pcm-qty-minus="' + item.itemId + '"' + (qty === 0 ? ' disabled' : '') + '>&minus;</button>' +
          '<span class="pcm-qty-count">' + qty + '</span>' +
          '<button type="button" class="pcm-qty-btn pcm-qty-plus" data-pcm-qty-plus="' + item.itemId + '"' + (soldOut || atCap ? ' disabled' : '') + '>+</button>' +
          '</div></div>'
        );
      }).join('');

      var nameField = page.collectBuyerName
        ? '<div class="pcm-field"><label class="pcm-label">Your Name</label>' +
          '<input type="text" class="pcm-input" data-pcm-buyer-name placeholder="Full name" value="' + escapeHtml(state.buyerName) + '"/></div>'
        : '';

      var btnLabel = lines.length === 0 ? 'Add items to your cart' : (page.collectBuyerName && !state.buyerName.trim() ? 'Enter your name to continue' : 'Proceed to Pay');

      return (
        renderHeader() +
        '<div class="pcm-body">' +
        '<p class="pcm-title">' + escapeHtml(page.title) + '</p>' +
        '<p class="pcm-subtitle">' + escapeHtml(page.merchantName) + '</p>' +
        itemsHtml +
        nameField +
        '<div class="pcm-subtotal-row"><span class="pcm-subtotal-label">Cart Total</span><span class="pcm-subtotal-amount">' + fmtKES(subtotal) + '</span></div>' +
        (state.cartError ? '<div class="pcm-status pcm-status-error">' + escapeHtml(state.cartError) + '</div>' : '') +
        '<button type="button" class="pcm-btn pcm-btn-primary" data-pcm-checkout' + (lines.length === 0 || state.isCheckingOut ? ' disabled' : '') + '>' +
        (state.isCheckingOut ? '<span class="pcm-btn-spinner"></span>' : '') + escapeHtml(btnLabel) +
        '</button>' +
        '<div class="pcm-lock"><img src="' + LOGO_DATA_URI + '" alt="" />Secured by PayChain</div>' +
        '</div>'
      );
    }

    function renderPay() {
      var d = state.linkDetails;
      var isBusy = state.payStatus === 'submitting' || state.payStatus === 'polling';
      var statusHtml = '';
      if (state.payMessage) statusHtml = '<div class="pcm-status pcm-status-info">' + (isBusy ? '<span class="pcm-btn-spinner" style="border-color:rgba(6,95,70,.25);border-top-color:#065F46;"></span>' : '') + escapeHtml(state.payMessage) + '</div>';
      if (state.payError) statusHtml = '<div class="pcm-status pcm-status-error">' + escapeHtml(state.payError) + '</div>';

      return (
        renderHeader() +
        '<div class="pcm-body">' +
        '<p class="pcm-title">Pay ' + escapeHtml(d.merchantName) + '</p>' +
        '<p class="pcm-subtitle">PayChain Verified Business</p>' +
        '<div class="pcm-amount-wrap">' +
        '<div class="pcm-amount-label">Total to Pay</div>' +
        '<div class="pcm-amount">' + fmtKES(d.total != null ? d.total : d.amount) + '</div>' +
        (d.fee > 0 ? '<div class="pcm-amount-fee">' + fmtKES(d.amount) + ' + ' + fmtKES(d.fee) + ' transaction fee</div>' : '') +
        '</div>' +
        '<div class="pcm-field"><label class="pcm-label">Your M-PESA Number</label>' +
        '<input type="tel" class="pcm-input" data-pcm-phone placeholder="0712 345 678" value="' + escapeHtml(state.phone) + '"' + (isBusy ? ' disabled' : '') + '/></div>' +
        statusHtml +
        '<button type="button" class="pcm-btn pcm-btn-primary" data-pcm-pay' + (isBusy || !state.phone.trim() ? ' disabled' : '') + '>' +
        (isBusy ? '<span class="pcm-btn-spinner"></span>' : '') + 'Pay with M-PESA' +
        '</button>' +
        (state.payStatus === 'failed' ? '<button type="button" class="pcm-btn pcm-btn-secondary" data-pcm-retry>Try Again</button>' : '') +
        '<div class="pcm-lock"><img src="' + LOGO_DATA_URI + '" alt="" />Secured by PayChain</div>' +
        '</div>'
      );
    }

    function renderSuccess() {
      return (
        renderHeader() +
        '<div class="pcm-body">' +
        '<div class="pcm-check-wrap">' + CHECK_SVG +
        '<div class="pcm-success-title">Payment received</div>' +
        '<div class="pcm-success-sub">Thank you! A confirmation has been sent to your phone.</div>' +
        '</div></div>'
      );
    }

    function renderHTML() {
      var inner;
      if (state.stage === 'loading') inner = renderLoading();
      else if (state.stage === 'error') inner = renderError();
      else if (state.stage === 'cart') inner = renderCart();
      else if (state.stage === 'pay') inner = renderPay();
      else if (state.stage === 'success') inner = renderSuccess();
      return '<div class="pcm-backdrop" data-pcm-backdrop><div class="pcm-card" role="dialog" aria-modal="true">' + inner + '</div></div>';
    }

    function wireEvents() {
      var closeBtn = root.querySelector('[data-pcm-close]');
      if (closeBtn) closeBtn.addEventListener('click', close);
      var backdrop = root.querySelector('[data-pcm-backdrop]');
      if (backdrop) backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });

      var minusBtns = root.querySelectorAll('[data-pcm-qty-minus]');
      for (var i = 0; i < minusBtns.length; i++) {
        (function (btn) {
          var id = btn.getAttribute('data-pcm-qty-minus');
          btn.addEventListener('click', function () {
            var item = findItem(id);
            setQty(id, (state.quantities[id] || 0) - 1, item ? item.remaining : null);
          });
        })(minusBtns[i]);
      }
      var plusBtns = root.querySelectorAll('[data-pcm-qty-plus]');
      for (var j = 0; j < plusBtns.length; j++) {
        (function (btn) {
          var id = btn.getAttribute('data-pcm-qty-plus');
          btn.addEventListener('click', function () {
            var item = findItem(id);
            setQty(id, (state.quantities[id] || 0) + 1, item ? item.remaining : null);
          });
        })(plusBtns[j]);
      }
      var nameInput = root.querySelector('[data-pcm-buyer-name]');
      if (nameInput) {
        nameInput.addEventListener('input', function (e) {
          state.buyerName = e.target.value;
          state.cartError = '';
        });
        nameInput.focus();
        nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);
      }
      var checkoutBtn = root.querySelector('[data-pcm-checkout]');
      if (checkoutBtn) checkoutBtn.addEventListener('click', startCartCheckout);

      var phoneInput = root.querySelector('[data-pcm-phone]');
      if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
          state.phone = e.target.value;
          var payBtn = root.querySelector('[data-pcm-pay]');
          if (payBtn) payBtn.disabled = !state.phone.trim();
        });
      }
      var payBtn = root.querySelector('[data-pcm-pay]');
      if (payBtn) payBtn.addEventListener('click', submitPayment);
      var retryBtn = root.querySelector('[data-pcm-retry]');
      if (retryBtn) retryBtn.addEventListener('click', retryPay);
    }

    function findItem(itemId) {
      if (!state.page) return null;
      for (var i = 0; i < state.page.items.length; i++) {
        if (state.page.items[i].itemId === itemId) return state.page.items[i];
      }
      return null;
    }

    function render() {
      root.innerHTML = renderHTML();
      wireEvents();
    }

    render();
    if (state.mode === 'checkout') loadCart();
    else loadLinkMode();
  }
})();
