import { hyphenateEvery4, money2dpString, TAX_TYPE_CODES } from './etimsFormat.js';

const TAX_LABELS = { A: 'EX', B: 'VAT16', C: 'ZERO', D: 'NON-VAT', E: 'VAT8' };

function formatDisplayDateTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Plain-JSON shape of a thermal/PDF receipt — pure and DB-free (takes an
// already-loaded EtimsInvoice + Merchant, plain objects or Mongoose docs
// both work) so it can be reused by an HTML renderer, a PDF layout, or a
// receipt-preview API endpoint without re-deriving anything.
export function buildReceiptData(invoice, merchant) {
  const cuInvoiceNumber = invoice.sdcId != null && invoice.rcptNo != null
    ? `${invoice.sdcId}/${invoice.rcptNo}`
    : null;

  const internalData = invoice.formattedInternalData || hyphenateEvery4(invoice.intrlData);
  const receiptSignature = invoice.formattedSignature || hyphenateEvery4(invoice.rcptSign);

  const taxBreakdown = TAX_TYPE_CODES
    .map((code) => ({
      code,
      label: TAX_LABELS[code],
      taxblAmt: money2dpString(invoice[`taxblAmt${code}`] || 0),
      taxAmt: money2dpString(invoice[`taxAmt${code}`] || 0),
    }))
    .filter((row) => Number(row.taxblAmt) !== 0 || Number(row.taxAmt) !== 0);

  return {
    trader: {
      name: merchant?.businessName || merchant?.name || '',
      address: [merchant?.area, merchant?.county].filter(Boolean).join(', '),
      pin: merchant?.kraPin || '',
    },
    buyer: (invoice.custTin || invoice.custNm)
      ? { pin: invoice.custTin || null, name: invoice.custNm || null }
      : null,
    receiptType: invoice.transactionType,
    invcNo: invoice.invcNo,
    orgInvcNo: invoice.orgInvcNo || null,
    items: (invoice.items || []).map((it) => ({
      sku: it.itemCd || it.itemClsCd,
      name: it.itemNm,
      qty: it.qty,
      unitPrice: money2dpString(it.prc),
      lineTotal: money2dpString(it.totAmt),
      taxLabel: TAX_LABELS[it.taxTyCd] || it.taxTyCd,
    })),
    subtotal: money2dpString(invoice.totTaxblAmt),
    discount: money2dpString(invoice.discountAmt || 0),
    taxBreakdown,
    grandTotal: money2dpString(invoice.totAmt),
    scu: {
      dateTime: formatDisplayDateTime(invoice.createdAt || new Date()),
      sdcId: invoice.sdcId,
      cuInvoiceNumber,
      internalData,
      receiptSignature,
      qrUrl: invoice.qrUrl,
      qrDataUri: invoice.qrDataUri,
      tisReceiptNumber: invoice.totRcptNo,
    },
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Standalone 80mm-thermal-width HTML — inline styles only, no external
// stylesheet/font, since this is meant to be opened directly in a print
// dialog or piped into a PDF renderer, not served as part of the app shell.
export function renderReceiptHtml(invoice, merchant) {
  const r = buildReceiptData(invoice, merchant);

  const itemRows = r.items.map((it) => `
    <tr>
      <td colspan="4" style="padding-top:4px;font-weight:bold;">${escapeHtml(it.name)} <span style="font-weight:normal;color:#555;">[${escapeHtml(it.taxLabel)}]</span></td>
    </tr>
    <tr>
      <td style="color:#555;">${escapeHtml(it.sku || '')}</td>
      <td style="text-align:right;">${it.qty} x ${it.unitPrice}</td>
      <td></td>
      <td style="text-align:right;font-weight:bold;">${it.lineTotal}</td>
    </tr>`).join('');

  const taxRows = r.taxBreakdown.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td style="text-align:right;">${row.taxblAmt}</td>
      <td style="text-align:right;">${row.taxAmt}</td>
    </tr>`).join('');

  return `
<div style="width:302px;font-family:'Courier New',monospace;font-size:12px;color:#111;padding:12px;background:#fff;">
  <div style="text-align:center;margin-bottom:8px;">
    <div style="width:48px;height:48px;margin:0 auto 4px;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;">KRA</div>
    <div style="font-weight:bold;font-size:14px;">${escapeHtml(r.trader.name)}</div>
    <div>${escapeHtml(r.trader.address)}</div>
    <div>PIN: ${escapeHtml(r.trader.pin)}</div>
  </div>

  <hr style="border:none;border-top:1px dashed #111;" />

  ${r.buyer ? `<div>Buyer: ${escapeHtml(r.buyer.name || '')} ${r.buyer.pin ? `(PIN: ${escapeHtml(r.buyer.pin)})` : ''}</div><hr style="border:none;border-top:1px dashed #111;" />` : ''}

  <div style="text-align:center;font-weight:bold;margin:4px 0;">
    ${r.receiptType === 'CREDIT_NOTE' ? 'CREDIT NOTE' : 'TAX INVOICE'} #${r.invcNo}
    ${r.orgInvcNo ? `<div style="font-weight:normal;font-size:11px;">Ref. Invoice #${r.orgInvcNo}</div>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;">${itemRows}</table>

  <hr style="border:none;border-top:1px dashed #111;" />

  <table style="width:100%;">
    <tr><td>Subtotal</td><td style="text-align:right;">${r.subtotal}</td></tr>
    <tr><td>Discount</td><td style="text-align:right;">${r.discount}</td></tr>
    <tr><td style="font-weight:bold;">TOTAL</td><td style="text-align:right;font-weight:bold;">${r.grandTotal}</td></tr>
  </table>

  <hr style="border:none;border-top:1px dashed #111;" />

  <table style="width:100%;font-size:11px;">
    <tr><td style="font-weight:bold;" colspan="3">Tax Rate</td></tr>
    <tr><td>Rate</td><td style="text-align:right;">Taxable</td><td style="text-align:right;">Tax</td></tr>
    ${taxRows}
  </table>

  <hr style="border:none;border-top:1px dashed #111;" />

  <div style="font-size:10.5px;line-height:1.5;">
    <div>Date/Time: ${escapeHtml(r.scu.dateTime)}</div>
    <div>SCU ID: ${escapeHtml(r.scu.sdcId || '')}</div>
    <div>CU Invoice No: ${escapeHtml(r.scu.cuInvoiceNumber || '')}</div>
    <div>Internal Data: ${escapeHtml(r.scu.internalData)}</div>
    <div>Receipt Signature: ${escapeHtml(r.scu.receiptSignature)}</div>
    <div>TIS Receipt No: ${escapeHtml(r.scu.tisReceiptNumber ?? '')}</div>
  </div>

  ${r.scu.qrDataUri ? `<div style="text-align:center;margin-top:8px;"><img src="${r.scu.qrDataUri}" width="120" height="120" alt="Receipt verification QR" /></div>` : ''}
  <div style="text-align:center;font-size:9px;word-break:break-all;margin-top:2px;">${escapeHtml(r.scu.qrUrl || '')}</div>
</div>`;
}
