import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';

export default function Dashboard({ navigation }: any) {
  const { merchant } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [trustScore, setTrustScore] = useState<any>({ current: 0, eligibleForAdvance: false });
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);

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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [txRes, scoreRes] = await Promise.all([
          api.get('/api/transactions'),
          api.get('/api/trust-score').catch(() => ({ data: { current: 0, eligibleForAdvance: false } }))
        ]);
        
        const txList = Array.isArray(txRes.data)
          ? txRes.data
          : Array.isArray(txRes.data?.transactions)
          ? txRes.data.transactions
          : [];
        setTransactions(txList);
        if (scoreRes.data) {
          setTrustScore(scoreRes.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (merchant) {
      fetchDashboardData();
    }
  }, [merchant]);

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

  const inboundTransactions = transactions.filter((tx) => tx.type === 'inbound');
  const todayInbound = inboundTransactions.filter((tx) => isSameDay(new Date(tx.createdAt), now));
  const monthInbound = inboundTransactions.filter((tx) => isSameMonth(new Date(tx.createdAt), now));
  const todayTotal = todayInbound.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);
  const monthTotal = monthInbound.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);


  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-lg mx-auto flex-1">
          {/* Header Area */}
          <LinearGradient
            colors={['#1D9E75', '#0B4D2E']}
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
              <TouchableOpacity
                onPress={() => navigation?.navigate('Notifications')}
                className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 mr-3"
              >
                <MaterialIcons name="notifications" size={20} color="white" />
                {unreadCount > 0 && (
                  <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff5a5f] border border-[#0b4d2e]" />
                )}
              </TouchableOpacity>
            </View>

            <View className="mb-2 pl-3">
              <Text className="text-white/80 text-[11px] font-jakarta-bold uppercase tracking-widest mb-1">Total Balance</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1 }} className="text-4xl text-white leading-none">
                {formatCurrency(merchant?.kesBalance || 0)}
              </Text>
              <View className="flex-row items-center justify-between mt-4">
                {todayTotal > 0 ? (
                  <View className="flex-row items-center gap-1.5 bg-[#83f5c6]/20 px-3 py-1.5 rounded-full border border-[#83f5c6]/20">
                    <Feather name="trending-up" size={14} color="#83f5c6" />
                    <Text className="text-[#83f5c6] font-jakarta-bold text-sm">+{formatCurrency(todayTotal)} today</Text>
                  </View>
                ) : <View />}
                <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/20 mb-1">
                  <Text className="text-white text-[10px] font-jakarta-bold uppercase tracking-widest">Till No: {merchant?.paybillAccount || 'PENDING'}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Action Buttons (overlapping) */}
          <View className="px-6 flex-row justify-between -mt-6 mb-10 z-10">
            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Collections')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#b1f1c6] items-center justify-center">
                  <Feather name="plus-circle" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Pay')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center">
                  <MaterialIcons name="payments" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('InflationShield')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#83f5c6] items-center justify-center">
                  <MaterialIcons name="swap-horiz" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Move Money</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Advance')}>
              <View className="w-[72px] h-[72px] rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2.5">
                <View className="w-12 h-12 rounded-full bg-[#e8eaf6] items-center justify-center">
                  <Feather name="trending-up" size={24} color="#3f51b5" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Advance</Text>
            </TouchableOpacity>
          </View>

          {/* Growth Ribbon */}
          <View className="px-6 mb-8">
            <View className="bg-[#b1f1c6] rounded-[24px] p-5 flex-row items-center justify-between shadow-sm">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] mb-1">
                  Collect. Pay. Protect. Grow.
                </Text>
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">
                  Merchant Estate Status: Elite
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
                <Text className="text-lg font-jakarta-bold text-[#1b1c1a]">Digital Ledgers</Text>
                <TouchableOpacity>
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
                <View className="bg-[#0b4d2e] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#0b4d2e]/30">
                  <View className="absolute -right-8 -top-8 opacity-10">
                    <MaterialIcons name="account-balance-wallet" size={140} color="white" />
                  </View>
                  <Text className="text-[#96d4ab] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Operating Balance</Text>
                  <Text className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">{formatCurrency(merchant?.kesBalance || 0)}</Text>
                  <View className="flex-row items-center gap-1.5 mt-4">
                    <Feather name="arrow-up" size={14} color="#96d4ab" />
                    <Text className="text-[#96d4ab] text-[13px] font-jakarta-medium">12.4% vs last month</Text>
                  </View>
                </View>

                <View className="bg-[#1e293b] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#1e293b]/30">
                  <View className="absolute -right-4 -top-4 opacity-10">
                    <MaterialIcons name="shield" size={100} color="white" />
                  </View>
                  <Text className="text-[#94a3b8] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">USDC Vault</Text>
                  <Text className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">{(merchant?.usdcBalance || 0).toFixed(2)}</Text>
                  <View className="flex-row items-center gap-1.5 mt-4">
                    <Feather name="refresh-cw" size={14} color="#94a3b8" />
                    <Text className="text-[#94a3b8] text-[13px] font-jakarta-medium">≈ KES 40,625</Text>
                  </View>
                </View>
              </ScrollView>
          </View>

          {/* This Month Performance */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#c0c9c0]/10">
              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-6">This Month Performance</Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Revenue</Text>
                  <Text className="text-[#006c4e] text-[16px] font-jakarta-extrabold">{formatCurrency(monthTotal)}</Text>
                </View>
                <View className="w-[1px] h-full bg-[#efeeeb]" />
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Payments</Text>
                  <Text className="text-[#1b1c1a] text-[16px] font-jakarta-extrabold">{monthInbound.length}</Text>
                </View>
                <View className="w-[1px] h-full bg-[#efeeeb]" />
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Trust Score</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[#1b1c1a] text-[16px] font-jakarta-extrabold">{trustScore.current || 0}/100</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Recent Activity */}
          <View className="px-6 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-jakarta-bold text-[#1b1c1a]">Recent Activity</Text>
              <TouchableOpacity onPress={() => navigation?.navigate('Transactions')} className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#c0c9c0]/10">
              {isLoading ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator color="#0B4D2E" />
                </View>
              ) : transactions.length === 0 ? (
                <View className="py-10 items-center justify-center">
                  <Text className="text-[#707971] font-jakarta-medium">No recent activity</Text>
                </View>
              ) : (
                transactions.slice(0, 5).map((tx, index) => {
                  const isInbound = tx.type === 'inbound';
                  const isSwap = tx.type === 'fx_swap';
                  const name = isInbound ? (tx.sender?.name || 'Unknown') : (tx.recipient?.name || tx.sender?.name || 'Treasury');
                  const verified = tx.status === 'completed' || tx.status === 'verified';
                  const kes = tx.kesAmount || tx.amount || 0;
                  const rawRef = tx.reference || tx.type.replace('_', ' ');
                  const refText = rawRef.length > 14 ? `${rawRef.slice(0, 6)}…${rawRef.slice(-4)}` : rawRef;
                  return (
                    <View key={tx._id || index} className={`flex-row items-center py-3 px-4 ${index !== Math.min(transactions.length - 1, 4) ? 'border-b border-[#efeeeb]/50' : ''}`}>
                      <View className="w-10 h-10 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden mr-3">
                        <Text className="text-[#404942] font-jakarta-bold text-[11px]">
                          {name ? name.substring(0, 2).toUpperCase() : 'TX'}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0 mr-2">
                        <View className="flex-row items-center">
                          <Text className="font-jakarta-bold text-[14px] text-[#1b1c1a] flex-shrink" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
                          {verified && <MaterialIcons name="verified" size={12} color="#006c4e" style={{ marginLeft: 4 }} />}
                        </View>
                        <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                          {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {refText}
                        </Text>
                      </View>
                      <Text
                        className={`font-jakarta-bold text-[13px] ${isSwap ? 'text-[#1D4ED8]' : isInbound ? 'text-[#006c4e]' : 'text-[#1b1c1a]'}`}
                        numberOfLines={1}
                        style={{ flexShrink: 0 }}
                      >
                        {isSwap ? `${(tx.usdcAmount || 0).toLocaleString()} USDC` : `${isInbound ? '+' : '-'} ${formatCurrency(kes)}`}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Available Cash Advance */}
          <View className="px-6 mb-8">
            <View className={`bg-white rounded-[40px] p-6 shadow-sm border-2 ${trustScore.eligibleForAdvance ? 'border-[#006c4e]' : 'border-[#efeeeb]'}`}>
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-1">Available Cash Advance</Text>
                  <Text className={`text-3xl font-jakarta-bold tracking-tight ${trustScore.eligibleForAdvance ? 'text-[#1b1c1a]' : 'text-[#707971]'}`}>
                    {trustScore.eligibleForAdvance ? 'KES 150,000' : 'KES 0'}
                  </Text>
                </View>
                <View className="w-14 h-14 rounded-full border-4 border-[#006c4e] items-center justify-center border-r-[#efeeeb] rotate-45">
                  <View className="-rotate-45 items-center justify-center">
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-xs">{trustScore.current || 0}</Text>
                    <Text className="text-[7px] text-[#707971] font-jakarta-bold uppercase tracking-wider">Score</Text>
                  </View>
                </View>
              </View>

              <View className="h-3 w-full bg-[#efeeeb] rounded-full mb-6 overflow-hidden">
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
                  className={`px-5 py-2.5 rounded-full ${trustScore.eligibleForAdvance ? 'bg-[#002110]' : 'bg-[#efeeeb]'}`}
                >
                  <Text className={`text-[11px] font-jakarta-bold uppercase tracking-wider ${trustScore.eligibleForAdvance ? 'text-white' : 'text-[#707971]'}`}>
                    Unlock Funds
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
