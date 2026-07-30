import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';
import { isCreditTransaction, typeLabel as txTypeLabel } from '../utils/transactionDirection';
import { formatTxDate, formatTxTime } from '../utils/formatDate';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';

const ITEMS_PER_PAGE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatKES(amount: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await api.get('/api/transactions');
        if (res.data.success) {
          setTransactions(res.data.transactions || []);
        } else if (Array.isArray(res.data)) {
          // Fallback: some endpoints return array directly
          setTransactions(res.data);
        }
      } catch (error) {
        console.error('Error fetching transactions', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  // ─── Stats calculation (mirroring merchant dashboard) ─────────────────────
  const inboundTxs = transactions.filter(t => isCreditTransaction(t.type));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 7);
  const monthStart = new Date(todayStart); monthStart.setMonth(todayStart.getMonth() - 1);

  const getAmt = (t: any) => t.kesAmount || t.amount || 0;

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

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTransactions = transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleNext = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
  const handlePrev = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>

      <TopBar title="Transactions" subtitle="Inbound payment history" />

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
          <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-[0.2em] mb-4">
            All Transactions
          </Text>

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
                <Text className="text-[#0c2010] font-jakarta-bold text-[16px] mb-1">No transactions yet</Text>
                <Text className="text-[#707971] font-jakarta-medium text-[13px] text-center leading-relaxed">
                  Inbound payments to your account will appear here.
                </Text>
              </View>
            ) : (
              currentTransactions.map((tx, index) => {
                const isInbound = isCreditTransaction(tx.type);
                const isSwap = tx.type === 'fx_swap';
                const name = isInbound
                  ? (tx.sender?.name || 'Unknown')
                  : (tx.recipient?.name || tx.sender?.name || 'Treasury');
                const verified = tx.status === 'completed' || tx.status === 'verified';
                const typeLabel = txTypeLabel(tx.type || 'inbound').toUpperCase();
                const dateStr = formatTxDate(tx.createdAt || tx.timestamp);
                const timeStr = formatTxTime(tx.createdAt || tx.timestamp);
                const phoneStr = formatPhoneDisplay(tx.sender?.id || tx.recipient?.id);
                return (
                  <View
                    key={tx._id || index}
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
                      {!!phoneStr && (
                        <Text className="text-[#707971]/70 text-[10px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                          {phoneStr}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={`font-jakarta-bold text-[14px] ${
                        isSwap ? 'text-[#1D4ED8]' : isInbound ? 'text-[#006c4e]' : 'text-[#0c2010]'
                      }`}
                      numberOfLines={1}
                      style={{ flexShrink: 0 }}
                    >
                      {isSwap
                        ? `${(tx.usdcAmount || 0).toLocaleString()} USDC`
                        : `${isInbound ? '+' : '-'} ${formatKES(tx.kesAmount || tx.amount || 0)}`}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {!isLoading && transactions.length > ITEMS_PER_PAGE && (
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
    </SafeAreaView>
  );
}
