import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';
import { formatAccountNumber } from '../utils/formatAccountNumber';

// ─── Types ────────────────────────────────────────────────────────────────────
type PayeeType = 'employee' | 'supplier' | 'utility' | 'contractor';
type PaymentMethod = 'Mobile Money' | 'Bank';
type MobileMoneyType = 'Personal Number' | 'Paybill' | 'Buy Goods';

interface Payee {
  _id: string;
  name: string;
  type: PayeeType;
  paymentMethod?: PaymentMethod;
  mobileMoneyType?: MobileMoneyType;
  phone?: string;
  paybillNumber?: string;
  businessAccount?: string;
  tillNumber?: string;
  bankName?: string;
  accountNumber?: string;
  kraPin?: string;
  idNumber?: string;
  nssfNumber?: string;
  shifNumber?: string;
  etimsInvoiceNumber?: string;
  cuNumber?: string;
  defaultAmount?: number;
}

interface Receipt {
  id: string;
  name: string;
  amount: number;
  method?: string;
  phone?: string;
  reference: string;
  timestamp: string;
  status?: string;
}

interface BatchHistory {
  _id: string;
  batchReference: string;
  totalGrossAmount: number;
  totalNetAmount: number;
  totalTaxDeductions: number;
  payeeCount: number;
  status: string;
  fundingSource: string;
  transactions: any[];
  createdAt: string;
}

interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
}

interface Invoice {
  _id?: string;
  customer: { name: string; email: string; phone: string; address: string };
  invoiceNumber: number | string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string;
  recurring: boolean;
  items: InvoiceItem[];
  payUrl?: string | null;
  status: 'draft' | 'sent' | 'paid' | 'void' | string;
  total?: number;
  createdAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_META: Record<PayeeType, { bg: string; text: string; badgeBg: string; badgeText: string; icon: keyof typeof MaterialIcons.glyphMap; description: string; label: string }> = {
  employee:   { bg: '#5efeb3', text: '#00351d', badgeBg: '#e7f8ef', badgeText: '#006c4e', icon: 'badge',           description: 'Payroll & Salaries',   label: 'Employee' },
  supplier:   { bg: '#e0d4f7', text: '#3730a3', badgeBg: '#eef2ff', badgeText: '#3730a3', icon: 'inventory-2',     description: 'Logistics & Stock',    label: 'Supplier' },
  utility:    { bg: '#fef3e7', text: '#b87333', badgeBg: '#fef9e7', badgeText: '#b87333', icon: 'account-balance', description: 'Rent, Power, Water',   label: 'Utility' },
  contractor: { bg: '#dbeafe', text: '#1e40af', badgeBg: '#eff6ff', badgeText: '#1e40af', icon: 'engineering',     description: 'One-off Services',     label: 'Contractor' },
};

const FILTERS = ['All', 'Employees', 'Suppliers', 'Utilities', 'Contractors'] as const;
type Filter = typeof FILTERS[number];

const FILTER_TYPE_MAP: Record<Filter, PayeeType | null> = {
  All: null,
  Employees: 'employee',
  Suppliers: 'supplier',
  Utilities: 'utility',
  Contractors: 'contractor',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  (name || '').split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || '??';

const formatKES = (amount?: number) => {
  const n = amount || 0;
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const validatePhone = (phone: string) =>
  /^(?:254|\+254|0)?(7\d{8}|1\d{8})$/.test((phone || '').replace(/\s+/g, ''));

const BATCH_STATUS_META: Record<string, { bg: string; text: string }> = {
  Processed: { bg: '#e7f8ef', text: '#006c4e' },
  Pending: { bg: '#fef3e7', text: '#b87333' },
  Partial: { bg: '#fef3e7', text: '#b87333' },
  Failed: { bg: '#fef2f2', text: '#b91c1c' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BulkPay() {
  const { merchant } = useAuth();

  const [activeTab, setActiveTab] = useState<'Payees' | 'Batches' | 'Invoices'>('Payees');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [payeesList, setPayeesList] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedPayees, setSelectedPayees] = useState<Record<string, boolean>>({});
  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, number>>({});

  // Modals
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showAddPayee, setShowAddPayee] = useState(false);
  const [showAmountEditor, setShowAmountEditor] = useState<Payee | null>(null);
  const [showAuthorize, setShowAuthorize] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [showBatchDetails, setShowBatchDetails] = useState<BatchHistory | null>(null);
  const [showFundingSourceSelect, setShowFundingSourceSelect] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  // Funding source (virtual account) — mirrors the dashboard's single
  // funding-source selector, derived from the merchant's own profile (no
  // separate multi-account backend).
  const [selectedFundingSource, setSelectedFundingSource] = useState(false);

  // Security verification (OTP-then-PIN), matches the dashboard's two-step
  // "Verification" modal. The OTP step is not backend-verified on the
  // dashboard either — the real check is the PIN, enforced server-side in
  // authorizeBatch. Kept here for exact behavioral parity.
  const [securityStep, setSecurityStep] = useState<1 | 2>(1);
  const [securityOtp, setSecurityOtp] = useState('');

  // Which batch is pending authorization — set right before opening the
  // Funding Source Select -> Security flow, consumed once the PIN is confirmed.
  const [pendingBatch, setPendingBatch] = useState<{ source: 'manual' | 'csv' } | null>(null);

  // Invoices
  const blankInvoice = (): Invoice => ({
    customer: { name: '', email: '', phone: '', address: '' },
    invoiceNumber: null,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    currency: 'KES',
    notes: '',
    recurring: false,
    items: [{ description: '', qty: 1, price: 0 }],
    payUrl: null,
    status: 'draft',
  });
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<'All' | 'Drafts' | 'Sent' | 'Paid'>('All');
  const [invoicePage, setInvoicePage] = useState(1);
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<Invoice>(blankInvoice());
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const invoicesPerPage = 5;

  // CSV upload
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvSummary, setCsvSummary] = useState<any>(null);
  const [csvUploadLoading, setCsvUploadLoading] = useState(false);

  // Batch history
  const [batchHistory, setBatchHistory] = useState<BatchHistory[]>([]);
  const [batchFilter, setBatchFilter] = useState('All');
  const [batchPage, setBatchPage] = useState(1);

  // PIN flows
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Add payee
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const blankPayee = {
    name: '',
    type: 'employee' as PayeeType,
    paymentMethod: 'Mobile Money' as PaymentMethod,
    mobileMoneyType: 'Personal Number' as MobileMoneyType,
    amount: '',
    phone: '',
    accountNumber: '',
    bankName: '',
    paybillNumber: '',
    businessAccount: '',
    tillNumber: '',
    kraPin: '',
    idNumber: '',
    nssfNumber: '',
    shifNumber: '',
    etimsInvoiceNumber: '',
    cuNumber: '',
  };
  const [newPayee, setNewPayee] = useState(blankPayee);

  // Amount editor
  const [amountInput, setAmountInput] = useState('');

  // Receipts after a batch
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lastBatchReference, setLastBatchReference] = useState<string>('');
  const [lastBatchStatus, setLastBatchStatus] = useState<string>('Processed');

  // ── Profile gate ──
  const isProfileComplete = Boolean(merchant?.kraPin && merchant?.businessNumber);

  // ── Fetch payees ──
  const fetchPayees = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await api.get('/api/bulkpay/payees');
      setPayeesList(Array.isArray(res.data) ? res.data : []);
      // Initialize per-payee amounts from defaultAmount
      const initial: Record<string, number> = {};
      (res.data || []).forEach((p: Payee) => {
        if (p.defaultAmount) initial[p._id] = p.defaultAmount;
      });
      setPayoutAmounts((prev) => ({ ...initial, ...prev }));
    } catch (err) {
      console.error('Failed to fetch payees:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (merchant) fetchPayees();
  }, [merchant, fetchPayees]);

  // ── Fetch batch history ──
  const fetchBatches = useCallback(async () => {
    try {
      const res = await api.get('/api/bulkpay/batches', {
        params: { page: 1, limit: 20 }
      });
      setBatchHistory(res.data?.batches || []);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }
  }, []);

  useEffect(() => {
    if (merchant && activeTab === 'Batches') {
      fetchBatches();
    }
  }, [merchant, activeTab, fetchBatches]);

  // ── Fetch invoices ──
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get('/api/invoices');
      setInvoicesList(res.data?.invoices || []);
    } catch (err) {
      // Non-fatal — the list just shows its empty state.
    }
  }, []);

  useEffect(() => {
    if (merchant && activeTab === 'Invoices') {
      fetchInvoices();
    }
  }, [merchant, activeTab, fetchInvoices]);

  // ── Invoice derived values ──
  const filteredInvoicesList = useMemo(
    () => invoicesList.filter(inv => invoiceFilter === 'All' || inv.status === (invoiceFilter === 'Drafts' ? 'draft' : invoiceFilter.toLowerCase())),
    [invoicesList, invoiceFilter]
  );
  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoicesList.length / invoicesPerPage));
  const paginatedInvoicesList = filteredInvoicesList.slice((invoicePage - 1) * invoicesPerPage, invoicePage * invoicesPerPage);
  const invoiceSubtotal = invoiceDetails.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const fmtInvoiceCurrency = (n: number) => `${invoiceDetails.currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    setInvoicePage(prev => Math.min(prev, totalInvoicePages));
  }, [totalInvoicePages]);

  // ── Invoice item editing ──
  const handleAddInvoiceItem = () => {
    setInvoiceDetails(prev => ({ ...prev, items: [...prev.items, { description: '', qty: 1, price: 0 }] }));
  };
  const handleUpdateInvoiceItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setInvoiceDetails(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };
  const handleRemoveInvoiceItem = (index: number) => {
    setInvoiceDetails(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const buildInvoicePayload = () => ({
    customer: invoiceDetails.customer,
    items: invoiceDetails.items,
    currency: invoiceDetails.currency,
    issueDate: invoiceDetails.issueDate,
    dueDate: invoiceDetails.dueDate || null,
    notes: invoiceDetails.notes,
    recurring: invoiceDetails.recurring,
    invoiceNumber: invoiceDetails.invoiceNumber || undefined,
  });

  const upsertInvoiceInList = (saved: Invoice) => {
    setInvoicesList(prev => {
      const exists = prev.some(inv => inv._id === saved._id);
      return exists ? prev.map(inv => (inv._id === saved._id ? saved : inv)) : [saved, ...prev];
    });
  };

  const handleOpenInvoiceEditor = async () => {
    setActiveInvoiceId(null);
    setInvoiceDetails(blankInvoice());
    setShowInvoiceEditor(true);
    try {
      const res = await api.get('/api/invoices/next-number');
      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: res.data?.invoiceNumber }));
    } catch (err) {
      // Non-fatal — invoiceNumber stays null and gets assigned on save.
    }
  };

  const openInvoiceForEdit = (inv: Invoice) => {
    setActiveInvoiceId(inv._id || null);
    setInvoiceDetails({
      customer: inv.customer,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate ? inv.issueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
      currency: inv.currency,
      notes: inv.notes,
      recurring: inv.recurring,
      items: inv.items?.length ? inv.items : [{ description: '', qty: 1, price: 0 }],
      payUrl: inv.payUrl,
      status: inv.status,
    });
    setShowInvoiceEditor(true);
  };

  const handleSaveDraft = async () => {
    if (!invoiceDetails.customer.name.trim()) {
      Alert.alert('Missing Customer', 'Enter a customer name first.');
      return;
    }
    setIsSavingInvoice(true);
    try {
      const payload = buildInvoicePayload();
      const res = activeInvoiceId
        ? await api.put(`/api/invoices/${activeInvoiceId}`, payload)
        : await api.post('/api/invoices', payload);
      const saved = res.data.invoice;
      setActiveInvoiceId(saved._id);
      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: saved.invoiceNumber, payUrl: saved.payUrl, status: saved.status }));
      upsertInvoiceInList(saved);
      setShowInvoiceEditor(false);
      Alert.alert('Draft Saved', `Invoice #${saved.invoiceNumber} safely stored in Invoices → Drafts.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save invoice draft');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoiceDetails.customer.name.trim()) {
      Alert.alert('Missing Customer', 'Enter a customer name first.');
      return;
    }
    if (!invoiceDetails.customer.email?.trim()) {
      Alert.alert('Missing Email', "Add the customer's email address to send this invoice.");
      return;
    }
    setIsSendingInvoice(true);
    try {
      const payload = buildInvoicePayload();
      let invoiceId = activeInvoiceId;
      if (!invoiceId) {
        const createRes = await api.post('/api/invoices', payload);
        invoiceId = createRes.data.invoice._id;
        setActiveInvoiceId(invoiceId);
      } else {
        await api.put(`/api/invoices/${invoiceId}`, payload);
      }
      const sendRes = await api.post(`/api/invoices/${invoiceId}/send`, {});
      const sent = sendRes.data.invoice;
      setInvoiceDetails(prev => ({ ...prev, invoiceNumber: sent.invoiceNumber, payUrl: sent.payUrl, status: sent.status }));
      upsertInvoiceInList(sent);
      setShowInvoiceEditor(false);
      Alert.alert('Invoice Sent', `Invoice #${sent.invoiceNumber} has been emailed to ${invoiceDetails.customer.email}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to send invoice');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    setConfirmDeleteInvoiceId(null);
    try {
      await api.delete(`/api/invoices/${inv._id}`);
      setInvoicesList(prev => prev.filter(i => i._id !== inv._id));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to delete invoice');
    }
  };

  const handleGenerateLink = () => {
    if (!invoiceDetails.payUrl) {
      Alert.alert('Send First', 'Send this invoice to generate its secure payment link.');
      return;
    }
    setShowLinkModal(true);
  };

  const handleCopyLink = async () => {
    if (!invoiceDetails.payUrl) return;
    await Clipboard.setStringAsync(invoiceDetails.payUrl);
    setShowLinkModal(false);
    Alert.alert('Link Copied', `Invoice link ready to share.`);
  };

  const downloadInvoicePDF = async () => {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const businessName = esc(merchant?.businessName || 'Merchant');
    const itemRows = invoiceDetails.items.map(item => `
      <tr>
        <td>${esc(item.description || '—')}</td>
        <td class="num">${item.qty}</td>
        <td class="amount">${fmtInvoiceCurrency(item.price)}</td>
        <td class="amount">${fmtInvoiceCurrency(item.qty * item.price)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice</title><style>
      @page { size: A4; margin: 24mm 16mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#0c2010; margin:0; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0b4d2e; padding-bottom:16px; margin-bottom:22px; }
      .brand-name { font-size:18px; font-weight:700; color:#0b4d2e; }
      .brand-sub { font-size:10px; color:#707971; text-transform:uppercase; letter-spacing:1.5px; margin-top:2px; }
      .doc-title { text-align:right; }
      .doc-title h1 { margin:0; font-size:20px; color:#0c2010; font-weight:600; }
      .doc-title .meta { font-size:10px; color:#707971; margin-top:4px; }
      .meta-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; margin-bottom:24px; }
      .meta-grid .label { font-size:9px; color:#707971; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:4px; }
      .meta-grid .value { font-size:12px; color:#0c2010; font-weight:600; }
      table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom: 24px; }
      thead th { text-align:left; padding:10px 8px; background:#f7faf7; color:#404942; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #e7ece7; }
      thead th.num, thead th.amount { text-align:right; }
      tbody td { padding:10px 8px; border-bottom:1px solid #eff4ef; }
      tbody td.num, tbody td.amount { text-align:right; }
      .totals { display:flex; justify-content:flex-end; }
      .totals .row { display:flex; justify-content:space-between; width:220px; padding:6px 0; font-size:12px; }
      .totals .row.total { font-weight:700; font-size:16px; border-top:1px solid #e7ece7; margin-top:4px; padding-top:10px; }
      .notes { margin-top: 24px; font-size: 10px; color: #707971; white-space: pre-wrap; }
    </style></head><body>
      <div class="header">
        <div><div class="brand-name">${businessName}</div><div class="brand-sub">PayChain · Invoice</div></div>
        <div class="doc-title">
          <h1>Invoice ${invoiceDetails.invoiceNumber ? `#${invoiceDetails.invoiceNumber}` : ''}</h1>
          <div class="meta">Issued ${invoiceDetails.issueDate}</div>
          ${invoiceDetails.dueDate ? `<div class="meta">Due ${invoiceDetails.dueDate}</div>` : ''}
        </div>
      </div>
      <div class="meta-grid">
        <div><div class="label">Bill To</div><div class="value">${esc(invoiceDetails.customer.name || '—')}</div><div class="value">${esc(invoiceDetails.customer.email || '')}</div><div class="value">${esc(invoiceDetails.customer.address || '')}</div></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="amount">Price</th><th class="amount">Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="totals">
        <div class="row total"><span>Total</span><span>${fmtInvoiceCurrency(invoiceSubtotal)}</span></div>
      </div>
      ${invoiceDetails.notes ? `<div class="notes">${esc(invoiceDetails.notes)}</div>` : ''}
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Invoice', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (err: any) {
      Alert.alert('PDF failed', err?.message || 'Could not generate PDF.');
    }
  };

  // ── Upload CSV ──
  const handleCsvUpload = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain'],
      });

      if (doc.canceled || !doc.assets?.[0]) return;

      setCsvUploadLoading(true);
      setAuthPin('');
      const file = doc.assets[0];

      // Send to backend for preview — the server computes real PAYE/NSSF/SHIF
      // tax withholding for employee rows. There is no safe client-side
      // fallback: parsing the CSV locally would submit gross-as-net (zero
      // withholding) for real payouts, so on failure we just surface the
      // error and let the merchant retry instead of guessing locally.
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: 'text/csv',
        name: file.name,
      } as any);

      const previewRes = await api.post('/api/bulkpay/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvPreview(previewRes.data?.rows || []);
      setCsvSummary(previewRes.data?.summary || {});
      setShowCsvUpload(true);
    } catch (err: any) {
      Alert.alert('CSV Upload Failed', err?.response?.data?.message || err?.message || 'Could not process CSV. Please try again.');
    } finally {
      setCsvUploadLoading(false);
    }
  };

  // ── Trigger PIN setup if needed ──
  useEffect(() => {
    if (merchant && merchant.hasBulkPayPin === false) {
      setShowPinSetup(true);
    }
  }, [merchant]);

  // ── Derived ──
  const filteredPayees = useMemo(() => {
    const t = FILTER_TYPE_MAP[activeFilter];
    return t === null ? payeesList : payeesList.filter(p => p.type === t);
  }, [payeesList, activeFilter]);

  const selectedIds = useMemo(
    () => Object.keys(selectedPayees).filter(id => selectedPayees[id]),
    [selectedPayees]
  );

  const batchTotal = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (payoutAmounts[id] || 0), 0),
    [selectedIds, payoutAmounts]
  );

  const balance = merchant?.kesBalance ?? 0;
  const isLiquidityLow = batchTotal > balance && batchTotal > 0;

  // ── Selection ──
  const togglePayee = (id: string) => {
    setSelectedPayees(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Add / Edit payee ──
  const openAddPayee = () => {
    setNewPayee(blankPayee);
    setEditingId(null);
    setAddStep(1);
    setShowAddPayee(true);
  };

  const openEditPayee = (p: Payee) => {
    setNewPayee({
      name: p.name || '',
      type: p.type || 'employee',
      paymentMethod: (p.paymentMethod as PaymentMethod) || 'Mobile Money',
      mobileMoneyType: (p.mobileMoneyType as MobileMoneyType) || 'Personal Number',
      amount: p.defaultAmount ? String(p.defaultAmount) : '',
      phone: p.phone || '',
      accountNumber: p.accountNumber || '',
      bankName: p.bankName || '',
      paybillNumber: p.paybillNumber || '',
      businessAccount: p.businessAccount || '',
      tillNumber: p.tillNumber || '',
      kraPin: p.kraPin || '',
      idNumber: p.idNumber || '',
      nssfNumber: p.nssfNumber || '',
      shifNumber: p.shifNumber || '',
      etimsInvoiceNumber: p.etimsInvoiceNumber || '',
      cuNumber: p.cuNumber || '',
    });
    setEditingId(p._id);
    setAddStep(2);
    setShowAddPayee(true);
  };

  const validateNewPayee = (): string | null => {
    if (!newPayee.name.trim()) return 'Recipient name is required.';
    if (newPayee.type === 'employee' && (!newPayee.kraPin || !newPayee.idNumber)) {
      return 'KRA PIN and ID Number are required for employees.';
    }
    if (newPayee.type === 'supplier' && (!newPayee.kraPin || !newPayee.etimsInvoiceNumber || !newPayee.cuNumber)) {
      return 'KRA PIN, eTIMS Invoice, and CU Number are required for suppliers.';
    }
    if (newPayee.paymentMethod === 'Mobile Money') {
      if (newPayee.mobileMoneyType === 'Personal Number' && !validatePhone(newPayee.phone)) {
        return 'Enter a valid Kenyan phone number (07XX or 01XX).';
      }
      if (newPayee.mobileMoneyType === 'Paybill') {
        if (!/^\d{5,7}$/.test(newPayee.paybillNumber.trim())) return 'Paybill number must be 5–7 digits.';
        if (!newPayee.businessAccount.trim()) return 'Account number is required.';
      }
      if (newPayee.mobileMoneyType === 'Buy Goods' && !/^\d{6,8}$/.test(newPayee.tillNumber.trim())) {
        return 'Till number must be 6–8 digits.';
      }
    }
    if (newPayee.paymentMethod === 'Bank') {
      if (!newPayee.bankName.trim()) return 'Bank name is required.';
      if (!/^\d{8,14}$/.test(newPayee.accountNumber.trim())) return 'Bank account number must be 8–14 digits.';
    }
    return null;
  };

  const handleSavePayee = async () => {
    const err = validateNewPayee();
    if (err) {
      Alert.alert('Missing details', err);
      return;
    }
    const numericAmount = parseFloat(newPayee.amount.replace(/,/g, '')) || 0;
    const payload = { ...newPayee, defaultAmount: numericAmount };
    try {
      if (editingId) {
        const res = await api.put(`/api/bulkpay/payees/${editingId}`, payload);
        setPayeesList(prev => prev.map(p => p._id === editingId ? res.data : p));
        if (numericAmount > 0) {
          setPayoutAmounts(prev => ({ ...prev, [editingId]: numericAmount }));
        }
      } else {
        const res = await api.post('/api/bulkpay/payees', payload);
        setPayeesList(prev => [res.data, ...prev]);
        if (numericAmount > 0) {
          setPayoutAmounts(prev => ({ ...prev, [res.data._id]: numericAmount }));
        }
      }
      setShowAddPayee(false);
      setEditingId(null);
      setAddStep(1);
    } catch (e: any) {
      Alert.alert('Save failed', e?.response?.data?.message || 'Could not save payee.');
    }
  };

  const handleDeletePayee = (p: Payee) => {
    Alert.alert(
      'Remove Payee',
      `Delete ${p.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/bulkpay/payees/${p._id}`);
              setPayeesList(prev => prev.filter(x => x._id !== p._id));
              setSelectedPayees(prev => {
                const c = { ...prev };
                delete c[p._id];
                return c;
              });
            } catch (e: any) {
              Alert.alert('Delete failed', e?.response?.data?.message || 'Could not delete payee.');
            }
          },
        },
      ]
    );
  };

  // ── Amount editor ──
  const openAmountEditor = (p: Payee) => {
    setAmountInput(payoutAmounts[p._id]?.toString() || (p.defaultAmount ? p.defaultAmount.toString() : ''));
    setShowAmountEditor(p);
  };

  const saveAmount = () => {
    if (!showAmountEditor) return;
    const n = parseFloat(amountInput.replace(/,/g, '')) || 0;
    setPayoutAmounts(prev => ({ ...prev, [showAmountEditor._id]: n }));
    setSelectedPayees(prev => ({ ...prev, [showAmountEditor._id]: n > 0 }));
    setShowAmountEditor(null);
  };

  // ── PIN setup ──
  const handleSetupPin = async () => {
    if (setupPin.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }
    if (setupPin !== confirmPin) {
      Alert.alert('Mismatch', 'PINs do not match.');
      return;
    }
    try {
      await api.post('/api/bulkpay/set-pin', { pin: setupPin });
      setShowPinSetup(false);
      setSetupPin('');
      setConfirmPin('');
      Alert.alert('PIN Set', 'Bulk Pay PIN configured successfully.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message || 'Could not set PIN.');
    }
  };

  // ── Authorize batch ──
  const startAuthorize = () => {
    if (selectedIds.length === 0) {
      Alert.alert('No selection', 'Select at least one payee.');
      return;
    }
    const missing = selectedIds.filter(id => !payoutAmounts[id] || payoutAmounts[id] <= 0);
    if (missing.length > 0) {
      Alert.alert('Missing amounts', 'Set a payout amount for every selected payee.');
      return;
    }
    if (isLiquidityLow) {
      Alert.alert('Low balance', `Batch total exceeds your KES balance (${formatKES(balance)}).`);
      return;
    }
    setShowAuthorize(true);
  };

  // Funding source label matches the dashboard's single funding-source card:
  // derived from the merchant's own profile, since there's no real
  // multi-account backend.
  const fundingSourceLabel = merchant?.businessName || 'Main Business Account';
  const fundingSourceNumber = formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending');

  // ── Step 3: confirm funding source, then move to Security (OTP -> PIN) ──
  const proceedToFundingSourceSelect = (source: 'manual' | 'csv') => {
    setPendingBatch({ source });
    setShowAuthorize(false);
    setShowCsvUpload(false);
    setSelectedFundingSource(false);
    setShowFundingSourceSelect(true);
  };

  const confirmFundingSourceAndVerify = () => {
    setShowFundingSourceSelect(false);
    setSecurityStep(1);
    setSecurityOtp('');
    setAuthPin('');
    setShowSecurity(true);
  };

  const cancelSecurity = () => {
    setShowSecurity(false);
    setSecurityStep(1);
    setSecurityOtp('');
    setAuthPin('');
    setPendingBatch(null);
  };

  // ── Final authorize (fires after Security PIN step, for either source) ──
  const handleAuthorize = async () => {
    if (authPin.length !== 4) {
      Alert.alert('Invalid PIN', 'Enter your 4-digit Bulk Pay PIN.');
      return;
    }
    setIsAuthorizing(true);
    try {
      const batchRows = pendingBatch?.source === 'csv'
        ? csvPreview.map((row: any) => ({
            name: row.name,
            type: row.type || 'employee',
            phone: row.phone,
            grossAmount: row.grossAmount || row.amount || 0,
            netAmount: row.netAmount || row.amount || 0,
            taxDeductions: row.taxDeductions || { paye: 0, nssf: 0, shif: 0 },
          }))
        : payeesList
            .filter(p => selectedPayees[p._id])
            .map(p => ({
              payeeMatch: p._id,
              name: p.name,
              type: p.type,
              phone: p.phone,
              grossAmount: payoutAmounts[p._id] || 0,
              netAmount: payoutAmounts[p._id] || 0,
            }));

      const res = await api.post('/api/bulkpay/authorize', {
        batchRows,
        fundingSource: fundingSourceLabel,
        pin: authPin,
      });

      const processedBatch = res.data?.batch;
      const ref = processedBatch?.batchReference || `B-${Date.now()}`;
      setLastBatchReference(ref);
      setLastBatchStatus(processedBatch?.status || 'Pending');

      const newReceipts: Receipt[] = (processedBatch?.transactions || batchRows).map((tx: any) => ({
        id: tx.receiptNumber || `R-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        name: tx.name,
        amount: tx.amount || tx.netAmount || tx.grossAmount || 0,
        method: tx.method,
        phone: tx.accountReference || tx.phone,
        reference: ref,
        timestamp: new Date().toLocaleString('en-KE', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
        status: tx.status || 'pending',
      }));

      setReceipts(newReceipts);
      setShowSecurity(false);
      setAuthPin('');
      setSecurityOtp('');
      setSecurityStep(1);
      setSelectedPayees({});
      setCsvPreview([]);
      setCsvSummary(null);
      setPendingBatch(null);
      setShowReceipts(true);
      fetchBatches();
    } catch (e: any) {
      Alert.alert('Authorization failed', e?.response?.data?.message || 'Could not process batch.');
      // Allow retry for PIN if it fails, matching the dashboard's behavior.
      if (e?.response?.status === 401) {
        setAuthPin('');
      } else {
        setShowSecurity(false);
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  // ── Receipt PDF (batch) ──
  const downloadBatchReceipts = async () => {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const businessName = esc(merchant?.businessName || 'Merchant');
    const generatedAt = new Date().toLocaleString('en-KE', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const total = receipts.reduce((s, r) => s + (r.amount || 0), 0);
    const rows = receipts.map((r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td><div class="primary">${esc(r.name)}</div><div class="muted">${esc(r.phone || '—')}</div></td>
        <td class="ref">${esc(r.id)}</td>
        <td class="amount">${formatKES(r.amount)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Batch Receipts</title><style>
      @page { size: A4; margin: 24mm 16mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#0c2010; margin:0; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0b4d2e; padding-bottom:16px; margin-bottom:22px; }
      .brand { display:flex; align-items:center; gap:12px; }
      .logo { width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg, #00351d, #1D9E75); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; }
      .brand-name { font-size:18px; font-weight:700; color:#0b4d2e; }
      .brand-sub { font-size:10px; color:#707971; text-transform:uppercase; letter-spacing:1.5px; margin-top:2px; }
      .doc-title { text-align:right; }
      .doc-title h1 { margin:0; font-size:20px; color:#0c2010; font-weight:600; }
      .doc-title .meta { font-size:10px; color:#707971; margin-top:4px; }
      .summary { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:22px; }
      .summary .card { padding:14px; border-radius:12px; border:1px solid #e7ece7; }
      .summary .card.primary { background:linear-gradient(135deg, #00351d, #0b4d2e); border:none; color:#fff; }
      .summary .card .lbl { font-size:9px; text-transform:uppercase; letter-spacing:1.2px; opacity:0.7; margin-bottom:6px; }
      .summary .card .val { font-size:15px; font-weight:700; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      thead th { text-align:left; padding:10px 8px; background:#f7faf7; color:#404942; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #e7ece7; }
      thead th.amount, thead th.num { text-align:right; }
      tbody td { padding:10px 8px; border-bottom:1px solid #eff4ef; vertical-align:top; }
      tbody td.num { text-align:right; color:#a1a1aa; font-size:10px; width:28px; }
      tbody td.amount { text-align:right; font-weight:700; }
      tbody td.ref { font-family: ui-monospace, monospace; font-size:10px; color:#404942; }
      .primary { font-weight:600; color:#0c2010; font-size:11px; }
      .muted { font-size:9px; color:#707971; margin-top:2px; }
      .footer { margin-top:24px; padding-top:14px; border-top:1px solid #e7ece7; font-size:9px; color:#707971; line-height:1.6; }
    </style></head><body>
      <div class="header">
        <div class="brand">
          <div class="logo">${esc(((merchant?.businessName || 'M').slice(0,2)).toUpperCase())}</div>
          <div><div class="brand-name">${businessName}</div><div class="brand-sub">PayChain · Bulk Disbursement</div></div>
        </div>
        <div class="doc-title">
          <h1>Batch Receipt</h1>
          <div class="meta">Generated ${generatedAt}</div>
          <div class="meta">Batch: ${esc(lastBatchReference)}</div>
        </div>
      </div>
      <div class="summary">
        <div class="card primary"><div class="lbl">Total Payout</div><div class="val">${formatKES(total)}</div></div>
        <div class="card"><div class="lbl">Recipients</div><div class="val">${receipts.length}</div></div>
        <div class="card"><div class="lbl">Avg / Recipient</div><div class="val">${formatKES(receipts.length ? total/receipts.length : 0)}</div></div>
      </div>
      <table>
        <thead><tr><th class="num">#</th><th>Recipient</th><th>Receipt</th><th class="amount">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Computer-generated batch report. Each receipt is settled via Safaricom Daraja API and recorded on the PayChain ledger.</div>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Batch Receipts', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e: any) {
      Alert.alert('PDF failed', e?.message || 'Could not generate PDF.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00351d" />
          <Text className="text-[#707971] font-jakarta-medium text-[14px] mt-4">Loading payees…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Profile gate
  if (!isProfileComplete) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Bulk Payments" subtitle="Profile required to unlock" showBack={false} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-[#fef3e7] items-center justify-center mb-6">
            <Feather name="lock" size={32} color="#b87333" />
          </View>
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[28px] text-[#0c2010] text-center mb-3">Profile Incomplete</Text>
          <Text className="text-[#707971] font-jakarta-medium text-[14px] text-center leading-relaxed max-w-[320px]">
            To unlock Bulk Payments and stay KRA-compliant, add your KRA PIN and Business Number to your profile.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Bulk Payments" subtitle={`Balance: ${formatKES(balance)}`} showBack={false} />

      {/* Tabs */}
      <View className="w-full max-w-lg mx-auto px-6 mt-4">
        <View className="flex-row gap-6 border-b border-[#bfc9bf]/30">
          {(['Payees', 'Batches', 'Invoices'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`pb-3 ${activeTab === tab ? 'border-b-[3px] border-[#00351d]' : ''}`}
            >
              <Text className={`font-jakarta-bold text-[14px] ${activeTab === tab ? 'text-[#00351d]' : 'text-[#707971]'}`}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: selectedIds.length > 0 ? 160 : 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchPayees(true)} tintColor="#00351d" />}
      >
        {activeTab === 'Payees' ? (
          <View className="w-full max-w-lg mx-auto pt-5 px-6">
            <TouchableOpacity
              onPress={openAddPayee}
              activeOpacity={0.9}
              className="flex-row items-center justify-center gap-2 bg-[#00351d] rounded-2xl py-3.5 mb-5"
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text className="text-white font-jakarta-bold text-[13px]">Add Payee</Text>
            </TouchableOpacity>

            {/* Stats strip */}
            <View className="flex-row gap-3 mb-5">
              <View className="flex-1 bg-white rounded-[20px] p-3.5 border border-[#bfc9bf]/20">
                <Text className="text-[9px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em]">Total Payees</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010] leading-tight mt-1">{payeesList.length}</Text>
              </View>
              <View className="flex-1 bg-white rounded-[20px] p-3.5 border border-[#bfc9bf]/20">
                <Text className="text-[9px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em]">Selected</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#006c4e] leading-tight mt-1">{selectedIds.length}</Text>
              </View>
              <View className="flex-1 bg-[#00351d] rounded-[20px] p-3.5">
                <Text className="text-[9px] font-jakarta-bold text-white/70 uppercase tracking-[0.12em]">Batch</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[16px] text-white leading-tight mt-1" numberOfLines={1} adjustsFontSizeToFit>
                  {formatKES(batchTotal)}
                </Text>
              </View>
            </View>

            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-5">
              {FILTERS.map(f => {
                const active = activeFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setActiveFilter(f)}
                    className={`px-5 py-2 rounded-full mr-2 ${active ? 'bg-[#00351d]' : 'bg-[#eff4ef]'}`}
                  >
                    <Text className={`font-jakarta-bold text-[12px] ${active ? 'text-white' : 'text-[#404942]'}`}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Liquidity warning */}
            {isLiquidityLow && (
              <View className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-3.5 mb-4 flex-row items-center gap-2">
                <Feather name="alert-triangle" size={16} color="#b91c1c" />
                <Text className="text-[#b91c1c] font-jakarta-bold text-[12px] flex-1" numberOfLines={2}>
                  Batch ({formatKES(batchTotal)}) exceeds balance ({formatKES(balance)}). Top up to proceed.
                </Text>
              </View>
            )}

            {/* Payee list */}
            {filteredPayees.length === 0 ? (
              <View className="items-center py-16">
                <View className="w-16 h-16 rounded-full bg-[#e7ece7] items-center justify-center mb-4">
                  <Feather name="users" size={26} color="#707971" />
                </View>
                <Text className="text-[#0c2010] font-jakarta-bold text-[16px] mb-1">No payees yet</Text>
                <Text className="text-[#707971] font-jakarta-medium text-[13px] text-center max-w-[260px] leading-relaxed">
                  Tap "Add Payee" above to register your first recipient.
                </Text>
              </View>
            ) : (
              filteredPayees.map(p => {
                const meta = TYPE_META[p.type];
                const isSelected = !!selectedPayees[p._id];
                const amt = payoutAmounts[p._id] || 0;
                return (
                  <TouchableOpacity
                    key={p._id}
                    activeOpacity={0.85}
                    onPress={() => togglePayee(p._id)}
                    onLongPress={() => handleDeletePayee(p)}
                    className={`bg-white rounded-[22px] p-4 flex-row items-center mb-3 border ${
                      isSelected ? 'border-[#00351d]' : 'border-[#bfc9bf]/15'
                    }`}
                  >
                    <View className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: meta.bg }}>
                      <Text className="font-jakarta-extrabold text-[13px]" style={{ color: meta.text }}>{initials(p.name)}</Text>
                    </View>
                    <View className="flex-1 min-w-0 mr-2">
                      <View className="flex-row items-center">
                        <Text className="font-jakarta-bold text-[15px] text-[#0c2010] flex-shrink" numberOfLines={1} ellipsizeMode="tail">{p.name}</Text>
                      </View>
                      <View className="flex-row items-center mt-1">
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.badgeBg }}>
                          <Text className="text-[8px] font-jakarta-bold uppercase tracking-[0.1em]" style={{ color: meta.badgeText }}>{meta.label}</Text>
                        </View>
                        <Text className="text-[#707971] font-jakarta-medium text-[10px] ml-2" numberOfLines={1}>
                          {p.paymentMethod === 'Bank' ? p.bankName : p.phone || p.paybillNumber || p.tillNumber || '—'}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end" style={{ flexShrink: 0 }}>
                      <TouchableOpacity onPress={() => openAmountEditor(p)} className="bg-[#f0fdf4] border border-[#bfc9bf]/30 rounded-full px-3 py-1.5 mb-1.5">
                        <Text className="font-jakarta-bold text-[11px] text-[#00351d]" numberOfLines={1}>{amt > 0 ? formatKES(amt) : 'Set amount'}</Text>
                      </TouchableOpacity>
                      <View className="flex-row gap-1.5">
                        <TouchableOpacity onPress={() => openEditPayee(p)} className="w-7 h-7 rounded-full bg-[#f0fdf4] items-center justify-center border border-[#bfc9bf]/30">
                          <Feather name="edit-2" size={11} color="#404942" />
                        </TouchableOpacity>
                        <View className={`w-7 h-7 rounded-full items-center justify-center ${isSelected ? 'bg-[#00351d]' : 'bg-[#f0fdf4] border border-[#bfc9bf]/30'}`}>
                          {isSelected
                            ? <Feather name="check" size={13} color="white" />
                            : <Feather name="circle" size={13} color="#707971" />}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : activeTab === 'Batches' ? (
          // ─── Batches Tab ───
          <View className="w-full max-w-lg mx-auto px-6 pt-5">
            {/* Quick actions */}
            <View className="flex-row gap-2.5 mb-5">
              <TouchableOpacity onPress={handleCsvUpload} className="flex-1 bg-[#dbeafe] rounded-2xl p-3.5 flex-row items-center justify-center gap-2 border border-[#bfdbfe]" disabled={csvUploadLoading}>
                <Feather name={csvUploadLoading ? 'loader' : 'upload'} size={16} color="#1e40af" />
                <Text className="text-[#1e40af] font-jakarta-bold text-[12px]">{csvUploadLoading ? 'Uploading' : 'CSV'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={fetchBatches} className="flex-1 bg-[#e7f8ef] rounded-2xl p-3.5 flex-row items-center justify-center gap-2 border border-[#bbf7d0]">
                <Feather name="refresh-cw" size={16} color="#006c4e" />
                <Text className="text-[#006c4e] font-jakarta-bold text-[12px]">Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Last Batch Summary */}
            {receipts.length > 0 && (
              <View className="bg-white rounded-[24px] p-5 border border-[#bfc9bf]/15 mb-4">
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="w-11 h-11 rounded-full bg-[#e7f8ef] items-center justify-center">
                    <Feather name="check-circle" size={18} color="#006c4e" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">Last Batch</Text>
                    <Text className="text-[#707971] font-jakarta-medium text-[11px]" numberOfLines={1}>
                      {receipts.length} recipients · {lastBatchReference}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowReceipts(true)} className="px-3 py-1.5 rounded-full bg-[#00351d]">
                    <Text className="text-white font-jakarta-bold text-[11px]">View</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={downloadBatchReceipts} className="flex-row items-center justify-center gap-2 bg-[#f0fdf4] border border-[#bfc9bf]/30 rounded-full py-3 mt-2">
                  <Feather name="download" size={14} color="#00351d" />
                  <Text className="text-[#00351d] font-jakarta-bold text-[12px]">Download Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Batch History */}
            <View className="mb-4">
              <View className="mb-3">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Batch History</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                  <View className="flex-row gap-2 px-1">
                    {['All', 'Processed', 'Pending', 'Partial', 'Failed'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => setBatchFilter(status)}
                        className={`px-3 py-1 rounded-full ${batchFilter === status ? 'bg-[#00351d]' : 'bg-[#f0fdf4] border border-[#bfc9bf]/30'}`}
                      >
                        <Text className={`text-[9px] font-jakarta-bold uppercase tracking-wider ${batchFilter === status ? 'text-white' : 'text-[#707971]'}`}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {batchHistory.length === 0 ? (
                <View className="bg-white rounded-[20px] p-8 items-center border border-[#e7ece7]">
                  <View className="w-14 h-14 rounded-full bg-[#f7faf7] items-center justify-center mb-3">
                    <Feather name="layers" size={22} color="#707971" />
                  </View>
                  <Text className="text-[#0c2010] font-jakarta-bold text-[14px] mb-1">No batches</Text>
                  <Text className="text-[#707971] font-jakarta-medium text-[12px] text-center">Create your first bulk payment to see history here.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                  {batchHistory
                    .filter((b: BatchHistory) => batchFilter === 'All' || b.status === batchFilter)
                    .map((batch: BatchHistory) => (
                      <TouchableOpacity
                        key={batch._id}
                        onPress={() => setShowBatchDetails(batch)}
                        className="bg-white rounded-[20px] p-4 border border-[#bfc9bf]/15 mr-3 w-[280px]"
                        style={{ minWidth: 280 }}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View>
                            <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" numberOfLines={1}>{batch.batchReference}</Text>
                            <Text className="text-[#707971] font-jakarta-medium text-[10px] mt-1">
                              {new Date(batch.createdAt).toLocaleDateString('en-KE')}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: (BATCH_STATUS_META[batch.status] || BATCH_STATUS_META.Failed).bg }} className="px-2.5 py-1 rounded-full">
                            <Text style={{ color: (BATCH_STATUS_META[batch.status] || BATCH_STATUS_META.Failed).text }} className="text-[9px] font-jakarta-bold uppercase tracking-wider">
                              {batch.status}
                            </Text>
                          </View>
                        </View>
                        <View className="bg-[#f0fdf4] rounded-xl p-3 mb-2">
                          <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Amount</Text>
                          <Text className="text-[#00351d] font-jakarta-bold text-[16px]">{formatKES(batch.totalNetAmount)}</Text>
                        </View>
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Recipients</Text>
                            <Text className="text-[#404942] font-jakarta-bold text-[13px]">{batch.payeeCount}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Source</Text>
                            <Text className="text-[#404942] font-jakarta-medium text-[11px]" numberOfLines={1}>{batch.fundingSource}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              )}
            </View>

            <View className="bg-white rounded-[24px] p-5 border border-[#bfc9bf]/15 mb-4">
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Security</Text>
              <TouchableOpacity onPress={() => setShowPinSetup(true)} className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-[#fef3e7] items-center justify-center">
                    <Feather name="shield" size={16} color="#b87333" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[14px] text-[#0c2010]">Bulk Pay PIN</Text>
                    <Text className="text-[#707971] font-jakarta-medium text-[11px]">{merchant?.hasBulkPayPin === false ? 'Not configured' : 'Configured'}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color="#707971" />
              </TouchableOpacity>
            </View>

            <View className="bg-[#5efeb3] rounded-[24px] p-6">
              <Text className="text-[#00351d] font-jakarta-extrabold text-[10px] tracking-[0.2em] uppercase mb-3">Pro Tip</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[#00351d] text-[18px] leading-snug">
                Upload CSV files for bulk imports, or fund your account to increase payment limits.
              </Text>
            </View>
          </View>
        ) : (
          // ─── Invoices Tab ───
          <View className="w-full max-w-lg mx-auto px-6 pt-5">
            {/* Create Invoice CTA */}
            <View className="bg-white rounded-[24px] p-5 border border-[#bfc9bf]/15 mb-4">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 rounded-xl bg-[#e7f8ef] items-center justify-center">
                  <Feather name="file-text" size={18} color="#006c4e" />
                </View>
                <View>
                  <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">Invoices</Text>
                  <Text className="text-[#707971] font-jakarta-medium text-[11px]">Billing & Drafts</Text>
                </View>
              </View>
              <Text className="text-[#707971] font-jakarta-medium text-[12px] leading-relaxed mb-4">
                Generate, send, and manage professional invoices directly to your clients.
              </Text>
              <TouchableOpacity onPress={handleOpenInvoiceEditor} className="bg-[#00351d] rounded-2xl py-3.5 flex-row items-center justify-center gap-2">
                <Feather name="plus" size={15} color="#fff" />
                <Text className="text-white font-jakarta-bold text-[13px]">Create Invoice</Text>
              </TouchableOpacity>
            </View>

            {/* Invoice Tracking */}
            <View className="bg-white rounded-[24px] p-5 border border-[#bfc9bf]/15 mb-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">Invoice Tracking</Text>
                <Text className="font-jakarta-extrabold text-[15px] text-[#00351d]">{invoicesList.length}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-4">
                {(['All', 'Drafts', 'Sent', 'Paid'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => { setInvoiceFilter(f); setInvoicePage(1); }}
                    className={`px-4 py-2 rounded-full mr-2 ${invoiceFilter === f ? 'bg-[#00351d]' : 'bg-[#f0fdf4] border border-[#bfc9bf]/30'}`}
                  >
                    <Text className={`text-[10px] font-jakarta-bold uppercase tracking-wider ${invoiceFilter === f ? 'text-white' : 'text-[#707971]'}`}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredInvoicesList.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-14 h-14 rounded-full bg-[#f7faf7] items-center justify-center mb-3">
                    <Feather name="file-text" size={22} color="#707971" />
                  </View>
                  <Text className="text-[#0c2010] font-jakarta-bold text-[14px] mb-1">No recent invoices</Text>
                  <Text className="text-[#707971] font-jakarta-medium text-[12px] text-center">Generate your first professional e-invoice to start getting paid.</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {paginatedInvoicesList.map(inv => {
                    const statusMeta: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; tone: string; toneText: string; badgeBg: string; badgeText: string }> = {
                      draft: { label: 'Draft', icon: 'edit-2', tone: '#fef3e7', toneText: '#b87333', badgeBg: '#fef3e7', badgeText: '#b87333' },
                      sent: { label: 'Sent', icon: 'send', tone: '#e7f8ef', toneText: '#006c4e', badgeBg: '#e7f8ef', badgeText: '#006c4e' },
                      paid: { label: 'Paid', icon: 'check-circle', tone: '#dbeafe', toneText: '#1e40af', badgeBg: '#dbeafe', badgeText: '#1e40af' },
                      void: { label: 'Void', icon: 'slash', tone: '#f1f5f9', toneText: '#64748b', badgeBg: '#f1f5f9', badgeText: '#64748b' },
                    };
                    const meta = statusMeta[inv.status] || statusMeta.draft;
                    const isConfirmingDelete = confirmDeleteInvoiceId === inv._id;
                    return (
                      <View key={inv._id} className="bg-[#f7faf7] rounded-[20px] p-4 border border-[#eff4ef]">
                        <View className="flex-row items-center gap-3 mb-3">
                          <View style={{ backgroundColor: meta.tone }} className="w-10 h-10 rounded-xl items-center justify-center">
                            <Feather name={meta.icon} size={16} color={meta.toneText} />
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" numberOfLines={1}>{inv.customer?.name || 'Unnamed Customer'}</Text>
                            <View className="flex-row items-center gap-2 mt-0.5">
                              <Text className="text-[10px] text-[#707971] font-jakarta-medium">
                                #{inv.invoiceNumber} · {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                              </Text>
                              <View style={{ backgroundColor: meta.badgeBg }} className="px-1.5 py-0.5 rounded">
                                <Text style={{ color: meta.badgeText }} className="text-[8px] font-jakarta-bold uppercase tracking-widest">{meta.label}</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {isConfirmingDelete ? (
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className="text-[10px] text-[#b91c1c] font-jakarta-bold flex-1 leading-snug">
                              {inv.status === 'sent' ? "This invoice's payment link will stop working. Delete anyway?" : 'Delete this draft?'}
                            </Text>
                            <TouchableOpacity onPress={() => setConfirmDeleteInvoiceId(null)} className="px-3 py-2 rounded-xl">
                              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971]">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteInvoice(inv)} className="px-3 py-2 rounded-xl bg-red-600">
                              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-white">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View className="flex-row items-center justify-between">
                            <View>
                              <Text className="text-[13px] font-jakarta-bold text-[#00351d]">{inv.currency} {(inv.total || 0).toLocaleString()}</Text>
                              <Text className="text-[9px] text-[#707971] font-jakarta-medium uppercase tracking-widest">Total value</Text>
                            </View>
                            <View className="flex-row gap-2">
                              {inv.status !== 'paid' && (
                                <TouchableOpacity onPress={() => setConfirmDeleteInvoiceId(inv._id!)} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                                  <Feather name="trash-2" size={15} color="#ef4444" />
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => openInvoiceForEdit(inv)}
                                disabled={inv.status === 'paid'}
                                className="w-9 h-9 rounded-xl bg-[#e7f8ef] items-center justify-center"
                                style={{ opacity: inv.status === 'paid' ? 0.4 : 1 }}
                              >
                                <Feather name={inv.status === 'paid' ? 'eye' : 'edit-2'} size={15} color="#006c4e" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {filteredInvoicesList.length > invoicesPerPage && (
                <View className="flex-row items-center justify-between mt-5">
                  <Text className="text-[10px] font-jakarta-bold text-[#707971]">
                    Showing {paginatedInvoicesList.length} of {filteredInvoicesList.length}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() => setInvoicePage(p => Math.max(1, p - 1))}
                      disabled={invoicePage === 1}
                      className="w-8 h-8 rounded-full bg-white border border-[#e7ece7] items-center justify-center"
                      style={{ opacity: invoicePage === 1 ? 0.3 : 1 }}
                    >
                      <Feather name="chevron-left" size={16} color="#00351d" />
                    </TouchableOpacity>
                    <Text className="text-[11px] font-jakarta-bold text-[#0c2010]">{invoicePage} / {totalInvoicePages}</Text>
                    <TouchableOpacity
                      onPress={() => setInvoicePage(p => Math.min(totalInvoicePages, p + 1))}
                      disabled={invoicePage >= totalInvoicePages}
                      className="w-8 h-8 rounded-full bg-white border border-[#e7ece7] items-center justify-center"
                      style={{ opacity: invoicePage >= totalInvoicePages ? 0.3 : 1 }}
                    >
                      <Feather name="chevron-right" size={16} color="#00351d" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Pay Now bar */}
      {activeTab === 'Payees' && selectedIds.length > 0 && (
        <View className="absolute bottom-6 left-6 right-6 z-50">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={startAuthorize}
            className="bg-[#002110] rounded-full px-6 py-4 flex-row items-center justify-between shadow-xl"
            style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}
          >
            <View className="flex-1 mr-3">
              <Text className="text-[#5efeb3] font-jakarta-bold text-[10px] uppercase tracking-[0.2em] mb-1">
                {selectedIds.length} Payee{selectedIds.length === 1 ? '' : 's'}
              </Text>
              <Text className="text-white font-jakarta-bold text-[19px] tracking-tight" numberOfLines={1} adjustsFontSizeToFit>{formatKES(batchTotal)}</Text>
            </View>
            <View className="flex-row items-center gap-2 bg-[#05c46b] px-5 py-2.5 rounded-full">
              <Text className="text-white font-jakarta-bold text-[14px]">Authorize</Text>
              <Feather name="arrow-right" size={16} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PIN Setup Modal ── */}
      <Modal visible={showPinSetup} transparent animationType="slide" onRequestClose={() => setShowPinSetup(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/40">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowPinSetup(false)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl">
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-full bg-[#e7f8ef] items-center justify-center mb-3">
                  <Feather name="shield" size={22} color="#006c4e" />
                </View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">Set Bulk Pay PIN</Text>
                <Text className="text-[#707971] font-jakarta-medium text-[12px] mt-1 text-center">A 4-digit PIN is required to authorize batches.</Text>
              </View>
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">New PIN</Text>
              <TextInput
                value={setupPin}
                onChangeText={(t) => setSetupPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-3.5 text-[#0c2010] font-jakarta-bold text-[18px] tracking-[0.5em] text-center mb-4"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
              />
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Confirm PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-3.5 text-[#0c2010] font-jakarta-bold text-[18px] tracking-[0.5em] text-center mb-6"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
              />
              <TouchableOpacity onPress={handleSetupPin} className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center">
                <Text className="text-white font-jakarta-bold text-[15px]">Save PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Amount Editor Modal ── */}
      <Modal visible={!!showAmountEditor} transparent animationType="slide" onRequestClose={() => setShowAmountEditor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/40">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowAmountEditor(null)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">Set Payout</Text>
              <Text className="text-[#707971] font-jakarta-medium text-[12px] mb-5" numberOfLines={1}>For {showAmountEditor?.name}</Text>
              <View className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-4 mb-5 flex-row items-center">
                <Text className="text-[#707971] font-jakarta-bold text-[18px] mr-2">KES</Text>
                <TextInput
                  value={amountInput}
                  onChangeText={(t) => setAmountInput(t.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  className="flex-1 text-[#0c2010] font-jakarta-bold text-[20px]"
                  placeholder="0"
                  placeholderTextColor="#a1a1aa"
                  autoFocus
                />
              </View>
              <TouchableOpacity onPress={saveAmount} className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center">
                <Text className="text-white font-jakarta-bold text-[15px]">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Authorize Modal ── */}
      <Modal visible={showAuthorize} transparent animationType="slide" onRequestClose={() => setShowAuthorize(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowAuthorize(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-full bg-[#fef3e7] items-center justify-center mb-3">
                <Feather name="lock" size={22} color="#b87333" />
              </View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">Authorize Batch</Text>
              <Text className="text-[#707971] font-jakarta-medium text-[12px] mt-1 text-center">Review before selecting a funding source.</Text>
            </View>
            <View className="bg-[#f0fdf4] rounded-2xl p-4 mb-6 border border-[#e7ece7]">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Recipients</Text>
                <Text className="font-jakarta-bold text-[#0c2010] text-[13px]">{selectedIds.length}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Total Payout</Text>
                <Text className="font-jakarta-bold text-[#00351d] text-[16px]">{formatKES(batchTotal)}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => proceedToFundingSourceSelect('manual')}
              className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center"
            >
              <Feather name="arrow-right" size={16} color="#fff" />
              <Text className="text-white font-jakarta-bold text-[15px] ml-2">Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CSV Upload Preview Modal ── */}
      <Modal visible={showCsvUpload} transparent animationType="slide" onRequestClose={() => !isAuthorizing && setShowCsvUpload(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/50">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => !isAuthorizing && setShowCsvUpload(false)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto" style={{ maxHeight: '90%' }}>
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <View className="items-center mb-4">
                <View className="w-14 h-14 rounded-full bg-[#dbeafe] items-center justify-center mb-3">
                  <Feather name="file-text" size={22} color="#1e40af" />
                </View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">Review CSV Batch</Text>
                <Text className="text-[#707971] font-jakarta-medium text-[12px] mt-1">{csvPreview.length} row{csvPreview.length === 1 ? '' : 's'} detected</Text>
              </View>

              <View className="bg-[#f0fdf4] rounded-2xl p-4 mb-4 border border-[#e7ece7]">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Gross Total</Text>
                  <Text className="font-jakarta-bold text-[#0c2010] text-[14px]">{formatKES(csvSummary?.totalGross)}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Net Payout</Text>
                  <Text className="font-jakarta-bold text-[#00351d] text-[16px]">{formatKES(csvSummary?.totalNet)}</Text>
                </View>
              </View>

              <ScrollView className="mb-4" showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                {csvPreview.map((row: any, idx: number) => (
                  <View key={idx} className="bg-white rounded-2xl p-3 mb-2 border border-[#e7ece7] flex-row items-center">
                    <View className="w-9 h-9 rounded-full bg-[#f0fdf4] items-center justify-center mr-3 border border-[#bfc9bf]/30">
                      <Text className="font-jakarta-bold text-[10px] text-[#404942]">{initials(row.name)}</Text>
                    </View>
                    <View className="flex-1 min-w-0 mr-2">
                      <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" numberOfLines={1}>{row.name}</Text>
                      <Text
                        className={`text-[10px] font-jakarta-medium ${row.status?.startsWith('Warning') ? 'text-[#b87333]' : 'text-[#707971]'}`}
                        numberOfLines={1}
                      >
                        {row.status || 'Valid'}
                      </Text>
                    </View>
                    <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" style={{ flexShrink: 0 }}>
                      {formatKES(row.netAmount ?? row.amount)}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => proceedToFundingSourceSelect('csv')}
                disabled={csvPreview.length === 0}
                className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center"
                style={{ opacity: csvPreview.length === 0 ? 0.7 : 1 }}
              >
                <Feather name="arrow-right" size={16} color="#fff" />
                <Text className="text-white font-jakarta-bold text-[15px] ml-2">Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCsvUpload(false)} className="items-center py-3 mt-2">
                <Text className="text-[#707971] font-jakarta-semibold text-[13px]">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Funding Source Select Modal (Step 3: Funding Source) ── */}
      <Modal visible={showFundingSourceSelect} transparent animationType="slide" onRequestClose={() => setShowFundingSourceSelect(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowFundingSourceSelect(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971] mb-4 ml-1">Select Funding Source</Text>
            <TouchableOpacity
              onPress={() => setSelectedFundingSource(true)}
              activeOpacity={0.85}
              className={`p-5 rounded-2xl border-2 mb-6 ${selectedFundingSource ? 'border-[#00351d] bg-[#f0fdf4]' : 'border-[#e7ece7] bg-white'}`}
            >
              <View className="flex-row items-start justify-between mb-5">
                <View className="flex-row items-center gap-3">
                  <View className={`w-12 h-12 rounded-xl items-center justify-center ${selectedFundingSource ? 'bg-[#00351d]' : 'bg-[#f7faf7]'}`}>
                    <Feather name={selectedFundingSource ? 'check' : 'home'} size={18} color={selectedFundingSource ? '#fff' : '#00351d'} />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[14px] text-[#0c2010]">{fundingSourceLabel}</Text>
                    <Text className="text-[#707971] font-jakarta-medium text-[11px] mt-0.5">PayChain Account No: {fundingSourceNumber}</Text>
                  </View>
                </View>
              </View>
              <View className="flex-row justify-between items-center pt-4 border-t border-[#e7ece7]">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Available Balance</Text>
                <Text className="font-jakarta-bold text-[#00351d] text-[15px]">{formatKES(balance)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmFundingSourceAndVerify}
              disabled={!selectedFundingSource}
              className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center"
              style={{ opacity: selectedFundingSource ? 1 : 0.5 }}
            >
              <Text className="text-white font-jakarta-bold text-[15px] mr-2">Continue</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Security Verification Modal (OTP -> PIN) ── */}
      <Modal visible={showSecurity} transparent animationType="slide" onRequestClose={cancelSecurity}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/50">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => !isAuthorizing && cancelSecurity()} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010] mb-1">Verification</Text>
              <Text className="text-[#707971] font-jakarta-medium text-[12px] mb-6">Security check required for settlement</Text>

              {securityStep === 1 ? (
                <>
                  <View className="items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-[#dbeafe] items-center justify-center mb-4">
                      <Feather name="message-square" size={26} color="#1e40af" />
                    </View>
                    <Text className="font-jakarta-bold text-[#0c2010] text-[14px]">Enter OTP Sent to {merchant?.phone || '07XX XXX XXX'}</Text>
                  </View>
                  <TextInput
                    value={securityOtp}
                    onChangeText={(t) => setSecurityOtp(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="numeric"
                    maxLength={6}
                    className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-4 text-[#0c2010] font-jakarta-bold text-[20px] tracking-[0.5em] text-center mb-6"
                    placeholder="••••••"
                    placeholderTextColor="#a1a1aa"
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => setSecurityStep(2)}
                    disabled={securityOtp.length < 4}
                    className="w-full bg-[#e7f8ef] h-[56px] rounded-full items-center justify-center"
                    style={{ opacity: securityOtp.length < 4 ? 0.5 : 1 }}
                  >
                    <Text className="text-[#006c4e] font-jakarta-bold text-[15px]">Verify OTP</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View className="items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-[#00351d] items-center justify-center mb-4">
                      <Feather name="lock" size={24} color="#5efeb3" />
                    </View>
                    <Text className="font-jakarta-bold text-[#0c2010] text-[14px]">Enter Account PIN to Authorize</Text>
                  </View>
                  <TextInput
                    value={authPin}
                    onChangeText={(t) => setAuthPin(t.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    editable={!isAuthorizing}
                    className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-4 text-[#0c2010] font-jakarta-bold text-[20px] tracking-[0.5em] text-center mb-6"
                    placeholder="••••"
                    placeholderTextColor="#a1a1aa"
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={handleAuthorize}
                    disabled={authPin.length !== 4 || isAuthorizing}
                    className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center"
                    style={{ opacity: authPin.length !== 4 || isAuthorizing ? 0.7 : 1 }}
                  >
                    {isAuthorizing ? <ActivityIndicator color="#fff" /> : (
                      <Text className="text-white font-jakarta-bold text-[15px]">Confirm & Pay</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Receipts Modal ── */}
      <Modal visible={showReceipts} transparent animationType="slide" onRequestClose={() => setShowReceipts(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowReceipts(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto" style={{ maxHeight: '90%' }}>
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            <View className="items-center mb-4">
              <View
                style={{ backgroundColor: lastBatchStatus === 'Processed' ? '#e7f8ef' : lastBatchStatus === 'Failed' ? '#fef2f2' : '#fef3e7' }}
                className="w-14 h-14 rounded-full items-center justify-center mb-3"
              >
                <Feather
                  name={lastBatchStatus === 'Processed' ? 'check-circle' : lastBatchStatus === 'Failed' ? 'x-circle' : 'clock'}
                  size={22}
                  color={lastBatchStatus === 'Processed' ? '#006c4e' : lastBatchStatus === 'Failed' ? '#b91c1c' : '#b87333'}
                />
              </View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">
                {lastBatchStatus === 'Processed' ? 'Batch Settled' : lastBatchStatus === 'Failed' ? 'Batch Failed' : lastBatchStatus === 'Partial' ? 'Batch Partially Settled' : 'Batch Submitted'}
              </Text>
              <Text className="text-[#707971] font-jakarta-medium text-[12px] mt-1 text-center" numberOfLines={2}>
                {lastBatchStatus === 'Processed'
                  ? `Ref: ${lastBatchReference}`
                  : lastBatchStatus === 'Failed'
                  ? `Ref: ${lastBatchReference} · Failed payouts were refunded to your balance.`
                  : `Ref: ${lastBatchReference} · Some payouts are awaiting M-PESA confirmation.`}
              </Text>
            </View>
            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {receipts.map((r) => {
                const rowMeta = r.status === 'completed'
                  ? { color: '#006c4e', label: 'Completed' }
                  : r.status === 'failed'
                  ? { color: '#b91c1c', label: 'Failed · Refunded' }
                  : { color: '#b87333', label: 'Pending' };
                return (
                  <View key={r.id} className="bg-[#f0fdf4] rounded-2xl p-3 mb-2 border border-[#e7ece7] flex-row items-center">
                    <View className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3 border border-[#bfc9bf]/30">
                      <Text className="font-jakarta-bold text-[10px] text-[#404942]">{initials(r.name)}</Text>
                    </View>
                    <View className="flex-1 min-w-0 mr-2">
                      <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" numberOfLines={1}>{r.name}</Text>
                      <Text className="text-[#707971] font-jakarta-medium text-[10px]" numberOfLines={1}>{r.id}</Text>
                    </View>
                    <View className="items-end" style={{ flexShrink: 0 }}>
                      <Text className="font-jakarta-bold text-[13px] text-[#0c2010]">{formatKES(r.amount)}</Text>
                      <Text style={{ color: rowMeta.color }} className="text-[9px] font-jakarta-bold uppercase tracking-wider mt-0.5">{rowMeta.label}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={downloadBatchReceipts} className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center">
              <Feather name="download" size={16} color="#fff" />
              <Text className="text-white font-jakarta-bold text-[15px] ml-2">Download Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReceipts(false)} className="items-center py-3 mt-2">
              <Text className="text-[#707971] font-jakarta-semibold text-[13px]">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Batch Details Modal ── */}
      <Modal visible={!!showBatchDetails} transparent animationType="slide" onRequestClose={() => setShowBatchDetails(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowBatchDetails(null)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto" style={{ maxHeight: '85%' }}>
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            {showBatchDetails && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="font-jakarta-bold text-[16px] text-[#0c2010]">{showBatchDetails.batchReference}</Text>
                    <Text className="text-[#707971] font-jakarta-medium text-[11px] mt-0.5">
                      {new Date(showBatchDetails.createdAt).toLocaleString('en-KE')}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: (BATCH_STATUS_META[showBatchDetails.status] || BATCH_STATUS_META.Failed).bg }} className="px-2.5 py-1 rounded-full">
                    <Text style={{ color: (BATCH_STATUS_META[showBatchDetails.status] || BATCH_STATUS_META.Failed).text }} className="text-[9px] font-jakarta-bold uppercase tracking-wider">
                      {showBatchDetails.status}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mb-4">
                  <View className="flex-1 bg-[#f0fdf4] rounded-2xl p-3">
                    <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Net Paid</Text>
                    <Text className="text-[#00351d] font-jakarta-bold text-[15px]">{formatKES(showBatchDetails.totalNetAmount)}</Text>
                  </View>
                  <View className="flex-1 bg-[#f0fdf4] rounded-2xl p-3">
                    <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Tax Withheld</Text>
                    <Text className="text-[#00351d] font-jakarta-bold text-[15px]">{formatKES(showBatchDetails.totalTaxDeductions)}</Text>
                  </View>
                  <View className="flex-1 bg-[#f0fdf4] rounded-2xl p-3">
                    <Text className="text-[9px] font-jakarta-medium text-[#707971] uppercase tracking-wider mb-1">Payees</Text>
                    <Text className="text-[#00351d] font-jakarta-bold text-[15px]">{showBatchDetails.payeeCount}</Text>
                  </View>
                </View>

                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Transactions</Text>
                <ScrollView className="mb-2" showsVerticalScrollIndicator={false}>
                  {showBatchDetails.transactions.map((tx: any, idx: number) => {
                    const rowStatus = tx.status || 'pending';
                    const meta = BATCH_STATUS_META[rowStatus === 'completed' ? 'Processed' : rowStatus === 'failed' ? 'Failed' : 'Pending'];
                    return (
                      <View key={tx.receiptNumber || idx} className="bg-[#f0fdf4] rounded-2xl p-3 mb-2 border border-[#e7ece7] flex-row items-center">
                        <View className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3 border border-[#bfc9bf]/30">
                          <Text className="font-jakarta-bold text-[10px] text-[#404942]">{initials(tx.name)}</Text>
                        </View>
                        <View className="flex-1 min-w-0 mr-2">
                          <Text className="font-jakarta-bold text-[13px] text-[#0c2010]" numberOfLines={1}>{tx.name}</Text>
                          <Text className="text-[#707971] font-jakarta-medium text-[10px]" numberOfLines={1}>{tx.accountReference}</Text>
                        </View>
                        <View className="items-end" style={{ flexShrink: 0 }}>
                          <Text className="font-jakarta-bold text-[13px] text-[#0c2010]">{formatKES(tx.amount)}</Text>
                          <View style={{ backgroundColor: meta.bg }} className="px-2 py-0.5 rounded-full mt-1">
                            <Text style={{ color: meta.text }} className="text-[8px] font-jakarta-bold uppercase tracking-wider">{rowStatus}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <TouchableOpacity onPress={() => setShowBatchDetails(null)} className="items-center py-3 mt-1">
              <Text className="text-[#707971] font-jakarta-semibold text-[13px]">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add/Edit Payee Modal ── */}
      <Modal visible={showAddPayee} transparent animationType="slide" onRequestClose={() => setShowAddPayee(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/40">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowAddPayee(false)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-6 mt-auto" style={{ maxHeight: '92%' }}>
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <View className="flex-row justify-between items-center mb-5">
                <View>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">{editingId ? 'Edit Recipient' : 'New Recipient'}</Text>
                  <Text className="text-[10px] font-jakarta-medium text-[#707971] uppercase tracking-wider mt-1">
                    Step {addStep} of 2 · {addStep === 1 ? 'Category' : 'Details'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddPayee(false)} className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center border border-[#bfc9bf]/30">
                  <Feather name="x" size={16} color="#707971" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {addStep === 1 ? (
                  <View>
                    {(Object.keys(TYPE_META) as PayeeType[]).map((key) => {
                      const meta = TYPE_META[key];
                      const isActive = newPayee.type === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setNewPayee({ ...newPayee, type: key })}
                          className={`flex-row items-center p-4 rounded-2xl mb-2.5 border ${isActive ? 'border-[#00351d] bg-[#f0fdf4]' : 'border-[#e7ece7] bg-white'}`}
                        >
                          <View className="w-11 h-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: isActive ? '#00351d' : meta.bg }}>
                            <MaterialIcons name={meta.icon} size={20} color={isActive ? '#fff' : meta.text} />
                          </View>
                          <View className="flex-1">
                            <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">{meta.label}</Text>
                            <Text className="text-[#707971] font-jakarta-medium text-[11px] mt-0.5">{meta.description}</Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full items-center justify-center ${isActive ? 'bg-[#00351d]' : 'border border-[#bfc9bf]'}`}>
                            {isActive && <Feather name="check" size={11} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View>
                    {/* Name */}
                    <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">
                      {newPayee.type === 'utility' ? 'Utility Name' : 'Recipient Name'}
                    </Text>
                    <TextInput
                      value={newPayee.name}
                      onChangeText={(t) => setNewPayee({ ...newPayee, name: t })}
                      placeholder={newPayee.type === 'utility' ? 'e.g. Kenya Power' : 'e.g. John Kamau'}
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-semibold text-[14px] mb-4"
                    />

                    {/* KRA Employee fields */}
                    {newPayee.type === 'employee' && (
                      <View className="bg-[#f0fdf4] rounded-2xl p-4 mb-4 border border-[#bbf7d0]">
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-wider mb-3">KRA Payroll Details</Text>
                        <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">KRA PIN *</Text>
                        <TextInput
                          value={newPayee.kraPin}
                          onChangeText={(t) => setNewPayee({ ...newPayee, kraPin: t.toUpperCase() })}
                          autoCapitalize="characters"
                          placeholder="A000000000A"
                          placeholderTextColor="#a1a1aa"
                          className="bg-white border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-3"
                        />
                        <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">ID Number *</Text>
                        <TextInput
                          value={newPayee.idNumber}
                          onChangeText={(t) => setNewPayee({ ...newPayee, idNumber: t.replace(/\D/g, '') })}
                          keyboardType="numeric"
                          placeholder="12345678"
                          placeholderTextColor="#a1a1aa"
                          className="bg-white border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-3"
                        />
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">NSSF</Text>
                            <TextInput
                              value={newPayee.nssfNumber}
                              onChangeText={(t) => setNewPayee({ ...newPayee, nssfNumber: t })}
                              placeholder="123456789"
                              placeholderTextColor="#a1a1aa"
                              className="bg-white border border-[#e7ece7] rounded-xl px-3 py-3 text-[#0c2010] font-jakarta-bold text-[13px]"
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">SHIF</Text>
                            <TextInput
                              value={newPayee.shifNumber}
                              onChangeText={(t) => setNewPayee({ ...newPayee, shifNumber: t })}
                              placeholder="1234567"
                              placeholderTextColor="#a1a1aa"
                              className="bg-white border border-[#e7ece7] rounded-xl px-3 py-3 text-[#0c2010] font-jakarta-bold text-[13px]"
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* KRA Supplier fields */}
                    {newPayee.type === 'supplier' && (
                      <View className="bg-[#eef2ff] rounded-2xl p-4 mb-4 border border-[#c7d2fe]">
                        <Text className="text-[10px] font-jakarta-bold text-[#3730a3] uppercase tracking-wider mb-3">KRA eTIMS Details</Text>
                        <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">Supplier KRA PIN *</Text>
                        <TextInput
                          value={newPayee.kraPin}
                          onChangeText={(t) => setNewPayee({ ...newPayee, kraPin: t.toUpperCase() })}
                          autoCapitalize="characters"
                          placeholder="P000000000A"
                          placeholderTextColor="#a1a1aa"
                          className="bg-white border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-3"
                        />
                        <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">eTIMS Invoice *</Text>
                        <TextInput
                          value={newPayee.etimsInvoiceNumber}
                          onChangeText={(t) => setNewPayee({ ...newPayee, etimsInvoiceNumber: t })}
                          placeholder="INV-123"
                          placeholderTextColor="#a1a1aa"
                          className="bg-white border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-3"
                        />
                        <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">Control Unit (CU) *</Text>
                        <TextInput
                          value={newPayee.cuNumber}
                          onChangeText={(t) => setNewPayee({ ...newPayee, cuNumber: t })}
                          placeholder="123456789"
                          placeholderTextColor="#a1a1aa"
                          className="bg-white border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px]"
                        />
                      </View>
                    )}

                    {/* Default Amount */}
                    <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Default Amount (KES)</Text>
                    <TextInput
                      value={newPayee.amount}
                      onChangeText={(t) => setNewPayee({ ...newPayee, amount: t.replace(/[^\d.]/g, '') })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-4"
                    />

                    {/* Payment Method */}
                    <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Settlement Method</Text>
                    <View className="flex-row gap-2 mb-4">
                      {(['Mobile Money', 'Bank'] as PaymentMethod[]).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setNewPayee({ ...newPayee, paymentMethod: m })}
                          className={`flex-1 py-3 rounded-xl items-center ${newPayee.paymentMethod === m ? 'bg-[#00351d]' : 'bg-[#f0fdf4] border border-[#e7ece7]'}`}
                        >
                          <Text className={`font-jakarta-bold text-[12px] ${newPayee.paymentMethod === m ? 'text-white' : 'text-[#404942]'}`}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Mobile money */}
                    {newPayee.paymentMethod === 'Mobile Money' && (
                      <View>
                        <View className="flex-row gap-1.5 mb-3">
                          {(['Personal Number', 'Paybill', 'Buy Goods'] as MobileMoneyType[]).map((mt) => (
                            <TouchableOpacity
                              key={mt}
                              onPress={() => setNewPayee({ ...newPayee, mobileMoneyType: mt })}
                              className={`flex-1 py-2.5 rounded-lg items-center border ${newPayee.mobileMoneyType === mt ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#e7ece7]'}`}
                            >
                              <Text className={`font-jakarta-bold text-[10px] uppercase tracking-wider ${newPayee.mobileMoneyType === mt ? 'text-white' : 'text-[#707971]'}`}>{mt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {newPayee.mobileMoneyType === 'Personal Number' && (
                          <TextInput
                            value={newPayee.phone}
                            onChangeText={(t) => setNewPayee({ ...newPayee, phone: t.replace(/\D/g, '').slice(0, 12) })}
                            keyboardType="phone-pad"
                            placeholder="07XX XXX XXX"
                            placeholderTextColor="#a1a1aa"
                            className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-2"
                          />
                        )}
                        {newPayee.mobileMoneyType === 'Paybill' && (
                          <View className="flex-row gap-2 mb-2">
                            <TextInput
                              value={newPayee.paybillNumber}
                              onChangeText={(t) => setNewPayee({ ...newPayee, paybillNumber: t.replace(/\D/g, '').slice(0, 7) })}
                              keyboardType="numeric"
                              placeholder="Paybill"
                              placeholderTextColor="#a1a1aa"
                              className="flex-1 bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px]"
                            />
                            <TextInput
                              value={newPayee.businessAccount}
                              onChangeText={(t) => setNewPayee({ ...newPayee, businessAccount: t })}
                              placeholder="Account #"
                              placeholderTextColor="#a1a1aa"
                              className="flex-1 bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px]"
                            />
                          </View>
                        )}
                        {newPayee.mobileMoneyType === 'Buy Goods' && (
                          <TextInput
                            value={newPayee.tillNumber}
                            onChangeText={(t) => setNewPayee({ ...newPayee, tillNumber: t.replace(/\D/g, '').slice(0, 8) })}
                            keyboardType="numeric"
                            placeholder="Till Number"
                            placeholderTextColor="#a1a1aa"
                            className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-2"
                          />
                        )}
                      </View>
                    )}

                    {newPayee.paymentMethod === 'Bank' && (
                      <View>
                        <TextInput
                          value={newPayee.bankName}
                          onChangeText={(t) => setNewPayee({ ...newPayee, bankName: t })}
                          placeholder="Bank Name (e.g. KCB)"
                          placeholderTextColor="#a1a1aa"
                          className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-2"
                        />
                        <TextInput
                          value={newPayee.accountNumber}
                          onChangeText={(t) => setNewPayee({ ...newPayee, accountNumber: t.replace(/\D/g, '').slice(0, 14) })}
                          keyboardType="numeric"
                          placeholder="Account Number"
                          placeholderTextColor="#a1a1aa"
                          className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px]"
                        />
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Footer actions */}
              <View className="flex-row gap-2 mt-5">
                {addStep === 2 && (
                  <TouchableOpacity onPress={() => setAddStep(1)} className="px-5 py-3.5 rounded-full bg-[#f0fdf4] border border-[#e7ece7]">
                    <Feather name="arrow-left" size={16} color="#00351d" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => addStep === 1 ? setAddStep(2) : handleSavePayee()}
                  className="flex-1 bg-[#00351d] h-[52px] rounded-full flex-row items-center justify-center"
                >
                  <Text className="text-white font-jakarta-bold text-[14px]">{addStep === 1 ? 'Next' : (editingId ? 'Save Changes' : 'Add Payee')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Invoice Editor Modal ── */}
      <Modal visible={showInvoiceEditor} transparent animationType="slide" onRequestClose={() => setShowInvoiceEditor(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/50">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowInvoiceEditor(false)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] pt-4 mt-auto" style={{ maxHeight: '92%' }}>
              <View className="items-center mb-2"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>

              <View className="flex-row items-center justify-between px-6 mb-4">
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">
                  {invoiceDetails.invoiceNumber ? `Invoice #${invoiceDetails.invoiceNumber}` : 'Create Invoice'}
                </Text>
                <TouchableOpacity onPress={() => setShowInvoiceEditor(false)} className="w-9 h-9 rounded-full bg-[#f7faf7] items-center justify-center">
                  <Feather name="x" size={16} color="#0c2010" />
                </TouchableOpacity>
              </View>

              <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971] mb-4">Customer</Text>
                <View className="gap-4 mb-6">
                  <View>
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Name</Text>
                    <TextInput
                      value={invoiceDetails.customer.name}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, customer: { ...prev.customer, name: t } }))}
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[14px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                  <View>
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Email</Text>
                    <TextInput
                      value={invoiceDetails.customer.email}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, customer: { ...prev.customer, email: t } }))}
                      placeholder="billing@customer.com"
                      placeholderTextColor="#a1a1aa"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[14px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                  <View>
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Phone</Text>
                    <ValidatedTextInput
                      kind="phoneKE"
                      optional
                      value={invoiceDetails.customer.phone}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, customer: { ...prev.customer, phone: t } }))}
                      placeholder="0712 345 678"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[14px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                  <View>
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Address</Text>
                    <TextInput
                      value={invoiceDetails.customer.address}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, customer: { ...prev.customer, address: t } }))}
                      placeholder="Nairobi, Kenya"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[14px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                </View>

                <View className="flex-row gap-4 mb-6">
                  <View className="flex-1">
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Issue Date</Text>
                    <TextInput
                      value={invoiceDetails.issueDate}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, issueDate: t }))}
                      placeholder="YYYY-MM-DD"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[13px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Due Date</Text>
                    <TextInput
                      value={invoiceDetails.dueDate}
                      onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, dueDate: t }))}
                      placeholder="Optional"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[13px] font-jakarta-bold text-[#0c2010]"
                    />
                  </View>
                </View>

                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971]">Items</Text>
                </View>
                <View className="gap-3 mb-3">
                  {invoiceDetails.items.map((item, index) => (
                    <View key={index} className="bg-[#f7faf7] rounded-2xl p-3.5 border border-[#eff4ef]">
                      <TextInput
                        value={item.description}
                        onChangeText={(t) => handleUpdateInvoiceItem(index, 'description', t)}
                        placeholder="Item description"
                        placeholderTextColor="#a1a1aa"
                        className="bg-white border border-[#eff4ef] rounded-xl px-3 py-2.5 text-[13px] font-jakarta-medium text-[#0c2010] mb-2.5"
                      />
                      <View className="flex-row items-center gap-2.5">
                        <View className="flex-1">
                          <Text className="text-[8px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1">Qty</Text>
                          <TextInput
                            value={String(item.qty)}
                            onChangeText={(t) => handleUpdateInvoiceItem(index, 'qty', parseInt(t) || 0)}
                            keyboardType="numeric"
                            className="bg-white border border-[#eff4ef] rounded-xl px-3 py-2 text-[12px] font-jakarta-bold text-[#0c2010] text-center"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[8px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1">Price</Text>
                          <TextInput
                            value={String(item.price)}
                            onChangeText={(t) => handleUpdateInvoiceItem(index, 'price', parseFloat(t) || 0)}
                            keyboardType="numeric"
                            className="bg-white border border-[#eff4ef] rounded-xl px-3 py-2 text-[12px] font-jakarta-bold text-[#0c2010] text-right"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[8px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1">Total</Text>
                          <Text className="text-[12px] font-jakarta-bold text-[#00351d] text-right py-2">{(item.qty * item.price).toLocaleString()}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveInvoiceItem(index)} className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center mt-4">
                          <Feather name="trash-2" size={13} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={handleAddInvoiceItem} className="py-3 rounded-2xl border-2 border-dashed border-[#e7ece7] items-center mb-6">
                  <Text className="text-[12px] font-jakarta-bold text-[#00351d]">+ Add Item</Text>
                </TouchableOpacity>

                <View className="flex-row justify-between items-center border-t border-[#eff4ef] pt-4 mb-6">
                  <Text className="text-[13px] font-jakarta-extrabold uppercase tracking-widest text-[#707971]">Total</Text>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">{fmtInvoiceCurrency(invoiceSubtotal)}</Text>
                </View>

                <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971] mb-3">Settings</Text>
                <View className="mb-4">
                  <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">Notes / Terms</Text>
                  <TextInput
                    value={invoiceDetails.notes}
                    onChangeText={(t) => setInvoiceDetails(prev => ({ ...prev, notes: t }))}
                    placeholder="Payment terms, thank you note..."
                    placeholderTextColor="#a1a1aa"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 text-[13px] font-jakarta-medium text-[#0c2010] min-h-[80px]"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setInvoiceDetails(prev => ({ ...prev, recurring: !prev.recurring }))}
                  className="flex-row items-center gap-3 mb-8"
                >
                  <View className={`w-5 h-5 rounded items-center justify-center border ${invoiceDetails.recurring ? 'bg-[#006c4e] border-[#006c4e]' : 'border-[#bfc9bf]'}`}>
                    {invoiceDetails.recurring && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text className="text-[13px] font-jakarta-bold text-[#0c2010]">Recurring Invoice</Text>
                </TouchableOpacity>

                <View className="flex-row gap-2.5 mb-4">
                  <TouchableOpacity onPress={downloadInvoicePDF} className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-[#e7ece7] rounded-2xl py-3">
                    <Feather name="file-text" size={14} color="#00351d" />
                    <Text className="text-[12px] font-jakarta-bold text-[#00351d]">PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleGenerateLink} className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-[#e7ece7] rounded-2xl py-3">
                    <Feather name="link" size={14} color="#00351d" />
                    <Text className="text-[12px] font-jakarta-bold text-[#00351d]">Link</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View className="flex-row gap-2.5 px-6 pt-3 pb-8 border-t border-[#eff4ef] bg-white">
                <TouchableOpacity
                  onPress={handleSaveDraft}
                  disabled={isSavingInvoice || isSendingInvoice}
                  className="flex-1 py-3.5 rounded-2xl border border-[#e7ece7] items-center"
                  style={{ opacity: isSavingInvoice || isSendingInvoice ? 0.5 : 1 }}
                >
                  {isSavingInvoice ? <ActivityIndicator color="#00351d" size="small" /> : (
                    <Text className="text-[12px] font-jakarta-bold text-[#00351d]">Save Draft</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendInvoice}
                  disabled={isSavingInvoice || isSendingInvoice}
                  className="flex-[1.4] py-3.5 rounded-2xl bg-[#00351d] items-center flex-row justify-center gap-2"
                  style={{ opacity: isSavingInvoice || isSendingInvoice ? 0.5 : 1 }}
                >
                  {isSendingInvoice ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Feather name="send" size={14} color="#fff" />
                      <Text className="text-[12px] font-jakarta-bold text-white">Send Invoice</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Invoice Payment Link Modal ── */}
      <Modal visible={showLinkModal} transparent animationType="slide" onRequestClose={() => setShowLinkModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowLinkModal(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#0c2010]">Invoice Link</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)} className="w-8 h-8 rounded-full bg-[#f7faf7] items-center justify-center">
                <Feather name="x" size={14} color="#0c2010" />
              </TouchableOpacity>
            </View>
            <Text className="text-[#707971] font-jakarta-medium text-[12px] mb-4 leading-relaxed">
              Share this link with your customer to allow them to view and pay this invoice online.
            </Text>
            <View className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl p-4 mb-5">
              <Text className="text-[13px] font-jakarta-bold text-[#0c2010]" numberOfLines={1}>{invoiceDetails.payUrl}</Text>
            </View>
            <TouchableOpacity onPress={handleCopyLink} className="w-full bg-[#e7f8ef] py-3.5 rounded-2xl items-center">
              <Text className="text-[#006c4e] font-jakarta-bold text-[13px]">Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
