import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../context/AuthContext';
import { isCreditTransaction, isDebitTransaction, typeLabel as txTypeLabel, netBalanceImpact, excludeReversedDuplicates } from '../utils/transactionDirection';
import { formatTxDate, formatTxTime } from '../utils/formatDate';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';
import { buildAuditReceiptHtml } from '../utils/auditReceiptHtml';
import { formatName } from '../utils/formatName';
import { buildStatementHtml } from '../utils/statementHtml';
import { InlineDatePicker } from '../components/InlineDatePicker';
import TourTarget from '../components/TourTarget';

const EXPORT_PRESETS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom Range' },
] as const;
type ExportPreset = typeof EXPORT_PRESETS[number]['key'];

const ITEMS_PER_PAGE = 20;
const FILTER_TABS = ['All', 'Inbound', 'Outbound', 'FX Swaps'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatKES(amount: number) {
  return `Ksh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Summary stat cards config ────────────────────────────────────────────────
const STAT_CARD_STYLES = [
  {
    // Today – dark anchor card
    containerStyle: { backgroundColor: '#00351d' },
    labelColor: '#5efeb3',
    valueColor: '#ffffff',
    subLabelColor: 'rgba(177,241,198,0.6)',
    icon: 'today',
    iconColor: '#5efeb3',
    accent: '#05c46b',
  },
  {
    // This Week – sage green
    containerStyle: { backgroundColor: '#f0fdf4' },
    labelColor: '#006c4e',
    valueColor: '#00351d',
    subLabelColor: '#6b7280',
    icon: 'calendar_view_week',
    iconColor: '#006c4e',
    accent: '#5efeb3',
  },
  {
    // This Month – cream
    containerStyle: { backgroundColor: '#ffffff' },
    labelColor: '#006c4e',
    valueColor: '#00351d',
    subLabelColor: '#6b7280',
    icon: 'calendar_month',
    iconColor: '#006c4e',
    accent: '#5efeb3',
  },
  {
    // All Time – deep forest
    containerStyle: { backgroundColor: '#002110' },
    labelColor: '#5efeb3',
    valueColor: '#ffffff',
    subLabelColor: 'rgba(177,241,198,0.5)',
    icon: 'all_inclusive',
    iconColor: '#5efeb3',
    accent: '#05c46b',
  },
];

export default function Transactions({ navigation }: any) {
  const { merchant } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

  // ─── Statement export ──────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPreset, setExportPreset] = useState<ExportPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get('/api/transactions');
      // Drops any duplicate-credit + its correction entry as a matched pair
      // at the source, so every downstream stat in this file is
      // automatically clean — see excludeReversedDuplicates' doc comment.
      if (res.data.success) {
        setTransactions(excludeReversedDuplicates(res.data.transactions || []));
      } else if (Array.isArray(res.data)) {
        // Fallback: some endpoints return array directly
        setTransactions(excludeReversedDuplicates(res.data));
      }
    } catch (error) {
      console.error('Error fetching transactions', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Keep the list live, matching the dashboard's identical 5s poll
  // (Transactions.jsx) — previously this only ever fetched once on mount,
  // so a new payment never appeared until the merchant left and re-entered
  // the screen.
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  useFocusEffect(useCallback(() => { fetchTransactions(); }, [fetchTransactions]));

  // ─── Stats calculation (mirroring merchant dashboard) ─────────────────────
  const inboundTxs = transactions.filter(t => isCreditTransaction(t.type));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 7);
  const monthStart = new Date(todayStart); monthStart.setMonth(todayStart.getMonth() - 1);

  // Math.abs(netBalanceImpact(t)) instead of the raw amount field —
  // inboundTxs is already filtered to credit types above, so this only
  // corrects the magnitude for unsettled rows and the NCBA gross/fee
  // mismatch (see netBalanceImpact's doc comment in
  // utils/transactionDirection.ts). A raw sum counted a failed/pending row
  // as real revenue and overstated ncba_inbound rows by a fee that never
  // actually reached the merchant's balance.
  const getAmt = (t: any) => Math.abs(netBalanceImpact(t));

  const stats = {
    today:   inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= todayStart).reduce((s, t) => s + getAmt(t), 0),
    week:    inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= weekStart).reduce((s, t) => s + getAmt(t), 0),
    month:   inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= monthStart).reduce((s, t) => s + getAmt(t), 0),
    allTime: inboundTxs.reduce((s, t) => s + getAmt(t), 0),
  };

  const statCards = [
    { label: 'Today',      value: stats.today,   style: STAT_CARD_STYLES[0] },
    { label: 'This Week',  value: stats.week,    style: STAT_CARD_STYLES[1] },
    { label: 'This Month', value: stats.month,   style: STAT_CARD_STYLES[2] },
    { label: 'All Time',   value: stats.allTime, style: STAT_CARD_STYLES[3] },
  ];

  // ─── Search + type filter (mirrors the dashboard's identical logic) ───────
  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      (t.sender?.name || '').toLowerCase().includes(q) ||
      (t.recipient?.name || '').toLowerCase().includes(q) ||
      (t.reference || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Inbound') return isCreditTransaction(t.type);
    if (activeFilter === 'Outbound') return isDebitTransaction(t.type);
    if (activeFilter === 'FX Swaps') return t.type === 'fx_swap';
    return true;
  });

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTransactions = filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilter]);

  const handleNext = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
  const handlePrev = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

  // ─── Statement export (mirrors the dashboard's identical period logic
  // in Transactions.jsx's resolveExportRange/handleExport) ────────────────
  const resolveExportRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

    if (exportPreset === '7d') {
      const from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      return { from, to: endOfToday };
    }
    if (exportPreset === '30d') {
      const from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
      return { from, to: endOfToday };
    }
    if (exportPreset === 'month') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    }
    if (exportPreset === 'year') {
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday };
    }
    if (exportPreset === 'custom') {
      const fromDate = customFrom ? new Date(customFrom) : null;
      const toDate = customTo ? new Date(customTo) : null;
      const from = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0) : null;
      const to = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59) : endOfToday;
      return { from, to };
    }
    return { from: null, to: null }; // All Time
  };

  const formatPeriodLabel = (from: Date | null, to: Date | null) => {
    const fmt = (d: Date) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!from && !to) return 'All transactions';
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `From ${fmt(from)}`;
    return `Up to ${fmt(to as Date)}`;
  };

  const confirmExport = async () => {
    const { from, to } = resolveExportRange();

    if (exportPreset === 'custom' && from && to && from > to) {
      Alert.alert('Invalid Range', 'The "from" date must be before the "to" date.');
      return;
    }

    const rows = transactions.filter((t) => {
      const d = new Date(t.createdAt || t.timestamp);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    if (rows.length === 0) {
      Alert.alert('No Transactions', 'No transactions were found in the selected period.');
      return;
    }

    setIsExporting(true);
    try {
      const periodLabel = formatPeriodLabel(from, to);
      const html = buildStatementHtml({
        rows,
        allTransactions: transactions,
        merchant,
        periodLabel,
        periodEnd: to,
        currentBalance: merchant?.kesBalance || 0,
      });
      const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
      setShowExportModal(false);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'PayChain Statement', UTI: 'com.adobe.pdf' });
      }

      if (base64) {
        try {
          await api.post('/api/transactions/statement/email', {
            pdfBase64: base64,
            periodLabel,
            filename: `PayChain-Statement-${new Date().toISOString().slice(0, 10)}.pdf`,
          });
        } catch (err) {
          console.error('Failed to email statement:', err);
          Alert.alert('Email Failed', 'The statement downloaded fine, but we could not email you a copy.');
        }
      }
    } catch (err: any) {
      console.error('Statement export failed', err);
      Alert.alert('Export Failed', err?.message || 'Could not generate the statement. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateAuditReceipt = async () => {
    if (!selectedTx) return;
    try {
      setIsGeneratingReceipt(true);
      const html = buildAuditReceiptHtml(selectedTx);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'PayChain Audit Receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Receipt Ready', `Saved to: ${uri}`);
      }
    } catch (err: any) {
      console.error('Audit receipt generation failed', err);
      Alert.alert('Unable to generate receipt', err?.message || 'Please try again.');
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Transactions" subtitle="Full payment history" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View className="w-full max-w-lg mx-auto px-6 pt-6">

          {/* ── Premium Summary Cards ──────────────────────────────────────── */}
          <View className="mb-8">
            <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-[0.2em] mb-4">
              Collection Summary
            </Text>

            {/* Top row: Today (wide) */}
            <View
              className="rounded-[28px] p-6 mb-3 shadow-sm overflow-hidden"
              style={statCards[0].style.containerStyle}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(177,241,198,0.2)' }}>
                      <MaterialIcons name="today" size={15} color={statCards[0].style.iconColor} />
                    </View>
                    <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.15em]" style={{ color: statCards[0].style.labelColor }}>
                      Today
                    </Text>
                  </View>
                  <Text
                    className="font-jakarta-extrabold text-[34px] tracking-tight leading-none"
                    style={{ color: statCards[0].style.valueColor }}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {formatKES(statCards[0].value)}
                  </Text>
                  <Text className="text-[12px] font-jakarta-medium mt-2" style={{ color: statCards[0].style.subLabelColor }}>
                    {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                </View>
                {/* Decorative icon */}
                <View className="opacity-10 -mr-2 -mt-2">
                  <MaterialIcons name="today" size={72} color="#ffffff" />
                </View>
              </View>
            </View>

            {/* Bottom row: Week / Month / All Time */}
            <View className="flex-row gap-3">
              {statCards.slice(1).map((card, idx) => (
                <View
                  key={card.label}
                  className="flex-1 rounded-[24px] p-5 shadow-sm border border-[#bfc9bf]/10 overflow-hidden"
                  style={card.style.containerStyle}
                >
                  <View className="w-8 h-8 rounded-full items-center justify-center mb-3" style={{ backgroundColor: idx === 2 ? '#002110' : '#e7f8ef' }}>
                    <MaterialIcons
                      name={idx === 0 ? 'date-range' : idx === 1 ? 'calendar-today' : 'all-inclusive'}
                      size={16}
                      color={card.style.iconColor}
                    />
                  </View>
                  <Text
                    className="font-jakarta-extrabold text-[18px] tracking-tight leading-none mb-1"
                    style={{ color: card.style.valueColor }}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {formatKES(card.value)}
                  </Text>
                  <Text className="text-[10px] font-jakarta-bold uppercase tracking-[0.1em]" style={{ color: card.style.labelColor }}>
                    {card.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Transaction List ───────────────────────────────────────────── */}
          <TourTarget id="transactions-list-header" className="flex-row items-center justify-between mb-4">
            <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-[0.2em]">
              All Transactions
            </Text>
            <TourTarget id="export-statement-btn">
            <TouchableOpacity
              onPress={() => setShowExportModal(true)}
              className="flex-row items-center gap-1.5 bg-white border border-[#bfc9bf]/20 px-3 py-1.5 rounded-full"
            >
              <Feather name="download" size={12} color="#00351d" />
              <Text className="text-[#00351d] text-[10px] font-jakarta-extrabold uppercase tracking-wider">Statement</Text>
            </TouchableOpacity>
            </TourTarget>
          </TourTarget>

          <View className="flex-row items-center gap-2 bg-white rounded-2xl border border-[#bfc9bf]/10 px-4 py-3 mb-3">
            <Feather name="search" size={15} color="#a1a1aa" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or reference"
              placeholderTextColor="#a1a1aa"
              className="flex-1 text-[13px] font-jakarta-medium text-[#0c2010]"
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={15} color="#a1a1aa" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-6 px-6">
            <View className="flex-row gap-2">
              {FILTER_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveFilter(tab)}
                  className={`px-4 py-2 rounded-full border ${activeFilter === tab ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
                >
                  <Text className={`text-[11px] font-jakarta-bold ${activeFilter === tab ? 'text-white' : 'text-[#707971]'}`}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View className="bg-white rounded-[28px] shadow-sm border border-[#bfc9bf]/10 mb-6 overflow-hidden">
            {isLoading ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator color="#00351d" size="large" />
                <Text className="text-[#707971] font-jakarta-medium text-[13px] mt-3">Loading…</Text>
              </View>
            ) : currentTransactions.length === 0 ? (
              <View className="py-20 items-center justify-center px-8">
                <View className="w-16 h-16 rounded-full bg-[#eff4ef] items-center justify-center mb-4">
                  <MaterialIcons name="receipt-long" size={28} color="#707971" />
                </View>
                <Text className="text-[#0c2010] font-jakarta-bold text-[16px] mb-1">
                  {searchQuery || activeFilter !== 'All' ? 'No matching transactions' : 'No transactions yet'}
                </Text>
                <Text className="text-[#707971] font-jakarta-medium text-[13px] text-center leading-relaxed">
                  {searchQuery || activeFilter !== 'All'
                    ? 'Try a different search term or filter.'
                    : 'Inbound payments to your account will appear here.'}
                </Text>
              </View>
            ) : (
              currentTransactions.map((tx, index) => {
                const isInbound = isCreditTransaction(tx.type);
                const isSwap = tx.type === 'fx_swap';
                const name = isInbound
                  ? (formatName(tx.sender?.name) || 'Unknown')
                  : (formatName(tx.recipient?.name) || formatName(tx.sender?.name) || 'Treasury');
                const verified = tx.status === 'completed' || tx.status === 'verified';
                // A failed payout is always refunded in full — without this,
                // it showed with the exact same solid debit color as a real
                // completed one, making it look like money had actually left
                // when net balance impact was zero.
                const isFailed = tx.status === 'failed';
                const typeLabel = txTypeLabel(tx.type || 'inbound').toUpperCase();
                const dateStr = formatTxDate(tx.createdAt || tx.timestamp);
                const timeStr = formatTxTime(tx.createdAt || tx.timestamp);
                const phoneStr = formatPhoneDisplay(tx.sender?.id || tx.recipient?.id);
                return (
                  <TouchableOpacity
                    key={tx._id || index}
                    activeOpacity={0.7}
                    onPress={() => setSelectedTx(tx)}
                    className={`flex-row items-center py-4 px-5 ${
                      index !== currentTransactions.length - 1 ? 'border-b border-[#eff4ef]/60' : ''
                    }`}
                  >
                    <View className="w-11 h-11 rounded-full bg-[#eff4ef] items-center justify-center mr-3">
                      <Text className="text-[#404942] font-jakarta-bold text-[12px]">
                        {name ? name.substring(0, 2).toUpperCase() : 'TX'}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0 mr-2">
                      <View className="flex-row items-center">
                        <Text className="font-jakarta-bold text-[14px] text-[#0c2010] flex-shrink" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
                        {verified && <MaterialIcons name="verified" size={12} color="#006c4e" style={{ marginLeft: 4 }} />}
                      </View>
                      <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                        {dateStr}, {timeStr} · {typeLabel}
                      </Text>
                      {isFailed ? (
                        <Text className="text-[#b91c1c] text-[10px] font-jakarta-bold mt-0.5 uppercase tracking-wider">Failed & Refunded</Text>
                      ) : !!phoneStr && (
                        <Text className="text-[#707971]/70 text-[10px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                          {phoneStr}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={`font-jakarta-bold text-[14px] ${
                        isFailed ? 'text-[#707971] line-through' : isSwap ? 'text-[#1D4ED8]' : isInbound ? 'text-[#006c4e]' : 'text-[#0c2010]'
                      }`}
                      numberOfLines={1}
                      style={{ flexShrink: 0 }}
                    >
                      {isSwap
                        ? `${(tx.usdcAmount || 0).toLocaleString()} USDC`
                        : `${isInbound ? '+' : '-'} ${formatKES(tx.kesAmount || tx.amount || 0)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {!isLoading && filteredTransactions.length > ITEMS_PER_PAGE && (
            <View className="flex-row items-center justify-between bg-white p-4 rounded-[24px] shadow-sm border border-[#bfc9bf]/10">
              <TouchableOpacity
                onPress={handlePrev}
                disabled={currentPage === 1}
                className={`flex-row items-center px-4 py-2.5 rounded-full gap-1 ${currentPage === 1 ? 'opacity-40' : 'bg-[#e7f8ef]'}`}
              >
                <Feather name="chevron-left" size={16} color={currentPage === 1 ? '#a1a1aa' : '#006c4e'} />
                <Text className={`font-jakarta-bold text-[12px] ${currentPage === 1 ? 'text-[#a1a1aa]' : 'text-[#006c4e]'}`}>Prev</Text>
              </TouchableOpacity>

              <Text className="text-[#707971] text-[12px] font-jakarta-bold">
                Page {currentPage} of {totalPages}
              </Text>

              <TouchableOpacity
                onPress={handleNext}
                disabled={currentPage === totalPages}
                className={`flex-row items-center px-4 py-2.5 rounded-full gap-1 ${currentPage === totalPages ? 'opacity-40' : 'bg-[#e7f8ef]'}`}
              >
                <Text className={`font-jakarta-bold text-[12px] ${currentPage === totalPages ? 'text-[#a1a1aa]' : 'text-[#006c4e]'}`}>Next</Text>
                <Feather name="chevron-right" size={16} color={currentPage === totalPages ? '#a1a1aa' : '#006c4e'} />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Transaction Detail (mirrors merchant-dashboard's side-slide drawer) ── */}
      <Modal visible={!!selectedTx} transparent animationType="slide" onRequestClose={() => setSelectedTx(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setSelectedTx(null)} />
          {selectedTx && (() => {
            const isInbound = isCreditTransaction(selectedTx.type);
            const isSwap = selectedTx.type === 'fx_swap';
            // A failed payout is always refunded in full — without this, it
            // showed with the exact same solid debit color and a green
            // "Network Status" pill as a real completed one, making it look
            // like money had actually left when net balance impact was zero.
            const isFailedTx = selectedTx.status === 'failed';
            const amountColor = isFailedTx ? '#9aa39c' : isSwap ? '#1D4ED8' : isInbound ? '#006c4e' : '#0c2010';
            const amountStr = isSwap
              ? `${(selectedTx.usdcAmount || 0).toLocaleString()} USDC`
              : `${isInbound ? '+' : '-'} ${formatKES(selectedTx.kesAmount || selectedTx.amount || 0)}`;
            const statusPillColor = isFailedTx ? '#f87171' : (selectedTx.status === 'completed' || selectedTx.status === 'verified') ? '#5efeb3' : '#fbbf24';
            const counterpartyName = isInbound
              ? (formatName(selectedTx.sender?.name) || 'Unknown')
              : (formatName(selectedTx.recipient?.name) || formatName(selectedTx.sender?.name) || 'Internal Treasury');
            const counterpartyPhone = formatPhoneDisplay(selectedTx.sender?.id || selectedTx.recipient?.id);

            return (
              <View className="w-full max-w-lg mx-auto bg-[#162723] rounded-t-[36px] px-6 pt-4 pb-8 mt-auto max-h-[85%]">
                <View className="items-center mb-4"><View className="w-12 h-1.5 bg-white/15 rounded-full" /></View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="items-center mb-6">
                    <Text className="text-white font-jakarta-extrabold text-[18px] uppercase tracking-[0.1em]">Transaction Details</Text>
                    <Text className="text-white/40 text-[10px] font-jakarta-bold mt-3 tracking-[0.15em] uppercase">
                      Reference ID: {selectedTx.reference}
                    </Text>
                  </View>

                  <View className="mb-6">
                    <Text className="text-white/40 text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Settlement</Text>
                    <Text
                      className="text-[30px] font-jakarta-extrabold tracking-tight"
                      style={{
                        color: amountColor === '#0c2010' ? '#ffffff' : amountColor,
                        textDecorationLine: isFailedTx ? 'line-through' : 'none',
                      }}
                    >
                      {amountStr}
                    </Text>
                    {isFailedTx && (
                      <Text className="text-[#f87171] text-[11px] font-jakarta-bold mt-2">This payout failed and the full amount was refunded to your balance.</Text>
                    )}
                  </View>

                  <View className="mb-6 pt-5 border-t border-white/10">
                    <Text className="text-white/40 text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Network Status</Text>
                    <View className="self-start flex-row items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${statusPillColor}1A`, borderWidth: 1, borderColor: `${statusPillColor}33` }}>
                      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: statusPillColor }} />
                      <Text style={{ color: statusPillColor }} className="text-[11px] font-jakarta-extrabold uppercase tracking-widest">{isFailedTx ? 'Failed & Refunded' : selectedTx.status}</Text>
                    </View>
                  </View>

                  <View className="mb-6 pt-5 border-t border-white/10">
                    <Text className="text-white/40 text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Counterparty</Text>
                    <Text className="text-white font-jakarta-bold text-[16px]">{counterpartyName}</Text>
                    {!!counterpartyPhone && (
                      <Text className="text-white/40 text-[10px] font-jakarta-bold mt-1 uppercase tracking-widest">{counterpartyPhone}</Text>
                    )}
                  </View>

                  <View className="mb-6 pt-5 border-t border-white/10">
                    <Text className="text-white/40 text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Timestamp</Text>
                    <Text className="text-white/70 text-[12px] font-jakarta-bold uppercase tracking-widest">
                      {formatTxDate(selectedTx.createdAt || selectedTx.timestamp)} · {formatTxTime(selectedTx.createdAt || selectedTx.timestamp)}
                    </Text>
                  </View>

                  {selectedTx.balanceAfter != null && (
                    <View className="mb-6 pt-5 border-t border-white/10">
                      <Text className="text-white/40 text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Balance After</Text>
                      <Text className="text-white font-jakarta-bold text-[16px]">{formatKES(selectedTx.balanceAfter)}</Text>
                    </View>
                  )}

                  <View className="pt-6 border-t border-white/10 items-center gap-5">
                    <TouchableOpacity
                      onPress={handleGenerateAuditReceipt}
                      disabled={isGeneratingReceipt}
                      activeOpacity={0.85}
                      className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 flex-row items-center justify-center gap-2"
                      style={{ opacity: isGeneratingReceipt ? 0.6 : 1 }}
                    >
                      {isGeneratingReceipt ? <ActivityIndicator color="#5efeb3" size="small" /> : (
                        <>
                          <MaterialIcons name="receipt-long" size={16} color="#5efeb3" />
                          <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Generate Audit Receipt</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedTx(null)} activeOpacity={0.7}>
                      <Text className="text-white/40 font-jakarta-extrabold text-[10px] uppercase tracking-[0.15em]">Done</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ── Statement Export ── */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => !isExporting && setShowExportModal(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto max-h-[85%]">
            <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="font-jakarta-extrabold text-[20px] text-[#0c2010] mb-1">Download Statement</Text>
              <Text className="text-[#707971] font-jakarta-medium text-[13px] mb-6">Choose a period — we'll also email you a copy.</Text>

              <View className="gap-2 mb-2">
                {EXPORT_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setExportPreset(p.key)}
                    className={`flex-row items-center justify-between px-4 py-3.5 rounded-2xl border ${exportPreset === p.key ? 'bg-[#f0fdf4] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
                  >
                    <Text className={`font-jakarta-bold text-[13px] ${exportPreset === p.key ? 'text-[#00351d]' : 'text-[#404942]'}`}>{p.label}</Text>
                    {exportPreset === p.key && <Feather name="check" size={15} color="#00351d" />}
                  </TouchableOpacity>
                ))}
              </View>

              {exportPreset === 'custom' && (
                <View className="flex-row gap-3 mt-3 mb-2">
                  <View className="flex-1">
                    <InlineDatePicker label="From" value={customFrom} onChange={setCustomFrom} clearable />
                  </View>
                  <View className="flex-1">
                    <InlineDatePicker label="To" value={customTo} onChange={setCustomTo} minDate={customFrom} clearable />
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={confirmExport}
                disabled={isExporting}
                className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center mt-6"
                style={isExporting ? { opacity: 0.6 } : undefined}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="download" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text className="text-white font-jakarta-bold text-[15px]">Download & Email Statement</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
