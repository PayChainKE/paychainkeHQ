import { loadConfig, configProblems } from './config.js';
import { Shopify } from './shopify.js';
import { PayChain } from './paychain.js';
import { Orders } from './orders.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const problems = configProblems(cfg);
if (problems.length) {
  console.error('PayChain for Shopify cannot start:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

const log = (level, message) => console.log(`${new Date().toISOString()} ${level.toUpperCase().padEnd(7)} ${message}`);
const orders = new Orders({ cfg, shopify: new Shopify(cfg), paychain: new PayChain(cfg), log });
const server = createApp({ cfg, orders, log });

server.listen(cfg.port, () => {
  log('info', `PayChain for Shopify listening on port ${cfg.port} for ${cfg.shop} (${cfg.mode === 'live' ? 'LIVE: real money' : 'test key: no real money'})`);
  if (cfg.mode === 'test' && !cfg.testPaymentsMarkPaid) log('info', 'Test payments will be tagged on the order but NOT marked paid (TEST_PAYMENTS_MARK_PAID=1 changes that).');
});

let sweeping = false;
const sweep = async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    const r = await orders.sweep();
    if (r.completed) log('info', `Status check marked ${r.completed} order(s) paid`);
  } catch (e) { log('warning', `Status check failed: ${e.message}`); } finally { sweeping = false; }
};
setTimeout(sweep, 30_000).unref();
setInterval(sweep, cfg.sweepEveryMinutes * 60_000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
