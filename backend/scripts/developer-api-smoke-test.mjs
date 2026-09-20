#!/usr/bin/env node
// Smoke test for the PayChain Developer API. No dependencies (Node 18+).
// You run it yourself with your own key; PayChain staff never need to see it.
//
//   node developer-api-smoke-test.mjs run --phone=07XXXXXXXX [options]
//   node developer-api-smoke-test.mjs listen --secret=<webhook secret> [--port=8787]
//   node developer-api-smoke-test.mjs verify --secret=... --signature=... --body-file=payload.json
//
// run: reads PAYCHAIN_API_KEY from the environment (a pc_test_ key exercises
// the sandbox; a pc_live_ key moves REAL money and needs --yes).
//   --phone=07..         phone that receives the STK push (your own)
//   --amount=10          KES per payment (default 10)
//   --payout-to=07..     also send a payout to this number (live needs the
//                        merchant's API payouts enabled; PIN in PAYCHAIN_API_PAYOUT_PIN)
//   --yes                required for a live key: confirms you know it moves money
//   PAYCHAIN_API_URL     override the base URL (default https://api.paychain.co.ke)
//
// listen: a tiny webhook receiver that checks every X-PayChain-Signature and
// prints the event. PayChain only delivers to public HTTPS URLs, so put a
// tunnel in front of it (for example `ngrok http 8787`), register the https
// URL in the developer portal, then send a test event or make a payment.
//
// verify: checks one delivery you copied from any inbox (for example
// webhook.site). Use the raw body exactly as received.

import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';

const [, , command = 'run', ...rest] = process.argv;
const flags = Object.fromEntries(
  rest.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const sign = (secret, rawBody) => crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- verify
if (command === 'verify') {
  const { secret, signature, 'body-file': bodyFile } = flags;
  if (!secret || !signature || !bodyFile) {
    console.error('Usage: verify --secret=... --signature=... --body-file=payload.json');
    process.exit(2);
  }
  const raw = fs.readFileSync(bodyFile);
  if (safeEqual(sign(secret, raw), signature)) {
    console.log('✓ signature is valid: this came from PayChain');
    process.exit(0);
  }
  // Text editors and `echo` add a trailing newline that was not in the request.
  const trimmed = Buffer.from(raw.toString().replace(/\r?\n$/, ''));
  if (trimmed.length !== raw.length && safeEqual(sign(secret, trimmed), signature)) {
    console.log('✓ signature is valid once the trailing newline your editor added is removed. In your real handler, sign the raw request bytes, not a re-saved copy.');
    process.exit(0);
  }
  console.log('✗ signature does NOT match (wrong secret, or the body was changed or re-formatted)');
  process.exit(1);
}

// ---------------------------------------------------------------- listen
if (command === 'listen') {
  const secret = flags.secret || process.env.PAYCHAIN_WEBHOOK_SECRET;
  const port = Number(flags.port || 8787);
  if (!secret) { console.error('Usage: listen --secret=<webhook secret> [--port=8787]'); process.exit(2); }
  http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const valid = safeEqual(sign(secret, raw), req.headers['x-paychain-signature']);
      let body = null; try { body = JSON.parse(raw.toString()); } catch { /* not JSON */ }
      console.log(`${new Date().toISOString()}  ${valid ? '✓ valid signature' : '✗ INVALID signature'}  event=${req.headers['x-paychain-event']}  delivery=${req.headers['x-paychain-delivery-id']}`);
      if (body) console.log(JSON.stringify(body.data ?? body, null, 2));
      // Only acknowledge a delivery we could verify. PayChain retries otherwise.
      res.writeHead(valid ? 200 : 401).end(valid ? 'ok' : 'bad signature');
    });
  }).listen(port, () => console.log(`Listening on http://localhost:${port}. Expose it with a tunnel and register the https URL as a webhook. Ctrl+C to stop.`));
} else if (command !== 'run') {
  console.error(`Unknown command "${command}". Use run, listen or verify.`);
  process.exit(2);
} else {
  await run();
}

// ------------------------------------------------------------------- run
async function run() {
  const key = process.env.PAYCHAIN_API_KEY;
  const base = (process.env.PAYCHAIN_API_URL || 'https://api.paychain.co.ke').replace(/\/+$/, '');
  if (!key) { console.error('Set PAYCHAIN_API_KEY first (export PAYCHAIN_API_KEY=pc_test_...).'); process.exit(2); }
  const live = key.startsWith('pc_live_');
  const amount = Number(flags.amount || 10);
  const phone = flags.phone;
  const payoutTo = flags['payout-to'];
  const stamp = Date.now().toString(36);

  console.log(`PayChain Developer API smoke test\n  base: ${base}\n  key:  ${key.slice(0, 12)}…  (${live ? 'LIVE, real money' : 'test / sandbox'})\n`);
  if (live && flags.yes !== true) {
    console.log(`A live key moves real money: KES ${amount} would be collected from ${phone || '(no --phone given)'}${payoutTo ? ` and KES ${amount} paid out to ${payoutTo}` : ''}.\nRe-run with --yes to go ahead.`);
    process.exit(2);
  }
  if (!phone) { console.error('Give the phone that should receive the STK push: --phone=07XXXXXXXX'); process.exit(2); }

  let passed = 0; let failed = 0;
  const check = (ok, label, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? '  ✓' : '  ✗'} ${label}${!ok && detail ? `\n      ${detail}` : ''}`); return ok; };
  const api = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null; try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  };
  const brief = (r) => `HTTP ${r.status} ${JSON.stringify(r.json)?.slice(0, 300)}`;
  const pollPayment = async (id, label) => {
    const deadline = Date.now() + (live ? 150_000 : 30_000);
    let last = null;
    while (Date.now() < deadline) {
      const r = await api('GET', `/api/v1/developer/payments/${id}`);
      last = r.json?.payment?.status;
      if (last === 'success' || last === 'failed') return { status: last, reason: r.json.payment.failureReason };
      await sleep(live ? 4000 : 1500);
    }
    return { status: last || 'unknown', reason: `still ${last} after waiting` };
  };

  // 1. auth
  let r = await api('GET', '/api/v1/developer/ping');
  if (!check(r.status === 200, 'key is accepted (GET /ping)', brief(r))) process.exit(1);

  // 2. collect
  const idem = `smoke-${stamp}-collect`;
  const collectBody = { amount, phone, reference: `smoke-${stamp}` };
  r = await api('POST', '/api/v1/developer/payments/collect', collectBody, { 'Idempotency-Key': idem });
  const started = check(r.status === 201 && r.json?.payment?.status === 'pending', `collect KES ${amount} started (POST /payments/collect)`, brief(r));
  const paymentId = r.json?.payment?.id;
  if (started) {
    // 3. idempotency
    const again = await api('POST', '/api/v1/developer/payments/collect', collectBody, { 'Idempotency-Key': idem });
    check(again.status === 200 && again.json?.replayed === true && again.json?.payment?.id === paymentId, 'same Idempotency-Key returns the same payment, not a second charge', brief(again));
    // 4. result
    if (live) console.log(`  … approve the M-PESA prompt on ${phone} now (waiting up to 2.5 minutes)`);
    const out = await pollPayment(paymentId);
    check(out.status === 'success', `collect resolved (${out.status}${out.reason ? `: ${out.reason}` : ''})`);
  }

  // 5. validation
  r = await api('POST', '/api/v1/developer/payments/collect', { amount, phone: '12' }, { 'Idempotency-Key': `smoke-${stamp}-bad` });
  check(r.status === 400, 'a bad phone number is rejected with 400', brief(r));
  r = await api('POST', '/api/v1/developer/payments/collect', { amount, phone });
  check(r.status === 400 && r.json?.code === 'IDEMPOTENCY_KEY_REQUIRED', 'a missing Idempotency-Key is rejected', brief(r));

  // 6. hosted checkout (creates a link only; nothing is charged)
  r = await api('POST', '/api/v1/developer/checkout', { amount, reference: `smoke-${stamp}-co`, callbackUrl: 'https://example.com/paid' });
  const session = r.json?.session || r.json?.checkout || r.json;
  if (check(r.status === 201 && session?.checkoutUrl, 'hosted checkout link created (POST /checkout)', brief(r))) {
    console.log(`      link: ${session.checkoutUrl}   (open it to see the customer page; not paid by this script)`);
    const page = await fetch(`${base}/api/public/checkout/${session.id}`).then((x) => x.json()).catch(() => null);
    check(page?.session?.amount === amount, 'the customer-facing page data loads without a key');
  }

  // 7. payout (optional)
  if (payoutTo) {
    const pin = process.env.PAYCHAIN_API_PAYOUT_PIN;
    if (live && !pin) {
      check(false, 'payout skipped: set PAYCHAIN_API_PAYOUT_PIN (the merchant must have API payouts enabled)');
    } else {
      r = await api('POST', '/api/v1/developer/payments/payout', { amount, phone: payoutTo, narration: 'PayChain smoke test', ...(pin ? { apiPayoutPin: pin } : {}) }, { 'Idempotency-Key': `smoke-${stamp}-payout` });
      if (check(r.status === 201, `payout of KES ${amount} accepted (POST /payments/payout)`, brief(r))) {
        const out = await pollPayment(r.json.payment.id);
        check(out.status === 'success', `payout resolved (${out.status}${out.reason ? `: ${out.reason}` : ''})`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log('\nWebhooks are the last thing to check. Register an https endpoint in the developer portal, then either:');
  console.log('  • run this script in listen mode behind a tunnel, or');
  console.log('  • use webhook.site, copy one delivery\'s raw body and X-PayChain-Signature, and run verify.');
  console.log('Then make a payment and confirm payment.collect.succeeded arrives with a valid signature.');
  process.exit(failed ? 1 : 0);
}
