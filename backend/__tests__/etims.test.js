// Covers everything that's exercisable without a live MongoDB connection:
// the pure formatting/tax-math helpers, the eTIMS HTTP client's simulate
// path (ETIMS_LIVE_ENABLED is unset in this environment, so every call
// below runs the deterministic in-process simulation branch — no network
// call is ever made), and route-level input validation that fails before
// any database access happens.
//
// NOT covered here: the full sale -> KRA -> signed-invoice round trip
// through invoicingService's DB-backed paths (EtimsConfig/EtimsInvoice
// reads/writes). That needs a real MongoDB (set MONGO_URI to a disposable
// test database — e.g. via mongodb-memory-server) and is out of scope for
// this offline suite; computeItemTax, the piece with the actual financial
// logic, is unit-tested directly below instead.

import express from 'express';
import request from 'supertest';

import {
  money2dp, money2dpString, hyphenateEvery4, buildQrVerificationUrl,
  formatKraDate, formatKraDateTime, paymentMethodToKraCode,
} from '../utils/etimsFormat.js';
import { initializeDevice, saveSalesTransaction, isLiveCallsEnabled } from '../services/etimsClient.js';
import { computeItemTax, InvoiceValidationError } from '../services/invoicingService.js';
import { buildReceiptData, renderReceiptHtml } from '../utils/receiptFormatter.js';
import { initDevice, syncItems, signInvoice, issueCreditNote } from '../controllers/etimsController.js';

describe('etimsFormat helpers', () => {
  test('money2dp rounds away float drift', () => {
    expect(money2dp(0.1 + 0.2)).toBe(0.3);
    expect(money2dp(19.999)).toBe(20);
    expect(money2dp('12.345')).toBe(12.35);
    expect(money2dp(undefined)).toBe(0);
  });

  test('money2dpString always shows 2 decimals', () => {
    expect(money2dpString(5)).toBe('5.00');
    expect(money2dpString(5.1)).toBe('5.10');
  });

  test('hyphenateEvery4 splits every 4 characters', () => {
    expect(hyphenateEvery4('TE68SLA234J5')).toBe('TE68-SLA2-34J5');
    expect(hyphenateEvery4('')).toBe('');
    expect(hyphenateEvery4(null)).toBe('');
  });

  test('buildQrVerificationUrl concatenates tin+bhfId+rcptSign into the query string', () => {
    const url = buildQrVerificationUrl('P123456789X', '00', 'TE68SLA234J5');
    expect(url).toBe('https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?P123456789X00TE68SLA234J5');
  });

  test('formatKraDate / formatKraDateTime use KRA numeric formats', () => {
    const d = new Date('2026-08-17T09:05:03Z');
    expect(formatKraDate(d)).toMatch(/^\d{8}$/);
    expect(formatKraDateTime(d)).toMatch(/^\d{14}$/);
    expect(formatKraDateTime(d).startsWith(formatKraDate(d))).toBe(true);
  });

  test('paymentMethodToKraCode maps known methods and falls back to Other', () => {
    expect(paymentMethodToKraCode('cash')).toBe('01');
    expect(paymentMethodToKraCode('mobile_money')).toBe('06');
    expect(paymentMethodToKraCode('bitcoin')).toBe('07');
  });
});

describe('invoicingService.computeItemTax', () => {
  test('backs out an 16% (B) tax-inclusive amount correctly', () => {
    const r = computeItemTax({ itemNm: 'Widget', qty: 2, unitPrice: 116, taxTyCd: 'B' });
    expect(r.grossAmt).toBe(232);
    expect(r.taxblAmt).toBe(200);
    expect(r.taxAmt).toBe(32);
    expect(r.totAmt).toBe(232);
  });

  test('8% (E) rate', () => {
    const r = computeItemTax({ itemNm: 'Fuel surcharge item', qty: 1, unitPrice: 108, taxTyCd: 'E' });
    expect(r.taxblAmt).toBe(100);
    expect(r.taxAmt).toBe(8);
  });

  test('exempt/zero-rated (A, C) and non-VAT (D) charge no tax', () => {
    for (const code of ['A', 'C', 'D']) {
      const r = computeItemTax({ itemNm: 'x', qty: 1, unitPrice: 50, taxTyCd: code });
      expect(r.taxAmt).toBe(0);
      expect(r.taxblAmt).toBe(50);
    }
  });

  test('applies a line-level discount before splitting tax', () => {
    const r = computeItemTax({ itemNm: 'Widget', qty: 1, unitPrice: 116, taxTyCd: 'B', discountAmt: 11.6 });
    expect(r.netAmt).toBe(104.4);
    expect(r.totAmt).toBe(104.4);
  });

  test('rejects an unknown tax type code', () => {
    expect(() => computeItemTax({ itemNm: 'x', qty: 1, unitPrice: 10, taxTyCd: 'Z' }))
      .toThrow(InvoiceValidationError);
  });

  test('rejects a non-positive quantity', () => {
    expect(() => computeItemTax({ itemNm: 'x', qty: 0, unitPrice: 10, taxTyCd: 'B' }))
      .toThrow(InvoiceValidationError);
  });
});

describe('etimsClient simulate mode (ETIMS_LIVE_ENABLED unset -> no real network call)', () => {
  test('is not live in this test environment', () => {
    expect(isLiveCallsEnabled()).toBe(false);
  });

  test('initializeDevice returns a deterministic simulated cmcKey', async () => {
    const { cmcKey, raw } = await initializeDevice({ tin: 'P123456789X', bhfId: '00', dvcSrlNo: 'DVC001', environment: 'sandbox' });
    expect(typeof cmcKey).toBe('string');
    expect(cmcKey.length).toBeGreaterThan(0);
    expect(raw.resultCd).toBe('000');
  });

  test('saveSalesTransaction returns a well-formed simulated fiscal response', async () => {
    const config = { tin: 'P123456789X', bhfId: '00', environment: 'sandbox' };
    const res = await saveSalesTransaction(config, 'fake-cmc-key', { invcNo: 42 });
    expect(res.resultCd).toBe('000');
    expect(res.data.rcptNo).toBe(42);
    expect(res.data.sdcId).toEqual(expect.stringContaining('00'));
    expect(typeof res.data.rcptSign).toBe('string');
    expect(typeof res.data.intrlData).toBe('string');
  });
});

describe('receiptFormatter', () => {
  const invoice = {
    _id: 'inv1', invcNo: 42, transactionType: 'NORMAL_SALE',
    custTin: null, custNm: 'Jane Doe',
    items: [{ itemCd: 'SKU-1', itemClsCd: '5059690800', itemNm: 'Widget', qty: 2, prc: 116, taxTyCd: 'B', totAmt: 232 }],
    totTaxblAmt: 200, totTaxAmt: 32, totAmt: 232, discountAmt: 0,
    taxblAmtA: 0, taxAmtA: 0, taxblAmtB: 200, taxAmtB: 32, taxblAmtC: 0, taxAmtC: 0, taxblAmtD: 0, taxAmtD: 0, taxblAmtE: 0, taxAmtE: 0,
    sdcId: 'SDC00SIM00', rcptNo: 42, totRcptNo: 42,
    rcptSign: 'SIM0000000042RCPTSIGN00000000000',
    intrlData: 'SIM0000000042INTRLDATA0000000000',
    formattedSignature: null, formattedInternalData: null,
    qrUrl: 'https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?P123456789X00SIM',
    qrDataUri: null, createdAt: new Date('2026-08-17T09:00:00Z'),
  };
  const merchant = { businessName: 'PayChain QA Biz', kraPin: 'P123456789X', area: 'CBD', county: 'Nairobi' };

  test('buildReceiptData shapes trader/buyer/items/SCU block correctly', () => {
    const data = buildReceiptData(invoice, merchant);
    expect(data.trader.name).toBe('PayChain QA Biz');
    expect(data.trader.pin).toBe('P123456789X');
    expect(data.items).toHaveLength(1);
    expect(data.items[0].lineTotal).toBe('232.00');
    expect(data.grandTotal).toBe('232.00');
    expect(data.scu.cuInvoiceNumber).toBe('SDC00SIM00/42');
    expect(data.scu.internalData).toBe(hyphenateEvery4(invoice.intrlData));
    expect(data.scu.receiptSignature).toBe(hyphenateEvery4(invoice.rcptSign));
    expect(data.taxBreakdown).toEqual([{ code: 'B', label: 'VAT16', taxblAmt: '200.00', taxAmt: '32.00' }]);
  });

  test('renderReceiptHtml produces HTML containing the key fiscal fields', () => {
    const html = renderReceiptHtml(invoice, merchant);
    expect(html).toContain('PayChain QA Biz');
    expect(html).toContain('232.00');
    expect(html).toContain(hyphenateEvery4(invoice.rcptSign));
    expect(html).toContain('SDC00SIM00/42');
  });
});

// Minimal harness: real controller functions, a stub in place of
// protectMerchant so these validation-only cases never need a live DB or a
// JWT. Anything that would require a DB read (e.g. "config not found")
// is intentionally not exercised here — see the file header.
function buildTestApp(merchantKraPin = 'P051892647X') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.merchant = { _id: '507f1f77bcf86cd799439011', kraPin: merchantKraPin };
    next();
  });
  app.post('/init', initDevice);
  app.post('/items/sync', syncItems);
  app.post('/invoices/sign', signInvoice);
  app.post('/invoices/credit-note', issueCreditNote);
  return app;
}

describe('etims routes — validation before any DB access', () => {
  const app = buildTestApp();

  test('POST /init 400s without dvcSrlNo', async () => {
    const res = await request(app).post('/init').send({ bhfId: '00' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /init 400s on an invalid environment', async () => {
    const res = await request(app).post('/init').send({ dvcSrlNo: 'DVC001', environment: 'staging' });
    expect(res.status).toBe(400);
  });

  test('POST /init 400s when the merchant profile has a fake/malformed KRA PIN', async () => {
    const fakeApp = buildTestApp('P123456789A'); // sequential-digit placeholder, same one KRA_PIN_FORMAT_HINT used to suggest
    const res = await request(fakeApp).post('/init').send({ dvcSrlNo: 'DVC001', environment: 'sandbox' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid format/i);
  });

  test('POST /items/sync 400s on an empty items array', async () => {
    const res = await request(app).post('/items/sync').send({ items: [] });
    expect(res.status).toBe(400);
  });

  test('POST /invoices/sign 400s with no line items', async () => {
    const res = await request(app).post('/invoices/sign').send({ items: [] });
    expect(res.status).toBe(400);
  });

  test('POST /invoices/sign 409s when a line item is short on stock', async () => {
    const res = await request(app).post('/invoices/sign').send({
      items: [{ itemNm: 'Widget', itemClsCd: '5059690800', qty: 5, unitPrice: 100, taxTyCd: 'B', availableQty: 2 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.details[0]).toMatchObject({ requested: 5, available: 2 });
  });

  test('POST /invoices/credit-note 400s without originalInvoiceId', async () => {
    const res = await request(app).post('/invoices/credit-note').send({ refundReason: 'Customer return' });
    expect(res.status).toBe(400);
  });
});
