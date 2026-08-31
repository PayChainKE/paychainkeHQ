import Expense, { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import { logAudit } from '../utils/auditLog.js';
import { recordDeletion } from '../utils/trash.js';
import { adminActor } from './adminController.js';
import { REVENUE_STREAMS } from '../config/revenueRateCard.js';
import { excludeDemoMerchantsMatch } from '../utils/demoMerchantExclusion.js';
import { reversedTransactionExclusionMatch } from '../utils/reversedTransactions.js';
import { CORPORATE_TAX_RATE } from '../config/taxRateCard.js';
import { resolvePeriod } from '../utils/resolvePeriod.js';

// Same whitelist Revenue's getRevenue uses — top_up/withdrawal and any
// other type with no revenue stream must never count as "income" here
// either, or the two pages can never agree on the same window.
const REVENUE_TX_TYPES = REVENUE_STREAMS.flatMap((s) => s.txTypes);

// @desc    List expense entries for a period, with category/search filters.
// @route   GET /api/admin/bookkeeping/expenses
// @access  Private (Admin)
export const listExpenses = async (req, res) => {
  try {
    const { preset, from, to, category, search = '', page = 1, limit = 25 } = req.query;
    const { since, until } = resolvePeriod({ preset, from, to });

    const filter = { date: { $gte: since, $lte: until } };
    if (category && category !== 'all') filter.category = category;
    if (search) {
      // Escape regex specials — an unescaped user-controlled pattern here
      // (e.g. "(a+)+$") is a ReDoS vector against the event loop even at
      // 100 chars.
      const safeSearch = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: safeSearch, $options: 'i' };
      filter.$or = [{ description: rx }, { payee: rx }, { reference: rx }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit, 10) || 25));

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('recordedBy', 'name email'),
      Expense.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        expenses,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
        categories: EXPENSE_CATEGORIES,
        paymentMethods: PAYMENT_METHODS,
      },
    });
  } catch (error) {
    console.error('List Expenses Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Record a new expense.
// @route   POST /api/admin/bookkeeping/expenses
// @access  Private (Admin)
export const createExpense = async (req, res) => {
  try {
    const { date, category, description, payee, amount, paymentMethod, reference, vatApplicable, vatAmount, deductible, notes } = req.body || {};

    if (!category || !EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Choose a valid expense category.' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ error: 'A description is required.' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than zero.' });
    }

    // This route now also accepts multipart/form-data (when a receipt file
    // is attached — see uploadReceipt.single('receipt') on the route), where
    // every field including booleans arrives as a string. A plain JSON
    // request (no file) still sends real booleans. isTrue() handles both:
    // the string "false" must not be treated as truthy.
    const isTrue = (v) => v === true || v === 'true';
    const isVatApplicable = isTrue(vatApplicable);
    const isDeductible = deductible === undefined ? true : !(deductible === false || deductible === 'false');

    const expense = await Expense.create({
      date: date ? new Date(date) : new Date(),
      category,
      description: description.trim(),
      payee: payee?.trim() || '',
      amount: amt,
      paymentMethod: PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'Bank Transfer',
      reference: reference?.trim() || '',
      vatApplicable: isVatApplicable,
      vatAmount: isVatApplicable ? Math.max(0, Number(vatAmount) || 0) : 0,
      deductible: isDeductible,
      notes: notes?.trim() || '',
      recordedBy: req.admin?._id || null,
      // Optional — `upload.single('receipt')` on this route lets a receipt
      // be attached in the same request an expense is created, rather than
      // requiring a separate follow-up upload step.
      receiptUrl: req.file?.path || null,
    });

    logAudit({
      action: 'admin.bookkeeping.expense_created', category: 'admin', severity: 'info',
      message: `Recorded expense — ${expense.category}: KES ${expense.amount.toLocaleString()} (${expense.description})`,
      actor: adminActor(req.admin), req,
      metadata: { expenseId: String(expense._id), category: expense.category, amount: expense.amount },
    });

    res.status(201).json({ success: true, expense });
  } catch (error) {
    console.error('Create Expense Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update an expense entry.
// @route   PUT /api/admin/bookkeeping/expenses/:id
// @access  Private (Admin)
export const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    const { date, category, description, payee, amount, paymentMethod, reference, vatApplicable, vatAmount, deductible, notes } = req.body || {};

    if (category !== undefined) {
      if (!EXPENSE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a valid expense category.' });
      expense.category = category;
    }
    if (description !== undefined) {
      if (!description.trim()) return res.status(400).json({ error: 'A description is required.' });
      expense.description = description.trim();
    }
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount greater than zero.' });
      expense.amount = amt;
    }
    if (date !== undefined) expense.date = new Date(date);
    if (payee !== undefined) expense.payee = payee.trim();
    if (paymentMethod !== undefined && PAYMENT_METHODS.includes(paymentMethod)) expense.paymentMethod = paymentMethod;
    if (reference !== undefined) expense.reference = reference.trim();
    if (vatApplicable !== undefined) expense.vatApplicable = !!vatApplicable;
    expense.vatAmount = expense.vatApplicable ? Math.max(0, Number(vatAmount ?? expense.vatAmount) || 0) : 0;
    if (deductible !== undefined) expense.deductible = !!deductible;
    if (notes !== undefined) expense.notes = notes.trim();

    await expense.save();

    logAudit({
      action: 'admin.bookkeeping.expense_updated', category: 'admin', severity: 'info',
      message: `Updated expense — ${expense.category}: KES ${expense.amount.toLocaleString()} (${expense.description})`,
      actor: adminActor(req.admin), req,
      metadata: { expenseId: String(expense._id) },
    });

    res.json({ success: true, expense });
  } catch (error) {
    console.error('Update Expense Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Attach or replace the scanned receipt/invoice backing an
//          existing expense — the create-time upload (createExpense above)
//          covers "add with receipt in one step"; this covers attaching one
//          later, or replacing it. Modeled on adminController.js's
//          updateMerchantCertificate.
// @route   PATCH /api/admin/bookkeeping/expenses/:id/receipt
// @access  Private (Admin, owner/admin only)
export const updateExpenseReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A receipt file is required.' });

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    expense.receiptUrl = req.file.path;
    await expense.save();

    logAudit({
      action: 'admin.bookkeeping.expense_receipt_updated', category: 'admin', severity: 'info',
      message: `Attached a receipt to expense — ${expense.category}: KES ${expense.amount.toLocaleString()} (${expense.description})`,
      actor: adminActor(req.admin), req,
      metadata: { expenseId: String(expense._id) },
    });

    res.json({ success: true, receiptUrl: expense.receiptUrl });
  } catch (error) {
    console.error('Update Expense Receipt Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete an expense entry.
// @route   DELETE /api/admin/bookkeeping/expenses/:id
// @access  Private (Admin)
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    logAudit({
      action: 'admin.bookkeeping.expense_deleted', category: 'admin', severity: 'warning',
      message: `Deleted expense — ${expense.category}: KES ${expense.amount.toLocaleString()} (${expense.description})`,
      actor: adminActor(req.admin), req,
      metadata: { expenseId: String(expense._id) },
    });

    await recordDeletion({ collectionName: 'Expense', doc: expense, label: `${expense.category}: KES ${expense.amount.toLocaleString()}`, deletedBy: req.admin._id });
    await Expense.deleteOne({ _id: expense._id });
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (error) {
    console.error('Delete Expense Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Profit & loss summary for a period — income (PayChain fee revenue,
//          sourced from the same paychainFee field the Revenue page uses),
//          expenses by category, VAT and a trailing 12-month trend. Built
//          for handing straight to an accountant or KRA iTax filing.
// @route   GET /api/admin/bookkeeping/summary
// @access  Private (Admin)
export const getBookkeepingSummary = async (req, res) => {
  try {
    const { preset, from, to } = req.query;
    const { since, until, label, preset: resolvedPreset } = resolvePeriod({ preset, from, to });

    const now = new Date();
    const trailingStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const [excludeDemo, excludeReversed] = await Promise.all([
      excludeDemoMerchantsMatch(),
      reversedTransactionExclusionMatch(),
    ]);

    const [incomeAgg, expenseAgg, categoryAgg, monthlyIncomeAgg, monthlyExpenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, status: { $in: ['completed', 'verified'] }, type: { $in: REVENUE_TX_TYPES }, ...excludeDemo, ...excludeReversed } },
        { $group: { _id: null, total: { $sum: '$paychainFee' } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            deductibleTotal: { $sum: { $cond: ['$deductible', '$amount', 0] } },
            vatTotal: { $sum: '$vatAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: since, $lte: until } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: trailingStart }, status: { $in: ['completed', 'verified'] }, type: { $in: REVENUE_TX_TYPES }, ...excludeDemo, ...excludeReversed } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$paychainFee' } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: trailingStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
      ]),
    ]);

    const income = Math.round((incomeAgg[0]?.total || 0) * 100) / 100;
    const expenseRow = expenseAgg[0] || { total: 0, deductibleTotal: 0, vatTotal: 0, count: 0 };
    const totalExpenses = Math.round(expenseRow.total * 100) / 100;
    const deductibleExpenses = Math.round(expenseRow.deductibleTotal * 100) / 100;
    const vatTotal = Math.round(expenseRow.vatTotal * 100) / 100;
    const netProfit = Math.round((income - totalExpenses) * 100) / 100;
    const taxableProfit = Math.round((income - deductibleExpenses) * 100) / 100;
    // Floored at zero — a loss-making period has no tax liability to
    // estimate (KRA doesn't refund a negative corporate tax this way).
    // Computed once, here, so every page that shows this figure (currently
    // Bookkeeping and Tax & Compliance) reads the exact same number rather
    // than each re-deriving it from taxableProfit independently.
    const estimatedTaxLiability = Math.round(Math.max(0, taxableProfit) * CORPORATE_TAX_RATE * 100) / 100;

    const categories = categoryAgg.map((c) => ({ category: c._id, total: Math.round(c.total * 100) / 100, count: c.count }));

    // Trailing 12-month income/expense series, aligned to calendar months
    // regardless of which months actually have data.
    const monthMap = new Map();
    for (let i = 0; i < 12; i++) {
      const d = new Date(trailingStart.getFullYear(), trailingStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, { month: key, income: 0, expenses: 0 });
    }
    monthlyIncomeAgg.forEach((r) => { if (monthMap.has(r._id)) monthMap.get(r._id).income = Math.round(r.total * 100) / 100; });
    monthlyExpenseAgg.forEach((r) => { if (monthMap.has(r._id)) monthMap.get(r._id).expenses = Math.round(r.total * 100) / 100; });

    res.json({
      success: true,
      data: {
        period: { since, until, label, preset: resolvedPreset },
        pnl: { income, totalExpenses, deductibleExpenses, netProfit, taxableProfit, vatTotal, expenseCount: expenseRow.count, estimatedTaxLiability, taxRate: CORPORATE_TAX_RATE },
        categories,
        monthly: Array.from(monthMap.values()),
      },
    });
  } catch (error) {
    console.error('Bookkeeping Summary Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    PayChain's own monthly fee revenue as a KRA-ready CSV — a
//          revenue listing an accountant can use directly when filing
//          PayChain's VAT/income tax return on iTax. NOT a live submission
//          to KRA (PayChain already has a separate, real eTIMS/OSCU
//          integration for MERCHANTS' own sales fiscalization — this is
//          unrelated and deliberately does not touch it). Same
//          period/type/demo-exclusion rules as getBookkeepingSummary
//          above, so this export's total always reconciles to that page's
//          "Income" figure for the same period.
//
//          Deliberately no VAT column — nothing in this codebase tracks
//          whether PayChain's own fee revenue is itself VATable; adding a
//          fabricated number here would be worse than omitting it.
// @route   GET /api/admin/bookkeeping/kra-export?preset=&from=&to=
// @access  Private (Admin)
export const exportKraRevenueCsv = async (req, res) => {
  try {
    const { preset, from, to } = req.query;
    const { since, until, label } = resolvePeriod({ preset, from, to });
    const [excludeDemo, excludeReversed] = await Promise.all([
      excludeDemoMerchantsMatch(),
      reversedTransactionExclusionMatch(),
    ]);

    const transactions = await Transaction.find({
      createdAt: { $gte: since, $lte: until },
      status: { $in: ['completed', 'verified'] },
      type: { $in: REVENUE_TX_TYPES },
      ...excludeDemo,
      ...excludeReversed,
    })
      .sort({ createdAt: 1 })
      .populate('merchantId', 'businessName')
      .lean();

    const header = [
      'Date', 'Reference', 'Transaction Type', 'Merchant',
      'Gross Amount (KES)', 'PayChain Fee / Net Revenue (KES)',
      'Revenue Stream', 'Settlement Rail', 'Status',
    ];
    // Excel/Sheets-safe CSV cell — same RFC-4180 helper as
    // revenueController.js's exportRevenueSweeps.
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = transactions.map((t) => [
      t.createdAt?.toISOString() || '',
      t.reference || '',
      t.type,
      t.merchantId?.businessName || 'Deleted Merchant',
      t.kesAmount ?? t.amount ?? 0,
      t.paychainFee || 0,
      t.revenueStream || '',
      t.settlementRail || '',
      t.status,
    ].map(cell).join(','));

    const csv = [header.map(cell).join(','), ...rows].join('\r\n');

    logAudit({
      action: 'admin.tax.kra_export', category: 'admin', severity: 'info',
      message: `Exported ${transactions.length} revenue transactions as a KRA-ready CSV (${label})`,
      actor: adminActor(req.admin), req,
      metadata: { count: transactions.length, since, until },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paychain-kra-revenue-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export KRA Revenue CSV Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
