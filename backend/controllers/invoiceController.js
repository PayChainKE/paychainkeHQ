import crypto from 'crypto';
import Invoice from '../models/Invoice.js';
import PaymentLink from '../models/PaymentLink.js';
import Merchant from '../models/Merchant.js';
import { sendInvoiceEmail } from '../utils/resend.js';

const FRONTEND_URL = process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

const computeTotals = (items = []) => {
  const subtotal = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  return { subtotal, total: subtotal };
};

const sanitizeItems = (items) =>
  (Array.isArray(items) ? items : []).map((i) => ({
    description: String(i.description || '').slice(0, 200),
    qty: Math.max(0, Number(i.qty) || 0),
    price: Math.max(0, Number(i.price) || 0),
  }));

const serializeInvoice = (inv) => {
  const { subtotal, total } = computeTotals(inv.items);
  const link = inv.paymentLinkId && inv.paymentLinkId.linkId ? inv.paymentLinkId : null;
  return {
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    publicToken: inv.publicToken,
    customer: inv.customer,
    items: inv.items,
    currency: inv.currency,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    notes: inv.notes,
    recurring: inv.recurring,
    status: inv.status,
    subtotal,
    total,
    sentAt: inv.sentAt,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
    payUrl: link ? `${FRONTEND_URL}/pay/${link.linkId}` : null,
    paymentLinkStatus: link ? link.status : null,
  };
};

// @desc    List merchant's invoices
// @route   GET /api/invoices
// @access  Private
export const listInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ merchantId: req.merchant._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('paymentLinkId', 'linkId status');

    res.json({ success: true, invoices: invoices.map(serializeInvoice) });
  } catch (error) {
    console.error('❌ Error listing invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
};

// @desc    Create a draft invoice
// @route   POST /api/invoices
// @access  Private
export const createInvoice = async (req, res) => {
  try {
    const { customer, items, currency, issueDate, dueDate, notes, recurring } = req.body;

    if (!customer?.name?.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase().slice(-5)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
    const publicToken = crypto.randomBytes(16).toString('hex');

    const invoice = await Invoice.create({
      merchantId: req.merchant._id,
      invoiceNumber,
      publicToken,
      customer: {
        name: customer.name.trim(),
        email: customer.email?.trim() || null,
        phone: customer.phone?.trim() || null,
        address: customer.address?.trim() || null,
      },
      items: sanitizeItems(items),
      currency: currency || 'KES',
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || '',
      recurring: !!recurring,
    });

    res.status(201).json({ success: true, invoice: serializeInvoice(invoice) });
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
};

// @desc    Update a draft/sent invoice's details (not its status)
// @route   PUT /api/invoices/:id
// @access  Private
export const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Paid invoices cannot be edited.' });

    const { customer, items, currency, issueDate, dueDate, notes, recurring } = req.body;

    if (customer) {
      if (!customer.name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });
      invoice.customer = {
        name: customer.name.trim(),
        email: customer.email?.trim() || null,
        phone: customer.phone?.trim() || null,
        address: customer.address?.trim() || null,
      };
    }
    if (items) invoice.items = sanitizeItems(items);
    if (currency) invoice.currency = currency;
    if (issueDate) invoice.issueDate = new Date(issueDate);
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) invoice.notes = notes;
    if (recurring !== undefined) invoice.recurring = !!recurring;

    await invoice.save();
    await invoice.populate('paymentLinkId', 'linkId status');
    res.json({ success: true, invoice: serializeInvoice(invoice) });
  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
};

// @desc    Email the invoice to the customer with a real, payable link
// @route   POST /api/invoices/:id/send
// @access  Private
export const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.merchant._id }).populate('paymentLinkId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'This invoice has already been paid.' });
    if (!invoice.customer?.email) return res.status(400).json({ error: 'Add a customer email address before sending.' });
    if (!invoice.items?.length) return res.status(400).json({ error: 'Add at least one line item before sending.' });

    const { subtotal, total } = computeTotals(invoice.items);
    if (total <= 0) return res.status(400).json({ error: 'Invoice total must be greater than zero.' });

    const merchant = await Merchant.findById(req.merchant._id);

    // Reuse an existing active payment link if one is still valid, otherwise mint a fresh one.
    let link = invoice.paymentLinkId;
    if (!link || link.status !== 'active') {
      const dueMs = invoice.dueDate ? invoice.dueDate.getTime() : 0;
      const minExpiry = Date.now() + 24 * 60 * 60 * 1000;
      link = await PaymentLink.create({
        merchantId: merchant._id,
        linkId: crypto.randomBytes(4).toString('hex'),
        amount: total,
        currency: invoice.currency,
        status: 'active',
        expiresAt: new Date(Math.max(dueMs, minExpiry)),
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
      subtotal,
      total,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      payUrl: `${FRONTEND_URL}/pay/${link.linkId}`,
    });

    invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();
    await invoice.populate('paymentLinkId', 'linkId status');

    res.json({ success: true, invoice: serializeInvoice(invoice) });
  } catch (error) {
    console.error('❌ Error sending invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice. Please try again.' });
  }
};

// @desc    Delete a draft invoice
// @route   DELETE /api/invoices/:id
// @access  Private
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (invoice.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted.' });

    await invoice.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
};

// @desc    Public, unauthenticated invoice view — for the customer to see and pay
// @route   GET /api/invoices/public/:publicToken
// @access  Public
export const getPublicInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ publicToken: req.params.publicToken })
      .populate('paymentLinkId')
      .populate('merchantId', 'businessName');

    if (!invoice || invoice.status === 'draft') {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const { subtotal, total } = computeTotals(invoice.items);

    res.json({
      success: true,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        businessName: invoice.merchantId?.businessName || 'PayChain Merchant',
        customer: invoice.customer,
        items: invoice.items,
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        subtotal,
        total,
        status: invoice.status,
        payLinkId: invoice.paymentLinkId?.linkId || null,
        paymentLinkStatus: invoice.paymentLinkId?.status || null,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching public invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};
