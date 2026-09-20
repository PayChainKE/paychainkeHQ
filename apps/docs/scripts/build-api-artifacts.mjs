#!/usr/bin/env node
// Builds the two files developers import: an OpenAPI 3.0 description of the
// public API and a Postman collection made from it. Run after any change to
// the public endpoints:
//
//   node scripts/build-api-artifacts.mjs
//
// Writes public/openapi.json and public/paychain.postman_collection.json.
// The shapes come from backend/utils/developerPaymentView.js, the checkout
// controller and the invoice serializer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const VERSION = '1.0.0';

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const num = (description, extra = {}) => ({ type: 'number', description, ...extra });
const dt = (description) => ({ type: 'string', format: 'date-time', description });
const idParam = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'string' } });
const idem = { $ref: '#/components/parameters/IdempotencyKey' };
const jsonBody = (schema, example, required = true) => ({ required, content: { 'application/json': { schema, ...(example ? { example } : {}) } } });
const ok = (description, schema, status = '200') => ({ [status]: { description, content: { 'application/json': { schema } } } });
const errs = (...codes) => Object.fromEntries(codes.map((c) => [c, { $ref: `#/components/responses/E${c}` }]));

const schemas = {
  Error: obj({ error: str('What went wrong, in plain words.'), code: str('A stable machine-readable code, when there is one. Examples: IDEMPOTENCY_KEY_REQUIRED, NO_LINKED_MERCHANT, API_PAYOUT_NOT_ENABLED, PER_TRANSACTION_CAP_EXCEEDED, DAILY_CAP_EXCEEDED, INVALID_API_KEY.') }, ['error']),
  Payment: obj({
    id: str('Payment id.'),
    mode: { type: 'string', enum: ['test', 'live'] },
    kind: { type: 'string', enum: ['collect', 'payout'] },
    origin: { type: 'string', enum: ['api', 'admin_test'], description: 'admin_test is a small real payment PayChain staff made to check your setup. Safe to ignore.' },
    merchantId: { type: 'string', nullable: true, description: 'The merchant this payment belongs to. Null for test-mode payments made before any merchant is linked.' },
    amount: num('Amount in Kenyan shillings.'),
    currency: { type: 'string', enum: ['KES'] },
    status: { type: 'string', enum: ['pending', 'success', 'failed'] },
    failureReason: { type: 'string', nullable: true },
    reference: { type: 'string', nullable: true, description: 'Your own reference, returned unchanged on every webhook.' },
    counterparty: { type: 'object', additionalProperties: true, description: 'Who paid or was paid: { phone } for a collection; bank, mobile money, paybill or till details for a payout.' },
    batchId: { type: 'string', nullable: true },
    payeeType: { type: 'string', nullable: true, enum: ['employee', 'contract'] },
    grossAmount: { type: 'number', nullable: true },
    taxDeductions: { type: 'object', nullable: true, additionalProperties: true },
    createdAt: dt('When it was created.'),
    updatedAt: dt('When it last changed.'),
  }, ['id', 'mode', 'kind', 'amount', 'currency', 'status']),
  CheckoutSession: obj({
    id: str('Checkout session id.'),
    mode: { type: 'string', enum: ['test', 'live'] },
    amount: num('Whole shillings.'),
    currency: { type: 'string', enum: ['KES'] },
    reference: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['pending', 'processing', 'success', 'expired'] },
    callbackUrl: { type: 'string', nullable: true },
    checkoutUrl: str('Send the customer here.'),
    qrCodeDataUri: str('The same URL as a scannable PNG (data URI).'),
    expiresAt: dt('When the link stops working.'),
    createdAt: dt('When it was created.'),
  }, ['id', 'amount', 'status', 'checkoutUrl']),
  InvoiceItem: obj({
    description: str('Line description (max 200 characters).'),
    qty: num('Quantity.'),
    price: num('Unit price in KES.'),
    discountRate: num('Percent discount, 0 to 100.'),
    taxTyCd: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'], description: 'KRA tax type code. Defaults to B.' },
    itemClsCd: { type: 'string', nullable: true, description: 'KRA item classification code.' },
  }, ['description', 'qty', 'price']),
  InvoiceCustomer: obj({
    name: str('Required.'), email: { type: 'string', nullable: true }, phone: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true }, kraPin: { type: 'string', nullable: true, description: 'Required when your merchant has a verified KRA PIN.' },
  }, ['name']),
  Invoice: obj({
    _id: str('Invoice id.'), invoiceNumber: str('For example INV-000042.'), publicToken: str('Token in the public view link.'),
    customer: ref('InvoiceCustomer'), items: { type: 'array', items: ref('InvoiceItem') },
    currency: { type: 'string', enum: ['KES'] }, issueDate: dt('Issue date.'), dueDate: { ...dt('Due date.'), nullable: true }, notes: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'sent', 'paid', 'void'] },
    subtotal: num('Before discount.'), discount: num('Total discount.'), total: num('What the customer pays.'),
    sentAt: { ...dt('When it was emailed.'), nullable: true }, paidAt: { ...dt('When it was paid.'), nullable: true }, createdAt: dt('When it was created.'),
    payUrl: { type: 'string', nullable: true, description: 'Payment page. Set once the invoice is sent.' },
    paymentLinkStatus: { type: 'string', nullable: true }, qrCodeDataUri: str('QR code of the payment or view link.'),
    etims: { type: 'object', additionalProperties: true, description: 'KRA eTIMS signing status and receipt data.' },
  }, ['_id', 'invoiceNumber', 'status', 'total']),
  PayoutDestination: {
    type: 'object',
    description: 'Send exactly one destination: bankCode + accountNumber, phone, paybillNumber + accountReference, or tillNumber.',
    properties: {
      bankCode: str('Bank code.'), accountNumber: str('Bank account number.'), accountName: str('Beneficiary name (optional).'),
      phone: str('Mobile money number.'), mobileNetwork: { type: 'string', enum: ['safaricom', 'airtel'], description: 'Defaults to safaricom.' },
      paybillNumber: str('Paybill number.'), accountReference: str('Account number at the paybill.'), tillNumber: str('Till number.'),
    },
  },
};

const paymentResponse = (description, status = '200') => ok(description, obj({ success: { type: 'boolean' }, payment: ref('Payment'), replayed: { type: 'boolean', description: 'True when this Idempotency-Key was used before and the original payment is returned.' } }, ['success', 'payment']), status);

const paths = {
  '/api/v1/developer/ping': {
    get: {
      tags: ['Account'], operationId: 'ping', summary: 'Check your API key',
      description: 'Returns the key\'s mode. A quick way to confirm a key works.',
      responses: { ...ok('The key is valid.', obj({ success: { type: 'boolean' }, mode: { type: 'string', enum: ['test', 'live'] }, developer: obj({ companyName: { type: 'string' } }) }, ['success', 'mode'])), ...errs(401, 429) },
    },
  },
  '/api/v1/developer/payments/collect': {
    post: {
      tags: ['Payments'], operationId: 'collectPayment', summary: 'Collect a payment (M-PESA STK push)',
      description: 'Sends an M-PESA prompt to the customer\'s phone. In test mode nothing real is sent and the payment settles to success after about 4 seconds. Listen for the payment.collect.succeeded webhook.',
      parameters: [idem],
      requestBody: jsonBody(obj({ amount: num('Whole shillings, greater than zero.', { minimum: 1 }), phone: str('Customer phone, for example 0712345678.'), reference: str('Your own reference. Returned on every webhook.') }, ['amount', 'phone']), { amount: 500, phone: '0712345678', reference: 'order-1001' }),
      responses: { ...paymentResponse('Started.', '201'), ...paymentResponse('Replay of an earlier request with the same Idempotency-Key.'), ...errs(400, 401, 409, 429) },
    },
  },
  '/api/v1/developer/payments/payout': {
    post: {
      tags: ['Payments'], operationId: 'payoutPayment', summary: 'Send money',
      description: 'Pays out to a bank account, mobile money number, Paybill or Till. Live payouts need the merchant to have API payouts enabled, and the payout PIN in apiPayoutPin. Amounts are capped per payment and per day.',
      parameters: [idem],
      requestBody: jsonBody({ allOf: [ref('PayoutDestination'), obj({ amount: num('Whole shillings, greater than zero.', { minimum: 1 }), narration: str('Shown on the statement.'), apiPayoutPin: str('The merchant\'s API payout PIN. Required for live keys.') }, ['amount'])] }, { amount: 1000, phone: '0712345678', narration: 'Refund order-1001' }),
      responses: { ...paymentResponse('Accepted.', '201'), ...paymentResponse('Replay of an earlier request with the same Idempotency-Key.'), ...errs(400, 401, 403, 409, 429) },
    },
  },
  '/api/v1/developer/payments/{id}': {
    get: {
      tags: ['Payments'], operationId: 'getPayment', summary: 'Get a payment',
      parameters: [idParam('id', 'Payment id.')],
      responses: { ...paymentResponse('The payment.'), ...errs(401, 404, 429) },
    },
  },
  '/api/v1/developer/checkout': {
    post: {
      tags: ['Hosted checkout'], operationId: 'createCheckout', summary: 'Create a hosted checkout link',
      description: 'PayChain hosts the payment page. Send the customer to checkoutUrl. The result arrives on your webhook with the same reference.',
      requestBody: jsonBody(obj({
        amount: num('Whole shillings. A value with cents is rounded up.', { minimum: 1 }),
        reference: str('Your own reference. Returned on every webhook.'),
        description: str('Shown to the customer (max 200 characters).'),
        callbackUrl: str('Where to send the customer afterwards. https only.'),
        customer: obj({ phone: str('Pre-fills the phone field.'), email: str('Customer email.'), name: str('Customer name.') }),
        expiresInMinutes: { type: 'integer', minimum: 5, maximum: 10080, description: 'How long the link works. Default 30, from 5 minutes to 7 days.' },
      }, ['amount']), { amount: 1500, reference: 'TKT-1042', description: 'Concert, 2 tickets', callbackUrl: 'https://tickets.example.com/orders/1042', expiresInMinutes: 10 }),
      responses: { ...ok('Created.', obj({ success: { type: 'boolean' }, session: ref('CheckoutSession') }, ['success', 'session']), '201'), ...errs(400, 401, 429) },
    },
  },
  '/api/v1/developer/checkout/{id}': {
    get: {
      tags: ['Hosted checkout'], operationId: 'getCheckout', summary: 'Get a checkout session',
      description: 'Use it as a fallback if a webhook is late. status is success once the customer has paid.',
      parameters: [idParam('id', 'Checkout session id.')],
      responses: { ...ok('The session.', obj({ success: { type: 'boolean' }, session: ref('CheckoutSession') }, ['success', 'session'])), ...errs(401, 404, 429) },
    },
  },
  '/api/v1/developer/invoices': {
    post: {
      tags: ['Invoices'], operationId: 'createInvoice', summary: 'Create an invoice (draft)',
      description: 'Creating an invoice moves no money. Needs a linked merchant. Send it with POST /invoices/{id}/send.',
      requestBody: jsonBody(obj({ customer: ref('InvoiceCustomer'), items: { type: 'array', items: ref('InvoiceItem') }, issueDate: dt('Defaults to now.'), dueDate: dt('Optional.'), notes: str('Shown on the invoice.') }, ['customer', 'items']), { customer: { name: 'Wanjiku Traders', email: 'accounts@wanjiku.example' }, items: [{ description: 'Monthly service', qty: 1, price: 3500 }], dueDate: '2026-10-15T00:00:00.000Z' }),
      responses: { ...ok('Created.', obj({ success: { type: 'boolean' }, invoice: ref('Invoice') }, ['success', 'invoice']), '201'), ...errs(400, 401, 429) },
    },
    get: {
      tags: ['Invoices'], operationId: 'listInvoices', summary: 'List invoices',
      description: 'Your 100 most recent invoices, newest first.',
      responses: { ...ok('The invoices.', obj({ success: { type: 'boolean' }, invoices: { type: 'array', items: ref('Invoice') } }, ['success', 'invoices'])), ...errs(401, 429) },
    },
  },
  '/api/v1/developer/invoices/{id}': {
    get: {
      tags: ['Invoices'], operationId: 'getInvoice', summary: 'Get an invoice',
      parameters: [idParam('id', 'Invoice id.')],
      responses: { ...ok('The invoice.', obj({ success: { type: 'boolean' }, invoice: ref('Invoice') }, ['success', 'invoice'])), ...errs(401, 404, 429) },
    },
  },
  '/api/v1/developer/invoices/{id}/send': {
    post: {
      tags: ['Invoices'], operationId: 'sendInvoice', summary: 'Email an invoice to the customer',
      description: 'Emails the customer a payable invoice. The customer needs an email address. You get invoice.sent now and invoice.paid when it is paid.',
      parameters: [idParam('id', 'Invoice id.')],
      responses: { ...ok('Sent.', obj({ success: { type: 'boolean' }, invoice: ref('Invoice') }, ['success', 'invoice'])), ...errs(400, 401, 404, 429, 502) },
    },
  },
  '/api/v1/developer/bulk-payments': {
    post: {
      tags: ['Bulk payments'], operationId: 'createBulkPayment', summary: 'Pay many people in one call',
      description: 'Up to 200 payouts per batch, each with its own destination. Live batches need API payouts enabled and the payout PIN. Track it with GET /bulk-payments/{batchId} and the payment.payout.* webhooks.',
      parameters: [idem],
      requestBody: jsonBody(obj({
        payments: { type: 'array', minItems: 1, maxItems: 200, items: { allOf: [ref('PayoutDestination'), obj({ amount: num('Whole shillings.', { minimum: 1 }), payeeType: { type: 'string', enum: ['employee', 'contract'], description: 'Defaults to contract.' }, narration: str('Shown on the statement.') }, ['amount'])] } },
        apiPayoutPin: str('The merchant\'s API payout PIN. Required for live keys.'),
      }, ['payments']), { payments: [{ amount: 1200, phone: '0712345678', narration: 'Delivery fee' }, { amount: 900, phone: '0723456789', narration: 'Delivery fee' }] }),
      responses: {
        ...ok('Accepted.', obj({ success: { type: 'boolean' }, batchId: { type: 'string' }, payments: { type: 'array', items: ref('Payment') } }, ['success', 'batchId', 'payments']), '201'),
        ...ok('Replay of an earlier request with the same Idempotency-Key.', obj({ success: { type: 'boolean' }, batchId: { type: 'string' }, payments: { type: 'array', items: ref('Payment') }, replayed: { type: 'boolean' } })),
        ...errs(400, 401, 403, 409, 429),
      },
    },
  },
  '/api/v1/developer/bulk-payments/{batchId}': {
    get: {
      tags: ['Bulk payments'], operationId: 'getBulkPayment', summary: 'Get a batch',
      parameters: [idParam('batchId', 'Batch id from the create call.')],
      responses: { ...ok('Every payment in the batch.', obj({ success: { type: 'boolean' }, batchId: { type: 'string' }, payments: { type: 'array', items: ref('Payment') } }, ['success', 'batchId', 'payments'])), ...errs(401, 404, 429) },
    },
  },
};

const errorResponse = (description) => ({ description, content: { 'application/json': { schema: ref('Error') } } });

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'PayChain Developer API',
    version: VERSION,
    description: [
      'Collect M-PESA payments, send money, invoice customers and pay in bulk, then get told when each one resolves.',
      '',
      '**Keys.** `pc_test_` keys use the sandbox: no real money, no merchant needed. `pc_live_` keys move real money for the one merchant they are tied to. Send the key as `Authorization: Bearer <key>`.',
      '',
      '**Idempotency.** Collection, payout and bulk calls need an `Idempotency-Key` header. Repeat a request with the same key and you get the original result back, never a second payment.',
      '',
      '**Webhooks.** Register an https endpoint in the developer portal. Every delivery is a POST with a JSON body `{ id, event, createdAt, data }` and an `X-PayChain-Signature` header: the hex HMAC-SHA256 of the raw body using your webhook secret. Events: `payment.collect.succeeded`, `payment.collect.failed`, `payment.payout.succeeded`, `payment.payout.failed`, `payment.paybill.received`, `invoice.sent`, `invoice.paid`, `bulk_payment.completed`. Failed deliveries retry after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours.',
      '',
      '**Limits per key, per 15 minutes.** Reads 900, collections and checkouts 600, payouts, bulk payments and invoice sends 60. Over the limit you get HTTP 429.',
      '',
      'Amounts are whole Kenyan shillings (KES). Guides: https://developer.paychain.co.ke',
    ].join('\n'),
  },
  servers: [{ url: 'https://api.paychain.co.ke', description: 'Production (test and live keys)' }],
  security: [{ bearerAuth: [] }],
  tags: [{ name: 'Account' }, { name: 'Payments' }, { name: 'Hosted checkout' }, { name: 'Invoices' }, { name: 'Bulk payments' }],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'pc_test_… or pc_live_…', description: 'Your API key.' } },
    parameters: { IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, description: 'A unique value per operation, for example your order id. A repeat returns the original result.', schema: { type: 'string' } } },
    responses: {
      E400: errorResponse('The request is invalid. The error field says why.'),
      E401: errorResponse('Missing, invalid or revoked API key, or a wrong payout PIN.'),
      E403: errorResponse('Not allowed: API payouts are off for this merchant, or a cap was exceeded.'),
      E404: errorResponse('Not found (or it belongs to another key\'s merchant).'),
      E409: errorResponse('The same Idempotency-Key is already being processed.'),
      E429: errorResponse('Too many requests for this key. Slow down.'),
      E502: errorResponse('A downstream service (for example KRA eTIMS) refused or failed.'),
    },
    schemas,
  },
};

// ------------------------------------------------------------- Postman
const IDS = { createCheckout: ['checkoutId', 'session.id'], collectPayment: ['paymentId', 'payment.id'], payoutPayment: ['paymentId', 'payment.id'], createInvoice: ['invoiceId', 'invoice._id'], createBulkPayment: ['batchId', 'batchId'] };

function postmanItem(pathKey, method, op) {
  const idVar = pathKey.includes('checkout') ? 'checkoutId' : pathKey.includes('invoices') ? 'invoiceId' : pathKey.includes('bulk') ? 'batchId' : 'paymentId';
  const segments = pathKey.split('/').filter(Boolean).map((s) => (s === '{id}' ? `{{${idVar}}}` : s === '{batchId}' ? '{{batchId}}' : s));
  const headers = [{ key: 'Content-Type', value: 'application/json' }];
  if ((op.parameters || []).some((p) => p.$ref === '#/components/parameters/IdempotencyKey')) headers.push({ key: 'Idempotency-Key', value: '{{$guid}}', description: 'A fresh value per request. Use your own order id in real code.' });
  const example = op.requestBody?.content?.['application/json']?.example;
  const item = {
    name: op.summary,
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: { raw: `{{baseUrl}}/${segments.join('/')}`, host: ['{{baseUrl}}'], path: segments },
      description: op.description || '',
      ...(example ? { body: { mode: 'raw', raw: JSON.stringify(example, null, 2), options: { raw: { language: 'json' } } } } : {}),
    },
  };
  const save = IDS[op.operationId];
  if (save) {
    const [variable, pathInResponse] = save;
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: [
      `if (pm.response.code === 201 || pm.response.code === 200) {`,
      `  const body = pm.response.json();`,
      `  const value = ${pathInResponse.split('.').reduce((acc, k) => `${acc}?.${k}`, 'body')};`,
      `  if (value) pm.collectionVariables.set('${variable}', value);`,
      `}`,
    ] } }];
  }
  return item;
}

const groups = new Map();
for (const [p, methods] of Object.entries(paths)) {
  for (const [m, op] of Object.entries(methods)) {
    const tag = op.tags[0];
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(postmanItem(p, m, op));
  }
}

const postman = {
  info: {
    name: 'PayChain Developer API',
    description: 'Set the apiKey variable to a pc_test_ key and send Ping first. Requests that create something save its id, so the next request (Get a payment, Get a checkout session, and so on) works without copying ids by hand.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    version: VERSION,
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'https://api.paychain.co.ke' },
    { key: 'apiKey', value: 'pc_test_replace_me' },
    { key: 'paymentId', value: '' }, { key: 'checkoutId', value: '' }, { key: 'invoiceId', value: '' }, { key: 'batchId', value: '' },
  ],
  item: [...groups.entries()].map(([name, item]) => ({ name, item })),
};

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'openapi.json'), JSON.stringify(spec, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'paychain.postman_collection.json'), JSON.stringify(postman, null, 2) + '\n');
console.log(`Wrote openapi.json (${Object.keys(paths).length} paths) and paychain.postman_collection.json (${[...groups.values()].flat().length} requests)`);
