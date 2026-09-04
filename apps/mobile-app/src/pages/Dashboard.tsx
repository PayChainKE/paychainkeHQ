import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import PrivateValue from '../components/PrivateValue';
import FundAccountModal from '../components/FundAccountModal';
import TourTarget from '../components/TourTarget';
import { isCreditTransaction, isDebitTransaction, netBalanceImpact, excludeReversedDuplicates } from '../utils/transactionDirection';
import { formatAccountNumber } from '../utils/formatAccountNumber';
import { formatName } from '../utils/formatName';

type Timeframe = '7D' | '30D' | '6M';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Same bucketing convention as the merchant dashboard's Overview chart
// (apps/merchant-dashboard/src/pages/Overview.jsx generateChartData), ported to RN.
function computeChartData(transactions: any[]) {
  const inboundTxs = transactions.filter((t) => isCreditTransaction(t.type));
  const outboundTxs = transactions.filter((t) => isDebitTransaction(t.type));
  const now = new Date();
  // Math.abs(netBalanceImpact(t)) instead of the raw amount field — txs is
  // already filtered to inboundTxs/outboundTxs (by type) above, so the sign
  // is already known; this corrects the magnitude for unsettled rows and
  // the NCBA gross/fee mismatch (see netBalanceImpact's doc comment in
  // utils/transactionDirection.ts).
  const sumFor = (txs: any[], matches: (t: any) => boolean) =>
    txs.filter(matches).reduce((sum, t) => sum + Math.abs(netBalanceImpact(t)), 0);

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
        if (weekIndex >= 0 && weekIndex < 4) bucket[weekIndex] += Math.abs(netBalanceImpact(t));
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
  // Backend calculateTrustScore caps the score at 80 (trustScoreController.js)
  // — 85 was above the ceiling and could never actually be reached.
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Trusted';
  if (score >= 40) return 'Established';
  return 'Growing';
}

export default function Dashboard({ navigation }: any) {
  const { merchant } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [trustScore, setTrustScore] = useState<any>({ current: 0, eligibleForAdvance: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAmounts, setShowAmounts] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('7D');
  const [showFundAccount, setShowFundAccount] = useState(false);

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
      const [txRes, scoreRes] = await Promise.all([
        api.get('/api/transactions'),
        api.get('/api/trust-score').catch(() => ({ data: { current: 0, eligibleForAdvance: false } })),
      ]);

      const txList = Array.isArray(txRes.data)
        ? txRes.data
        : Array.isArray(txRes.data?.transactions)
        ? txRes.data.transactions
        : [];
      // Drops any duplicate-credit + its correction entry as a matched pair
      // at the source, so every downstream stat/chart in this file is
      // automatically clean — see excludeReversedDuplicates' doc comment.
      setTransactions(excludeReversedDuplicates(txList));
      if (scoreRes.data) setTrustScore(scoreRes.data);
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
  // dashboard Overview's 3s poll + refetch-on-focus behavior.
  useEffect(() => {
    if (!merchant) return;
    const interval = setInterval(fetchDashboardData, 3000);
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
    return `Ksh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  const inboundTransactions = transactions.filter((tx) => isCreditTransaction(tx.type));
  const todayInbound = inboundTransactions.filter((tx) => isSameDay(new Date(tx.createdAt), now));
  const monthInbound = inboundTransactions.filter((tx) => isSameMonth(new Date(tx.createdAt), now));
  // netBalanceImpact (not the raw amount field) — inboundTransactions is
  // already type-filtered to credits, so Math.abs just corrects the
  // magnitude for unsettled rows and the NCBA gross/fee mismatch (see its
  // doc comment in utils/transactionDirection.ts). A raw sum counted a
  // failed/pending row as real revenue and overstated ncba_inbound rows by
  // the fee that never actually reached the merchant's balance.
  const todayTotal = todayInbound.reduce((sum, tx) => sum + Math.abs(netBalanceImpact(tx)), 0);
  const monthTotal = monthInbound.reduce((sum, tx) => sum + Math.abs(netBalanceImpact(tx)), 0);

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
          {/* Greeting backdrop — just page chrome now (avatar, greeting,
              eye toggle, notifications). The wallet card below is its own
              element, sized and shadowed like a real card, not stretched
              full-bleed into this. */}
          <LinearGradient
            colors={['#22B589', '#0b4d2e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-6 pt-16 pb-24 rounded-b-[40px] z-0"
          >
            <View className="flex-row justify-between items-center mt-4">
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
          </LinearGradient>

          {/* Wallet card — floats over the backdrop at a real e-wallet card
              proportion (ISO card ratio, ~1.586:1) instead of a full-bleed
              banner, with a real drop shadow so it reads as a physical
              object sitting on the page. */}
          <View className="px-6 -mt-16 mb-10 z-10">
            <TourTarget id="home-balance">
              <LinearGradient
                colors={['#22B589', '#0b4d2e', '#031f13']}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  aspectRatio: 1.586,
                  borderRadius: 24,
                  padding: 22,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.35,
                  shadowRadius: 28,
                  elevation: 18,
                }}
                className="overflow-hidden justify-between"
              >
                {/* Ambient light — the soft glow real premium card UIs use
                    to avoid a flat, single-tone fill. */}
                <View pointerEvents="none" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(94,254,179,0.14)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.04)' }} />

                <Text className="text-white/60 text-[10px] font-jakarta-bold uppercase tracking-[0.15em]">Available Balance</Text>

                {/* Main row — balance on the left, chip + contactless icon
                    stacked on the right, side by side instead of stacked
                    above the amount. */}
                <View className="flex-row items-start justify-between mt-2">
                  <PrivateValue
                    hidden={!showAmounts}
                    tint="dark"
                    style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1, flexShrink: 1 }}
                    className="text-[34px] text-white leading-none"
                  >
                    {formatCurrency(merchant?.kesBalance || 0)}
                  </PrivateValue>

                  <View className="items-center gap-2 pl-3">
                    {/* Contactless indicator — MaterialIcons "wifi" rotated
                        90° reads as the standard tap-to-pay glyph. Sits
                        above the chip, the same order real cards print it
                        in (contactless mark near the top edge, chip below). */}
                    <MaterialIcons name="wifi" size={19} color="rgba(255,255,255,0.65)" style={{ transform: [{ rotate: '90deg' }] }} />
                    {/* EMV-style chip with the PayChain mark set into it,
                        like a brand emblem debossed on a metal card. */}
                    <LinearGradient
                      colors={['#f6e7b4', '#d4af37', '#a8842c']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 42, height: 32, borderRadius: 7 }}
                      className="items-center justify-center overflow-hidden"
                    >
                      <View style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
                      <View style={{ position: 'absolute', bottom: 5, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,251,235,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                        <Image source={require('../../assets/icon.png')} style={{ width: 12, height: 12 }} resizeMode="contain" />
                      </View>
                    </LinearGradient>
                  </View>
                </View>

                <View>
                  {todayTotal > 0 && (
                    <View className="flex-row items-center gap-1.5 self-start bg-[#83f5c6]/20 px-2.5 py-1 rounded-full border border-[#83f5c6]/20 mb-3">
                      <Feather name="trending-up" size={12} color="#83f5c6" />
                      <View className="flex-row items-center">
                        <Text className="text-[#83f5c6] font-jakarta-bold text-[11px]">+</Text>
                        <PrivateValue hidden={!showAmounts} tint="dark" className="text-[#83f5c6] font-jakarta-bold text-[11px]">
                          {formatCurrency(todayTotal)}
                        </PrivateValue>
                        <Text className="text-[#83f5c6] font-jakarta-bold text-[11px]"> today</Text>
                      </View>
                    </View>
                  )}
                  {/* Card-number-style account line — same treatment a
                      physical card gives its embossed digits: wide
                      letter-spacing, no pill/border boxing it in. */}
                  <Text
                    style={{ letterSpacing: 2.5 }}
                    className="text-white/70 text-[13px] font-jakarta-bold"
                  >
                    {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'PENDING')}
                  </Text>
                </View>
              </LinearGradient>
            </TourTarget>
          </View>

          <FundAccountModal visible={showFundAccount} onClose={() => setShowFundAccount(false)} />

          {/* Action Buttons — Fund now lives here as its own circle (gold,
              matching the card chip) instead of the full-width button that
              used to sit inside the card. The wallet card above now has its
              own bottom margin (it's no longer a full-bleed hero this row
              overlapped), so no negative offset needed here anymore. */}
          <View className="px-6 flex-row justify-between mb-10 z-10">
            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Collections')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-11 h-11 rounded-full bg-[#5efeb3] items-center justify-center">
                  <Feather name="plus-circle" size={21} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Pay')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-11 h-11 rounded-full bg-[#eff4ef] items-center justify-center">
                  <MaterialIcons name="payments" size={21} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Advance')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-11 h-11 rounded-full bg-[#e8eaf6] items-center justify-center">
                  <Feather name="trending-up" size={21} color="#3f51b5" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Advance</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => setShowFundAccount(true)}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <LinearGradient
                  colors={['#f6e7b4', '#d4af37', '#a8842c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  className="items-center justify-center"
                >
                  <Feather name="plus" size={21} color="#3d2e05" />
                </LinearGradient>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Fund</Text>
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

          {/* Send / Request Money */}
          <TourTarget id="send-request-row" className="px-6 flex-row gap-3 mb-8">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('SendMoney')}
              className="flex-1 bg-white rounded-2xl border border-[#bfc9bf]/10 shadow-sm p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 rounded-xl bg-[#eff4ef] items-center justify-center">
                <MaterialIcons name="north-east" size={18} color="#00351d" />
              </View>
              <Text className="text-[12px] font-jakarta-bold text-[#0c2010] uppercase tracking-wide">Send Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('RequestMoney')}
              className="flex-1 bg-white rounded-2xl border border-[#bfc9bf]/10 shadow-sm p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 rounded-xl bg-[#eff4ef] items-center justify-center">
                <MaterialIcons name="south-west" size={18} color="#00351d" />
              </View>
              <Text className="text-[12px] font-jakarta-bold text-[#0c2010] uppercase tracking-wide">Request Money</Text>
            </TouchableOpacity>
          </TourTarget>

          {/* Quick Actions — the two fastest ways to get paid, deep-linking
              into RequestMoney with the relevant option pre-selected. Back to
              full size (was briefly shrunk to a compact horizontal layout) —
              each still keeps its own frame color, mirroring
              merchant-dashboard's Overview.jsx Quick Action tiles. */}
          <View className="px-6 mb-8">
            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#0c2010]/40 mb-3">Quick Actions</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation?.navigate('RequestMoney', { preset: 'mpesa' })}
                className="flex-1 bg-[#00351d] rounded-2xl p-4 border-2 border-amber-400/30 overflow-hidden"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center">
                    <Feather name="zap" size={16} color="#5efeb3" />
                  </View>
                  <Feather name="arrow-up-right" size={16} color="rgba(255,255,255,0.3)" />
                </View>
                <Text className="text-white text-[12px] font-jakarta-bold uppercase tracking-wide mb-1">Send STK Push</Text>
                <Text className="text-white/40 text-[10px] font-jakarta-medium leading-snug">Prompt a customer to pay instantly</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation?.navigate('RequestMoney', { preset: 'link' })}
                className="flex-1 bg-[#00351d] rounded-2xl p-4 border-2 border-sky-400/30 overflow-hidden"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center">
                    <Feather name="link" size={16} color="#5efeb3" />
                  </View>
                  <Feather name="arrow-up-right" size={16} color="rgba(255,255,255,0.3)" />
                </View>
                <Text className="text-white text-[12px] font-jakarta-bold uppercase tracking-wide mb-1">Get Payment Link</Text>
                <Text className="text-white/40 text-[10px] font-jakarta-medium leading-snug">Share a link for any amount</Text>
              </TouchableOpacity>
            </View>
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
              <View className="flex-row items-center justify-between mt-5 pt-5 border-t border-[#eff4ef]">
                <Text className="text-[#707971] text-[10px] font-jakarta-bold uppercase tracking-wider">All-Time Transactions</Text>
                <Text className="text-[#0c2010] text-[14px] font-jakarta-extrabold">{transactions.length}</Text>
              </View>
            </View>
          </View>

          {/* Growth Tip */}
          <View className="px-6 mb-8">
            <View className="bg-[#e6fffa] p-5 rounded-[24px] border border-emerald-100 flex-row items-start gap-4">
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center border border-emerald-100">
                <MaterialIcons name="lightbulb" size={18} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-[9px] font-jakarta-extrabold text-emerald-800 uppercase tracking-[0.2em] mb-1">Growth Tip</Text>
                <Text className="text-[11px] text-emerald-900 font-jakarta-medium leading-relaxed opacity-80">
                  Instruct your customers to pay via M-Pesa Paybill 880100, Account Number {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || '...')}, to increase your daily volume.
                </Text>
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
                transactions.slice(0, 10).map((tx, index) => {
                  const isInbound = isCreditTransaction(tx.type);
                  const isSwap = tx.type === 'fx_swap';
                  const name = isInbound ? (formatName(tx.sender?.name) || 'Unknown') : (formatName(tx.recipient?.name) || formatName(tx.sender?.name) || 'Treasury');
                  const verified = tx.status === 'completed' || tx.status === 'verified';
                  // A failed payout is always refunded in full — without this,
                  // it showed with the exact same solid debit color as a real
                  // completed one, making it look like money had actually
                  // left when net balance impact was zero.
                  const isFailed = tx.status === 'failed';
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
                        {isFailed ? (
                          <Text className="text-[#b91c1c] text-[10px] font-jakarta-bold mt-0.5 uppercase tracking-wider">Failed & Refunded</Text>
                        ) : (
                          <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                            {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {refText}
                          </Text>
                        )}
                      </View>
                      <PrivateValue
                        hidden={!showAmounts}
                        tint="light"
                        className={`font-jakarta-bold text-[13px] ${isFailed ? 'text-[#707971] line-through' : isSwap ? 'text-[#1D4ED8]' : isInbound ? 'text-[#006c4e]' : 'text-[#0c2010]'}`}
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

          {/* Bulk Payouts shortcut */}
          <View className="px-6 mb-8">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('Pay')}
              className="bg-white rounded-[40px] p-6 shadow-sm border-2 border-[#eff4ef]"
            >
              <View className="flex-row items-start justify-between mb-5">
                <View className="w-14 h-14 rounded-full bg-[#f0fdf4] items-center justify-center">
                  <Feather name="users" size={22} color="#006c4e" />
                </View>
                <View className="w-9 h-9 rounded-full bg-[#eff4ef] items-center justify-center">
                  <Feather name="arrow-up-right" size={16} color="#0c2010" />
                </View>
              </View>

              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-1">Bulk Payouts</Text>
              <Text className="text-2xl font-jakarta-bold tracking-tight text-[#0c2010] mb-2">
                Pay suppliers & staff at once
              </Text>
              <Text className="text-[#707971] text-[13px] font-jakarta-medium leading-[18px] mb-6">
                Upload a list or pick recipients, then settle an entire batch of payouts in a single click.
              </Text>

              <View className="self-start bg-[#002110] px-5 py-2.5 rounded-full">
                <Text className="text-white text-[11px] font-jakarta-bold uppercase tracking-wider">Start a Bulk Payout</Text>
              </View>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
