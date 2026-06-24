import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'custom';
// Backend type enum: 'inbound' | 'outbound' | 'bulk_pay' | 'settlement' | 'fx_swap'
// Dashboard groups bulk_pay + settlement + outbound under "Outbound"
type TypeFilter = 'all' | 'inbound' | 'outbound' | 'fx_swap';
// Backend status enum: 'pending' | 'completed' | 'failed' | 'verified'
type StatusFilter = 'all' | 'completed' | 'pending' | 'failed';

type Tx = {
  _id: string;
  type: 'inbound' | 'outbound' | 'bulk_pay' | 'settlement' | 'fx_swap';
  status: 'pending' | 'completed' | 'failed' | 'verified';
  amount: number;
  kesAmount: number;
  usdcAmount: number;
  currency: string;
  reference: string;
  sender?: { name?: string; id?: string };
  recipient?: { name?: string; id?: string };
  createdAt: string;
  accountNumber?: string;
};

const isOutboundType = (t: Tx['type']) => t === 'outbound' || t === 'bulk_pay' || t === 'settlement';
const isInboundType = (t: Tx['type']) => t === 'inbound';

const counterpartyName = (tx: Tx): string => {
  if (isInboundType(tx.type)) return tx.sender?.name || 'Unknown';
  return tx.recipient?.name || tx.sender?.name || 'Treasury';
};

const kesValue = (tx: Tx): number => tx.kesAmount || tx.amount || 0;

// Shorten long opaque refs (Stellar tx hashes, etc.) to "ABCDEF…WXYZ" so they
// fit inside a single row. Leaves short, human-readable M-PESA codes alone.
const formatReference = (ref?: string): string => {
  if (!ref) return '';
  if (ref.length <= 14) return ref;
  return `${ref.slice(0, 6)}…${ref.slice(-4)}`;
};

const getDateRange = (filter: DateFilter): { start: Date | null; end: Date | null; label: string } => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (filter) {
    case 'today':
      return { start, end, label: 'Today' };
    case 'yesterday': {
      const y = new Date(start);
      y.setDate(y.getDate() - 1);
      const yEnd = new Date(end);
      yEnd.setDate(yEnd.getDate() - 1);
      return { start: y, end: yEnd, label: 'Yesterday' };
    }
    case 'week': {
      const s = new Date(start);
      s.setDate(s.getDate() - s.getDay());
      return { start: s, end, label: 'This Week' };
    }
    case 'last7': {
      const s = new Date(start);
      s.setDate(s.getDate() - 6);
      return { start: s, end, label: 'Last 7 Days' };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end, label: 'This Month' };
    }
    case 'last30': {
      const s = new Date(start);
      s.setDate(s.getDate() - 29);
      return { start: s, end, label: 'Last 30 Days' };
    }
    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s, end, label: 'This Year' };
    }
    default:
      return { start: null, end: null, label: 'All Time' };
  }
};

export default function Collections() {
  const { merchant } = useAuth();
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [activeQuickFilter, setActiveQuickFilter] = useState<'all' | 'today' | 'week' | 'month' | 'inbound' | 'outbound' | 'fx_swap'>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filterDate, setFilterDate] = useState<DateFilter>('all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  // Statement download state
  const [showStatementSheet, setShowStatementSheet] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState<DateFilter>('month');
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/api/transactions');
      // Backend returns either a raw array (res.data is the array)
      // or a wrapped { success, transactions } envelope — handle both.
      const list: Tx[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.transactions)
        ? res.data.transactions
        : [];
      setTransactions(list);
    } catch (error) {
      console.error('Error fetching collections', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (merchant) {
      setIsLoading(true);
      fetchTransactions();
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [merchant]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const initials = merchant?.businessName
    ? merchant.businessName.substring(0, 2).toUpperCase()
    : '??';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

  // Quick filter pill -> turn into active filter set
  const quickFilterApplied = useMemo(() => {
    const map: Record<typeof activeQuickFilter, { date: DateFilter; type: TypeFilter }> = {
      all: { date: 'all', type: 'all' },
      today: { date: 'today', type: 'all' },
      week: { date: 'week', type: 'all' },
      month: { date: 'month', type: 'all' },
      inbound: { date: 'all', type: 'inbound' },
      outbound: { date: 'all', type: 'outbound' },
      fx_swap: { date: 'all', type: 'fx_swap' },
    };
    return map[activeQuickFilter];
  }, [activeQuickFilter]);

  // Effective filters: advanced sheet overrides quick pills when set
  const effectiveDateFilter: DateFilter = filterDate !== 'all' ? filterDate : quickFilterApplied.date;
  const effectiveTypeFilter: TypeFilter = filterType !== 'all' ? filterType : quickFilterApplied.type;

  const matchesTypeFilter = (tx: Tx, filter: TypeFilter): boolean => {
    if (filter === 'all') return true;
    if (filter === 'inbound') return isInboundType(tx.type);
    if (filter === 'outbound') return isOutboundType(tx.type);
    if (filter === 'fx_swap') return tx.type === 'fx_swap';
    return true;
  };

  const matchesStatusFilter = (tx: Tx, filter: StatusFilter): boolean => {
    if (filter === 'all') return true;
    // Dashboard treats 'verified' as completed-equivalent
    if (filter === 'completed') return tx.status === 'completed' || tx.status === 'verified';
    return tx.status === filter;
  };

  const filteredTransactions = useMemo(() => {
    const range = getDateRange(effectiveDateFilter);
    const minAmt = parseFloat(filterMinAmount) || 0;
    const maxAmt = parseFloat(filterMaxAmount) || Infinity;
    const searchStr = searchQuery.toLowerCase().trim();

    return transactions.filter((tx) => {
      // Search
      if (searchStr) {
        const senderMatch = (tx.sender?.name || '').toLowerCase().includes(searchStr);
        const recipientMatch = (tx.recipient?.name || '').toLowerCase().includes(searchStr);
        const refMatch = (tx.reference || '').toLowerCase().includes(searchStr);
        const amountMatch = kesValue(tx).toString().includes(searchStr);
        if (!senderMatch && !recipientMatch && !refMatch && !amountMatch) return false;
      }
      // Date range
      if (range.start && range.end) {
        const txDate = new Date(tx.createdAt);
        if (txDate < range.start || txDate > range.end) return false;
      }
      // Type
      if (!matchesTypeFilter(tx, effectiveTypeFilter)) return false;
      // Status
      if (!matchesStatusFilter(tx, filterStatus)) return false;
      // Amount range (against KES value)
      const amt = kesValue(tx);
      if (amt < minAmt || amt > maxAmt) return false;
      return true;
    });
  }, [transactions, searchQuery, effectiveDateFilter, effectiveTypeFilter, filterStatus, filterMinAmount, filterMaxAmount]);

  const advancedFiltersActive =
    filterDate !== 'all' || filterType !== 'all' || filterStatus !== 'all' || filterMinAmount !== '' || filterMaxAmount !== '';

  const resetFilters = () => {
    setFilterDate('all');
    setFilterType('all');
    setFilterStatus('all');
    setFilterMinAmount('');
    setFilterMaxAmount('');
  };

  // Stat cards reflect INBOUND collections — same semantics as the merchant dashboard
  // Transactions page (see merchant-dashboard/src/pages/Transactions.jsx stats block).
  const stats = useMemo(() => {
    const inboundTxs = transactions.filter((tx) => isInboundType(tx.type));
    const inRange = (filter: DateFilter) => {
      const { start, end } = getDateRange(filter);
      if (!start || !end) return inboundTxs;
      return inboundTxs.filter((tx) => {
        const d = new Date(tx.createdAt);
        return d >= start && d <= end;
      });
    };
    const sum = (arr: Tx[]) => arr.reduce((acc, tx) => acc + kesValue(tx), 0);
    const todayTxs = inRange('today');
    const weekTxs = inRange('week');
    const monthTxs = inRange('month');
    return {
      today: { total: sum(todayTxs), count: todayTxs.length },
      week: { total: sum(weekTxs), count: weekTxs.length },
      month: { total: sum(monthTxs), count: monthTxs.length },
      allTime: { total: sum(inboundTxs), count: inboundTxs.length },
    };
  }, [transactions]);

  const typeFilterLabel = (f: TypeFilter): string => {
    if (f === 'inbound') return 'Inbound';
    if (f === 'outbound') return 'Outbound';
    if (f === 'fx_swap') return 'FX Swaps';
    return '';
  };

  const currentListLabel = useMemo(() => {
    if (searchQuery) return `Search Results (${filteredTransactions.length})`;
    const dl = getDateRange(effectiveDateFilter).label;
    const tl = typeFilterLabel(effectiveTypeFilter);
    return tl ? `${dl} • ${tl}` : dl;
  }, [searchQuery, effectiveDateFilter, effectiveTypeFilter, filteredTransactions.length]);

  // -------- STATEMENT PDF --------
  const buildStatementHtml = (period: DateFilter): string => {
    const { start, end, label } = getDateRange(period);
    const periodTxs = transactions.filter((tx) => {
      if (!start || !end) return true;
      const d = new Date(tx.createdAt);
      return d >= start && d <= end;
    });
    const inbound = periodTxs.filter((t) => isInboundType(t.type));
    const outbound = periodTxs.filter((t) => isOutboundType(t.type));
    const swaps = periodTxs.filter((t) => t.type === 'fx_swap');
    const inboundTotal = inbound.reduce((a, t) => a + kesValue(t), 0);
    const outboundTotal = outbound.reduce((a, t) => a + kesValue(t), 0);
    const swapKesTotal = swaps.reduce((a, t) => a + kesValue(t), 0);
    const swapUsdcTotal = swaps.reduce((a, t) => a + (t.usdcAmount || 0), 0);
    const net = inboundTotal - outboundTotal;

    const rangeStr = start && end ? `${formatDate(start)} — ${formatDate(end)}` : 'All time';
    const generatedAt = new Date().toLocaleString('en-KE', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const typeLabel = (t: Tx['type']) => {
      switch (t) {
        case 'inbound': return 'Inbound';
        case 'outbound': return 'Outbound';
        case 'bulk_pay': return 'Bulk Pay';
        case 'settlement': return 'Settlement';
        case 'fx_swap': return 'FX Swap';
        default: return t;
      }
    };

    const rows = periodTxs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((tx, idx) => {
        const d = new Date(tx.createdAt);
        const dateStr = d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
        const inboundRow = isInboundType(tx.type);
        const sign = inboundRow ? '+' : '-';
        const color = inboundRow ? '#006c4e' : '#b3261e';
        const amtText = tx.type === 'fx_swap'
          ? `${tx.usdcAmount || 0} USDC`
          : `${sign} ${formatCurrency(kesValue(tx))}`;
        const amtColor = tx.type === 'fx_swap' ? '#1D4ED8' : color;
        return `
          <tr>
            <td class="num">${idx + 1}</td>
            <td>
              <div class="primary">${esc(dateStr)}</div>
              <div class="muted">${esc(timeStr)}</div>
            </td>
            <td>
              <div class="primary">${esc(counterpartyName(tx))}</div>
              <div class="muted">${esc(tx.reference || '—')}</div>
            </td>
            <td class="type">${esc(typeLabel(tx.type))}</td>
            <td class="status">${esc((tx.status || 'completed').toUpperCase())}</td>
            <td class="amount" style="color: ${amtColor}">${amtText}</td>
          </tr>`;
      })
      .join('');

    const businessName = esc(merchant?.businessName || 'Merchant');
    const tillNumber = esc(merchant?.paybillAccount || '—');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Statement — ${businessName}</title>
<style>
  @page { size: A4; margin: 28mm 18mm 24mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1b1c1a; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0B4D2E; padding-bottom: 18px; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #00351d, #1D9E75); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; letter-spacing: 0.5px; }
  .brand-name { font-size: 20px; font-weight: 700; color: #0B4D2E; letter-spacing: -0.2px; }
  .brand-sub { font-size: 11px; color: #707971; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 22px; color: #1b1c1a; font-weight: 600; letter-spacing: -0.4px; }
  .doc-title .meta { font-size: 11px; color: #707971; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 16px; background: #faf9f6; border-radius: 12px; margin-bottom: 24px; }
  .meta-grid .item .label { font-size: 9px; color: #707971; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
  .meta-grid .item .value { font-size: 12px; color: #1b1c1a; font-weight: 600; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 28px; }
  .summary .card { padding: 14px; border-radius: 12px; border: 1px solid #e9e8e5; }
  .summary .card.primary { background: linear-gradient(135deg, #00351d, #0B4D2E); border: none; color: #fff; }
  .summary .card .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.7; margin-bottom: 6px; }
  .summary .card .val { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
  .summary .card.primary .lbl { opacity: 0.8; color: #c0e5d3; }
  .section-title { font-size: 11px; color: #707971; text-transform: uppercase; letter-spacing: 1.6px; font-weight: 700; margin: 0 0 12px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { text-align: left; padding: 10px 8px; background: #f4f3f0; color: #404942; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e9e8e5; }
  thead th.amount, thead th.num { text-align: right; }
  tbody td { padding: 10px 8px; border-bottom: 1px solid #efeeeb; vertical-align: top; }
  tbody td.num { text-align: right; color: #a1a1aa; font-size: 10px; width: 28px; }
  tbody td.amount { text-align: right; font-weight: 700; font-feature-settings: 'tnum'; }
  tbody td.type { font-size: 10px; color: #404942; }
  tbody td.status { font-size: 10px; color: #006c4e; font-weight: 600; }
  .primary { font-weight: 600; color: #1b1c1a; font-size: 11px; }
  .muted { font-size: 9px; color: #707971; margin-top: 2px; }
  .empty { padding: 40px; text-align: center; color: #707971; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid #e9e8e5; font-size: 9px; color: #707971; line-height: 1.6; }
  .footer .signature { display: flex; justify-content: space-between; margin-top: 18px; font-size: 10px; }
  .footer .signature .col { width: 45%; }
  .footer .signature .col .line { border-top: 1px solid #c0c9c0; margin-top: 28px; padding-top: 4px; color: #404942; font-weight: 600; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; background: #e7f8ef; color: #006c4e; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo">${initials}</div>
      <div>
        <div class="brand-name">${businessName}</div>
        <div class="brand-sub">PayChain · Verified Merchant</div>
      </div>
    </div>
    <div class="doc-title">
      <h1>Account Statement</h1>
      <div class="meta">Generated ${generatedAt}</div>
      <div style="margin-top:6px;"><span class="badge">${label}</span></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="item">
      <div class="label">Account</div>
      <div class="value">${businessName}</div>
    </div>
    <div class="item">
      <div class="label">Till / Paybill</div>
      <div class="value">${tillNumber}</div>
    </div>
    <div class="item">
      <div class="label">Period</div>
      <div class="value">${rangeStr}</div>
    </div>
    <div class="item">
      <div class="label">Currency</div>
      <div class="value">KES (Kenyan Shilling)</div>
    </div>
  </div>

  <div class="summary">
    <div class="card primary">
      <div class="lbl">Net Amount</div>
      <div class="val">${formatCurrency(net)}</div>
    </div>
    <div class="card">
      <div class="lbl">Inbound · ${inbound.length}</div>
      <div class="val" style="color:#006c4e">+ ${formatCurrency(inboundTotal)}</div>
    </div>
    <div class="card">
      <div class="lbl">Outbound · ${outbound.length}</div>
      <div class="val" style="color:#b3261e">- ${formatCurrency(outboundTotal)}</div>
    </div>
    <div class="card">
      <div class="lbl">${swaps.length > 0 ? `FX Swaps · ${swaps.length}` : 'Transactions'}</div>
      <div class="val">${swaps.length > 0 ? `${swapUsdcTotal.toFixed(2)} USDC` : periodTxs.length}</div>
    </div>
  </div>
  ${swaps.length > 0 ? `<div style="font-size:9px;color:#707971;margin-top:-18px;margin-bottom:24px;text-align:right;">Swap volume in KES: ${formatCurrency(swapKesTotal)}</div>` : ''}

  <p class="section-title">Transaction Detail</p>
  ${periodTxs.length === 0
    ? `<div class="empty">No transactions in this period.</div>`
    : `<table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Date</th>
            <th>Counterparty</th>
            <th>Type</th>
            <th>Status</th>
            <th class="amount">Amount (KES)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}

  <div class="footer">
    This statement is computer-generated and serves as a true record of activity on the named account for the period indicated. For queries, contact your PayChain account manager or email support@paychain.co.ke. Verified via Safaricom Daraja API.
    <div class="signature">
      <div class="col">
        <div class="line">PayChain Operations</div>
      </div>
      <div class="col" style="text-align:right">
        <div class="line">Authorised Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const handleDownloadStatement = async () => {
    try {
      setIsGenerating(true);
      const html = buildStatementHtml(statementPeriod);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      setShowStatementSheet(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'PayChain Statement',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Statement Ready', `Saved to: ${uri}`);
      }
    } catch (err: any) {
      console.error('Statement generation failed', err);
      Alert.alert('Unable to generate statement', err?.message || 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openReceipt = (tx: any) => {
    setSelectedTx(tx);
    setShowReceipt(true);
  };

  const QuickPill = ({ value, label }: { value: typeof activeQuickFilter; label: string }) => {
    const active = activeQuickFilter === value;
    return (
      <TouchableOpacity
        onPress={() => setActiveQuickFilter(value)}
        className={`px-6 py-2.5 rounded-full mr-2 ${active ? 'bg-[#00351d] shadow-md shadow-[#00351d]/10' : 'bg-[#e9e8e5]'}`}
      >
        <Text className={`text-[13px] ${active ? 'text-white font-jakarta-bold' : 'text-[#404942] font-jakarta-semibold'}`}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const Choice = ({
    active,
    label,
    onPress,
    icon,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
    icon?: keyof typeof Feather.glyphMap;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`flex-row items-center px-4 py-3 rounded-2xl mr-2 mb-2 border ${
        active ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#e9e8e5]'
      }`}
    >
      {icon && <Feather name={icon} size={14} color={active ? '#a7f3d0' : '#707971'} />}
      <Text className={`${icon ? 'ml-2' : ''} text-[13px] ${active ? 'text-white font-jakarta-bold' : 'text-[#404942] font-jakarta-semibold'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0B4D2E', '#1D9E75']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full pt-[40px] pb-[16px] px-6 z-40 rounded-b-[24px] shadow-sm shadow-[#0b4d2e]/10"
      >
        <View className="w-full max-w-lg mx-auto flex-row items-center justify-between mb-2">
          <View className="flex-row items-center space-x-3 gap-3">
            <TouchableOpacity className="w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30 ml-3">
              <Text className="text-white font-jakarta-bold text-sm">{initials}</Text>
            </TouchableOpacity>
            <View>
              <Text className="text-white text-[20px] font-jakarta-bold tracking-tight leading-tight">Collections</Text>
              <Text className="text-white/70 text-[12px] font-jakarta-medium tracking-wide">Till {merchant?.paybillAccount || 'PENDING'}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowStatementSheet(true)}
            className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/25 mr-3"
          >
            <Feather name="download" size={17} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 z-10 mt-6"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#006c4e"
            colors={['#006c4e']}
          />
        }
      >
        <View className="w-full max-w-lg mx-auto px-4">
          {/* Summary Cards — 2x2 Grid */}
          <View className="flex-row flex-wrap pb-6 pt-2 -mx-1.5">
            <View className="w-1/2 px-1.5 mb-3">
              <LinearGradient
                colors={['#00351d', '#0B4D2E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 shadow-lg shadow-[#00351d]/20"
                style={{ minHeight: 124, borderRadius: 22, overflow: 'hidden' }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="w-9 h-9 rounded-full bg-white/15 items-center justify-center border border-white/20">
                    <Feather name="sun" size={15} color="#a7f3d0" />
                  </View>
                  <View className="bg-white/15 px-2 py-0.5 rounded-full">
                    <Text className="text-[9px] font-jakarta-bold text-white tracking-wider">LIVE</Text>
                  </View>
                </View>
                <Text className="text-[10px] font-jakarta-bold text-white/70 uppercase tracking-[0.12em] mb-1">Today</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-white leading-tight" numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(stats.today.total)}
                </Text>
              </LinearGradient>
            </View>

            <View className="w-1/2 px-1.5 mb-3">
              <View className="bg-white rounded-[22px] p-4 shadow-sm border border-[#c0c9c0]/20" style={{ minHeight: 124 }}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="w-9 h-9 rounded-full bg-[#e7f8ef] items-center justify-center">
                    <Feather name="trending-up" size={15} color="#006c4e" />
                  </View>
                  <Feather name="arrow-up-right" size={14} color="#68dbae" />
                </View>
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-1">This Week</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#1b1c1a] leading-tight" numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(stats.week.total)}
                </Text>
              </View>
            </View>

            <View className="w-1/2 px-1.5">
              <View className="bg-white rounded-[22px] p-4 shadow-sm border border-[#c0c9c0]/20" style={{ minHeight: 124 }}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="w-9 h-9 rounded-full bg-[#fef3e7] items-center justify-center">
                    <Feather name="calendar" size={15} color="#b87333" />
                  </View>
                  <Feather name="arrow-up-right" size={14} color="#d4a574" />
                </View>
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-1">This Month</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#1b1c1a] leading-tight" numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(stats.month.total)}
                </Text>
              </View>
            </View>

            <View className="w-1/2 px-1.5">
              <View className="bg-[#f4f3f0] rounded-[22px] p-4 border border-[#c0c9c0]/30" style={{ minHeight: 124 }}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="w-9 h-9 rounded-full bg-white items-center justify-center shadow-sm">
                    <Feather name="award" size={15} color="#404942" />
                  </View>
                  <View className="w-1.5 h-1.5 rounded-full bg-[#006c4e]" />
                </View>
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-1">All Time</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#1b1c1a] leading-tight" numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(stats.allTime.total)}
                </Text>
              </View>
            </View>
          </View>

          {/* Download Statement CTA */}
          <TouchableOpacity
            onPress={() => setShowStatementSheet(true)}
            activeOpacity={0.85}
            className="flex-row items-center justify-between bg-white rounded-[22px] p-4 mb-5 border border-[#c0c9c0]/20 shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-full bg-[#e7f8ef] items-center justify-center">
                <Feather name="file-text" size={18} color="#006c4e" />
              </View>
              <View>
                <Text className="font-jakarta-bold text-[#1b1c1a] text-[14px]">Download Statement</Text>
                <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5">Choose a period · PDF export</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#707971" />
          </TouchableOpacity>

          {/* Search and Filter Row */}
          <View className="flex-row items-center gap-3 mb-6 px-1">
            <View className="flex-1 flex-row items-center bg-white rounded-full px-4 py-3 shadow-sm border border-[#c0c9c0]/20">
              <Feather name="search" size={18} color="#707971" />
              <TextInput
                className="flex-1 ml-2 text-[#1b1c1a] font-jakarta-medium text-[14px]"
                placeholder="Search transactions..."
                placeholderTextColor="#a1a1aa"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={18} color="#707971" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowFilterSheet(true)}
              className={`w-12 h-12 rounded-full items-center justify-center shadow-sm border ${
                advancedFiltersActive ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#c0c9c0]/20'
              }`}
            >
              <Feather name="sliders" size={18} color={advancedFiltersActive ? '#ffffff' : '#00351d'} />
              {advancedFiltersActive && (
                <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#a7f3d0] border border-white" />
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Pill Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-8 mr-2">
            <QuickPill value="all" label="All" />
            <QuickPill value="today" label="Today" />
            <QuickPill value="week" label="This Week" />
            <QuickPill value="month" label="This Month" />
            <QuickPill value="inbound" label="Inbound" />
            <QuickPill value="outbound" label="Outbound" />
            <QuickPill value="fx_swap" label="FX Swaps" />
          </ScrollView>

          <View className="px-2">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-[0.15em] text-[#707971]">
                {currentListLabel}
              </Text>
              <Text className="text-[11px] font-jakarta-medium text-[#707971]">{filteredTransactions.length} Results</Text>
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#c0c9c0]/10 mb-6">
              {isLoading ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator color="#0B4D2E" />
                </View>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx, index) => {
                  const name = counterpartyName(tx);
                  const inboundRow = isInboundType(tx.type);
                  const isSwap = tx.type === 'fx_swap';
                  const verified = tx.status === 'completed' || tx.status === 'verified';
                  const amountText = isSwap
                    ? `${(tx.usdcAmount || 0).toLocaleString()} USDC`
                    : `${inboundRow ? '+' : '-'} ${formatCurrency(kesValue(tx))}`;
                  const amountColor = isSwap
                    ? 'text-[#1D4ED8]'
                    : inboundRow
                    ? 'text-[#006c4e]'
                    : 'text-[#1b1c1a]';
                  const refText = tx.reference ? formatReference(tx.reference) : tx.type.replace('_', ' ');
                  return (
                    <TouchableOpacity
                      key={tx._id || index}
                      activeOpacity={0.8}
                      onPress={() => openReceipt(tx)}
                      className={`flex-row items-center py-3 px-4 ${
                        index !== filteredTransactions.length - 1 ? 'border-b border-[#efeeeb]/50' : ''
                      }`}
                    >
                      <View className="w-10 h-10 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden mr-3">
                        <Text className="text-[#404942] font-jakarta-bold text-[11px]">
                          {name ? name.substring(0, 2).toUpperCase() : 'TX'}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0 mr-2">
                        <View className="flex-row items-center">
                          <Text
                            className="font-jakarta-bold text-[14px] text-[#1b1c1a] flex-shrink"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {name}
                          </Text>
                          {verified && <MaterialIcons name="verified" size={12} color="#006c4e" style={{ marginLeft: 4 }} />}
                        </View>
                        <Text
                          className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {refText}
                        </Text>
                      </View>
                      <Text
                        className={`font-jakarta-bold text-[13px] ${amountColor}`}
                        numberOfLines={1}
                        style={{ flexShrink: 0 }}
                      >
                        {amountText}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="items-center justify-center py-10">
                  <View className="w-14 h-14 rounded-full bg-[#faf9f6] items-center justify-center mb-3">
                    <Feather name="inbox" size={22} color="#707971" />
                  </View>
                  <Text className="text-[#1b1c1a] font-jakarta-bold text-[14px]">No transactions found</Text>
                  <Text className="text-[#707971] font-jakarta-medium text-[12px] mt-1">Try adjusting your filters or search</Text>
                  {(advancedFiltersActive || activeQuickFilter !== 'all' || searchQuery) && (
                    <TouchableOpacity
                      onPress={() => {
                        resetFilters();
                        setActiveQuickFilter('all');
                        setSearchQuery('');
                      }}
                      className="mt-4 px-5 py-2 rounded-full bg-[#e7f8ef]"
                    >
                      <Text className="text-[#006c4e] font-jakarta-bold text-[12px]">Clear filters</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Advanced Filter Sheet */}
      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowFilterSheet(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl" style={{ maxHeight: '90%' }}>
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-[#e9e8e5] rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-5">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#1b1c1a]">Filter Transactions</Text>
              <TouchableOpacity onPress={resetFilters}>
                <Text className="text-[12px] font-jakarta-bold text-[#006c4e] uppercase tracking-wider">Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Date Range</Text>
              <View className="flex-row flex-wrap mb-5">
                <Choice active={filterDate === 'all'} label="All Time" onPress={() => setFilterDate('all')} icon="globe" />
                <Choice active={filterDate === 'today'} label="Today" onPress={() => setFilterDate('today')} icon="sun" />
                <Choice active={filterDate === 'yesterday'} label="Yesterday" onPress={() => setFilterDate('yesterday')} icon="clock" />
                <Choice active={filterDate === 'week'} label="This Week" onPress={() => setFilterDate('week')} icon="calendar" />
                <Choice active={filterDate === 'last7'} label="Last 7 Days" onPress={() => setFilterDate('last7')} icon="trending-up" />
                <Choice active={filterDate === 'month'} label="This Month" onPress={() => setFilterDate('month')} icon="calendar" />
                <Choice active={filterDate === 'last30'} label="Last 30 Days" onPress={() => setFilterDate('last30')} icon="bar-chart-2" />
                <Choice active={filterDate === 'year'} label="This Year" onPress={() => setFilterDate('year')} icon="award" />
              </View>

              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Direction</Text>
              <View className="flex-row flex-wrap mb-5">
                <Choice active={filterType === 'all'} label="All" onPress={() => setFilterType('all')} />
                <Choice active={filterType === 'inbound'} label="Inbound" onPress={() => setFilterType('inbound')} icon="arrow-down-left" />
                <Choice active={filterType === 'outbound'} label="Outbound" onPress={() => setFilterType('outbound')} icon="arrow-up-right" />
                <Choice active={filterType === 'fx_swap'} label="FX Swaps" onPress={() => setFilterType('fx_swap')} icon="refresh-cw" />
              </View>

              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Status</Text>
              <View className="flex-row flex-wrap mb-5">
                <Choice active={filterStatus === 'all'} label="Any" onPress={() => setFilterStatus('all')} />
                <Choice active={filterStatus === 'completed'} label="Completed" onPress={() => setFilterStatus('completed')} icon="check-circle" />
                <Choice active={filterStatus === 'pending'} label="Pending" onPress={() => setFilterStatus('pending')} icon="clock" />
                <Choice active={filterStatus === 'failed'} label="Failed" onPress={() => setFilterStatus('failed')} icon="x-circle" />
              </View>

              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Amount Range (KES)</Text>
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 bg-[#faf9f6] rounded-2xl px-4 py-3 border border-[#e9e8e5]">
                  <Text className="text-[9px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1">Min</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#a1a1aa"
                    value={filterMinAmount}
                    onChangeText={setFilterMinAmount}
                    className="text-[#1b1c1a] font-jakarta-bold text-[15px]"
                  />
                </View>
                <View className="flex-1 bg-[#faf9f6] rounded-2xl px-4 py-3 border border-[#e9e8e5]">
                  <Text className="text-[9px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1">Max</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="No limit"
                    placeholderTextColor="#a1a1aa"
                    value={filterMaxAmount}
                    onChangeText={setFilterMaxAmount}
                    className="text-[#1b1c1a] font-jakarta-bold text-[15px]"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowFilterSheet(false)}
              className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
            >
              <Text className="text-white font-jakarta-bold text-[15px]">Apply Filters ({filteredTransactions.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Statement Download Sheet */}
      <Modal visible={showStatementSheet} transparent animationType="slide" onRequestClose={() => setShowStatementSheet(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowStatementSheet(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-[#e9e8e5] rounded-full" />
            </View>

            <View className="items-center mb-2">
              <View className="w-14 h-14 rounded-full bg-[#e7f8ef] items-center justify-center mb-3">
                <Feather name="file-text" size={22} color="#006c4e" />
              </View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[26px] text-[#1b1c1a]">Download Statement</Text>
              <Text className="text-[13px] font-jakarta-medium text-[#707971] mt-1 text-center">
                Select a period — we'll prepare a premium PDF
              </Text>
            </View>

            <View className="mt-6 mb-2">
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-3">Period</Text>
              <View className="flex-row flex-wrap">
                <Choice active={statementPeriod === 'today'} label="Today" onPress={() => setStatementPeriod('today')} icon="sun" />
                <Choice active={statementPeriod === 'week'} label="This Week" onPress={() => setStatementPeriod('week')} icon="calendar" />
                <Choice active={statementPeriod === 'last7'} label="Last 7 Days" onPress={() => setStatementPeriod('last7')} icon="trending-up" />
                <Choice active={statementPeriod === 'month'} label="This Month" onPress={() => setStatementPeriod('month')} icon="calendar" />
                <Choice active={statementPeriod === 'last30'} label="Last 30 Days" onPress={() => setStatementPeriod('last30')} icon="bar-chart-2" />
                <Choice active={statementPeriod === 'year'} label="This Year" onPress={() => setStatementPeriod('year')} icon="award" />
                <Choice active={statementPeriod === 'all'} label="All Time" onPress={() => setStatementPeriod('all')} icon="globe" />
              </View>
            </View>

            <View className="bg-[#faf9f6] rounded-[20px] p-4 mb-6 mt-2 border border-[#e9e8e5]">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Period</Text>
                <Text className="text-[12px] font-jakarta-bold text-[#1b1c1a]">{getDateRange(statementPeriod).label}</Text>
              </View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Format</Text>
                <Text className="text-[12px] font-jakarta-bold text-[#1b1c1a]">PDF · A4</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Account</Text>
                <Text className="text-[12px] font-jakarta-bold text-[#1b1c1a]" numberOfLines={1}>{merchant?.businessName || '—'}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDownloadStatement}
              disabled={isGenerating}
              className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
              style={{ opacity: isGenerating ? 0.7 : 1 }}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="download" size={17} color="#fff" />
                  <Text className="text-white font-jakarta-bold text-[15px] ml-2">Generate & Share</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStatementSheet(false)} className="items-center py-3 mt-2">
              <Text className="text-[#707971] font-jakarta-semibold text-[13px]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Receipt Modal */}
      <Modal visible={showReceipt} transparent animationType="slide" onRequestClose={() => setShowReceipt(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowReceipt(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[40px] px-6 pt-4 pb-10 items-center mt-auto shadow-2xl">
            <View className="w-12 h-1.5 bg-[#e9e8e5] rounded-full mb-8" />

            <View className="w-16 h-16 rounded-full bg-[#e7f8ef] items-center justify-center mb-6">
              <MaterialIcons name="verified" size={32} color="#006c4e" />
            </View>

            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-3xl text-[#1b1c1a] mb-2">Payment Verified</Text>
            <Text className="text-[15px] font-jakarta-medium text-[#707971] mb-8">Transaction settled successfully</Text>

            <View className="w-full bg-[#faf9f6] rounded-[32px] p-6 mb-8">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Amount</Text>
                <Text className="text-[17px] font-jakarta-bold text-[#1b1c1a]">
                  {selectedTx?.type === 'fx_swap'
                    ? `${(selectedTx?.usdcAmount || 0).toLocaleString()} USDC`
                    : formatCurrency(selectedTx ? kesValue(selectedTx) : 0)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">
                  {selectedTx && isInboundType(selectedTx.type) ? 'From' : 'To'}
                </Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]" numberOfLines={1}>
                  {selectedTx ? counterpartyName(selectedTx) : 'Unknown'}
                </Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Reference</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]" numberOfLines={1}>{selectedTx?.reference || '—'}</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Type</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a] capitalize">{selectedTx?.type?.replace('_', ' ') || '—'}</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Status</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#006c4e] capitalize">{selectedTx?.status || '—'}</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Till Number</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]">{selectedTx?.accountNumber || merchant?.paybillAccount || '—'}</Text>
              </View>

              <View className="w-full h-[1px] bg-[#e9e8e5] mb-5" />

              <View className="flex-row items-center gap-3">
                <Feather name="zap" size={18} color="#006c4e" />
                <View>
                  <Text className="font-jakarta-bold text-[#1b1c1a] text-[13px] mb-0.5">Verified via Safaricom Daraja API</Text>
                  <Text className="text-[#707971] text-[11px] font-jakarta-medium">
                    {selectedTx ? new Date(selectedTx.createdAt).toLocaleString('en-KE') : ''}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              className="w-full bg-[#00351d] h-[60px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
              onPress={() => setShowReceipt(false)}
            >
              <Text className="text-white font-jakarta-bold text-[17px]">Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
