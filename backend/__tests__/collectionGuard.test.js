import { jest } from '@jest/globals';
import { requireCollectionsOpen } from '../middleware/collectionGuard.js';

const run = (merchant) => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  requireCollectionsOpen({ merchant }, res, next);
  return { res, next };
};

describe('requireCollectionsOpen', () => {
  it('lets an open merchant through', () => {
    expect(run({ status: 'active', inboundLocked: false }).next).toHaveBeenCalled();
  });
  it('refuses a blocked merchant, giving the reason the admin chose', () => {
    const { res, next } = run({ status: 'active', inboundLocked: true, inboundLockReason: 'a system upgrade' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toContain('due to a system upgrade');
    expect(res.json.mock.calls[0][0].code).toBe('COLLECTIONS_PAUSED');
  });
});

// Reads the real routers, so dropping the guard from a route fails here.
describe('guarded routes', () => {
  const guards = async (file, method, path) => {
    const { default: router } = await import(file);
    const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
    const names = layer.route.stack.map((s) => s.name);
    return names.indexOf('requireCollectionsOpen') > names.indexOf('protectMerchant') && names.includes('requireCollectionsOpen');
  };
  it.each([
    ['../routes/transactionRoutes.js', 'post', '/payment-link'],
    ['../routes/transactionRoutes.js', 'post', '/checkout-page'],
    ['../routes/invoiceRoutes.js', 'post', '/'],
    ['../routes/invoiceRoutes.js', 'post', '/:id/send'],
    ['../routes/mpesaRoutes.js', 'post', '/stk-push'],
    ['../routes/mpesaRoutes.js', 'post', '/generate-qr'],
    ['../routes/mpesaRoutes.js', 'get', '/account-qr'],
    ['../routes/transactionRoutes.js', 'get', '/sticker'],
  ])('%s %s %s', async (file, method, path) => {
    expect(await guards(file, method, path)).toBe(true);
  });
});
