import { formatName } from './formatName';
import { formatPhoneOrBlank } from './formatPhoneDisplay';
import { barcodeSvg } from './barcode';

// Single source of truth for the printable "Official Audit Receipt" PDF —
// used by both Collections.tsx (inbound collections) and Transactions.tsx
// (full transaction history detail view), so the two never drift into
// visually-different receipts for what's supposed to be the same document.
export type ReceiptTx = {
  type: string;
  status?: string;
  reference?: string;
  amount?: number;
  kesAmount?: number;
  usdcAmount?: number;
  createdAt: string;
  sender?: { name?: string; id?: string };
  recipient?: { name?: string; id?: string };
};

const PAYCHAIN_PHONE = '+254 743 283 782';
const PAYCHAIN_SLOGAN = 'Collect, Pay, Protect, Grow';

const formatCurrency = (amount: number) =>
  `Ksh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// `phoneNumber` lets a caller that already knows the real recipient phone
// (e.g. TransactionSuccessCard.tsx, right after a Send Money/withdrawal
// flow, before the saved Transaction's recipient.id is available to read
// back) pass it explicitly; otherwise the recipient phone is derived from
// recipient.id, the same field Collections.tsx/Transactions.tsx already
// read.
export function buildAuditReceiptHtml(tx: ReceiptTx, phoneNumber?: string): string {
  const amountStr = formatCurrency(tx.kesAmount || tx.amount || 0);
  const timestamp = new Date(tx.createdAt).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  // A receipt has to prove BOTH who paid and who was paid, not just one
  // blended "counterparty" — previously picked sender-first for outbound
  // types, which is always this merchant's own name.
  const senderName = formatName(tx.sender?.name) || '—';
  const senderPhone = formatPhoneOrBlank(tx.sender?.id);
  const recipientName = formatName(tx.recipient?.name) || '—';
  const recipientPhone = formatPhoneOrBlank(phoneNumber ?? tx.recipient?.id);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Audit Receipt — ${esc(tx.reference)}</title>
<style>
  @page { size: 105mm 148mm; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #162723; margin: 0; }
  .band { background: #162723; padding: 18px 16px; text-align: center; }
  .band .title { color: #fff; font-size: 15px; font-weight: 700; letter-spacing: 1.5px; margin-top: 8px; }
  .content { padding: 20px 18px; }
  .ref-label { font-size: 9px; color: #5b645c; text-transform: uppercase; letter-spacing: 1.5px; }
  .ref-value { font-size: 14px; font-weight: 700; margin-top: 3px; }
  .divider { border-top: 1px solid #e6e6e6; margin: 14px 0; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .party { border: 1px solid #e6e6e6; border-radius: 6px; padding: 8px 10px; }
  .party .label { font-size: 7.5px; color: #78807c; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; font-weight: 700; }
  .party .value { font-size: 11px; font-weight: 700; }
  .party .phone { font-size: 9px; color: #5b645c; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid .item .label { font-size: 8px; color: #5b645c; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 3px; }
  .grid .item .value { font-size: 11px; font-weight: 700; }
  .amount-box { margin-top: 16px; }
  .amount-box .label { font-size: 8px; color: #5b645c; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
  .amount-box .value { font-size: 22px; font-weight: 700; }
  .verify { margin-top: 20px; background: #f5f7f9; padding: 10px 12px; text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
  .barcode { margin-top: 16px; text-align: center; }
  .barcode svg { width: 200px; height: 36px; }
  .barcode .ref { margin-top: 4px; font-family: 'Courier New', monospace; font-size: 8px; color: #5b645c; letter-spacing: 0.5px; }
  .footer { margin-top: 18px; text-align: center; font-size: 8px; color: #969696; line-height: 1.7; }
  .footer .brand { color: #162723; font-weight: 700; }
  .footer .slogan { font-size: 7.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #2f6b52; margin-top: 2px; }
</style>
</head>
<body>
  <div class="band">
    <div class="title">OFFICIAL AUDIT RECEIPT</div>
  </div>
  <div class="content">
    <div class="ref-label">Reference ID</div>
    <div class="ref-value">${esc(tx.reference || '')}</div>
    <div class="divider"></div>
    <div class="parties">
      <div class="party">
        <div class="label">Sender</div>
        <div class="value">${esc(senderName)}</div>
        ${senderPhone ? `<div class="phone">${esc(senderPhone)}</div>` : ''}
      </div>
      <div class="party">
        <div class="label">Recipient</div>
        <div class="value">${esc(recipientName)}</div>
        ${recipientPhone ? `<div class="phone">${esc(recipientPhone)}</div>` : ''}
      </div>
    </div>
    <div class="grid">
      <div class="item">
        <div class="label">Date &amp; Time</div>
        <div class="value">${esc(timestamp)}</div>
      </div>
      <div class="item">
        <div class="label">Status</div>
        <div class="value">${esc((tx.status || '').toUpperCase())}</div>
      </div>
      <div class="item">
        <div class="label">Payment Type</div>
        <div class="value">${esc(tx.type.replace(/_/g, ' ').toUpperCase())}</div>
      </div>
    </div>
    <div class="amount-box">
      <div class="label">Total Amount</div>
      <div class="value">${esc(amountStr)}</div>
    </div>
    <div class="verify">OFFICIAL PAYCHAIN TRANSACTION RECORD</div>
    <div class="barcode">
      ${barcodeSvg(tx.reference || '')}
      <div class="ref">${esc(tx.reference || '')}</div>
    </div>
    <div class="footer">
      This receipt reflects PayChain's record of the transaction identified by the reference above.<br/>
      Generated ${esc(new Date().toLocaleString('en-KE'))}<br/>
      <span class="brand">PayChain Kenya · ${esc(PAYCHAIN_PHONE)}</span>
      <div class="slogan">${esc(PAYCHAIN_SLOGAN)}</div>
    </div>
  </div>
</body>
</html>`;
}
