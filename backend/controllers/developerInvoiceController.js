import crypto from 'crypto';
import Invoice from '../models/Invoice.js';
import PaymentLink from '../models/PaymentLink.js';
import Merchant from '../models/Merchant.js';
import { sendInvoiceEmail } from '../utils/resend.js';
import {
  computeTotals,
  sanitizeItems,
  sanitizeCustomer,
  getNextInvoiceNumber,
  serializeInvoice,
  serializeEtims,
  fiscalizeWithEtims,
  FRONTEND_URL,
} from './invoiceController.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';
import {
  InvoiceValidationError as EtimsInvoiceValidationError,
  EtimsApiError,
  EtimsConfigError,
} from '../services/invoicingService.js';

// Developer-API mirror of invoiceController.js's createInvoice/sendInvoice —
// reuses the exact same helpers (sanitizeCustomer, serializeInvoice, the
// real PaymentLink/STK collection path) rather than a second implementation,
// so an API-created invoice behaves identically to a dashboard-created one
// in every way except who's allowed to see/act on it (scoped to the
// developer that created it, not a merchant dashboard session) and that
// paying it fires a webhook instead of just updating the dashboard UI.

// @desc    Create a draft invoice.
// @route   POST /api/v1/developer/invoices
// @access  Public (API key)
export const createDeveloperInvoice = async (req, res) => {
  try {
    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const { customer, items, currency, issueDate, dueDate, notes } = req.body || {};
    if (!customer?.name?.trim()) {
      return res.status(400).json({ error: 'customer.name is required.' });
    }

    const invoice = await Invoice.create({
      merchantId,
      invoiceNumber: await getNextInvoiceNumber(),
      publicToken: crypto.randomBytes(16).toString('hex'),
      customer: sanitizeCustomer(customer),
      items: sanitizeItems(items),
      currency: currency || 'KES',
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || '',
      createdViaDeveloperId: developer._id,
    });

    res.status(201).json({ success: true, invoice: await serializeInvoice(invoice) });
  } catch (error) {
    console.error('Developer Create Invoice Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Email the invoice to the customer with a real, payable link.
//          Fires an invoice.sent webhook, and later — the moment the
//          customer actually pays via the resulting link — invoice.paid
//          (see mpesaController.js#resolveStkOutcome).
// @route   POST /api/v1/developer/invoices/:id/send
// @access  Public (API key)
export const sendDeveloperInvoice = async (req, res) => {
  try {
    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId, createdViaDeveloperId: developer._id }).populate('paymentLinkId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'This invoice has already been paid.' });
    if (!invoice.customer?.email) return res.status(400).json({ error: 'This invoice has no customer email on file — set customer.email when creating it.' });
    if (!invoice.items?.length) return res.status(400).json({ error: 'Add at least one line item before sending.' });
    if (invoice.items.some((i) => !i.description?.trim())) {
      return res.status(400).json({ error: 'Every line item needs a description before sending.' });
    }

    const { total } = computeTotals(invoice.items);
    if (total <= 0) return res.status(400).json({ error: 'Invoice total must be greater than zero.' });

    const merchant = await Merchant.findById(merchantId);

    // Must happen before the receipt is ever handed to the customer — see
    // fiscalizeWithEtims's own comment in invoiceController.js. A no-op for
    // the majority of merchants who haven't registered for KRA OSCU.
    try {
      await fiscalizeWithEtims(invoice, merchant);
    } catch (err) {
      console.error('❌ eTIMS fiscalization failed while sending developer-created invoice:', err);
      if (err instanceof EtimsInvoiceValidationError) return res.status(400).json({ error: err.message });
      if (err instanceof EtimsConfigError) return res.status(400).json({ error: err.message });
      if (err instanceof EtimsApiError) {
        return res.status(502).json({ error: `KRA eTIMS rejected this invoice: ${err.message}` });
      }
      return res.status(502).json({ error: 'Failed to sign this invoice with KRA eTIMS. Please try again.' });
    }
    if (invoice.etimsInvoiceId) await invoice.populate('etimsInvoiceId');

    let link = invoice.paymentLinkId;
    if (!link || link.status !== 'active') {
      link = await PaymentLink.create({
        merchantId,
        linkId: crypto.randomBytes(4).toString('hex'),
        amount: total,
        currency: invoice.currency,
        status: 'active',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        invoiceId: invoice._id,
      });
      invoice.paymentLinkId = link._id;
    }

    // Send the real email before persisting "sent" — a delivery failure
    // should not leave the invoice claiming it was sent when it wasn't.
    await sendInvoiceEmail({
      to: invoice.customer.email,
      customerName: invoice.customer.name,
      businessName: merchant.businessName,
      invoiceNumber: invoice.invoiceNumber,
      items: invoice.items,
      currency: invoice.currency,
      subtotal: total,
      total,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      payUrl: `${FRONTEND_URL}/pay/${link.linkId}`,
      trader: { name: merchant.businessName, pin: merchant.kraPin, address: [merchant.businessArea, merchant.county].filter(Boolean).join(', ') || null },
      etims: serializeEtims(invoice),
    });

    invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();
    await invoice.populate('paymentLinkId', 'linkId status');

    const serialized = await serializeInvoice(invoice);
    dispatchDeveloperEvent(developer._id, 'invoice.sent', { invoice: serialized });

    res.json({ success: true, invoice: serialized });
  } catch (error) {
    console.error('Developer Send Invoice Error:', error);
    res.status(500).json({ error: 'Failed to send invoice. Please try again.' });
  }
};

// @desc    Check one invoice's current status.
// @route   GET /api/v1/developer/invoices/:id
// @access  Public (API key)
export const getDeveloperInvoice = async (req, res) => {
  try {
    // Scoping to createdViaDeveloperId alone (not merchantId too) is safe —
    // it's only ever set to the developer that created the invoice in the
    // first place, so it already excludes every other developer and every
    // dashboard-created invoice with no possible cross-tenant overlap.
    const invoice = await Invoice.findOne({ _id: req.params.id, createdViaDeveloperId: req.developer._id })
      .populate('paymentLinkId', 'linkId status')
      .populate('etimsInvoiceId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ success: true, invoice: await serializeInvoice(invoice) });
  } catch (error) {
    console.error('Get Developer Invoice Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    List invoices created via this developer's API keys.
// @route   GET /api/v1/developer/invoices
// @access  Public (API key)
export const listDeveloperInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ createdViaDeveloperId: req.developer._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('paymentLinkId', 'linkId status')
      .populate('etimsInvoiceId');
    res.json({ success: true, invoices: await Promise.all(invoices.map(serializeInvoice)) });
  } catch (error) {
    console.error('List Developer Invoices Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
