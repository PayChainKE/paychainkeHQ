import { jest } from '@jest/globals';

const sel = (rows) => ({ select: () => ({ sort: () => Promise.resolve(rows) }) });
const Merchant = { find: jest.fn(), updateMany: jest.fn() };
const Admin = { findOneAndUpdate: jest.fn(), updateOne: jest.fn() };
const reviewHeldDeposits = jest.fn();
const creditHeldDeposit = jest.fn();
const disableMerchantCollections = jest.fn();
const restoreMerchantCollections = jest.fn();

jest.unstable_mockModule('../models/Merchant.js', () => ({ default: Merchant }));
jest.unstable_mockModule('../models/Admin.js', () => ({ default: Admin }));
jest.unstable_mockModule('../utils/resend.js', () => ({ sendAdminActionOTP: jest.fn() }));
jest.unstable_mockModule('../utils/auditLog.js', () => ({ logAudit: jest.fn() }));
jest.unstable_mockModule('./../controllers/adminController.js', () => ({ adminActor: () => ({}), notifyMerchantInboundInApp: jest.fn(), notifyMerchantInboundExternal: jest.fn() }));
jest.unstable_mockModule('../controllers/notificationController.js', () => ({ createNotification: jest.fn() }));
jest.unstable_mockModule('../services/heldCreditService.js', () => ({ reviewHeldDeposits, creditHeldDeposit }));
jest.unstable_mockModule('../services/merchantDisableService.js', () => ({ disableMerchantCollections, restoreMerchantCollections }));
jest.unstable_mockModule('../utils/smsSanitizer.js', () => ({ safeSendSMS: jest.fn().mockResolvedValue({}), formatKes: (n) => `KES ${n}` }));

const { confirmBulkInboundBlock, previewBulkInboundBlock } = await import('../controllers/merchantInboundBlockController.js');

const ID = (n) => String(n).padStart(24, 'a');
const merchant = (n, over = {}) => ({ _id: ID(n), businessName: `Shop ${n}`, inboundLocked: true, status: 'active', ...over });
const reply = () => { const r = { status: jest.fn(() => r), json: jest.fn(() => r) }; return r; };
const confirm = async (payload) => {
  Admin.findOneAndUpdate.mockResolvedValue({ pendingAction: { payload } });
  const res = reply();
  await confirmBulkInboundBlock({ body: { otp: '123456' }, admin: { _id: 'admin' } }, res);
  return res.json.mock.calls[0][0];
};
const hold = (id, amount) => ({ holdId: id, transId: `R${id}`, amount });

beforeEach(() => { jest.clearAllMocks(); creditHeldDeposit.mockReset(); });

describe('credit held and disable', () => {
  it('credits only the deposits the code approved', async () => {
    Merchant.find.mockReturnValue(sel([merchant(1)]));
    reviewHeldDeposits.mockResolvedValue(new Map([[ID(1), { creditable: [hold('h1', 500), hold('late', 900)], needsReview: [] }]]));
    creditHeldDeposit.mockResolvedValue({ credited: true, amount: 500 });
    const out = await confirm({ merchantIds: [ID(1)], mode: 'disable', holdIds: ['h1'] });
    expect(creditHeldDeposit).toHaveBeenCalledTimes(1);
    expect(creditHeldDeposit.mock.calls[0][0]).toBe('h1');
    expect(out.data.creditedAmount).toBe(500);
  });

  it('still disables everyone when one credit fails, and reports it', async () => {
    Merchant.find.mockReturnValue(sel([merchant(1), merchant(2)]));
    reviewHeldDeposits.mockResolvedValue(new Map([
      [ID(1), { creditable: [hold('h1', 500)], needsReview: [] }],
      [ID(2), { creditable: [hold('h2', 700)], needsReview: [] }],
    ]));
    creditHeldDeposit.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ credited: true, amount: 700 });
    const out = await confirm({ merchantIds: [ID(1), ID(2)], mode: 'disable', holdIds: ['h1', 'h2'] });
    expect(disableMerchantCollections.mock.calls[0][0]).toEqual([ID(1), ID(2)]);
    expect(out.data.failed).toEqual([expect.objectContaining({ transId: 'Rh1' })]);
    expect(out.data.creditedAmount).toBe(700);
  });

  it('credits a late deposit on a disabled merchant without disabling it twice', async () => {
    Merchant.find.mockReturnValue(sel([merchant(1, { accountDisabledAt: new Date() })]));
    reviewHeldDeposits.mockResolvedValue(new Map([[ID(1), { creditable: [hold('h1', 500)], needsReview: [] }]]));
    creditHeldDeposit.mockResolvedValue({ credited: true, amount: 500 });
    await confirm({ merchantIds: [ID(1)], mode: 'disable', holdIds: ['h1'] });
    expect(disableMerchantCollections.mock.calls[0][0]).toEqual([]);
  });

  it('never credits or disables fraud-locked, demo or not-blocked accounts', async () => {
    Merchant.find.mockReturnValue(sel([
      merchant(1, { status: 'locked' }), merchant(2, { isDemoMerchant: true }),
      merchant(3, { isAppReviewAccount: true }), merchant(4, { inboundLocked: false }),
    ]));
    reviewHeldDeposits.mockResolvedValue(new Map());
    const res = reply();
    await previewBulkInboundBlock({ body: { merchantIds: [ID(1), ID(2), ID(3), ID(4)], mode: 'disable' } }, res);
    const { items, skipped } = res.json.mock.calls[0][0].data;
    expect(items).toEqual([]);
    expect(skipped).toHaveLength(4);
    expect(reviewHeldDeposits.mock.calls[0][0]).toEqual([]);
  });
});

describe('block and allow', () => {
  it('a bulk block disables the account too', async () => {
    Merchant.find.mockReturnValue(sel([merchant(1, { inboundLocked: false })]));
    await confirm({ merchantIds: [ID(1)], mode: 'block', reason: 'maintenance' });
    expect(disableMerchantCollections).toHaveBeenCalledWith([ID(1)], 'admin');
    expect(creditHeldDeposit).not.toHaveBeenCalled();
  });
  it('a bulk allow restores what the disable turned off', async () => {
    Merchant.find.mockReturnValue(sel([merchant(1)]));
    await confirm({ merchantIds: [ID(1)], mode: 'allow' });
    expect(restoreMerchantCollections).toHaveBeenCalledWith([ID(1)]);
  });
});
