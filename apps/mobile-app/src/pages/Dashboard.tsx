import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import PrivateValue from '../components/PrivateValue';
import { isCreditTransaction, isDebitTransaction } from '../utils/transactionDirection';
import { formatAccountNumber } from '../utils/formatAccountNumber';

type Timeframe = '7D' | '30D' | '6M';
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Same bucketing convention as the merchant dashboard's Overview chart
// (apps/merchant-dashboard/src/pages/Overview.jsx generateChartData), ported to RN.
function computeChartData(transactions: any[]) {
  const inboundTxs = transactions.filter((t) => isCreditTransaction(t.type));
  const outboundTxs = transactions.filter((t) => isDebitTransaction(t.type));
  const now = new Date();
  const sumFor = (txs: any[], matches: (t: any) => boolean) =>
    txs.filter(matches).reduce((sum, t) => sum + (t.kesAmount || t.amount || 0), 0);

  const labels7D: string[] = [];
  const inbound7D: number[] = [];
  const outbound7D: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels7D.push(DAY_NAMES[d.getDay()]);
    const sameDay = (t: any) => new Date(t.createdAt).toDateString() === d.toDateString();
    inbound7D.push(sumFor(inboundTxs, sameDay));
    outbound7D.push(sumFor(outboundTxs, sameDay));
  }

  const labels30D = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const inbound30D = [0, 0, 0, 0];
  const outbound30D = [0, 0, 0, 0];
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);
  const bucketByWeek = (txs: any[], bucket: number[]) => {
    txs.forEach((t) => {
      const txDate = new Date(t.createdAt);
      if (txDate >= thirtyDaysAgo) {
        const diffDays = Math.floor(Math.abs(now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = 3 - Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex < 4) bucket[weekIndex] += t.kesAmount || t.amount || 0;
      }
    });
  };
  bucketByWeek(inboundTxs, inbound30D);
  bucketByWeek(outboundTxs, outbound30D);

  const labels6M: string[] = [];
  const inbound6M: number[] = [];
  const outbound6M: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    labels6M.push(MONTH_NAMES[d.getMonth()]);
    const sameMonth = (t: any) => {
      const txDate = new Date(t.createdAt);
      return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
    };
    inbound6M.push(sumFor(inboundTxs, sameMonth));
    outbound6M.push(sumFor(outboundTxs, sameMonth));
  }

  return {
    '7D': { labels: labels7D, inbound: inbound7D, outbound: outbound7D },
    '30D': { labels: labels30D, inbound: inbound30D, outbound: outbound30D },
    '6M': { labels: labels6M, inbound: inbound6M, outbound: outbound6M },
  };
}

function estateTier(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Trusted';
  if (score >= 40) return 'Established';
  return 'Growing';
}

export default function Dashboard({ navigation }: any) {
  const { merchant } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [trustScore, setTrustScore] = useState<any>({ current: 0, eligibleForAdvance: false });
  const [approvedLimit, setApprovedLimit] = useState<number | null>(null);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAmounts, setShowAmounts] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('7D');

  useFocusEffect(
    useCallback(() => {
      api.get('/api/notifications/unread-count')
        .then((res) => {
          if (res.data?.success) setUnreadCount(res.data.count);
        })
        .catch(() => {});
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!merchant) return;
    try {
      const [txRes, scoreRes, rateRes, cashAdvRes] = await Promise.all([
        api.get('/api/transactions'),
        api.get('/api/trust-score').catch(() => ({ data: { current: 0, eligibleForAdvance: false } })),
        api.get('/api/transactions/live-rate').catch(() => null),
        api.get('/api/cash-advance/my-applications').catch(() => null),
      ]);

      const txList = Array.isArray(txRes.data)
        ? txRes.data
        : Array.isArray(txRes.data?.transactions)
        ? txRes.data.transactions
        : [];
      setTransactions(txList);
      if (scoreRes.data) setTrustScore(scoreRes.data);
      if (rateRes?.data?.success) setLiveRate(rateRes.data.rate);

      const applications = cashAdvRes?.data?.applications || [];
      const latestApproved = applications.find((a: any) => a.status === 'approved' && a.approvedLimit);
      setApprovedLimit(latestApproved ? latestApproved.approvedLimit : null);
    } catch (error) {
      console.error('Error fetching dashboard data', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [merchant]);

  useEffect(() => {
    if (merchant) {
      setIsLoading(true);
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [merchant, fetchDashboardData]);

  // Keep the balance/chart/transaction data live, matching the merchant
  // dashboard Overview's 30s poll + refetch-on-focus behavior.
  useEffect(() => {
    if (!merchant) return;
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [merchant, fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      if (merchant) fetchDashboardData();
    }, [merchant, fetchDashboardData])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const initials = merchant?.businessName
    ? merchant.businessName.substring(0, 2).toUpperCase()
    : '??';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  const inboundTransactions = transactions.filter((tx) => isCreditTransaction(tx.type));
  const todayInbound = inboundTransactions.filter((tx) => isSameDay(new Date(tx.createdAt), now));
  const monthInbound = inboundTransactions.filter((tx) => isSameMonth(new Date(tx.createdAt), now));
  const todayTotal = todayInbound.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);
  const monthTotal = monthInbound.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthInbound = inboundTransactions.filter((tx) => isSameMonth(new Date(tx.createdAt), lastMonthDate));
  const lastMonthTotal = lastMonthInbound.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);
  const monthOverMonthPct = lastMonthTotal > 0 ? ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null;

  const walletActivated = !!merchant?.stellarPublicKey;
  const usdcBalance = merchant?.usdcBalance || 0;
  const usdcInKes = liveRate != null ? usdcBalance * liveRate : null;

  const chartData = computeChartData(transactions);
  const activeChart = chartData[activeTimeframe];
  const chartMax = Math.max(1, ...activeChart.inbound, ...activeChart.outbound);
  const periodInboundTotal = activeChart.inbound.reduce((s, v) => s + v, 0);
  const periodOutboundTotal = activeChart.outbound.reduce((s, v) => s + v, 0);

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#0b4d2e" colors={['#0b4d2e']} />
        }
      >
        <View className="w-full max-w-lg mx-auto flex-1">
          {/* Header Area */}
          <LinearGradient
            colors={['#1D9E75', '#0b4d2e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="px-6 pt-[150px] pb-40 rounded-b-[40px] z-0 shadow-lg shadow-[#0b4d2e]/20"
          >
            <View className="flex-row justify-between items-center mb-10 mt-4">
              <View className="flex-row items-center gap-3 pl-3">
                <TouchableOpacity
                  onPress={() => navigation?.navigate('More')}
                  className="w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30"
                >
                  <Text className="text-white font-jakarta-bold text-sm">{initials}</Text>
                </TouchableOpacity>
                <View>
                  <Text className="text-white/80 text-[11px] font-jakarta-bold uppercase tracking-wider mb-0.5">{greeting} 👋</Text>
                  <Text className="text-white text-base font-jakarta-bold tracking-tight">{merchant?.businessName || 'Merchant'}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2 mr-3">
                <TouchableOpacity
                  onPress={() => setShowAmounts((v) => !v)}
                  className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10"
                >
                  <Feather name={showAmounts ? 'eye' : 'eye-off'} size={17} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation?.navigate('Notifications')}
                  className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10"
                >
                  <MaterialIcons name="notifications" size={20} color="white" />
                  {unreadCount > 0 && (
                    <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff5a5f] border border-[#0b4d2e]" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-2 pl-3">
              <Text className="text-white/80 text-[11px] font-jakarta-bold uppercase tracking-widest mb-1">Total Balance</Text>
              <PrivateValue
                hidden={!showAmounts}
                tint="dark"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1 }}
                className="text-4xl text-white leading-none"
              >
                {formatCurrency(merchant?.kesBalance || 0)}
              </PrivateValue>
              <View className="flex-row items-center justify-between mt-4">
                {todayTotal > 0 ? (
                  <View className="flex-row items-center gap-1.5 bg-[#83f5c6]/20 px-3 py-1.5 rounded-full border border-[#83f5c6]/20">
                    <Feather name="trending-up" size={14} color="#83f5c6" />
                    <View className="flex-row items-center">
                      <Text className="text-[#83f5c6] font-jakarta-bold text-sm">+</Text>
                      <PrivateValue hidden={!showAmounts} tint="dark" className="text-[#83f5c6] font-jakarta-bold text-sm">
                        {formatCurrency(todayTotal)}
                      </PrivateValue>
                      <Text className="text-[#83f5c6] font-jakarta-bold text-sm"> today</Text>
                    </View>
                  </View>
                ) : <View />}
                <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/20 mb-1">
                  <Text className="text-white text-[10px] font-jakarta-bold uppercase tracking-widest">Account No: {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'PENDING')}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Action Buttons (overlapping) */}
          <View className="px-6 flex-row justify-between -mt-6 mb-10 z-10">
            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Collections')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#5efeb3] items-center justify-center">
                  <Feather name="plus-circle" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Pay')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#eff4ef] items-center justify-center">
                  <MaterialIcons name="payments" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('InflationShield')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#83f5c6] items-center justify-center">
                  <MaterialIcons name="swap-horiz" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Advance')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#e8eaf6] items-center justify-center">
                  <Feather name="trending-up" size={24} color="#3f51b5" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Advance</Text>
            </TouchableOpacity>
          </View>

          {/* Growth Ribbon */}
          <View className="px-6 mb-8">
            <View className="bg-[#5efeb3] rounded-[24px] p-5 flex-row items-center justify-between shadow-sm">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] mb-1">
                  Collect. Pay. Protect. Grow.
                </Text>
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">
                  Merchant Estate Status: {estateTier(trustScore.current || 0)}
                </Text>
              </View>
              <View className="w-8 h-8 rounded-full bg-[#83f5c6] items-center justify-center">
                <MaterialIcons name="verified-user" size={16} color="#00351d" />
              </View>
            </View>
          </View>

          {/* Digital Ledgers */}
          <View className="mb-8">
              <View className="px-6 flex-row items-center justify-between mb-4">
                <Text className="text-lg font-jakarta-bold text-[#0c2010]">Digital Ledgers</Text>
                <TouchableOpacity onPress={() => navigation?.navigate('DigitalWallet')}>
                  <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-widest">View All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 24, paddingRight: 24 }}
                snapToInterval={296} // 280 (card) + 16 (margin)
                decelerationRate="fast"
                bounces={true}
                alwaysBounceHorizontal={true}
                overScrollMode="always"
                className="w-full"
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation?.navigate('DigitalWallet')}
                  className="bg-[#0b4d2e] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#0b4d2e]/30">
                  <View className="absolute -right-8 -top-8 opacity-10">
                    <MaterialIcons name="account-balance-wallet" size={140} color="white" />
                  </View>
                  <Text className="text-[#96d4ab] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Operating Balance</Text>
                  <PrivateValue hidden={!showAmounts} tint="dark" className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">
                    {formatCurrency(merchant?.kesBalance || 0)}
                  </PrivateValue>
                  <View className="flex-row items-center gap-1.5 mt-4">
                    {monthOverMonthPct != null ? (
                      <>
                        <Feather name={monthOverMonthPct >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color="#96d4ab" />
                        <Text className="text-[#96d4ab] text-[13px] font-jakarta-medium">
                          {monthOverMonthPct >= 0 ? '+' : ''}{monthOverMonthPct.toFixed(1)}% vs last month
                        </Text>
                      </>
                    ) : (
                      <Text className="text-[#96d4ab] text-[13px] font-jakarta-medium">{formatCurrency(monthTotal)} collected this month</Text>
                    )}
                  </View>
                </TouchableOpacity>

                {walletActivated ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation?.navigate('DigitalWallet')}
                    className="bg-[#1e293b] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#1e293b]/30"
                  >
                    <View className="absolute -right-4 -top-4 opacity-10">
                      <MaterialIcons name="shield" size={100} color="white" />
                    </View>
                    <Text className="text-[#94a3b8] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">USDC Vault</Text>
                    <PrivateValue hidden={!showAmounts} tint="dark" className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">
                      {usdcBalance.toFixed(2)}
                    </PrivateValue>
                    <View className="flex-row items-center gap-1.5 mt-4">
                      <Feather name="refresh-cw" size={14} color="#94a3b8" />
                      {usdcInKes != null ? (
                        <View className="flex-row items-center">
                          <Text className="text-[#94a3b8] text-[13px] font-jakarta-medium">≈ </Text>
                          <PrivateValue hidden={!showAmounts} tint="dark" className="text-[#94a3b8] text-[13px] font-jakarta-medium">
                            {formatCurrency(usdcInKes)}
                          </PrivateValue>
                        </View>
                      ) : (
                        <Text className="text-[#94a3b8] text-[13px] font-jakarta-medium">Fetching rate…</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation?.navigate('DigitalWallet')}
                    className="bg-[#0A2540] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#0A2540]/30"
                  >
                    <View className="absolute -right-4 -top-4 opacity-10">
                      <MaterialIcons name="shield" size={100} color="white" />
                    </View>
                    <Text className="text-[#93c5fd] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">USDC Vault</Text>
                    <Text className="text-white text-[16px] font-jakarta-extrabold tracking-tight mb-auto leading-relaxed">
                      Activate your Digital Wallet to shield revenue in USDC
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-4">
                      <Text className="text-[#93c5fd] text-[13px] font-jakarta-bold uppercase tracking-widest">Activate now</Text>
                      <Feather name="arrow-right" size={14} color="#93c5fd" />
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
          </View>

          {/* This Month Performance */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#bfc9bf]/10">
              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-6">This Month Performance</Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-[#0c2010] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Revenue</Text>
                  <PrivateValue hidden={!showAmounts} tint="light" className="text-[#006c4e] text-[16px] font-jakarta-extrabold">
                    {formatCurrency(monthTotal)}
                  </PrivateValue>
                </View>
                <View className="w-[1px] h-full bg-[#eff4ef]" />
                <View>
                  <Text className="text-[#0c2010] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Payments</Text>
                  <Text className="text-[#0c2010] text-[16px] font-jakarta-extrabold">{monthInbound.length}</Text>
                </View>
                <View className="w-[1px] h-full bg-[#eff4ef]" />
                <View>
                  <Text className="text-[#0c2010] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Trust Score</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[#0c2010] text-[16px] font-jakarta-extrabold">{trustScore.current || 0}/100</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Revenue Overview Chart */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#bfc9bf]/10">
              <View className="flex-row items-center justify-between mb-1">
                <View>
                  <Text className="text-lg font-jakarta-bold text-[#0c2010]">Revenue Overview</Text>
                  <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5">Money moving in and out</Text>
                </View>
                <View className="flex-row bg-[#f0fdf4] p-0.5 rounded-lg border border-[#e7ece7]">
                  {(['7D', '30D', '6M'] as Timeframe[]).map((period) => (
                    <TouchableOpacity
                      key={period}
                      onPress={() => setActiveTimeframe(period)}
                      className={`px-2.5 py-1.5 rounded-md ${activeTimeframe === period ? 'bg-white shadow-sm' : ''}`}
                    >
                      <Text className={`text-[9px] font-jakarta-extrabold uppercase tracking-wider ${activeTimeframe === period ? 'text-[#006c4e]' : 'text-[#006c4e]/40'}`}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center gap-5 mt-5 mb-5">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#00855D]" />
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">In</Text>
                  <PrivateValue hidden={!showAmounts} tint="light" className="text-[12px] font-jakarta-extrabold text-[#0c2010]">
                    {formatCurrency(periodInboundTotal)}
                  </PrivateValue>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider">Out</Text>
                  <PrivateValue hidden={!showAmounts} tint="light" className="text-[12px] font-jakarta-extrabold text-[#0c2010]">
                    {formatCurrency(periodOutboundTotal)}
                  </PrivateValue>
                </View>
              </View>

              {periodInboundTotal === 0 && periodOutboundTotal === 0 ? (
                <View className="h-[120px] items-center justify-center">
                  <Text className="text-[#707971] font-jakarta-medium text-[12px]">No activity in this period</Text>
                </View>
              ) : (
                <View className="flex-row items-end justify-between h-[120px]">
                  {activeChart.labels.map((label, i) => {
                    const inH = Math.max(4, (activeChart.inbound[i] / chartMax) * 100);
                    const outH = Math.max(4, (activeChart.outbound[i] / chartMax) * 100);
                    return (
                      <View key={`${label}-${i}`} className="items-center flex-1">
                        <View className="flex-row items-end gap-[3px]" style={{ height: 100 }}>
                          <View style={{ width: 6, height: inH, backgroundColor: '#00855D', borderRadius: 3 }} />
                          <View style={{ width: 6, height: outH, backgroundColor: '#D97706', borderRadius: 3 }} />
                        </View>
                        <Text className="text-[7px] font-jakarta-bold text-[#707971] uppercase tracking-wider mt-2" numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Recent Activity */}
          <View className="px-6 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-jakarta-bold text-[#0c2010]">Recent Activity</Text>
                <TouchableOpacity
                  onPress={onRefresh}
                  className="w-7 h-7 rounded-full bg-[#eff4ef] items-center justify-center"
                >
                  <Feather name="refresh-cw" size={12} color="#006c4e" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => navigation?.navigate('Transactions')} className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#bfc9bf]/10">
              {isLoading ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator color="#0b4d2e" />
                </View>
              ) : transactions.length === 0 ? (
                <View className="py-10 items-center justify-center">
                  <Text className="text-[#707971] font-jakarta-medium">No recent activity</Text>
                </View>
              ) : (
                transactions.slice(0, 5).map((tx, index) => {
                  const isInbound = isCreditTransaction(tx.type);
                  const isSwap = tx.type === 'fx_swap';
                  const name = isInbound ? (tx.sender?.name || 'Unknown') : (tx.recipient?.name || tx.sender?.name || 'Treasury');
                  const verified = tx.status === 'completed' || tx.status === 'verified';
                  const kes = tx.kesAmount || tx.amount || 0;
                  const rawRef = tx.reference || tx.type.replace('_', ' ');
                  const refText = rawRef.length > 14 ? `${rawRef.slice(0, 6)}…${rawRef.slice(-4)}` : rawRef;
                  return (
                    <View key={tx._id || index} className={`flex-row items-center py-3 px-4 ${index !== Math.min(transactions.length - 1, 4) ? 'border-b border-[#eff4ef]/50' : ''}`}>
                      <View className="w-10 h-10 rounded-full bg-[#eff4ef] items-center justify-center overflow-hidden mr-3">
                        <Text className="text-[#404942] font-jakarta-bold text-[11px]">
                          {name ? name.substring(0, 2).toUpperCase() : 'TX'}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0 mr-2">
                        <View className="flex-row items-center">
                          <Text className="font-jakarta-bold text-[14px] text-[#0c2010] flex-shrink" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
                          {verified && <MaterialIcons name="verified" size={12} color="#006c4e" style={{ marginLeft: 4 }} />}
                        </View>
                        <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                          {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {refText}
                        </Text>
                      </View>
                      <PrivateValue
                        hidden={!showAmounts}
                        tint="light"
                        className={`font-jakarta-bold text-[13px] ${isSwap ? 'text-[#1D4ED8]' : isInbound ? 'text-[#006c4e]' : 'text-[#0c2010]'}`}
                        numberOfLines={1}
                        style={{ flexShrink: 0 }}
                      >
                        {isSwap ? `${(tx.usdcAmount || 0).toLocaleString()} USDC` : `${isInbound ? '+' : '-'} ${formatCurrency(kes)}`}
                      </PrivateValue>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Available Cash Advance */}
          <View className="px-6 mb-8">
            <View className={`bg-white rounded-[40px] p-6 shadow-sm border-2 ${trustScore.eligibleForAdvance ? 'border-[#006c4e]' : 'border-[#eff4ef]'}`}>
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-1">Available Cash Advance</Text>
                  {trustScore.eligibleForAdvance ? (
                    approvedLimit ? (
                      <PrivateValue hidden={!showAmounts} tint="light" className="text-3xl font-jakarta-bold tracking-tight text-[#0c2010]">
                        {formatCurrency(approvedLimit)}
                      </PrivateValue>
                    ) : (
                      <Text className="text-3xl font-jakarta-bold tracking-tight text-[#0c2010]">Apply to see your limit</Text>
                    )
                  ) : (
                    <Text className="text-3xl font-jakarta-bold tracking-tight text-[#707971]">KES 0</Text>
                  )}
                </View>
                <View className="w-14 h-14 rounded-full border-4 border-[#006c4e] items-center justify-center border-r-[#eff4ef] rotate-45">
                  <View className="-rotate-45 items-center justify-center">
                    <Text className="font-jakarta-bold text-[#0c2010] text-xs">{trustScore.current || 0}</Text>
                    <Text className="text-[7px] text-[#707971] font-jakarta-bold uppercase tracking-wider">Score</Text>
                  </View>
                </View>
              </View>

              <View className="h-3 w-full bg-[#eff4ef] rounded-full mb-6 overflow-hidden">
                <View
                  className="h-full bg-[#006c4e] rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, trustScore.current || 0))}%` }}
                />
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5 flex-1 pr-3">
                  <MaterialIcons name={trustScore.eligibleForAdvance ? "check-circle" : "info"} size={16} color={trustScore.eligibleForAdvance ? "#006c4e" : "#707971"} />
                  <Text numberOfLines={1} className={`flex-1 text-[11px] font-jakarta-bold uppercase tracking-wider ${trustScore.eligibleForAdvance ? 'text-[#006c4e]' : 'text-[#707971]'}`}>
                    {trustScore.eligibleForAdvance ? 'Cash Advance Eligible' : 'Keep Processing to Unlock'}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={!trustScore.eligibleForAdvance}
                  onPress={() => navigation?.navigate('Advance')}
                  className={`px-5 py-2.5 rounded-full ${trustScore.eligibleForAdvance ? 'bg-[#002110]' : 'bg-[#eff4ef]'}`}
                >
                  <Text className={`text-[11px] font-jakarta-bold uppercase tracking-wider ${trustScore.eligibleForAdvance ? 'text-white' : 'text-[#707971]'}`}>
                    {approvedLimit ? 'Unlock Funds' : 'Apply Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
