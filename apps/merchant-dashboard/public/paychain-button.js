/*!
 * PayChain Embed Button — paste-and-go checkout button for any website
 * (Wix, Shopify, WordPress, Squarespace, a plain HTML page — anywhere a
 * <script> tag can be added).
 *
 * Usage:
 *   <script src="https://app.paychain.co.ke/paychain-button.js" defer></script>
 *   <div data-paychain-link="a1b2c3d4"></div>
 *
 * The div's content is replaced with a working "Pay with PayChain" button.
 * Clicking it opens the real PayChain-hosted payment page
 * (https://app.paychain.co.ke/pay/<linkId>) in a centered popup window —
 * never an iframe, deliberately: an iframe would need PayChain's own
 * payment page to opt out of clickjacking protection (X-Frame-Options /
 * frame-ancestors), which is not a trade-off worth making for a
 * convenience widget. A popup is a normal top-level navigation from the
 * customer's point of view, so none of that applies, and it degrades
 * safely — if the browser blocks the popup, the button is a real <a href>
 * underneath and just navigates the current tab instead.
 *
 * Optional attributes on the same element:
 *   data-paychain-label="Pay KES 2,500"   — override the button text
 *   data-paychain-theme="light"           — "dark" (default) or "light"
 */
(function () {
  var BASE_URL = 'https://app.paychain.co.ke';

  var LOGO_SVG =
    '<svg width="16" height="16" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<rect x="3" y="3" width="94" height="94" rx="27" fill="#0c4a3a"/>' +
    '<polygon points="34,3 58,3 8,84 3,84 3,58" fill="#ffffff"/>' +
    '<polygon points="3,3 30,3 3,46" fill="#3fae6a"/></svg>';

  var STYLE_ID = 'paychain-embed-style';
  function injectStyleOnce() {
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
      '.paychain-embed-btn svg{flex:none;}';
    document.head.appendChild(style);
  }

  function openPopup(url) {
    var w = 420, h = 720;
    var left = (window.screenX || 0) + Math.max(0, ((window.outerWidth || screen.width) - w) / 2);
    var top = (window.screenY || 0) + Math.max(0, ((window.outerHeight || screen.height) - h) / 2);
    var popup = window.open(
      url,
      'paychain_checkout',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes,noopener,noreferrer'
    );
    // Popup blockers, and some in-app browsers (Instagram/Facebook webviews)
    // silently return null instead of throwing — fall back to a normal
    // full-page navigation so the button still works either way.
    if (!popup) window.location.href = url;
    else popup.focus();
  }

  function mount(el) {
    if (el.__paychainMounted) return;
    var linkId = (el.getAttribute('data-paychain-link') || '').trim();
    if (!linkId) return;
    el.__paychainMounted = true;

    var href = BASE_URL + '/pay/' + encodeURIComponent(linkId);
    var label = el.getAttribute('data-paychain-label') || 'Pay with PayChain';
    var theme = el.getAttribute('data-paychain-theme') === 'light' ? 'pc-light' : 'pc-dark';

    var btn = document.createElement('a');
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.className = 'paychain-embed-btn ' + theme;
    btn.innerHTML = LOGO_SVG + '<span>' + label.replace(/</g, '&lt;') + '</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openPopup(href);
    });

    el.innerHTML = '';
    el.appendChild(btn);
  }

  function scan() {
    injectStyleOnce();
    var els = document.querySelectorAll('[data-paychain-link]');
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
})();
