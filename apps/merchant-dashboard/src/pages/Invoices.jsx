import React, { useState, useEffect, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import domtoimage from 'dom-to-image'
import { ValidatedInput } from '../components/ValidatedInput'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNotification } from '../context/NotificationContext'
import { formatKES } from '../utils/formatCurrency'
import paychainLogo from '../assets/paychain-logo-dark.png'
import paychainLogoWhite from '../assets/paychain-logo-white.png'
import paychainMark from '../assets/paychain-mark.png'
import axios from 'axios'

// Extracted out of BulkPay.jsx, where this whole feature used to live under
// a "Bulk Payments" nav item — nobody thinks to look there to check whether
// an invoice they sent has been paid. Same data, same handlers, same
// backend (routes/invoiceRoutes.js), just given its own sidebar entry.
export default function Invoices() {
  const { addNotification } = useNotification()
  const { merchant } = useMerchantAuth()

  const blankInvoice = () => ({
    customer: { name: '', email: '', phone: '', address: '', kraPin: '' },
    invoiceNumber: null, // assigned by the server on first save
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    currency: 'KES',
    notes: '',
    recurring: false,
    items: [{ description: '', qty: 1, price: 0, discountRate: 0, taxTyCd: 'B', itemClsCd: '' }],
    payUrl: null,
    status: 'draft',
    qrCodeDataUri: null,
    etims: null,
  });

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(blankInvoice());

  // Whether this merchant has an initialized KRA eTIMS OSCU device — the
  // per-item tax/classification fields and buyer PIN only render at all when
  // this is true, so the vast majority of merchants (no OSCU registered)
  // never see fields that don't apply to them.
  const [etimsEnabled, setEtimsEnabled] = useState(false);
  const TAX_TYPE_OPTIONS = [
    { code: 'A', label: 'A — Exempt' },
    { code: 'B', label: 'B — 16% VAT' },
    { code: 'C', label: 'C — Zero-rated' },
    { code: 'D', label: 'D — Non-VAT' },
    { code: 'E', label: 'E — 8% VAT' },
  ];

  const [invoicesList, setInvoicesList] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState('All');
  const [invoicePage, setInvoicePage] = useState(1);
  const invoicesPerPage = 8;

  const filteredInvoicesList = invoicesList.filter(inv => invoiceFilter === 'All' || inv.status === (invoiceFilter === 'Drafts' ? 'draft' : invoiceFilter.toLowerCase()));
  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoicesList.length / invoicesPerPage));
  const paginatedInvoicesList = filteredInvoicesList.slice((invoicePage - 1) * invoicesPerPage, invoicePage * invoicesPerPage);

  // Per-status breakdown for the stat tiles below — draft (still being
  // prepared), sent (awaiting the customer's payment), paid (successfully
  // collected). Monetary totals only sum KES invoices — `currency` is a
  // free-text field on each invoice, so adding a USD total onto a KES one
  // would silently misreport the figure; invoices in any other currency
  // still count toward the tile's count, just not its KES total.
  const invoiceStats = ['draft', 'sent', 'paid'].reduce((acc, s) => {
    const rows = invoicesList.filter(inv => inv.status === s);
    const kesTotal = rows.filter(inv => (inv.currency || 'KES') === 'KES').reduce((sum, inv) => sum + (inv.total || 0), 0);
    acc[s] = { count: rows.length, kesTotal };
    return acc;
  }, {});

  const lineGross = (item) => (item.qty || 0) * (item.price || 0);
  const lineDiscount = (item) => lineGross(item) * (Math.min(100, Math.max(0, Number(item.discountRate) || 0)) / 100);
  const lineNet = (item) => lineGross(item) - lineDiscount(item);

  const invoiceSubtotal = invoiceDetails.items.reduce((sum, item) => sum + lineGross(item), 0);
  const invoiceDiscountTotal = invoiceDetails.items.reduce((sum, item) => sum + lineDiscount(item), 0);
  const invoiceTotal = invoiceSubtotal - invoiceDiscountTotal;
  const invoiceHasRealItems = invoiceDetails.items.some(i => i.description.trim() || i.price > 0);

  const fmtInvoiceCurrency = (n) => `${invoiceDetails.currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Always renders as the professional local format (0XXXXXXXXX) regardless
  // of how the number is stored — mirrors the backend's normalizePhoneKE.
  const displayPhoneKE = (raw) => {
    if (!raw) return null;
    let d = String(raw).replace(/\D/g, '');
    if (d.startsWith('254')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);
    return /^[71]\d{8}$/.test(d) ? `0${d}` : raw;
  };

  const fmtInvoiceDate = (value) => value
    ? new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const fetchInvoices = useCallback(async () => {
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoicesList(res.data.invoices || []);
    } catch (err) {
      // Non-fatal — the list just shows its empty state
    }
  }, []);

  const fetchEtimsStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/v1/etims/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // `eligible` (a KRA PIN on file), not `isInitialized` — there's no
      // "enable eTIMS" action for a merchant to take, activation happens
      // silently on first send, so the fields need to be visible before
      // that ever happens, not after.
      setEtimsEnabled(!!(res.data.eligible || res.data.isInitialized));
    } catch (err) {
      // Non-fatal — just means the KRA-specific fields stay hidden
    }
  }, []);

  useEffect(() => { fetchInvoices() }, [fetchInvoices]);
  useEffect(() => { fetchEtimsStatus() }, [fetchEtimsStatus]);

  // Keep the current page in range as the (filtered) list shrinks — e.g.
  // deleting the last invoice on the final page.
  useEffect(() => {
    setInvoicePage(prev => Math.min(prev, totalInvoicePages));
  }, [totalInvoicePages]);

  const handleAddInvoiceItem = () => {
    setInvoiceDetails(prev => ({
      ...prev,
      items: [...prev.items, { description: '', qty: 1, price: 0, discountRate: 0, taxTyCd: 'B', itemClsCd: '' }]
    }))
  };

  const handleUpdateInvoiceItem = (index, field, value) => {
    setInvoiceDetails(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  };

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceDetails(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  };

  const downloadInvoicePDF = async () => {
    addNotification({ title: 'Processing', message: 'Generating professional invoice...', type: 'info' });
    const element = document.getElementById('invoice-pdf-pane');
    if (element) {
      try {
        // Capture the live preview at whatever pixel size it renders at, but
        // always place it on a real, fixed A4 page (210x297mm) rather than
        // sizing the PDF page itself off element.clientWidth/clientHeight —
        // that previously made the "PDF" whatever arbitrary size the pane
        // happened to render at, not actually A4.
        const dataUrl = await domtoimage.toPng(element, { bgcolor: '#ffffff' });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210;
        const pageHeight = 297;
        const img = pdf.getImageProperties(dataUrl);
        const imgRatio = img.height / img.width;
        let renderWidth = pageWidth;
        let renderHeight = pageWidth * imgRatio;
        if (renderHeight > pageHeight) {
          renderHeight = pageHeight;
          renderWidth = pageHeight / imgRatio;
        }
        const offsetX = (pageWidth - renderWidth) / 2;
        pdf.addImage(dataUrl, 'PNG', offsetX, 0, renderWidth, renderHeight);
        pdf.save(`Invoice_${invoiceDetails.invoiceNumber || 'Draft'}.pdf`);
        addNotification({ title: 'Download Complete', message: `Invoice saved successfully.`, type: 'success' });
      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to generate PDF: ' + err.message, type: 'error' });
      }
    }
  };

  const buildInvoicePayload = () => ({
    customer: invoiceDetails.customer,
    items: invoiceDetails.items,
    currency: invoiceDetails.currency,
    issueDate: invoiceDetails.issueDate,
    dueDate: invoiceDetails.dueDate || null,
    notes: invoiceDetails.notes,
    recurring: invoiceDetails.recurring,
    // Reuse the number already reserved when the modal opened, so the
    // number shown in the editor is the exact one that gets saved.
    invoiceNumber: invoiceDetails.invoiceNumber || undefined,
  });

  const upsertInvoiceInList = (saved) => {
    setInvoicesList(prev => {
      const exists = prev.some(inv => inv._id === saved._id);
      return exists ? prev.map(inv => inv._id === saved._id ? saved : inv) : [saved, ...prev];
    });
  };

  const handleSaveDraft = async () => {
    if (!invoiceDetails.customer.name.trim()) {
      addNotification({ title: 'Missing Customer', message: 'Enter a customer name first.', type: 'error' });
      return;
    }
    // Only enforced once eTIMS is actually eligible (etimsEnabled) — same
    // condition the field itself is shown under, and what the backend
    // re-checks server-side (see invoiceController.js's createInvoice).
    if (etimsEnabled && !invoiceDetails.customer.kraPin?.trim()) {
      addNotification({ title: 'Missing KRA PIN', message: "Enter the buyer's KRA PIN — required for electronic tax invoices.", type: 'error' });
      return;
    }

    setIsSavingInvoice(true);
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const payload = buildInvoicePayload();

      const res = activeInvoiceId
        ? await axios.put(`${API_URL}/api/invoices/${activeInvoiceId}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        : await axios.post(`${API_URL}/api/invoices`, payload, { headers: { Authorization: `Bearer ${token}` } });

      const saved = res.data.invoice;
      setActiveInvoiceId(saved._id);
      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: saved.invoiceNumber, payUrl: saved.payUrl, status: saved.status, qrCodeDataUri: saved.qrCodeDataUri, etims: saved.etims }));
      upsertInvoiceInList(saved);

      setShowInvoiceModal(false);
      addNotification({
        title: 'Draft Saved',
        message: `Invoice #${saved.invoiceNumber} safely stored in Invoices -> Drafts.`,
        type: 'success'
      });
    } catch (err) {
      addNotification({ title: 'Error', message: err.response?.data?.error || 'Failed to save invoice draft', type: 'error' });
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoiceDetails.customer.name.trim()) {
      addNotification({ title: 'Missing Customer', message: 'Enter a customer name first.', type: 'error' });
      return;
    }
    if (!invoiceDetails.customer.email?.trim()) {
      addNotification({ title: 'Missing Email', message: "Add the customer's email address to send this invoice.", type: 'error' });
      return;
    }
    // See handleSaveDraft's identical check.
    if (etimsEnabled && !invoiceDetails.customer.kraPin?.trim()) {
      addNotification({ title: 'Missing KRA PIN', message: "Enter the buyer's KRA PIN — required for electronic tax invoices.", type: 'error' });
      return;
    }

    setIsSendingInvoice(true);
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const payload = buildInvoicePayload();

      let invoiceId = activeInvoiceId;
      if (!invoiceId) {
        const createRes = await axios.post(`${API_URL}/api/invoices`, payload, { headers: { Authorization: `Bearer ${token}` } });
        invoiceId = createRes.data.invoice._id;
        setActiveInvoiceId(invoiceId);
      } else {
        await axios.put(`${API_URL}/api/invoices/${invoiceId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }

      const sendRes = await axios.post(`${API_URL}/api/invoices/${invoiceId}/send`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const sent = sendRes.data.invoice;

      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: sent.invoiceNumber, payUrl: sent.payUrl, status: sent.status, qrCodeDataUri: sent.qrCodeDataUri, etims: sent.etims }));
      upsertInvoiceInList(sent);

      setShowInvoiceModal(false);
      addNotification({
        title: 'Invoice Sent',
        message: `Invoice #${sent.invoiceNumber} has been emailed to ${invoiceDetails.customer.email}.`,
        type: 'success'
      });
    } catch (err) {
      addNotification({ title: 'Error', message: err.response?.data?.error || 'Failed to send invoice', type: 'error' });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState(null);

  const handleDeleteInvoice = async (inv) => {
    setConfirmDeleteInvoiceId(null);
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      await axios.delete(`${API_URL}/api/invoices/${inv._id}`, { headers: { Authorization: `Bearer ${token}` } });
      setInvoicesList(prev => prev.filter(i => i._id !== inv._id));
      addNotification({ title: 'Invoice Deleted', message: `Invoice #${inv.invoiceNumber} was removed.`, type: 'success' });
    } catch (err) {
      addNotification({ title: 'Error', message: err.response?.data?.error || 'Failed to delete invoice', type: 'error' });
    }
  };

  const handleOpenInvoiceModal = async () => {
    setActiveInvoiceId(null);
    setInvoiceDetails(blankInvoice());
    setShowInvoiceModal(true);
    // Reserve a real, globally-unique invoice number immediately so the
    // editor never shows a "DRAFT" placeholder — it shows the number that
    // will actually be saved.
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/invoices/next-number`, { headers: { Authorization: `Bearer ${token}` } });
      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: res.data.invoiceNumber }));
    } catch (err) {
      // Non-fatal — invoiceNumber stays null and gets assigned on save
    }
  };

  const [showLinkModal, setShowLinkModal] = useState(false);

  const handleGenerateLink = () => {
    if (!invoiceDetails.payUrl) {
      addNotification({ title: 'Send First', message: 'Send this invoice to generate its secure payment link.', type: 'error' });
      return;
    }
    setShowLinkModal(true);
  };

  const handleCopyLink = () => {
    if (!invoiceDetails.payUrl) return;
    navigator.clipboard.writeText(invoiceDetails.payUrl);
    addNotification({
      title: 'Link Copied',
      message: `Invoice link (${invoiceDetails.payUrl}) ready to share.`,
      type: 'success'
    });
    setShowLinkModal(false);
  };

  return (
    <MerchantLayout title="Invoices">
      <div className="md:px-0">
        <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-outline-variant/10 p-6 md:p-8">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="font-headline text-xl text-primary tracking-tight font-bold">Invoice Tracking</h3>
                <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60 italic">Monitor the status of every invoice you've issued — this is how you know if a customer has paid.</p>
              </div>
              <div className="flex items-center gap-3 self-start md:self-auto">
                <div className="flex gap-2 p-1.5 bg-surface-container-lowest border border-outline-variant/5 rounded-xl">
                  {['All', 'Drafts', 'Sent', 'Paid'].map(f => (
                    <button
                      key={f}
                      onClick={() => { setInvoiceFilter(f); setInvoicePage(1); }}
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        invoiceFilter === f
                          ? 'bg-white text-primary shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-outline-variant/5'
                          : 'text-on-surface-variant/60 hover:text-primary'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleOpenInvoiceModal}
                  className="px-4 py-2.5 bg-[#00351D] text-white hover:bg-emerald-950 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-[0.97] shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Create Invoice
                </button>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             <div className="p-4 rounded-[20px] bg-[#f8fafc] border border-outline-variant/5 flex items-center justify-between group hover:border-amber-500/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">edit_document</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Drafts</span>
                    <p className="font-headline text-lg font-black text-primary leading-tight">{invoiceStats.draft.count}</p>
                  </div>
                </div>
             </div>
             <div className="p-4 rounded-[20px] bg-[#f8fafc] border border-outline-variant/5 flex items-center justify-between group hover:border-blue-500/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">send</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Sent • Awaiting Payment</span>
                    <p className="font-headline text-lg font-black text-primary leading-tight">{invoiceStats.sent.count}</p>
                    {invoiceStats.sent.kesTotal > 0 && (
                      <p className="text-[9px] font-bold text-blue-600 opacity-70">{formatKES(invoiceStats.sent.kesTotal)}</p>
                    )}
                  </div>
                </div>
             </div>
             <div className="p-4 rounded-[20px] bg-[#f8fafc] border border-outline-variant/5 flex items-center justify-between group hover:border-emerald-500/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Paid • Collected</span>
                    <p className="font-headline text-lg font-black text-primary leading-tight">{invoiceStats.paid.count}</p>
                    {invoiceStats.paid.kesTotal > 0 && (
                      <p className="text-[9px] font-bold text-emerald-600 opacity-70">{formatKES(invoiceStats.paid.kesTotal)}</p>
                    )}
                  </div>
                </div>
             </div>
           </div>

           {/* Recent Invoices List */}
           <div className="mt-8">
             <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant opacity-50 mb-4">Invoice History</h4>
             <div className="flex flex-col gap-3">
               {filteredInvoicesList.length === 0 ? (
                 <div className="p-8 rounded-[20px] bg-surface-container-lowest border border-outline-variant/10 text-center flex flex-col items-center">
                   <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">receipt_long</span>
                   <p className="text-sm font-bold text-primary mb-1">No recent invoices</p>
                   <p className="text-xs text-on-surface-variant opacity-70">Generate your first professional e-invoice to start getting paid.</p>
                 </div>
               ) : paginatedInvoicesList.map(inv => {
                 const statusMeta = {
                   draft: { label: 'Draft', icon: 'edit_document', tone: 'bg-amber-50 text-amber-600', badge: 'bg-amber-100 text-amber-800' },
                   sent:  { label: 'Sent',  icon: 'send',          tone: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-100 text-emerald-800' },
                   paid:  { label: 'Paid',  icon: 'check_circle',  tone: 'bg-blue-50 text-blue-600', badge: 'bg-blue-100 text-blue-800' },
                   void:  { label: 'Void',  icon: 'block',         tone: 'bg-slate-100 text-slate-500', badge: 'bg-slate-200 text-slate-600' },
                 }[inv.status] || { label: inv.status, icon: 'receipt_long', tone: 'bg-amber-50 text-amber-600', badge: 'bg-amber-100 text-amber-800' };
                 const isConfirmingDelete = confirmDeleteInvoiceId === inv._id;

                 return (
                 <div key={inv._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[20px] bg-surface-container-lowest border border-outline-variant/10 shadow-sm hover:border-emerald-500/20 transition-all group gap-4">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusMeta.tone}`}>
                       <span className="material-symbols-outlined text-[18px]">{statusMeta.icon}</span>
                     </div>
                     <div>
                       <p className="text-sm font-bold text-primary">{inv.customer?.name || 'Unnamed Customer'}</p>
                       <div className="flex items-center gap-2 mt-0.5">
                         <p className="text-[10px] text-on-surface-variant font-medium opacity-60">#{inv.invoiceNumber} • {new Date(inv.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                         <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${statusMeta.badge}`}>
                           {statusMeta.label}
                         </div>
                       </div>
                     </div>
                   </div>

                   {isConfirmingDelete ? (
                     <div className="flex items-center justify-between gap-2 pl-14 sm:pl-0">
                       <p className="text-[10px] text-red-600 font-bold leading-snug max-w-[180px]">
                         {inv.status === 'sent' ? "This invoice's payment link will stop working. Delete anyway?" : 'Delete this draft?'}
                       </p>
                       <div className="flex items-center gap-2 shrink-0">
                         <button
                           onClick={() => setConfirmDeleteInvoiceId(null)}
                           className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-low transition-colors"
                         >
                           Cancel
                         </button>
                         <button
                           onClick={() => handleDeleteInvoice(inv)}
                           className="px-3 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                         >
                           Delete
                         </button>
                       </div>
                     </div>
                   ) : (
                   <div className="flex items-center justify-between sm:gap-3 pl-14 sm:pl-0">
                     <div className="text-left sm:text-right">
                       <p className="text-xs font-bold text-primary">{inv.currency} {inv.total.toLocaleString()}</p>
                       <p className="text-[9px] text-on-surface-variant font-medium opacity-50 italic uppercase tracking-widest">Total value</p>
                     </div>
                     {inv.status !== 'paid' && (
                       <button
                         onClick={() => setConfirmDeleteInvoiceId(inv._id)}
                         className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors shadow-sm active:scale-90"
                       >
                         <span className="material-symbols-outlined text-[18px] sm:text-sm">delete</span>
                       </button>
                     )}
                     <button
                       onClick={() => {
                          setActiveInvoiceId(inv._id);
                          setInvoiceDetails({
                            customer: { kraPin: '', ...inv.customer },
                            invoiceNumber: inv.invoiceNumber,
                            issueDate: inv.issueDate ? inv.issueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
                            dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
                            currency: inv.currency,
                            notes: inv.notes,
                            recurring: inv.recurring,
                            items: inv.items?.length ? inv.items.map(i => ({ taxTyCd: 'B', itemClsCd: '', discountRate: 0, ...i })) : [{ description: '', qty: 1, price: 0, discountRate: 0, taxTyCd: 'B', itemClsCd: '' }],
                            payUrl: inv.payUrl,
                            status: inv.status,
                            qrCodeDataUri: inv.qrCodeDataUri,
                            etims: inv.etims,
                          });
                          setShowInvoiceModal(true);
                       }}
                       disabled={inv.status === 'paid'}
                       className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors shadow-sm active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                     >
                       <span className="material-symbols-outlined text-[18px] sm:text-sm">{inv.status === 'paid' ? 'visibility' : 'edit'}</span>
                     </button>
                   </div>
                   )}
                 </div>
                 )})}
             </div>

             {filteredInvoicesList.length > invoicesPerPage && (
               <div className="mt-6 flex items-center justify-between">
                 <p className="text-[10px] font-bold text-on-surface-variant opacity-60">
                   Showing {paginatedInvoicesList.length} of {filteredInvoicesList.length}
                 </p>
                 <div className="flex items-center gap-2">
                   <button
                     onClick={() => setInvoicePage(prev => Math.max(1, prev - 1))}
                     disabled={invoicePage === 1}
                     className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all"
                   >
                     <span className="material-symbols-outlined text-lg">chevron_left</span>
                   </button>
                   <span className="text-[10px] font-bold text-primary px-1">{invoicePage} / {totalInvoicePages}</span>
                   <button
                     onClick={() => setInvoicePage(prev => Math.min(totalInvoicePages, prev + 1))}
                     disabled={invoicePage >= totalInvoicePages}
                     className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all"
                   >
                     <span className="material-symbols-outlined text-lg">chevron_right</span>
                   </button>
                 </div>
               </div>
             )}
           </div>

        </div>
      </div>

      {/* Invoice Modal Overlay */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full h-full max-h-full rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20 flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-4 md:px-8 md:py-6 border-b border-outline-variant/10 flex items-center justify-between bg-white shrink-0">
              <div>
                <h2 className="font-headline text-xl md:text-2xl text-primary tracking-tight font-bold">Create Invoice</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">Cancel</button>
                <button onClick={handleSaveDraft} disabled={isSavingInvoice || isSendingInvoice} className="px-4 py-2 text-xs font-bold text-primary border border-outline-variant/20 rounded-xl hover:bg-surface-container-low transition-all disabled:opacity-50">
                  {isSavingInvoice ? 'Saving...' : 'Save Draft'}
                </button>
                <button onClick={handleSendInvoice} disabled={isSavingInvoice || isSendingInvoice} className="px-5 py-2 text-xs font-bold text-white bg-[#00351D] rounded-xl hover:bg-emerald-950 transition-all disabled:opacity-50 flex items-center gap-2">
                  {isSendingInvoice ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      Send Invoice
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Dual Pane Layout */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

              {/* Left Pane: Editor */}
              <div className="w-full lg:w-1/2 overflow-y-auto p-5 md:p-10 border-r border-outline-variant/10 bg-white custom-scroll">

                {/* Meta Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div className="space-y-2">
                     <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Customer Name</label>
                     <input
                       type="text"
                       value={invoiceDetails.customer.name}
                       onChange={e => setInvoiceDetails({...invoiceDetails, customer: { ...invoiceDetails.customer, name: e.target.value }})}
                       className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Customer Email</label>
                     <input
                       type="email"
                       value={invoiceDetails.customer.email}
                       onChange={e => setInvoiceDetails({...invoiceDetails, customer: { ...invoiceDetails.customer, email: e.target.value }})}
                       placeholder="billing@customer.com"
                       className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Customer Phone</label>
                     <ValidatedInput
                       kind="phoneKE"
                       optional
                       value={invoiceDetails.customer.phone}
                       onChange={e => setInvoiceDetails({...invoiceDetails, customer: { ...invoiceDetails.customer, phone: e.target.value }})}
                       placeholder="0712 345 678"
                       className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Customer Address</label>
                     <input
                       type="text"
                       value={invoiceDetails.customer.address}
                       onChange={e => setInvoiceDetails({...invoiceDetails, customer: { ...invoiceDetails.customer, address: e.target.value }})}
                       placeholder="Nairobi, Kenya"
                       className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50"
                     />
                  </div>

                  {etimsEnabled && (
                    <div className="space-y-2">
                       <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Buyer KRA PIN *</label>
                       <input
                         type="text"
                         required
                         value={invoiceDetails.customer.kraPin || ''}
                         onChange={e => setInvoiceDetails({...invoiceDetails, customer: { ...invoiceDetails.customer, kraPin: e.target.value.toUpperCase() }})}
                         placeholder="P051892647A"
                         className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 uppercase"
                       />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60 pr-1 flex items-center gap-1">
                      Invoice Number
                    </label>
                    <div className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-not-allowed">
                       <span className="text-sm font-bold text-primary/70">{invoiceDetails.invoiceNumber || 'Assigned on save'}</span>
                       <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40">lock</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Currency</label>
                    <div className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-not-allowed">
                       <span className="text-sm font-bold text-primary/70">KES</span>
                       <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40">lock</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Issue Date</label>
                    <input type="date" value={invoiceDetails.issueDate} onChange={e => setInvoiceDetails({...invoiceDetails, issueDate: e.target.value})} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Due Date</label>
                    <input type="date" value={invoiceDetails.dueDate} onChange={e => setInvoiceDetails({...invoiceDetails, dueDate: e.target.value})} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50" />
                  </div>
                </div>

                {/* Items Array */}
                <div className="mb-10">
                  <h4 className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60 mb-4">Items</h4>

                  <div className="hidden md:grid grid-cols-[1fr_70px_90px_70px_90px_40px] gap-4 mb-2 px-2">
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Description</span>
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest text-center">Qty</span>
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest text-right">Price</span>
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest text-right">Disc %</span>
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest text-right">Amount</span>
                    <span></span>
                  </div>

                  <div className="space-y-4 mb-5">
                    {invoiceDetails.items.map((item, index) => (
                      <div key={index} className="bg-surface-container-lowest border md:border-0 border-outline-variant/10 p-4 md:p-0 rounded-[24px] md:bg-transparent shadow-sm md:shadow-none">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_70px_90px_70px_90px_40px] gap-3 md:gap-4 items-center">
                        <input type="text" value={item.description} onChange={e => handleUpdateInvoiceItem(index, 'description', e.target.value)} placeholder="Item description" className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-medium text-primary focus:ring-0 focus:border-emerald-500/50" />
                        <div className="flex items-center gap-2">
                          <span className="md:hidden text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Qty</span>
                          <input type="number" value={item.qty} onChange={e => handleUpdateInvoiceItem(index, 'qty', parseInt(e.target.value) || 0)} className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-medium text-center text-primary focus:ring-0 focus:border-emerald-500/50" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="md:hidden text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Price</span>
                          <input type="number" value={item.price} onChange={e => handleUpdateInvoiceItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-medium text-right text-primary focus:ring-0 focus:border-emerald-500/50" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="md:hidden text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Disc %</span>
                          <input type="number" min="0" max="100" value={item.discountRate || 0} onChange={e => handleUpdateInvoiceItem(index, 'discountRate', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-medium text-right text-primary focus:ring-0 focus:border-emerald-500/50" />
                        </div>
                        <div className="text-right text-xs font-bold text-primary flex justify-between items-center md:items-end md:block">
                          <span className="md:hidden text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Total</span>
                          {lineNet(item).toLocaleString()}
                        </div>
                       <button onClick={() => handleRemoveInvoiceItem(index)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors">
                         <span className="material-symbols-outlined text-sm">delete</span>
                       </button>
                      </div>
                      {etimsEnabled && (
                        <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-outline-variant/15">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest shrink-0">Tax</span>
                            <select
                              value={item.taxTyCd || 'B'}
                              onChange={e => handleUpdateInvoiceItem(index, 'taxTyCd', e.target.value)}
                              className="w-full bg-white border border-outline-variant/20 rounded-xl px-2 py-2 text-[11px] font-medium text-primary focus:ring-0 focus:border-emerald-500/50"
                            >
                              {TAX_TYPE_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest shrink-0">KRA Code</span>
                            <input
                              type="text"
                              value={item.itemClsCd || ''}
                              onChange={e => handleUpdateInvoiceItem(index, 'itemClsCd', e.target.value)}
                              placeholder="e.g. 8399120000"
                              className="w-full bg-white border border-outline-variant/20 rounded-xl px-2 py-2 text-[11px] font-medium text-primary focus:ring-0 focus:border-emerald-500/50"
                            />
                          </div>
                        </div>
                      )}
                      </div>
                    ))}
                  </div>
                  {etimsEnabled && (
                    <p className="text-[10.5px] text-on-surface-variant opacity-60 -mt-3 mb-4">
                      KRA eTIMS is enabled on this account — every item needs a classification code before this invoice can be sent.
                    </p>
                  )}

                  <button onClick={handleAddInvoiceItem} className="w-full py-3 border-2 border-dashed border-outline-variant/20 rounded-2xl text-xs font-bold text-primary hover:border-emerald-500/30 hover:bg-emerald-50 transition-all">+ Add Item</button>

                </div>

                {/* Totals */}
                <div className="flex flex-col items-end gap-3 mb-10 border-t border-outline-variant/10 pt-6">
                   <div className="flex items-center justify-between w-full max-w-xs">
                      <span className="text-xs font-bold text-on-surface-variant opacity-60">Subtotal</span>
                      <span className="text-sm font-bold text-primary">{invoiceDetails.currency} {invoiceSubtotal.toLocaleString()}</span>
                   </div>
                   {invoiceDiscountTotal > 0 && (
                     <div className="flex items-center justify-between w-full max-w-xs">
                        <span className="text-xs font-bold text-on-surface-variant opacity-60">Discount</span>
                        <span className="text-sm font-bold text-primary">-{invoiceDetails.currency} {invoiceDiscountTotal.toLocaleString()}</span>
                     </div>
                   )}
                   <div className="flex items-center justify-between w-full max-w-xs">
                      <span className="text-xs text-on-surface-variant font-black uppercase tracking-widest">Total</span>
                      <span className="font-headline text-2xl font-bold text-primary">{invoiceDetails.currency} {invoiceTotal.toLocaleString()}</span>
                   </div>
                </div>

                {/* Settings */}
                <div className="space-y-4 pb-10">
                  <h4 className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">Settings</h4>
                  <div className="space-y-2">
                     <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Notes / Terms</label>
                     <textarea value={invoiceDetails.notes} onChange={e => setInvoiceDetails({...invoiceDetails, notes: e.target.value})} className="w-full h-24 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-5 py-3 text-xs font-medium text-primary focus:ring-0 focus:border-emerald-500/50 resize-none" placeholder="Payment terms, thank you note..."></textarea>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${invoiceDetails.recurring ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-outline-variant/30 text-transparent group-hover:border-emerald-500'}`}>
                      <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                    </div>
                    <input type="checkbox" className="hidden" checked={invoiceDetails.recurring} onChange={e => setInvoiceDetails({...invoiceDetails, recurring: e.target.checked})} />
                    <span className="text-xs font-bold text-primary">Recurring Invoice</span>
                  </label>
                </div>

              </div>

              {/* Right Pane: Live Preview */}
              <div className="w-full lg:w-1/2 bg-surface-container-lowest flex flex-col h-full bg-[#f8fafc]">
                {/* Preview Actions */}
                <div className="p-4 flex items-center justify-end gap-3 shrink-0">
                  <button onClick={downloadInvoicePDF} className="px-4 py-2 bg-white border border-outline-variant/10 rounded-xl text-xs font-bold text-primary hover:bg-emerald-50 transition-colors flex items-center gap-2">
                     <span className="material-symbols-outlined text-sm">picture_as_pdf</span> PDF
                  </button>
                  <button onClick={handleGenerateLink} className="px-4 py-2 bg-white border border-outline-variant/10 rounded-xl text-xs font-bold text-primary hover:bg-emerald-50 transition-colors flex items-center gap-2">
                     <span className="material-symbols-outlined text-sm">link</span> Link
                  </button>
                </div>

                {/* Document Container */}
                <div className="flex-1 overflow-y-auto px-4 pb-12 pt-2 flex justify-center custom-scroll">
                   {/* The Target PDF Area */}
                   <div id="invoice-pdf-pane" className="w-[640px] md:w-[700px] min-h-[900px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex flex-col relative scale-[0.48] xs:scale-[0.55] sm:scale-[0.8] md:scale-[0.9] lg:scale-100 origin-top shadow-2xl transition-transform duration-500 overflow-hidden">

                      {/* Header Band */}
                      <div className="bg-[#06201B] px-8 md:px-14 py-8 md:py-10 flex items-start justify-between relative overflow-hidden shrink-0">
                         <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>
                         <div className="relative z-10 min-w-0 max-w-[340px]">
                            <img src={paychainLogoWhite} alt="PayChain" className="h-7 mb-5 object-contain" />
                            <h2 className="font-headline text-lg font-bold text-white truncate">{merchant?.businessName || 'PayChain'}</h2>
                            <p className="text-xs text-white/50 mt-1.5 truncate">{merchant?.email}</p>
                            {displayPhoneKE(merchant?.phone) && (
                              <p className="text-xs text-white/50 truncate">{displayPhoneKE(merchant?.phone)}</p>
                            )}
                         </div>
                         <div className="relative z-10 text-right shrink-0">
                            <p className="text-[10px] text-[#5EFEB3] font-black uppercase tracking-[0.3em] mb-2">Invoice</p>
                            <p className="font-headline text-2xl font-black text-white">#{invoiceDetails.invoiceNumber || '···'}</p>
                            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              invoiceDetails.status === 'paid' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/60'
                            }`}>
                              {invoiceDetails.status === 'paid' ? 'Paid' : 'Draft'}
                            </span>
                         </div>
                      </div>

                      <div className="p-8 md:p-14 pt-10 md:pt-12 flex flex-col flex-1">

                      {/* Addresses & Dates */}
                      <div className="flex justify-between items-start mb-12 gap-8">
                         <div className="max-w-[300px] min-w-0">
                            <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-2">Bill To</p>
                            <h3 className="font-bold text-primary text-base mb-1 truncate">{invoiceDetails.customer.name || 'Unnamed Customer'}</h3>
                            {invoiceDetails.customer.email && (
                              <p className="text-xs text-on-surface-variant truncate">{invoiceDetails.customer.email}</p>
                            )}
                            {displayPhoneKE(invoiceDetails.customer.phone) && (
                              <p className="text-xs text-on-surface-variant truncate">{displayPhoneKE(invoiceDetails.customer.phone)}</p>
                            )}
                            {invoiceDetails.customer.address && (
                              <p className="text-xs text-on-surface-variant truncate">{invoiceDetails.customer.address}</p>
                            )}
                            {!invoiceDetails.customer.email && !invoiceDetails.customer.phone && !invoiceDetails.customer.address && (
                              <p className="text-xs text-on-surface-variant/40 italic">No contact details on file</p>
                            )}
                         </div>
                         <div className="text-right flex flex-col gap-4 shrink-0">
                            <div>
                               <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-1">Issue Date</p>
                               <p className="font-bold text-sm text-primary whitespace-nowrap">{fmtInvoiceDate(invoiceDetails.issueDate) || '—'}</p>
                            </div>
                            {invoiceDetails.dueDate && (
                              <div>
                                <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-1">Due Date</p>
                                <p className="font-bold text-sm text-primary whitespace-nowrap">{fmtInvoiceDate(invoiceDetails.dueDate)}</p>
                              </div>
                            )}
                         </div>
                      </div>

                      {/* Table */}
                      <div className="mb-12 flex-1">
                         <div className="grid grid-cols-[1fr_80px_100px_100px] gap-4 bg-[#06201B] rounded-t-2xl px-5 py-3.5">
                            <span className="text-[10px] text-white font-black uppercase tracking-widest">Description</span>
                            <span className="text-[10px] text-white font-black uppercase tracking-widest text-center">Qty</span>
                            <span className="text-[10px] text-white font-black uppercase tracking-widest text-right">Price</span>
                            <span className="text-[10px] text-white font-black uppercase tracking-widest text-right">Amount</span>
                         </div>

                         {invoiceHasRealItems ? (
                           <div className="border border-t-0 border-outline-variant/10 rounded-b-2xl overflow-hidden">
                             {invoiceDetails.items.filter(item => item.description.trim() || item.price > 0).map((item, index) => (
                               <div key={index} className={`grid grid-cols-[1fr_80px_100px_100px] gap-4 items-center px-5 py-4 ${index % 2 === 1 ? 'bg-surface-container-lowest/50' : ''}`}>
                                  <div className="min-w-0">
                                    <span className="text-sm font-bold text-primary truncate block">{item.description || 'Untitled item'}</span>
                                    {item.discountRate > 0 && (
                                      <span className="text-[11px] text-emerald-700/70 font-medium">Discount {item.discountRate}% (-{fmtInvoiceCurrency(lineDiscount(item))})</span>
                                    )}
                                  </div>
                                  <span className="text-sm text-on-surface-variant text-center">{item.qty}</span>
                                  <span className="text-sm text-on-surface-variant text-right whitespace-nowrap">{fmtInvoiceCurrency(item.price)}</span>
                                  <span className="text-sm font-bold text-primary text-right whitespace-nowrap">{fmtInvoiceCurrency(lineNet(item))}</span>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <div className="border border-t-0 border-outline-variant/10 rounded-b-2xl px-5 py-10 text-center">
                             <p className="text-xs text-on-surface-variant/40 italic">No line items added yet</p>
                           </div>
                         )}
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end mb-12">
                         <div className="w-full max-w-[260px] flex flex-col gap-2">
                            <div className="flex justify-between items-center px-1">
                               <p className="text-xs font-bold text-on-surface-variant opacity-60">Subtotal</p>
                               <p className="text-sm font-bold text-primary">{fmtInvoiceCurrency(invoiceSubtotal)}</p>
                            </div>
                            {invoiceDiscountTotal > 0 && (
                              <div className="flex justify-between items-center px-1">
                                 <p className="text-xs font-bold text-on-surface-variant opacity-60">Discount</p>
                                 <p className="text-sm font-bold text-primary">-{fmtInvoiceCurrency(invoiceDiscountTotal)}</p>
                              </div>
                            )}
                            <div className="flex justify-between items-center mt-1 px-5 py-4 rounded-2xl bg-[#06201B]">
                               <p className="text-[10px] text-[#5EFEB3] font-black uppercase tracking-widest">Total</p>
                               <p className="font-headline text-xl font-black text-white">{fmtInvoiceCurrency(invoiceTotal)}</p>
                            </div>
                         </div>
                      </div>

                      {/* KRA eTIMS fiscal marks — only present once this invoice has actually been signed by KRA */}
                      {invoiceDetails.etims?.status === 'signed' && (
                        <div className="mb-10 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center gap-4">
                          {invoiceDetails.etims.qrDataUri && (
                            <img src={invoiceDetails.etims.qrDataUri} alt="KRA eTIMS verification QR" className="w-20 h-20 object-contain shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[9px] text-emerald-700 font-black uppercase tracking-widest mb-1">KRA e-Invoice — Signed</p>
                            <p className="text-xs font-bold text-emerald-900 break-all">{invoiceDetails.etims.cuInvoiceNumber}</p>
                            <p className="text-[10px] text-emerald-800/70 break-all mt-1">{invoiceDetails.etims.formattedSignature}</p>
                          </div>
                        </div>
                      )}

                      {/* Footer Notes */}
                      {invoiceDetails.notes && (
                         <div className="mb-10 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
                           <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-60 mb-2">Notes / Terms</p>
                           <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{invoiceDetails.notes}</p>
                         </div>
                      )}

                      <div className="mt-auto pt-6 border-t border-outline-variant/10 flex flex-col items-center gap-3">
                         {invoiceDetails.qrCodeDataUri && (
                           <div className="flex flex-col items-center gap-1.5">
                             <img src={invoiceDetails.qrCodeDataUri} alt="Scan to view/pay this invoice" className="w-20 h-20 object-contain" />
                             <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40">Scan to view &amp; pay</p>
                           </div>
                         )}
                         <img src={paychainMark} alt="" className="h-4 w-auto object-contain opacity-40" />
                         <p className="text-[9px] text-center text-on-surface-variant font-bold uppercase tracking-widest opacity-50">Powered by PayChain Finance • Nairobi, Kenya</p>
                      </div>
                      </div>
                   </div>


                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Invoice Link Sharing Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-headline text-xl text-primary tracking-tight font-bold">Invoice Link</h2>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <p className="text-xs text-on-surface-variant font-medium mb-6 leading-relaxed">
                Share this link with your customer to allow them to view and pay this invoice online, or let them scan the QR code below.
              </p>

              {invoiceDetails.qrCodeDataUri && (
                <div className="flex justify-center mb-6">
                  <div className="p-3 bg-white border border-outline-variant/20 rounded-2xl shadow-sm">
                    <img src={invoiceDetails.qrCodeDataUri} alt="Scan to view/pay this invoice" className="w-36 h-36 object-contain" />
                  </div>
                </div>
              )}

              <div className="bg-surface-container-lowest/50 border border-outline-variant/20 rounded-2xl p-4 flex items-center justify-between gap-3 mb-6">
                 <p className="text-sm font-bold text-primary truncate flex-1">
                   {invoiceDetails.payUrl}
                 </p>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full py-3.5 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-all"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantLayout>
  )
}
