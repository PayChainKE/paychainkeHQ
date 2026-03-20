export const payees = [
  { id: 'payee_001', type: 'employee', name: 'Mary Wanjiku', phone: '0722 123 456', role: 'Shop Assistant', salary: 18000, frequency: 'monthly', lastPaidAt: '2026-02-28', isActive: true },
  { id: 'payee_002', type: 'employee', name: 'Peter Otieno', phone: '0711 234 567', role: 'Cashier', salary: 20000, frequency: 'monthly', lastPaidAt: '2026-02-28', isActive: true },
  { id: 'payee_003', type: 'supplier', name: 'Gikomba Wholesale Ltd', phone: '0733 456 789', businessName: 'Gikomba Wholesale', amount: 85000, frequency: 'as needed', lastPaidAt: '2026-03-05', isActive: true },
  { id: 'payee_004', type: 'utility', name: 'Kenya Power', accountNumber: '123456789', amount: 4500, frequency: 'monthly', lastPaidAt: '2026-02-25', isActive: true },
  { id: 'payee_005', type: 'employee', name: 'Alice Nyambura', phone: '0725 987 654', role: 'Stock Manager', salary: 22000, frequency: 'monthly', lastPaidAt: '2026-02-28', isActive: true }
]

export const bulkPayHistory = [
  { id: 'batch_001', label: 'March 2026 Payroll', type: 'payroll', totalAmount: 108000, recipientCount: 6, status: 'completed', executedAt: '2026-03-01', recipients: ['payee_001','payee_002','payee_005'] },
  { id: 'batch_002', label: 'Supplier payment — Gikomba', type: 'supplier', totalAmount: 85000, recipientCount: 1, status: 'completed', executedAt: '2026-03-05', recipients: ['payee_003'] }
]
