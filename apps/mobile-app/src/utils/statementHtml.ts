import { isCreditTransaction, isDebitTransaction } from './transactionDirection';
import { formatAccountNumber } from './formatAccountNumber';
import { formatName } from './formatName';

// Mirrors the merchant-dashboard's jsPDF-built statement (Transactions.jsx's
// handleExport) in content — same account details, summary strip, running
// balance and transaction ledger — rendered as HTML for expo-print instead
// of jsPDF (which needs a DOM/canvas jsPDF doesn't have in React Native).
// Not a pixel-for-pixel match of the web PDF, but the same information.

export type StatementTx = {
  type: string;
  status?: string;
  reference?: string;
  amount?: number;
  kesAmount?: number;
  usdcAmount?: number;
  createdAt: string;
  timestamp?: string;
  sender?: { name?: string; id?: string };
  recipient?: { name?: string; id?: string };
};

type Merchant = {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  ncbaVirtualAccountNumber?: string;
  ncbaMerchantCode?: string;
};

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtKES = (n: number) => `Ksh ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const signedKesDelta = (t: StatementTx) => {
  if (isCreditTransaction(t.type as any)) return t.kesAmount || t.amount || 0;
  if (t.type === 'fx_swap') return -(t.kesAmount || 0);
  return -(t.kesAmount || t.amount || 0);
};

export function buildStatementHtml({
  rows,
  allTransactions,
  merchant,
  periodLabel,
  periodEnd,
  currentBalance,
}: {
  rows: StatementTx[];
  allTransactions: StatementTx[];
  merchant: Merchant | null;
  periodLabel: string;
  periodEnd: Date | null;
  currentBalance: number;
}) {
  const now = new Date();
  const statementId = `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const netChangeWithinPeriod = rows.reduce((s, t) => s + signedKesDelta(t), 0);
  const netChangeAfterPeriod = periodEnd
    ? allTransactions.filter((t) => new Date(t.createdAt || t.timestamp || 0) > periodEnd).reduce((s, t) => s + signedKesDelta(t), 0)
    : 0;
  const openingBalance = currentBalance - netChangeWithinPeriod - netChangeAfterPeriod;

  const totalIn = rows.filter((t) => isCreditTransaction(t.type as any)).reduce((s, o) => s + (o.kesAmount || o.amount || 0), 0);
  const totalOut = rows.filter((t) => isDebitTransaction(t.type as any)).reduce((s, o) => s + (o.kesAmount || o.amount || 0), 0);

  let runBalance = openingBalance;
  const sorted = [...rows].sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());

  const tableRows = sorted.map((tx) => {
    const dt = new Date(tx.createdAt || tx.timestamp || 0);
    const dateStr = dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' });
    const timeStr = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
    const isIn = isCreditTransaction(tx.type as any);
    const isOut = isDebitTransaction(tx.type as any);
    const isSwap = tx.type === 'fx_swap';
    const rawAmt = tx.amount || tx.kesAmount || 0;

    let paidIn = '', paidOut = '';
    if (isIn) { paidIn = fmtNum(rawAmt); runBalance += rawAmt; }
    if (isOut) { paidOut = fmtNum(rawAmt); runBalance -= rawAmt; }
    if (isSwap) { paidOut = fmtNum(tx.kesAmount || 0); runBalance -= (tx.kesAmount || 0); }

    const desc = isSwap
      ? `FX Swap → ${tx.usdcAmount || 0} USDC`
      : tx.sender?.name !== tx.recipient?.name
        ? `${formatName(tx.sender?.name) || '—'} → ${formatName(tx.recipient?.name) || '—'}`
        : formatName(tx.sender?.name) || formatName(tx.recipient?.name) || '—';

    return `<tr>
      <td class="mono small">${esc(dateStr)}<br/><span class="dim">${esc(timeStr)}</span></td>
      <td class="mono small">${esc((tx.reference || '—').slice(0, 16))}</td>
      <td class="small">${esc(desc.slice(0, 40))}</td>
      <td class="mono small right in">${esc(paidIn)}</td>
      <td class="mono small right out">${esc(paidOut)}</td>
      <td class="mono small right">${esc(fmtNum(runBalance))}</td>
      <td class="small status">${esc((tx.status || '').toUpperCase().slice(0, 9))}</td>
    </tr>`;
  }).join('');

  const accountNumber = merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>PayChain Statement — ${esc(statementId)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #06201B; margin: 0; }
  .band { background: #06201B; padding: 16px 18px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
  .band .brand { color: #fff; font-size: 16px; font-weight: 700; }
  .band .meta { color: #C8DCD2; font-size: 9px; text-align: right; line-height: 1.6; }
  .band .meta .tag { color: #5EFEB3; font-weight: 700; letter-spacing: 1px; }
  h2 { font-size: 11px; margin: 20px 0 6px; border-bottom: 1px solid #dce6e2; padding-bottom: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 9px; margin-bottom: 4px; }
  .grid .k { color: #5A645F; }
  .grid .v { font-weight: 700; text-align: right; }
  .summary { display: flex; gap: 8px; margin: 16px 0; }
  .summary .box { flex: 1; background: #F4F7F5; border-radius: 6px; padding: 8px; text-align: center; }
  .summary .box .label { font-size: 7px; color: #5A645F; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary .box .value { font-size: 12px; font-weight: 700; margin-top: 3px; }
  .in { color: #06201B; }
  .out { color: #B41E1E; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; color: #5A645F; text-align: left; padding: 6px 4px; border-bottom: 1px solid #dce6e2; }
  th.right { text-align: right; }
  td { padding: 5px 4px; border-bottom: 1px solid #f0f2f1; vertical-align: top; }
  .small { font-size: 8px; }
  .mono { font-family: 'Courier New', monospace; }
  .right { text-align: right; }
  .dim { color: #9aa39e; }
  .status { text-transform: uppercase; color: #5A645F; }
  .opening { font-size: 9px; margin-top: 4px; color: #5A645F; }
  .footer { margin-top: 20px; text-align: center; font-size: 7px; color: #9aa39e; }
</style>
</head>
<body>
  <div class="band">
    <div class="brand">PayChain Kenya</div>
    <div class="meta">
      <div class="tag">OFFICIAL TRANSACTION STATEMENT</div>
      <div>Statement Ref: ${esc(statementId)}</div>
      <div>Issued: ${esc(now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }))}</div>
    </div>
  </div>

  <h2>Account Details</h2>
  <div class="grid">
    <div class="k">Account Name: <span class="v">${esc(merchant?.name || '—')}</span></div>
    <div class="k">Business: <span class="v">${esc(merchant?.businessName || '—')}</span></div>
    <div class="k">Paybill / PayChain Account: <span class="v">880100 / ${esc(formatAccountNumber(accountNumber))}</span></div>
    <div class="k">Email: <span class="v">${esc(merchant?.email || '—')}</span></div>
    <div class="k">Phone: <span class="v">${esc(merchant?.phone || '—')}</span></div>
    <div class="k">Statement Period: <span class="v">${esc(periodLabel)}</span></div>
  </div>

  <div class="summary">
    <div class="box"><div class="label">Total Money In</div><div class="value in">${esc(fmtKES(totalIn))}</div></div>
    <div class="box"><div class="label">Total Money Out</div><div class="value out">${esc(fmtKES(totalOut))}</div></div>
    <div class="box"><div class="label">Net Position</div><div class="value" style="color:${totalIn >= totalOut ? '#06201B' : '#B41E1E'}">${esc(fmtKES(totalIn - totalOut))}</div></div>
    <div class="box"><div class="label">Transactions</div><div class="value">${rows.length}</div></div>
  </div>

  <h2>Transaction Ledger <span style="float:right;font-weight:400;color:#9aa39e">${rows.length} record${rows.length !== 1 ? 's' : ''}</span></h2>
  <div class="opening">Opening Balance: ${esc(fmtKES(openingBalance))}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Reference</th><th>Description</th>
        <th class="right">Paid In</th><th class="right">Paid Out</th><th class="right">Balance</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">This is a system-generated statement from PayChain Kenya. For queries, contact support@paychain.co.ke.</div>
</body>
</html>`;
}
