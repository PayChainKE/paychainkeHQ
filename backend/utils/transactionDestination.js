import { KENYAN_BANK_CODES } from '../config/kenyanBankCodes.js';

// Builders for Transaction.destination — a small, purely descriptive record of
// WHERE an outgoing payment went (mobile wallet, Paybill, Till, bank account,
// utility). The number/account itself stays in recipient.id and the name in
// recipient.name; this only adds what those two fields can't say: which kind
// of destination it was, which bank, which network, which Paybill account
// reference. Never used for money movement — display and audit only.

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const bankNameForCode = (code) =>
  KENYAN_BANK_CODES.find((b) => b.code === String(code ?? '').trim())?.name;

export const mobileDestination = (network) =>
  clean({ kind: 'mobile', network: network === 'airtel' ? 'airtel' : 'safaricom' });

// paymentType is either 'Paybill'/'Till' (NCBA rail) or 'paybill'/'till'.
export const paybillTillDestination = (paymentType, accountReference) => {
  const isPaybill = String(paymentType).toLowerCase() === 'paybill';
  return clean({ kind: isPaybill ? 'paybill' : 'till', accountReference: isPaybill ? accountReference : undefined });
};

export const bankDestination = ({ bankCode, bankName } = {}) =>
  clean({ kind: 'bank', bankCode, bankName: bankName || bankNameForCode(bankCode) });

// Bulk-pay payee (models/Payee.js) -> destination.
export const payeeDestination = (payee) => {
  if (!payee) return undefined;
  if (payee.type === 'utility' && payee.utilityProvider) {
    return clean({ kind: 'utility', provider: payee.utilityProvider });
  }
  if (payee.paymentMethod === 'Bank') {
    return bankDestination({ bankCode: payee.bankCode, bankName: payee.bankName });
  }
  if (payee.mobileMoneyType === 'Paybill') return paybillTillDestination('paybill', payee.businessAccount);
  if (payee.mobileMoneyType === 'Buy Goods') return paybillTillDestination('till');
  return mobileDestination(payee.mobileNetwork);
};
