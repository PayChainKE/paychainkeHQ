import EtimsConfig from '../models/EtimsConfig.js';
import EtimsInvoice from '../models/EtimsInvoice.js';
import Merchant from '../models/Merchant.js';
import { saveSalesTransaction, getCmcKeyPlain, EtimsApiError, EtimsConfigError } from './etimsClient.js';
import { generateQrDataUri } from '../utils/qrCode.js';
import {
  money2dp, hyphenateEvery4, buildQrVerificationUrl,
  formatKraDate, formatKraDateTime, paymentMethodToKraCode, TAX_RATES, TAX_TYPE_CODES,
} from '../utils/etimsFormat.js';

export class InsufficientStockError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'InsufficientStockError';
    this.details = details;
  }
}

export class InvoiceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvoiceValidationError';
  }
}

export { EtimsApiError, EtimsConfigError };

// PayChain has no dedicated product/inventory catalog yet, so there's
// nothing server-side to check requested quantities against. This validates
// against stock levels the caller supplies inline per item
// (`availableQty`) — the same shape a POS/inventory system would pass once
// one exists — rather than inventing a whole product/stock subsystem that
// isn't part of this integration's scope. Items with no `availableQty`
// simply skip the check.
function validateStock(items) {
  const shortfalls = items.filter(
    (i) => i.availableQty !== undefined && Number(i.availableQty) < Number(i.qty)
  );
  if (shortfalls.length) {
    throw new InsufficientStockError(
      `Insufficient stock for ${shortfalls.length} item(s)`,
      shortfalls.map((i) => ({ itemNm: i.itemNm, requested: i.qty, available: i.availableQty }))
    );
  }
}

// Computes one line item's tax breakdown. `unitPrice` is tax-inclusive (KRA
// convention) — the taxable base and tax portion are backed out of the net
// amount rather than added on top of it.
export function computeItemTax(item) {
  const qty = money2dp(item.qty);
  const unitPrice = money2dp(item.unitPrice);
  if (!(qty > 0)) throw new InvoiceValidationError(`Item "${item.itemNm || '?'}" needs a positive qty`);
  if (!(unitPrice >= 0)) throw new InvoiceValidationError(`Item "${item.itemNm || '?'}" needs a non-negative unitPrice`);

  const rate = TAX_RATES[item.taxTyCd];
  if (rate === undefined) throw new InvoiceValidationError(`Unknown tax type code "${item.taxTyCd}"`);

  const grossAmt = money2dp(qty * unitPrice);
  const dcAmt = money2dp(item.discountAmt || 0);
  const netAmt = money2dp(grossAmt - dcAmt);
  const taxblAmt = rate > 0 ? money2dp(netAmt / (1 + rate)) : netAmt;
  const taxAmt = rate > 0 ? money2dp(netAmt - taxblAmt) : 0;

  return { qty, unitPrice, grossAmt, dcAmt, netAmt, taxblAmt, taxAmt, totAmt: netAmt };
}

function sumTaxBreakdown(computedItems) {
  const totals = Object.fromEntries(TAX_TYPE_CODES.map((c) => [c, { taxblAmt: 0, taxAmt: 0 }]));
  let totTaxblAmt = 0, totTaxAmt = 0, totAmt = 0;
  for (const it of computedItems) {
    totals[it.taxTyCd].taxblAmt = money2dp(totals[it.taxTyCd].taxblAmt + it.taxblAmt);
    totals[it.taxTyCd].taxAmt = money2dp(totals[it.taxTyCd].taxAmt + it.taxAmt);
    totTaxblAmt = money2dp(totTaxblAmt + it.taxblAmt);
    totTaxAmt = money2dp(totTaxAmt + it.taxAmt);
    totAmt = money2dp(totAmt + it.totAmt);
  }
  return { totals, totTaxblAmt, totTaxAmt, totAmt };
}

function totalsByCode(totals) {
  const out = {};
  for (const c of TAX_TYPE_CODES) {
    out[`taxblAmt${c}`] = totals[c].taxblAmt;
    out[`taxAmt${c}`] = totals[c].taxAmt;
  }
  return out;
}

// Atomic per-branch sequence claim — never read-then-write, so two
// concurrent sales on the same branch can't collide on invcNo.
async function claimNextInvcNo(configId) {
  const config = await EtimsConfig.findByIdAndUpdate(configId, { $inc: { lastInvcNo: 1 } }, { new: true });
  return config.lastInvcNo;
}

async function loadActiveConfig(merchantId, bhfId) {
  const config = await EtimsConfig.findOne({ merchantId, bhfId }).select('+cmcKeyEncrypted');
  if (!config || !config.isInitialized) {
    throw new EtimsConfigError(
      `No initialized eTIMS device for branch "${bhfId}". Call POST /api/v1/etims/init first.`
    );
  }
  return config;
}

async function applyKraSalesResponse(invoiceDoc, config, kraResponse) {
  const data = kraResponse?.data || {};
  const rcptSignRaw = data.rcptSign || '';
  const intrlDataRaw = data.intrlData || '';
  const qrUrl = buildQrVerificationUrl(config.tin, config.bhfId, rcptSignRaw);
  const qrDataUri = await generateQrDataUri(qrUrl);

  invoiceDoc.status = 'signed';
  invoiceDoc.sdcId = data.sdcId || null;
  invoiceDoc.rcptNo = data.rcptNo ?? null;
  invoiceDoc.totRcptNo = data.totRcptNo ?? null;
  invoiceDoc.intrlData = intrlDataRaw;
  invoiceDoc.rcptSign = rcptSignRaw;
  invoiceDoc.formattedInternalData = hyphenateEvery4(intrlDataRaw);
  invoiceDoc.formattedSignature = hyphenateEvery4(rcptSignRaw);
  invoiceDoc.qrUrl = qrUrl;
  invoiceDoc.qrDataUri = qrDataUri;
  invoiceDoc.vsdcRcptPbctDate = data.vsdcRcptPbctDate || null;
  invoiceDoc.kraRawResponse = kraResponse;
  invoiceDoc.errorMessage = null;
  await invoiceDoc.save();
  return invoiceDoc;
}

function buildKraItemList(computedItems) {
  return computedItems.map((it) => ({
    itemSeq: it.itemSeq,
    itemCd: it.itemCd || null,
    itemClsCd: it.itemClsCd,
    itemNm: it.itemNm,
    qty: it.qty,
    qtyUnitCd: it.qtyUnitCd || 'U',
    pkg: it.pkg || 1,
    pkgUnitCd: it.pkgUnitCd || 'NT',
    prc: it.unitPrice,
    splyAmt: it.grossAmt,
    dcRt: it.dcRt || 0,
    dcAmt: it.dcAmt,
    taxTyCd: it.taxTyCd,
    taxblAmt: it.taxblAmt,
    taxAmt: it.taxAmt,
    totAmt: it.totAmt,
  }));
}

// 1. Validates stock, 2. computes exact tax breakdown, 3. claims the next
// ascending invcNo, 4. builds and sends the /saveTrnsSalesOsdc payload,
// 5. parses rcptSign/intrlData/sdcId, 6. generates the QR, 7. persists.
export async function createNormalSale(orderData) {
  const {
    merchantId, bhfId = '00', items = [],
    custTin = null, custNm = null, paymentMethod = 'cash',
  } = orderData || {};

  if (!merchantId) throw new InvoiceValidationError('merchantId is required');
  if (!Array.isArray(items) || !items.length) throw new InvoiceValidationError('At least one line item is required');
  validateStock(items);

  const config = await loadActiveConfig(merchantId, bhfId);
  const cmcKeyPlain = getCmcKeyPlain(config);

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new InvoiceValidationError('Merchant not found');

  const computedItems = items.map((item, idx) => ({ ...item, ...computeItemTax(item), itemSeq: idx + 1 }));
  const { totals, totTaxblAmt, totTaxAmt, totAmt } = sumTaxBreakdown(computedItems);
  const kraItems = buildKraItemList(computedItems);

  const invcNo = await claimNextInvcNo(config._id);
  const salesDt = formatKraDate();
  const pmtTyCd = paymentMethodToKraCode(paymentMethod);

  const salesPayload = {
    invcNo,
    orgInvcNo: 0,
    custTin, custNm,
    salesTyCd: 'N',
    rcptTyCd: 'S',
    pmtTyCd,
    salesSttsCd: '02', // KRA: 02 = approved/complete
    cfmDt: formatKraDateTime(),
    salesDt,
    totItemCnt: kraItems.length,
    ...totalsByCode(totals),
    totTaxblAmt, totTaxAmt, totAmt,
    itemList: kraItems,
  };

  const invoiceDoc = await EtimsInvoice.create({
    merchantId, etimsConfigId: config._id, bhfId: config.bhfId, invcNo,
    transactionType: 'NORMAL_SALE', salesTyCd: 'N', rcptTyCd: 'S', pmtTyCd,
    custTin, custNm, salesDt, items: kraItems,
    ...totalsByCode(totals), totTaxblAmt, totTaxAmt, totAmt,
    totItemCnt: kraItems.length, paymentMethod, status: 'pending',
  });

  try {
    const kraResponse = await saveSalesTransaction(config, cmcKeyPlain, salesPayload);
    await applyKraSalesResponse(invoiceDoc, config, kraResponse);
  } catch (err) {
    invoiceDoc.status = 'failed';
    invoiceDoc.errorMessage = err.message;
    await invoiceDoc.save();
    throw err;
  }

  return invoiceDoc;
}

// 1. Looks up the original invoice (must already be KRA-signed),
// 2. builds a negative adjustment payload referencing orgInvcNo/rcptTyCd:'R',
// 3. transmits and stores the credit note. Every amount on a credit note is
// transmitted as a negative adjustment against the original sale — that's
// what distinguishes rcptTyCd:'R' from simply resubmitting the same sale.
export async function createCreditNote(originalInvoiceId, refundReason, refundItems) {
  if (!refundReason) throw new InvoiceValidationError('refundReason is required');

  const original = await EtimsInvoice.findById(originalInvoiceId);
  if (!original) throw new InvoiceValidationError('Original invoice not found');
  if (original.status !== 'signed') {
    throw new InvoiceValidationError('Cannot issue a credit note against an invoice KRA never successfully signed');
  }

  const config = await EtimsConfig.findById(original.etimsConfigId).select('+cmcKeyEncrypted');
  if (!config || !config.isInitialized) {
    throw new EtimsConfigError('The eTIMS device for this invoice is no longer initialized');
  }
  const cmcKeyPlain = getCmcKeyPlain(config);

  const requested = Array.isArray(refundItems) && refundItems.length ? refundItems : null;
  const sourceItems = (requested || original.items).map((refundItem) => {
    const originalItem = requested
      ? original.items.find((i) => i.itemSeq === refundItem.itemSeq) || refundItem
      : refundItem;
    const refundQty = money2dp(requested && refundItem.qty !== undefined ? refundItem.qty : originalItem.qty);
    if (refundQty > originalItem.qty) {
      throw new InvoiceValidationError(
        `Cannot refund ${refundQty} of "${originalItem.itemNm}" — only ${originalItem.qty} were sold`
      );
    }
    const portion = refundQty / originalItem.qty;

    return {
      itemSeq: originalItem.itemSeq,
      itemCd: originalItem.itemCd,
      itemClsCd: originalItem.itemClsCd,
      itemNm: originalItem.itemNm,
      qty: -refundQty,
      qtyUnitCd: originalItem.qtyUnitCd,
      pkg: originalItem.pkg,
      pkgUnitCd: originalItem.pkgUnitCd,
      prc: originalItem.prc,
      splyAmt: -money2dp(originalItem.splyAmt * portion),
      dcRt: originalItem.dcRt,
      dcAmt: -money2dp((originalItem.dcAmt || 0) * portion),
      taxTyCd: originalItem.taxTyCd,
      taxblAmt: -money2dp(originalItem.taxblAmt * portion),
      taxAmt: -money2dp(originalItem.taxAmt * portion),
      totAmt: -money2dp(originalItem.totAmt * portion),
    };
  });

  const { totals, totTaxblAmt, totTaxAmt, totAmt } = sumTaxBreakdown(
    sourceItems.map((it) => ({ ...it, taxblAmt: it.taxblAmt, taxAmt: it.taxAmt, totAmt: it.totAmt }))
  );

  const invcNo = await claimNextInvcNo(config._id);
  const salesDt = formatKraDate();

  const salesPayload = {
    invcNo,
    orgInvcNo: original.invcNo,
    custTin: original.custTin, custNm: original.custNm,
    salesTyCd: 'N',
    rcptTyCd: 'R',
    pmtTyCd: original.pmtTyCd,
    salesSttsCd: '02',
    cfmDt: formatKraDateTime(),
    salesDt,
    totItemCnt: sourceItems.length,
    ...totalsByCode(totals),
    totTaxblAmt, totTaxAmt, totAmt,
    itemList: sourceItems,
    remark: refundReason,
  };

  const invoiceDoc = await EtimsInvoice.create({
    merchantId: original.merchantId, etimsConfigId: config._id, bhfId: config.bhfId,
    invcNo, orgInvcNo: original.invcNo, originalInvoiceId: original._id,
    transactionType: 'CREDIT_NOTE', salesTyCd: 'N', rcptTyCd: 'R', pmtTyCd: original.pmtTyCd,
    custTin: original.custTin, custNm: original.custNm, salesDt, items: sourceItems,
    ...totalsByCode(totals), totTaxblAmt, totTaxAmt, totAmt,
    totItemCnt: sourceItems.length, paymentMethod: original.paymentMethod,
    status: 'pending', refundReason,
  });

  try {
    const kraResponse = await saveSalesTransaction(config, cmcKeyPlain, salesPayload);
    await applyKraSalesResponse(invoiceDoc, config, kraResponse);
  } catch (err) {
    invoiceDoc.status = 'failed';
    invoiceDoc.errorMessage = err.message;
    await invoiceDoc.save();
    throw err;
  }

  return invoiceDoc;
}
