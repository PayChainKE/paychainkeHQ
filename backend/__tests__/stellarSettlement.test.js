import {
  computeSplit, buildReceiptHash, buildSimulatedB2C, maskPhone, ledgerToCsv, isDefinitiveFailure,
  explorerTxUrl, SettlementError, RECONCILIATION_COLUMNS,
} from '../services/stellarSettlementService.js';

describe('computeSplit', () => {
  test('80/20 style split, rounded to cents, parts add up', () => {
    expect(computeSplit(10000, 20)).toEqual({ stellarKes: 2000, liquidKes: 8000 });
    const s = computeSplit(333.33, 20);
    expect(s.stellarKes).toBe(66.67);
    expect(Math.round((s.stellarKes + s.liquidKes) * 100) / 100).toBe(333.33);
  });
  test('0%, 100% and clamped/invalid inputs', () => {
    expect(computeSplit(500, 0)).toEqual({ stellarKes: 0, liquidKes: 500 });
    expect(computeSplit(500, 100)).toEqual({ stellarKes: 500, liquidKes: 0 });
    expect(computeSplit(500, 250)).toEqual({ stellarKes: 500, liquidKes: 0 });
    expect(computeSplit(-5, 20)).toEqual({ stellarKes: 0, liquidKes: 0 });
    expect(computeSplit('abc', 20)).toEqual({ stellarKes: 0, liquidKes: 0 });
    expect(computeSplit(500, 'x')).toEqual({ stellarKes: 0, liquidKes: 500 });
  });
});

describe('buildReceiptHash', () => {
  test('is deterministic and independent of key order', () => {
    const a = buildReceiptHash({ x: 1, y: { b: 2, a: 1 } });
    const b = buildReceiptHash({ y: { a: 1, b: 2 }, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  test('changes when any field changes', () => {
    expect(buildReceiptHash({ amount: 10 })).not.toBe(buildReceiptHash({ amount: 11 }));
  });
});

describe('simulated B2C', () => {
  const b2c = buildSimulatedB2C({ phone: '0712345678', kesAmount: 1300, reference: 'abc' });
  test('is Daraja-shaped, clearly simulated, and can never be sent anywhere', () => {
    expect(b2c.simulated).toBe(true);
    expect(b2c.request.PartyB).toBe('254712345678');
    expect(b2c.request.CommandID).toBe('BusinessPayment');
    expect(b2c.request.SecurityCredential).toBe('SIMULATED');
    expect(b2c.request.ResultURL).toMatch(/\.invalid\//);
    expect(b2c.response.Result.ResultCode).toBe(0);
    expect(b2c.response.Result.ResultDesc).toMatch(/SIMULATED/);
    expect(b2c.response.Result.TransactionID).toMatch(/^SIM[0-9A-F]{8}$/);
  });
  test('phone is masked for display', () => {
    expect(maskPhone('254712345678')).toBe('0712 *** 678');
    expect(maskPhone('0712345678')).toBe('0712 *** 678');
    expect(maskPhone('')).toBeNull();
  });
});

describe('reconciliation CSV', () => {
  const entry = {
    createdAt: '2026-09-20T10:00:00.000Z', kind: 'split_settlement', status: 'completed',
    sourceReference: 'FT123', splitPercent: 20, kesAmount: 2000, usdcAmount: 15.3846154, rate: 0.0076923,
    stellarTxHash: 'abc123', receiptHash: 'r'.repeat(64), errorMessage: '',
  };
  test('links each row to StellarExpert testnet and has the header', () => {
    const csv = ledgerToCsv([entry]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(RECONCILIATION_COLUMNS.join(','));
    expect(lines[1]).toContain('https://stellar.expert/explorer/testnet/tx/abc123');
    expect(explorerTxUrl('abc123')).toBe('https://stellar.expert/explorer/testnet/tx/abc123');
    expect(explorerTxUrl(null)).toBeNull();
  });
  test('neutralises spreadsheet formula injection and quotes commas', () => {
    const csv = ledgerToCsv([{ ...entry, sourceReference: '=HYPERLINK("x")', errorMessage: 'a,b' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a,b"');
  });
});

describe('failure classification', () => {
  test('definitive rejections are refundable', () => {
    expect(isDefinitiveFailure(new Error('Master wallet has insufficient USDC balance.'))).toBe(true);
    expect(isDefinitiveFailure(new Error('Merchant wallet has no USDC trustline for this issuer.'))).toBe(true);
    expect(isDefinitiveFailure(new Error('Blockchain settlement failed ({"transaction":"tx_bad_seq"}).'))).toBe(true);
    expect(isDefinitiveFailure(new SettlementError('x', 'INSUFFICIENT_USDC'))).toBe(true);
  });
  test('timeouts and network errors are ambiguous (never auto-refunded)', () => {
    expect(isDefinitiveFailure(new SettlementError('The Stellar network did not respond in time.', 'RPC_TIMEOUT', 504))).toBe(false);
    expect(isDefinitiveFailure(new Error('Blockchain settlement failed (undefined).'))).toBe(false);
    expect(isDefinitiveFailure(new Error('socket hang up'))).toBe(false);
  });
});
