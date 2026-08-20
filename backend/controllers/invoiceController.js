import crypto from 'crypto';
import Invoice from '../models/Invoice.js';
import PaymentLink from '../models/PaymentLink.js';
import Merchant from '../models/Merchant.js';
import Counter from '../models/Counter.js';
import EtimsConfig from '../models/EtimsConfig.js';
import { sendInvoiceEmail } from '../utils/resend.js';
import { generateQrDataUri } from '../utils/qrCode.js';
import { TAX_TYPE_CODES } from '../utils/etimsFormat.js';
import {
  createNormalSale,
  InvoiceValidationError as EtimsInvoiceValidationError,
  InsufficientStockError,
  EtimsApiError,
  EtimsConfigError,
} from '../services/invoicingService.js';

export const FRONTEND_URL = process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

export const computeTotals = (items = []) => {
  const subtotal = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  return { subtotal, total: subtotal };
};

export const sanitizeItems = (items) =>
  (Array.isArray(items) ? items : []).map((i) => ({
    description: String(i.description || '').slice(0, 200),
    qty: Math.max(0, Number(i.qty) || 0),
    price: Math.max(0, Number(i.price) || 0),
    taxTyCd: TAX_TYPE_CODES.includes(i.taxTyCd) ? i.taxTyCd : 'B',
    itemClsCd: i.itemClsCd ? String(i.itemClsCd).trim().slice(0, 20) : null,
  }));

// Atomically reserves the next number in a single global sequence — this is
// what guarantees invoice numbers are unique across every merchant, not just
// within one account, and reads as a clean sequential "INV-000042" series.
export const getNextInvoiceNumber = async () => {
  const counter = await Counter.findByIdAndUpdate(
    'invoiceNumber',
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return `INV-${String(counter.seq).padStart(6, '0')}`;
};

// Kenyan mobile numbers are always stored/displayed in the professional
// local format (0XXXXXXXXX) regardless of how the merchant typed it in —
// "790889066", "254790889066" and "+254790889066" all normalize the same way.
// Anything that isn't a recognisable KE mobile shape is left untouched
// rather than silently corrupted.
export const normalizePhoneKE = (raw) => {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (/^[71]\d{8}$/.test(digits)) return `0${digits}`;
  const trimmed = String(raw).trim();
  return trimmed || null;
};

export const sanitizeCustomer = (customer) => ({
  name: customer.name.trim(),
  email: customer.email?.trim() || null,
  phone: normalizePhoneKE(customer.phone),
  address: customer.address?.trim() || null,
  kraPin: customer.kraPin ? String(customer.kraPin).trim().toUpperCase().slice(0, 20) : null,
});

// Unique per invoice, one QR encoding the same link a merchant would
// otherwise copy/paste — the payment link once one exists (post-send),
// else the invoice's own view page. Drafts still get one (it just 404s
// until sent, same as the draft's public link itself) so the PDF/preview
// doesn't have to special-case "no QR yet".
export const invoiceShareUrl = (inv, link) =>
  link ? `${FRONTEND_URL}/pay/${link.linkId}` : `${FRONTEND_URL}/invoice/${inv.publicToken}`;

// inv.etimsInvoiceId may be a populated EtimsInvoice doc (callers that
// .populate() it) or just left as an ObjectId/null (callers that don't) —
// either way this only surfaces the KRA fiscal fields when it's actually
// the populated document, never partial/wrong data.
function serializeEtims(inv) {
  const etims = inv.etimsInvoiceId;
  if (inv.etimsStatus !== 'signed' || !etims || typeof etims !== 'object' || !etims.sdcId) {
    return { status: inv.etimsStatus || 'not_applicable' };
  }
  return {
    status: 'signed',
    cuInvoiceNumber: `${etims.sdcId}/${etims.rcptNo}`,
    invcNo: etims.invcNo,
    formattedInternalData: etims.formattedInternalData,
    formattedSignature: etims.formattedSignature,
    qrUrl: etims.qrUrl,
    qrDataUri: etims.qrDataUri,
    signedAt: etims.updatedAt,
  };
}

export const serializeInvoice = async (inv) => {
  const { subtotal, total } = computeTotals(inv.items);
  const link = inv.paymentLinkId && inv.paymentLinkId.linkId ? inv.paymentLinkId : null;
  const shareUrl = invoiceShareUrl(inv, link);
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
    qrCodeDataUri: await generateQrDataUri(shareUrl),
    etims: serializeEtims(inv),
  };
};

// Signs this invoice with KRA eTIMS OSCU before it's ever handed to the
// customer — mirroring the OSCU/VSCU spec's own hard requirement that a
// receipt cannot be printed/issued until the signing round-trip finishes
// (Technical Specification v2.0, item 10). Only runs at all when the
// merchant has an initialized eTIMS device for the default branch ("00");
// the vast majority of merchants (no OSCU registration yet) are completely
// unaffected — this returns immediately and the invoice sends exactly as it
// always has. Throws (never silently marks "sent") if eTIMS is configured
// but signing fails, since a merchant who registered for OSCU is legally
// required to fiscalize every tax invoice they issue.
export async function fiscalizeWithEtims(invoice, merchant) {
  // Already signed (e.g. a merchant re-triggering "send" on an already-sent
  // invoice) — never re-fiscalize the same supply a second time.
  if (invoice.etimsStatus === 'signed') return;

  const bhfId = '00';
  const config = await EtimsConfig.findOne({ merchantId: merchant._id, bhfId });
  if (!config || !config.isInitialized) return;

  const missingCls = invoice.items
    .map((it, idx) => ({ idx, description: it.description }))
    .filter((_, idx) => !invoice.items[idx].itemClsCd);
  if (missingCls.length) {
    throw new EtimsInvoiceValidationError(
      `This account has KRA eTIMS enabled — every line item needs a KRA item classification code before this invoice can be sent. Missing on: ${missingCls.map((m) => m.description || `item ${m.idx + 1}`).join(', ')}.`
    );
  }

  const etimsInvoice = await createNormalSale({
    merchantId: merchant._id,
    bhfId,
    custTin: invoice.customer.kraPin || null,
    custNm: invoice.customer.name,
    paymentMethod: 'other',
    items: invoice.items.map((it) => ({
      itemNm: it.description,
      qty: it.qty,
      unitPrice: it.price,
      taxTyCd: it.taxTyCd,
      itemClsCd: it.itemClsCd,
    })),
  });

  invoice.etimsInvoiceId = etimsInvoice._id;
  invoice.etimsStatus = 'signed';
}

// @desc    List merchant's invoices
// @route   GET /api/invoices
// @access  Private
export const listInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ merchantId: req.merchant._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('paymentLinkId', 'linkId status')
      .populate('etimsInvoiceId');

    res.json({ success: true, invoices: await Promise.all(invoices.map(serializeInvoice)) });
  } catch (error) {
    console.error('❌ Error listing invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
};

// @desc    Reserve the next globally-unique invoice number so the UI can show
//          a real number immediately, before the invoice is actually saved.
// @route   GET /api/invoices/next-number
// @access  Private
export const peekNextInvoiceNumber = async (req, res) => {
  try {
    const invoiceNumber = await getNextInvoiceNumber();
    res.json({ success: true, invoiceNumber });
  } catch (error) {
    console.error('❌ Error reserving invoice number:', error);
    res.status(500).json({ error: 'Failed to reserve an invoice number.' });
  }
};

// @desc    Create a draft invoice
// @route   POST /api/invoices
// @access  Private
export const createInvoice = async (req, res) => {
  try {
    const { customer, items, currency, issueDate, dueDate, notes, recurring, invoiceNumber: reservedNumber } = req.body;

    if (!customer?.name?.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    // Reuse a number already reserved via /next-number (so the number shown
    // in the editor matches what actually gets saved); otherwise allocate
    // a fresh one from the same global counter.
    const invoiceNumber = /^INV-\d{6,}$/.test(reservedNumber || '')
      ? reservedNumber
      : await getNextInvoiceNumber();
    const publicToken = crypto.randomBytes(16).toString('hex');

    const invoiceData = {
      merchantId: req.merchant._id,
      publicToken,
      customer: sanitizeCustomer(customer),
      items: sanitizeItems(items),
      currency: currency || 'KES',
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || '',
      recurring: !!recurring,
    };

    let invoice;
    try {
      invoice = await Invoice.create({ ...invoiceData, invoiceNumber });
    } catch (err) {
      // Extremely unlikely (reserved number already consumed) — fall back to
      // a freshly allocated one rather than fail the whole request.
      if (err.code === 11000) {
        invoice = await Invoice.create({ ...invoiceData, invoiceNumber: await getNextInvoiceNumber() });
      } else {
        throw err;
      }
    }

    res.status(201).json({ success: true, invoice: await serializeInvoice(invoice) });
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
      invoice.customer = sanitizeCustomer(customer);
    }
    if (items) invoice.items = sanitizeItems(items);
    if (currency) invoice.currency = currency;
    if (issueDate) invoice.issueDate = new Date(issueDate);
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) invoice.notes = notes;
    if (recurring !== undefined) invoice.recurring = !!recurring;

    await invoice.save();
    await invoice.populate('paymentLinkId', 'linkId status');
    await invoice.populate('etimsInvoiceId');
    res.json({ success: true, invoice: await serializeInvoice(invoice) });
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
    if (invoice.items.some((i) => !i.description?.trim())) {
      return res.status(400).json({ error: 'Every line item needs a description before sending.' });
    }

    const { subtotal, total } = computeTotals(invoice.items);
    if (total <= 0) return res.status(400).json({ error: 'Invoice total must be greater than zero.' });

    const merchant = await Merchant.findById(req.merchant._id);

    // Must happen before the receipt is ever handed to the customer — see
    // fiscalizeWithEtims's own comment. A no-op for the majority of
    // merchants who haven't registered for OSCU.
    try {
      await fiscalizeWithEtims(invoice, merchant);
    } catch (err) {
      console.error('❌ eTIMS fiscalization failed while sending invoice:', err);
      if (err instanceof EtimsInvoiceValidationError) return res.status(400).json({ error: err.message });
      if (err instanceof EtimsConfigError) return res.status(400).json({ error: err.message });
      if (err instanceof EtimsApiError) {
        return res.status(502).json({ error: `KRA eTIMS rejected this invoice: ${err.message}` });
      }
      return res.status(502).json({ error: 'Failed to sign this invoice with KRA eTIMS. Please try again.' });
    }

    // Reuse an existing active payment link if one is still valid, otherwise mint a fresh one.
    // Invoice-backed links get 90 days — invoices are often issued against
    // longer payment terms than an ad-hoc "request money" link, so they get
    // a longer runway than the platform's default 48h payment-link expiry.
    let link = invoice.paymentLinkId;
    if (!link || link.status !== 'active') {
      link = await PaymentLink.create({
        merchantId: merchant._id,
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
    await invoice.populate('etimsInvoiceId');

    res.json({ success: true, invoice: await serializeInvoice(invoice) });
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
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Paid invoices cannot be deleted — they are kept for your financial records.' });

    // Deleting a sent invoice also kills the M-PESA link the customer was
    // emailed, so it can't be paid into after the merchant has cancelled it.
    if (invoice.paymentLinkId) {
      await PaymentLink.findByIdAndUpdate(invoice.paymentLinkId, { status: 'expired' });
    }

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
      .populate('merchantId', 'businessName')
      .populate('etimsInvoiceId');

    if (!invoice || invoice.status === 'draft') {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const { subtotal, total } = computeTotals(invoice.items);
    const shareUrl = invoiceShareUrl(invoice, invoice.paymentLinkId);

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
        qrCodeDataUri: await generateQrDataUri(shareUrl),
        // KRA requires the fiscal signature/QR appear on the actual receipt
        // handed to the buyer — this public page is that receipt.
        etims: serializeEtims(invoice),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching public invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};

// @desc    List every invoice across every merchant, paginated/searchable —
//          the platform-wide view for admin oversight.
// @route   GET /api/admin/invoices
// @access  Private (admin)
export const adminListInvoices = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const q = (req.query.q || '').trim();

    // Escape regex specials — an unescaped user-controlled pattern here
    // (e.g. "(a+)+$") is a ReDoS vector against the event loop.
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: safeQ, $options: 'i' } },
        { 'customer.name': { $regex: safeQ, $options: 'i' } },
        { 'customer.email': { $regex: safeQ, $options: 'i' } },
      ];
    }

    // Per-document totals aren't stored (items can change while a draft is
    // edited), so the summary is computed via aggregation rather than a
    // stored field — keeps a single source of truth for "what's the total".
    const totalsPipeline = [
      { $match: filter },
      { $addFields: {
        computedTotal: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.qty', '$$i.price'] } } } },
      } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$computedTotal' } } },
    ];

    // Overdue = sent, has a due date, and that due date has passed. Computed
    // independently of the status tab/filter (search term still applies) so
    // the "Overdue" KPI stays a stable, always-visible signal rather than
    // disappearing whenever a different status tab is selected.
    const overdueMatch = { status: 'sent', dueDate: { $ne: null, $lt: new Date() } };
    if (q) {
      overdueMatch.$or = [
        { invoiceNumber: { $regex: safeQ, $options: 'i' } },
        { 'customer.name': { $regex: safeQ, $options: 'i' } },
        { 'customer.email': { $regex: safeQ, $options: 'i' } },
      ];
    }

    const [total, invoices, totalsByStatus, overdueAgg] = await Promise.all([
      Invoice.countDocuments(filter),
      Invoice.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchantId', 'businessName email')
        .populate('paymentLinkId', 'linkId status')
        .lean(),
      Invoice.aggregate(totalsPipeline),
      Invoice.aggregate([
        { $match: overdueMatch },
        { $addFields: {
          computedTotal: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.qty', '$$i.price'] } } } },
        } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$computedTotal' } } },
      ]),
    ]);

    const summary = { draft: { count: 0, totalAmount: 0 }, sent: { count: 0, totalAmount: 0 }, paid: { count: 0, totalAmount: 0 }, void: { count: 0, totalAmount: 0 } };
    for (const row of totalsByStatus) {
      if (summary[row._id]) summary[row._id] = { count: row.count, totalAmount: row.totalAmount };
    }
    summary.overdue = overdueAgg[0] ? { count: overdueAgg[0].count, totalAmount: overdueAgg[0].totalAmount } : { count: 0, totalAmount: 0 };

    res.json({
      success: true,
      invoices: invoices.map((inv) => {
        const { subtotal, total: invTotal } = computeTotals(inv.items);
        return {
          _id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          merchant: inv.merchantId ? {
            _id: inv.merchantId._id,
            businessName: inv.merchantId.businessName,
            email: inv.merchantId.email,
          } : null,
          customer: inv.customer,
          currency: inv.currency,
          subtotal,
          total: invTotal,
          status: inv.status,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          sentAt: inv.sentAt,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
          paymentLinkStatus: inv.paymentLinkId?.status || null,
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
    });
  } catch (error) {
    console.error('❌ Error listing invoices (admin):', error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
};
