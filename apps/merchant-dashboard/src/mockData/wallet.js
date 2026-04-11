import { transactionsData } from './transactions'

export const walletStats = {
  totalBalanceKES: 184250,
  totalBalanceUSDC: 312.50,
  withdrawalDestinations: [
    { id: 'till-1', type: 'Till', label: 'Store Till (284729)', verified: true },
    { id: 'bank-1', type: 'Bank', label: 'KCB Bank (***6721)', verified: true },
    { id: 'bank-2', type: 'Bank', label: 'Equity Bank (***0912)', verified: false },
  ]
}

export const walletHistory = [
  ...transactionsData.filter(tx => tx.type === 'fx_swap' || tx.type === 'withdrawal'),
  {
    id: 'w-1',
    type: 'withdrawal',
    amount: 5000,
    currency: 'KES',
    destination: 'Store Till (284729)',
    status: 'completed',
    timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'w-2',
    type: 'withdrawal',
    amount: 12000,
    currency: 'KES',
    destination: 'KCB Bank (***6721)',
    status: 'pending',
    timestamp: new Date().toISOString(),
  }
]
