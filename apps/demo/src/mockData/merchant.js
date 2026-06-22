// Mock merchant profile for merchant portal
export const mockMerchant = {
  id: 'mer_847291',
  name: 'James Kamau',
  businessName: 'Kamau General Store',
  phone: '+254712847291',
  email: 'james@kamaustore.co.ke',
  businessType: 'Retail',
  revenueRange: 'KES 200,000–500,000',
  tillNumber: '84729',
  walletAddress: '0x8472...91d0',
  fullWalletAddress: '0x847291aB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V',
  accountStatus: 'active',
  kycStatus: 'verified',
  trustScore: {
    current: 74,
    eligibleForAdvance: true,
    eligibleSince: '2026-01-20',
    nextMilestone: 80,
    nextMilestoneReward: 'Higher advance limit',
    factors: {
      transactionVolume: 82,
      consistency: 78,
      revenueGrowth: 65,
      tenure: 71,
      repaymentHistory: 100
    }
  },
  financials: {
    kesBalance: 184250,
    usdcBalance: 312.5,
    totalCollected: 1847500,
    totalPaidOut: 1243000,
    totalFxSwapped: 287000,
    totalTransactions: 847,
    lastTransactionAt: new Date().toISOString(),
    monthlyAvgRevenue: 307916,
    thisMonthRevenue: 284750,
    lastMonthRevenue: 331200,
    todayRevenue: 18450
  },
  cashAdvance: {
    isEligible: true,
    eligibleSince: '2026-01-20',
    currentAdvance: {
      id: 'adv_001',
      amount: 150000,
      disbursedAt: '2026-02-01',
      repaidAmount: 67500,
      repaymentRate: 8,
      status: 'active',
      estimatedCompletionDate: '2026-04-15'
    },
    history: [
      { id: 'adv_000', amount: 75000, disbursedAt: '2025-11-01', repaidAt: '2026-01-15', status: 'repaid' }
    ]
  },
  onboardedBy: 'Sarah Njeri',
  onboardedAt: '2025-10-15',
  joinedAt: '2025-10-15',
  isFirstLogin: false,
  notifications: [
    { id: 'n1', type: 'advance', message: 'Your Cash Advance repayment is 45% complete.', isRead: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'n2', type: 'trust_score', message: 'Your Trust Score increased to 74. You are 6 points from your next milestone.', isRead: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'n3', type: 'payment', message: 'Bulk Pay of KES 45,000 to 3 employees completed successfully.', isRead: true, createdAt: new Date(Date.now() - 172800000).toISOString() }
  ]
}
