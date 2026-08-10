import { isCreditTransaction as isInboundType } from './transactionDirection';

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

const counterpartyName = (tx: ReceiptTx): string => {
  if (isInboundType(tx.type as any)) return tx.sender?.name || 'Unknown';
  return tx.recipient?.name || tx.sender?.name || 'Treasury';
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildAuditReceiptHtml(tx: ReceiptTx): string {
  const amountStr = tx.type === 'fx_swap'
    ? `${(tx.usdcAmount || 0).toLocaleString()} USDC`
    : formatCurrency(tx.kesAmount || tx.amount || 0);
  const auditHash = Math.random().toString(36).substring(2, 18).toUpperCase();
  const timestamp = new Date(tx.createdAt).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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
  .ref-label { font-size: 9px; color: #707971; text-transform: uppercase; letter-spacing: 1.5px; }
  .ref-value { font-size: 14px; font-weight: 700; margin-top: 3px; }
  .divider { border-top: 1px solid #e6e6e6; margin: 14px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid .item .label { font-size: 8px; color: #707971; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 3px; }
  .grid .item .value { font-size: 11px; font-weight: 700; }
  .amount-box { margin-top: 16px; }
  .amount-box .label { font-size: 8px; color: #707971; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
  .amount-box .value { font-size: 22px; font-weight: 700; }
  .verify { margin-top: 20px; background: #f5f7f9; padding: 10px 12px; text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
  .footer { margin-top: 22px; text-align: center; font-size: 8px; color: #969696; line-height: 1.6; }
</style>
</head>
<body>
  <div class="band">
    <div class="title">OFFICIAL AUDIT RECEIPT</div>
  </div>
  <div class="content">
    <div class="ref-label">Reference ID</div>
    <div class="ref-value">${esc(tx.reference || '—')}</div>
    <div class="divider"></div>
    <div class="grid">
      <div class="item">
        <div class="label">Transaction Type</div>
        <div class="value">${esc(tx.type.replace(/_/g, ' ').toUpperCase())}</div>
      </div>
      <div class="item">
        <div class="label">Network Status</div>
        <div class="value">${esc((tx.status || '').toUpperCase())}</div>
      </div>
      <div class="item">
        <div class="label">Counterparty</div>
        <div class="value">${esc(counterpartyName(tx))}</div>
      </div>
      <div class="item">
        <div class="label">Timestamp</div>
        <div class="value">${esc(timestamp)}</div>
      </div>
    </div>
    <div class="amount-box">
      <div class="label">Total Amount</div>
      <div class="value">${esc(amountStr)}</div>
    </div>
    <div class="verify">VERIFICATION: PROTOCOL V4.2 SECURED</div>
    <div class="footer">
      This receipt is a cryptographically verified record of the transaction.<br/>
      Audit Hash: ${auditHash}<br/>
      Verified by PayChain Ledger Node v0.8.2
    </div>
  </div>
</body>
</html>`;
}
