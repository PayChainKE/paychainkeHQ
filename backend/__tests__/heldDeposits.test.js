import { jest } from '@jest/globals';

const held = { find: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() };
const candidates = { exists: jest.fn(), findOneAndUpdate: jest.fn() };
const transactions = { exists: jest.fn() };
const creditNcbaCollection = jest.fn();
class DuplicateCollectionError extends Error {}

jest.unstable_mockModule('../models/NcbaUnattributedCredit.js', () => ({ default: held }));
jest.unstable_mockModule('../models/MissedNcbaCollectionCandidate.js', () => ({ default: candidates }));
jest.unstable_mockModule('../models/Transaction.js', () => ({ default: transactions }));
jest.unstable_mockModule('../utils/securityAlerts.js', () => ({ notifyAdmins: jest.fn(), escapeHtml: (s) => s }));
jest.unstable_mockModule('../services/ncbaLedgerService.js', () => ({ creditNcbaCollection, DuplicateCollectionError }));
jest.unstable_mockModule('../services/ncbaCollectionReconciliationService.js', () => ({ INBOUND_TYPES: ['ncba_inbound'] }));
jest.unstable_mockModule('../utils/notificationService.js', () => ({ toE164Kenyan: (p) => (/^254\d{9}$/.test(p) ? p : null) }));

const { heldMerchantCode, reviewHeldDeposits, creditHeldDeposit, RECONCILIATION_FEED } = await import('../services/heldCreditService.js');

const merchant = { _id: 'm1', ncbaMerchantCode: '11112222', businessName: 'Shop (Nairobi)' };
const note = 'Held: Shop (Nairobi) (11112222) — incoming payments blocked';
const at = (minutes) => new Date(Date.UTC(2026, 10, 5, 12, minutes));
const hold = (over = {}) => ({ _id: 'h1', transId: 'REF1', amount: 500, resolved: false, resolvedNote: note, txnType: 'C2B', createdAt: at(0), ...over });
const review = async (rows) => (await reviewHeldDeposits([merchant])).get('m1');
const sortable = (rows) => ({ sort: () => Promise.resolve(rows) });

beforeEach(() => {
  jest.clearAllMocks();
  transactions.exists.mockResolvedValue(null);
  candidates.exists.mockResolvedValue(null);
});

describe('heldMerchantCode', () => {
  it('reads the code, even when the business name has brackets', () => {
    expect(heldMerchantCode(note)).toBe('11112222');
  });
  it('never treats account-locked or deleted holds as creditable', () => {
    expect(heldMerchantCode('Held: Shop (11112222) — account locked')).toBeNull();
    expect(heldMerchantCode('Held: Shop (11112222) — account deleted')).toBeNull();
    expect(heldMerchantCode(null)).toBeNull();
  });
});

describe('reviewHeldDeposits', () => {
  it('passes a clean hold as creditable', async () => {
    held.find.mockReturnValue(sortable([hold()]));
    const { creditable, needsReview } = await review();
    expect(creditable.map((h) => h.transId)).toEqual(['REF1']);
    expect(needsReview).toEqual([]);
  });

  it('sends a hold to review when the same amount was already credited under another reference', async () => {
    held.find.mockReturnValue(sortable([hold()]));
    transactions.exists.mockResolvedValue({ _id: 't1' });
    const { creditable, needsReview } = await review();
    expect(creditable).toEqual([]);
    expect(needsReview[0].reason).toMatch(/already on this merchant/);
  });

  it('sends a hold to review when Credit Missed Collection already paid it', async () => {
    held.find.mockReturnValue(sortable([hold()]));
    candidates.exists.mockResolvedValue({ _id: 'c1' });
    expect((await review()).needsReview[0].reason).toMatch(/Credit Missed Collection/);
  });

  it('does not mistake an earlier credited hold for a double credit', async () => {
    held.find.mockReturnValue(sortable([hold({ _id: 'h0', transId: 'REF0', resolved: true }), hold()]));
    await review();
    expect(transactions.exists.mock.calls[0][0].reference.$nin).toEqual(['REF0', 'REF1']);
  });

  it('flags one deposit recorded by both feeds, but not two on the same feed', async () => {
    held.find.mockReturnValue(sortable([hold(), hold({ _id: 'h2', transId: 'REF2', txnType: RECONCILIATION_FEED, createdAt: at(5) })]));
    let result = await review();
    expect(result.creditable.map((h) => h.transId)).toEqual(['REF1']);
    expect(result.needsReview[0].reason).toMatch(/same deposit as REF1/);

    held.find.mockReturnValue(sortable([hold(), hold({ _id: 'h2', transId: 'REF2', createdAt: at(5) })]));
    result = await review();
    expect(result.creditable).toHaveLength(2);
  });

  it('refuses a hold with no reference, which could not be deduplicated', async () => {
    held.find.mockReturnValue(sortable([hold({ transId: null })]));
    expect((await review()).needsReview[0].reason).toMatch(/No bank reference/);
  });

  it('ignores other merchants', async () => {
    held.find.mockReturnValue(sortable([hold({ resolvedNote: 'Held: Other (99998888) — incoming payments blocked' })]));
    const { creditable, needsReview } = await review();
    expect(creditable).toEqual([]);
    expect(needsReview).toEqual([]);
  });
});

describe('creditHeldDeposit', () => {
  it('credits, closes the hold and closes any swept candidate', async () => {
    held.findOne.mockResolvedValue(hold({ rawCustomerName: 'JANE DOE', rawPhoneNr: '254700000001' }));
    expect(await creditHeldDeposit('h1', merchant, 'admin')).toEqual({ credited: true, amount: 500 });
    expect(creditNcbaCollection).toHaveBeenCalledWith(expect.objectContaining({ grossAmount: 500, bankRef: 'REF1', customerPhone: '254700000001' }));
    expect(held.updateOne.mock.calls[0][1].$set.resolved).toBe(true);
    expect(candidates.findOneAndUpdate.mock.calls[0][1].$set.status).toBe('dismissed');
  });

  it('keeps the note readable as block-held after crediting, so its ref stays excluded', async () => {
    held.findOne.mockResolvedValue(hold());
    await creditHeldDeposit('h1', merchant, 'admin');
    expect(heldMerchantCode(held.updateOne.mock.calls[0][1].$set.resolvedNote)).toBe('11112222');
  });

  it('does nothing when the hold is already closed', async () => {
    held.findOne.mockResolvedValue(null);
    expect(await creditHeldDeposit('h1', merchant, 'admin')).toEqual({ credited: false, amount: 0 });
    expect(creditNcbaCollection).not.toHaveBeenCalled();
  });

  it('closes the hold without counting money when the ledger already has the reference', async () => {
    held.findOne.mockResolvedValue(hold());
    creditNcbaCollection.mockRejectedValueOnce(new DuplicateCollectionError('REF1'));
    expect(await creditHeldDeposit('h1', merchant, 'admin')).toEqual({ credited: false, amount: 0 });
    expect(held.updateOne).toHaveBeenCalled();
  });

  it('leaves the hold open when the credit fails, so it can be retried', async () => {
    held.findOne.mockResolvedValue(hold());
    creditNcbaCollection.mockRejectedValueOnce(new Error('session aborted'));
    await expect(creditHeldDeposit('h1', merchant, 'admin')).rejects.toThrow('session aborted');
    expect(held.updateOne).not.toHaveBeenCalled();
  });
});
