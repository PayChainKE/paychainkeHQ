import EtimsConfig from '../models/EtimsConfig.js';
import EtimsInvoice from '../models/EtimsInvoice.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import { initializeDevice, registerItem, getCmcKeyPlain, EtimsApiError } from '../services/etimsClient.js';
import {
  createNormalSale, createCreditNote,
  InsufficientStockError, InvoiceValidationError, EtimsConfigError,
} from '../services/invoicingService.js';
import { generateZReport } from '../services/reportService.js';
import { isValidKraPin, KRA_PIN_FORMAT_HINT } from '../utils/kraPinValidator.js';

function serializeInvoice(invoice) {
  return {
    id: invoice._id,
    invcNo: invoice.invcNo,
    orgInvcNo: invoice.orgInvcNo,
    transactionType: invoice.transactionType,
    status: invoice.status,
    errorMessage: invoice.errorMessage,
    totTaxblAmt: invoice.totTaxblAmt,
    totTaxAmt: invoice.totTaxAmt,
    totAmt: invoice.totAmt,
    sdcId: invoice.sdcId,
    rcptNo: invoice.rcptNo,
    totRcptNo: invoice.totRcptNo,
    formattedInternalData: invoice.formattedInternalData,
    formattedSignature: invoice.formattedSignature,
    qrUrl: invoice.qrUrl,
    qrDataUri: invoice.qrDataUri,
    createdAt: invoice.createdAt,
  };
}

// GET /api/v1/etims/config — whether this merchant has (or will silently
// get, on their next invoice send) an active eTIMS device for the default
// branch ("00"). Non-sensitive summary only, no cmcKey. There's no
// merchant-facing "enable eTIMS" action — invoiceController.fiscalizeWithEtims
// auto-activates a device the moment it's needed — so `eligible` (a
// plausible-format KRA PIN on file) is what the dashboard uses to decide
// whether to show KRA-specific invoice fields, not `isInitialized`: a
// merchant needs to be able to fill in item classification codes on their
// very first invoice, before any send has had the chance to activate
// anything. The ~99% of merchants with no KRA PIN never see these fields.
export async function getConfig(req, res) {
  try {
    const { bhfId = '00' } = req.query;
    const merchant = req.merchant;
    const eligible = !!(merchant.kraPin && merchant.isKRAVerified);
    const config = await EtimsConfig.findOne({ merchantId: merchant._id, bhfId });
    if (!config || !config.isInitialized) {
      return res.json({ success: true, eligible, isInitialized: false });
    }
    return res.json({
      success: true,
      eligible,
      isInitialized: true,
      tin: config.tin,
      bhfId: config.bhfId,
      environment: config.environment,
      initializedAt: config.initializedAt,
    });
  } catch (err) {
    console.error('etims.getConfig failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch eTIMS status' });
  }
}

// POST /api/v1/etims/init — device handshake + cmcKey registration.
export async function initDevice(req, res) {
  try {
    const { bhfId = '00', dvcSrlNo, environment = 'sandbox' } = req.body || {};
    if (!dvcSrlNo) return res.status(400).json({ success: false, error: 'dvcSrlNo is required' });
    if (!['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({ success: false, error: 'environment must be "sandbox" or "production"' });
    }

    const merchant = req.merchant;
    if (!merchant.kraPin) {
      return res.status(400).json({
        success: false,
        error: 'Add your KRA PIN to your merchant profile before registering an eTIMS device.',
      });
    }
    // Belt-and-suspenders: the Merchant schema already validates format on
    // write, but this is the point where a bad PIN would otherwise reach
    // KRA's real infrastructure as the tin — worth a clear, specific error
    // here rather than a confusing rejection from KRA's own API.
    if (!isValidKraPin(merchant.kraPin)) {
      return res.status(400).json({
        success: false,
        error: `Your merchant profile's KRA PIN is not in a valid format. ${KRA_PIN_FORMAT_HINT} Update it in your merchant profile before retrying.`,
      });
    }

    let config = await EtimsConfig.findOne({ merchantId: merchant._id, bhfId });
    if (config?.isInitialized) {
      return res.status(409).json({ success: false, error: `An eTIMS device is already initialized for branch "${bhfId}".` });
    }

    const { cmcKey } = await initializeDevice({ tin: merchant.kraPin, bhfId, dvcSrlNo, environment });

    if (!config) config = new EtimsConfig({ merchantId: merchant._id, bhfId });
    config.tin = merchant.kraPin;
    config.dvcSrlNo = dvcSrlNo;
    config.environment = environment;
    config.cmcKeyEncrypted = encryptKey(cmcKey);
    config.isInitialized = true;
    config.initializedAt = new Date();
    config.lastError = null;
    await config.save();

    return res.status(201).json({
      success: true,
      config: {
        id: config._id, tin: config.tin, bhfId: config.bhfId,
        environment: config.environment, isInitialized: true, initializedAt: config.initializedAt,
      },
    });
  } catch (err) {
    console.error('etims.initDevice failed:', err);
    if (err instanceof EtimsApiError) return res.status(502).json({ success: false, error: err.message, resultCd: err.resultCd });
    return res.status(500).json({ success: false, error: 'Failed to initialize eTIMS device' });
  }
}

// POST /api/v1/etims/items/sync — registers an item catalog with KRA.
export async function syncItems(req, res) {
  try {
    const { bhfId = '00', items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, error: 'items must be a non-empty array' });
    }

    const config = await EtimsConfig.findOne({ merchantId: req.merchant._id, bhfId }).select('+cmcKeyEncrypted');
    if (!config || !config.isInitialized) {
      return res.status(400).json({ success: false, error: `No initialized eTIMS device for branch "${bhfId}". Call /init first.` });
    }
    const cmcKeyPlain = getCmcKeyPlain(config);

    const results = [];
    for (const item of items) {
      try {
        const kraResponse = await registerItem(config, cmcKeyPlain, item);
        results.push({ itemCd: item.itemCd, itemNm: item.itemNm, success: true, resultMsg: kraResponse.resultMsg });
      } catch (err) {
        results.push({ itemCd: item.itemCd, itemNm: item.itemNm, success: false, error: err.message });
      }
    }

    const failedCount = results.filter((r) => !r.success).length;
    return res.status(failedCount ? 207 : 200).json({ success: failedCount === 0, results });
  } catch (err) {
    console.error('etims.syncItems failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to sync item catalog with KRA' });
  }
}

// POST /api/v1/etims/invoices/sign — signs a normal sale.
export async function signInvoice(req, res) {
  try {
    const orderData = { ...req.body, merchantId: req.merchant._id };
    const invoice = await createNormalSale(orderData);
    const signed = invoice.status === 'signed';
    return res.status(signed ? 201 : 502).json({ success: signed, invoice: serializeInvoice(invoice) });
  } catch (err) {
    console.error('etims.signInvoice failed:', err);
    if (err instanceof InsufficientStockError) return res.status(409).json({ success: false, error: err.message, details: err.details });
    if (err instanceof InvoiceValidationError) return res.status(400).json({ success: false, error: err.message });
    if (err instanceof EtimsConfigError) return res.status(400).json({ success: false, error: err.message });
    if (err instanceof EtimsApiError) return res.status(502).json({ success: false, error: err.message, resultCd: err.resultCd });
    return res.status(500).json({ success: false, error: 'Failed to sign invoice with KRA eTIMS' });
  }
}

// POST /api/v1/etims/invoices/credit-note — issues a fiscal credit note.
export async function issueCreditNote(req, res) {
  try {
    const { originalInvoiceId, refundReason, refundItems, refundReasonCode } = req.body || {};
    if (!originalInvoiceId) return res.status(400).json({ success: false, error: 'originalInvoiceId is required' });

    const original = await EtimsInvoice.findById(originalInvoiceId);
    if (!original || String(original.merchantId) !== String(req.merchant._id)) {
      return res.status(404).json({ success: false, error: 'Original invoice not found' });
    }

    const creditNote = await createCreditNote(originalInvoiceId, refundReason, refundItems, refundReasonCode);
    const signed = creditNote.status === 'signed';
    return res.status(signed ? 201 : 502).json({ success: signed, invoice: serializeInvoice(creditNote) });
  } catch (err) {
    console.error('etims.issueCreditNote failed:', err);
    if (err instanceof InvoiceValidationError) return res.status(400).json({ success: false, error: err.message });
    if (err instanceof EtimsConfigError) return res.status(400).json({ success: false, error: err.message });
    if (err instanceof EtimsApiError) return res.status(502).json({ success: false, error: err.message, resultCd: err.resultCd });
    return res.status(500).json({ success: false, error: 'Failed to issue credit note' });
  }
}

// GET /api/v1/etims/reports/daily-z — generates and logs the daily Z-report.
export async function dailyZReport(req, res) {
  try {
    const { date, bhfId = '00' } = req.query;
    const report = await generateZReport({
      merchantId: req.merchant._id, bhfId, date: date ? new Date(date) : new Date(),
    });
    console.log(JSON.stringify({
      level: 'info', event: 'etims.z_report', ts: new Date().toISOString(),
      merchantId: String(req.merchant._id), bhfId, ...report,
    }));
    return res.status(200).json({ success: true, report });
  } catch (err) {
    console.error('etims.dailyZReport failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate Z-report' });
  }
}
