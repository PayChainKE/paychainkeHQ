import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import Developer from '../models/Developer.js';

// Same escape used elsewhere a user-typed string becomes a $regex
// (developerController.js's transaction search) — without it, a query
// containing regex metacharacters either throws or, worse, becomes an
// unintended pattern match.
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    One search box across merchants, transactions and developers —
//          so an admin can jump straight to a record by name, email,
//          phone, reference or account code instead of navigating into
//          the right page and filtering there. Read-only, capped results
//          per category (this is a jump-to tool, not a reporting screen).
// @route   GET /api/admin/search?q=
// @access  Private (Admin — owner/admin/analyst)
export const globalSearch = async (req, res) => {
  try {
    const raw = String(req.query.q || '').trim();
    if (raw.length < 2) return res.json({ success: true, merchants: [], transactions: [], developers: [] });

    const term = escapeRegex(raw).slice(0, 200);
    const rx = { $regex: term, $options: 'i' };
    const limit = 6;

    const merchantOr = [{ businessName: rx }, { email: rx }, { phone: rx }, { ncbaMerchantCode: rx }];
    // A 24-char hex string might be a merchant _id pasted from somewhere —
    // worth trying directly, not just as a substring match against other fields.
    if (mongoose.isValidObjectId(raw)) merchantOr.push({ _id: raw });

    const [merchants, transactions, developers] = await Promise.all([
      Merchant.find({ $or: merchantOr })
        .select('businessName email phone ncbaMerchantCode status isDemoMerchant')
        .limit(limit),
      Transaction.find({ reference: rx })
        .select('reference type status amount merchantId createdAt')
        .sort('-createdAt')
        .limit(limit),
      Developer.find({ $or: [{ companyName: rx }, { email: rx }] })
        .select('companyName email status')
        .limit(limit),
    ]);

    res.json({
      success: true,
      merchants: merchants.filter((m) => !m.isDemoMerchant).map((m) => ({
        id: m._id, businessName: m.businessName, email: m.email, phone: m.phone,
        ncbaMerchantCode: m.ncbaMerchantCode, status: m.status,
      })),
      transactions: transactions.map((t) => ({
        id: t._id, reference: t.reference, type: t.type, status: t.status, amount: t.amount, createdAt: t.createdAt,
      })),
      developers: developers.map((d) => ({ id: d._id, companyName: d.companyName, email: d.email, status: d.status })),
    });
  } catch (error) {
    console.error('Global Search Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
