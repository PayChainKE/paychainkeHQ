import Expense, { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// ── Period resolution ────────────────────────────────────────────────────
// Bookkeeping periods are calendar-aligned (month/quarter/year) rather than
// the rolling 24h/7d/30d windows used elsewhere in admin — that's what maps
// onto how KRA actually expects returns to be filed.
function resolvePeriod({ preset, from, to }) {
  if (from && to) {
    const since = new Date(from);
    const until = new Date(to);
    until.setHours(23, 59, 59, 999);
    if (!isNaN(since) && !isNaN(until)) {
      return { since, until, label: 'Custom range', preset: 'custom' };
    }
  }

  const now = new Date();
  switch (preset) {
    case 'last_month': {
      const since = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const until = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { since, until, label: since.toLocaleString('en-KE', { month: 'long', year: 'numeric' }), preset };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const since = new Date(now.getFullYear(), q * 3, 1);
      return { since, until: now, label: `Q${q + 1} ${now.getFullYear()}`, preset };
    }
    case 'ytd': {
      const since = new Date(now.getFullYear(), 0, 1);
      return { since, until: now, label: `${now.getFullYear()} (Year to date)`, preset };
    }
    case 'all': {
      return { since: new Date('2020-01-01'), until: now, label: 'All time', preset };
    }
    case 'this_month':
    default: {
      const since = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since, until: now, label: since.toLocaleString('en-KE', { month: 'long', year: 'numeric' }), preset: 'this_month' };
    }
  }
}

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
      const rx = { $regex: String(search).slice(0, 100), $options: 'i' };
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

    const expense = await Expense.create({
      date: date ? new Date(date) : new Date(),
      category,
      description: description.trim(),
      payee: payee?.trim() || '',
      amount: amt,
      paymentMethod: PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'Bank Transfer',
      reference: reference?.trim() || '',
      vatApplicable: !!vatApplicable,
      vatAmount: vatApplicable ? Math.max(0, Number(vatAmount) || 0) : 0,
      deductible: deductible !== false,
      notes: notes?.trim() || '',
      recordedBy: req.admin?._id || null,
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

    const [incomeAgg, expenseAgg, categoryAgg, monthlyIncomeAgg, monthlyExpenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, status: { $in: ['completed', 'verified'] } } },
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
        { $match: { createdAt: { $gte: trailingStart }, status: { $in: ['completed', 'verified'] } } },
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
        pnl: { income, totalExpenses, deductibleExpenses, netProfit, taxableProfit, vatTotal, expenseCount: expenseRow.count },
        categories,
        monthly: Array.from(monthMap.values()),
      },
    });
  } catch (error) {
    console.error('Bookkeeping Summary Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
