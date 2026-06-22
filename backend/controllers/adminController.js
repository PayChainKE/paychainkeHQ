import Merchant from '../models/Merchant.js';

// @desc    Get all merchants
// @route   GET /api/admin/merchants
// @access  Private (Admin)
export const getMerchants = async (req, res) => {
  try {
    const merchants = await Merchant.find({}).sort('-createdAt').select('-password -otp -otpExpires');
    res.json({ success: true, count: merchants.length, data: merchants });
  } catch (error) {
    console.error('Get Merchants Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get merchant analytics
// @route   GET /api/admin/merchants/analytics
// @access  Private (Admin)
export const getMerchantAnalytics = async (req, res) => {
  try {
    const totalMerchants = await Merchant.countDocuments();
    const verifiedMerchants = await Merchant.countDocuments({ isVerified: true });
    const unverifiedMerchants = totalMerchants - verifiedMerchants;

    // Get recently added merchants (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMerchants = await Merchant.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    res.json({
      success: true,
      data: {
        totalMerchants,
        verifiedMerchants,
        unverifiedMerchants,
        recentMerchants
      }
    });
  } catch (error) {
    console.error('Get Merchant Analytics Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
