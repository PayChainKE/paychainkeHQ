import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/config';
import { useAuth } from '../context/AuthContext';

type SwapDirection = 'KES_TO_USDC' | 'USDC_TO_KES';

const FEE_RATE = 0.005;

function formatKES(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
}

export default function InflationShield({ navigation }: any) {
  const { merchant, refreshSession } = useAuth();
  const walletActivated = !!merchant?.stellarPublicKey;

  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  const [rate, setRate] = useState(130);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [inputAmount, setInputAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState<SwapDirection>('KES_TO_USDC');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState('');

  const estimatedOutput = inputAmount
    ? swapDirection === 'KES_TO_USDC'
      ? ((Number(inputAmount) * (1 - FEE_RATE)) / rate).toFixed(2)
      : (Number(inputAmount) * (1 - FEE_RATE) * rate).toFixed(2)
    : '0.00';

  const loadData = useCallback(async () => {
    try {
      const [rateRes, txRes] = await Promise.allSettled([
        api.get('/api/transactions/live-rate'),
        api.get('/api/transactions'),
      ]);
      if (rateRes.status === 'fulfilled' && rateRes.value.data?.rate) {
        setRate(rateRes.value.data.rate);
      }
      if (txRes.status === 'fulfilled') {
        const list = Array.isArray(txRes.value.data)
          ? txRes.value.data
          : Array.isArray(txRes.value.data?.transactions)
          ? txRes.value.data.transactions
          : [];
        setTransactions(list);
      }
      if (merchant?.stellarPublicKey) {
        try {
          const syncRes = await api.post('/api/transactions/sync-wallet');
          if (syncRes.data?.success) setUsdcBalance(syncRes.data.balance ?? syncRes.data.usdcBalance ?? 0);
        } catch (err) {
          console.error('Failed to sync USDC balance', err);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.stellarPublicKey]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleActivateWallet = async () => {
    setIsActivating(true);
    setActivateError('');
    try {
      await api.post('/api/transactions/activate-wallet');
      await refreshSession();
    } catch (err: any) {
      setActivateError(err?.response?.data?.error || 'Failed to activate digital wallet. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSwap = async () => {
    const amount = Number(inputAmount);
    if (!amount || amount <= 0) {
      setSwapError('Enter a valid amount to swap.');
      return;
    }
    if (swapDirection === 'KES_TO_USDC' && amount > (merchant?.kesBalance || 0)) {
      setSwapError('You do not have enough KES.');
      return;
    }
    if (swapDirection === 'USDC_TO_KES' && amount > usdcBalance) {
      setSwapError('You do not have enough USDC.');
      return;
    }
    setSwapError('');
    setIsSwapping(true);
    try {
      await api.post('/api/transactions/swap', { amount, direction: swapDirection });
      await refreshSession();
      setInputAmount('');
      await loadData();
    } catch (err: any) {
      setSwapError(err?.response?.data?.error || 'Failed to swap currency.');
    } finally {
      setIsSwapping(false);
    }
  };

  const swapHistory = transactions.filter((tx) => tx.type === 'fx_swap');

  const Header = () => (
    <View className="w-full bg-[#f7faf7] z-50 pt-2 pb-4 border-b border-[#eff4ef]">
      <View className="w-full max-w-lg mx-auto px-6 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 rounded-full">
            <Feather name="arrow-left" size={24} color="#00351d" />
          </TouchableOpacity>
          <View>
            <Text className="text-[#707971] text-[10px] font-jakarta-bold uppercase tracking-[0.2em] mb-0.5">Money Hub</Text>
            <Text className="font-jakarta-bold tracking-tight text-[22px] text-[#00351d]">Inflation Shield</Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] tracking-tight">PayChain</Text>
      </View>
    </View>
  );

  // ── Hard gate: no Stellar wallet yet ────────────────────────────────────
  if (!walletActivated) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <Header />
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
            <View className="bg-[#0A2540] rounded-[40px] p-8 relative overflow-hidden border border-blue-500/10 shadow-2xl">
              <View className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full -mr-32 -mt-32" />
              <View className="relative z-10">
                <View className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 items-center justify-center mb-6">
                  <MaterialIcons name="security" size={30} color="#93c5fd" />
                </View>
                <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-[0.25em] text-blue-300 mb-3">Activate to unlock</Text>
                <Text className="font-jakarta-extrabold text-[26px] text-white leading-tight mb-4">
                  Inflation Shield needs an active Digital Wallet
                </Text>
                <Text className="text-white/70 text-[14px] leading-relaxed mb-8">
                  Shielding KES into USDC requires a provisioned Stellar wallet on your account. Activation takes under a minute and is a one-time setup — once it's live you can swap, hold and convert at any time.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-8">
                  {[
                    { icon: 'shield', label: 'USDC-pegged' },
                    { icon: 'currency-exchange', label: 'Live FX rate' },
                    { icon: 'bolt', label: 'On-chain settle' },
                  ].map((b) => (
                    <View key={b.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1 min-w-[100px]">
                      <MaterialIcons name={b.icon as any} size={18} color="#93c5fd" />
                      <Text className="text-[11px] font-jakarta-bold text-white mt-2">{b.label}</Text>
                    </View>
                  ))}
                </View>

                {!!activateError && (
                  <View className="bg-white/10 border border-red-400/30 rounded-2xl px-4 py-3 mb-4">
                    <Text className="text-red-300 text-[12px] font-jakarta-semibold">{activateError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleActivateWallet}
                  disabled={isActivating}
                  activeOpacity={0.85}
                  className="bg-[#10b981] py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                >
                  {isActivating ? (
                    <ActivityIndicator color="#031813" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="account-balance-wallet" size={18} color="#031813" />
                      <Text className="text-[#031813] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Activate Digital Wallet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <Header />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          <View className="flex-row items-center justify-between mb-8">
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-3xl text-[#00351d] leading-tight tracking-tight">Protect your revenue.</Text>
            <View className="items-end">
              <Text className="text-[9px] font-jakarta-bold text-[#707971] uppercase tracking-widest mb-0.5">Live Rate</Text>
              <Text className="text-[13px] font-jakarta-extrabold text-[#00351d]">1 USDC = {formatKES(rate)}</Text>
            </View>
          </View>

          <View className="flex-row gap-4 mb-10">
            <View className="flex-1 bg-[#0b4d2e] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#0b4d2e]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="account-balance-wallet" size={100} color="white" />
              </View>
              <Text className="text-[#96d4ab] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">KES Balance</Text>
              <Text className="text-white text-[24px] font-jakarta-extrabold tracking-tight leading-tight">{formatKES(merchant?.kesBalance || 0)}</Text>
            </View>
            <View className="flex-1 bg-[#0A2540] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#0A2540]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="security" size={100} color="white" />
              </View>
              <Text className="text-[#94a3b8] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">USDC Vault</Text>
              <Text className="text-white text-[24px] font-jakarta-extrabold tracking-tight leading-tight">{usdcBalance.toFixed(2)} USDC</Text>
            </View>
          </View>

          {/* Swap Engine */}
          <View className="bg-[#0f172a] rounded-[36px] p-6 border border-white/10 shadow-xl mb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="font-jakarta-extrabold text-[20px] text-white tracking-tight">Swap Engine</Text>
              <View className="w-9 h-9 rounded-full bg-white/5 border border-white/10 items-center justify-center">
                <MaterialIcons name="currency-exchange" size={16} color="#a7f3d0" />
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 mb-3">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-widest">You Send</Text>
                <Text className="text-[10px] text-[#707971] font-jakarta-medium">
                  Balance: {swapDirection === 'KES_TO_USDC' ? formatKES(merchant?.kesBalance || 0) : `${usdcBalance.toFixed(2)} USDC`}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1.5 bg-[#f0fdf4] px-3 py-1.5 rounded-full border border-[#eff4ef]">
                  <View className={`w-5 h-5 rounded-full items-center justify-center ${swapDirection === 'KES_TO_USDC' ? 'bg-[#006c4e]' : 'bg-[#1d4ed8]'}`}>
                    <Text className="text-white text-[9px] font-jakarta-bold">{swapDirection === 'KES_TO_USDC' ? 'K' : 'U'}</Text>
                  </View>
                  <Text className="text-[13px] font-jakarta-bold text-[#0c2010]">{swapDirection === 'KES_TO_USDC' ? 'KES' : 'USDC'}</Text>
                </View>
                <TextInput
                  value={inputAmount}
                  onChangeText={setInputAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#d4d4d8"
                  className="flex-1 text-right text-[26px] font-jakarta-extrabold text-[#0c2010]"
                />
              </View>
            </View>

            <View className="items-center -my-2 z-10">
              <TouchableOpacity
                onPress={() => setSwapDirection((p) => (p === 'KES_TO_USDC' ? 'USDC_TO_KES' : 'KES_TO_USDC'))}
                className="w-11 h-11 rounded-full bg-[#0f172a] border-4 border-[#f0fdf4] items-center justify-center shadow-lg"
              >
                <MaterialIcons name="swap-vert" size={20} color="#a7f3d0" />
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-2xl p-5 mt-3 mb-5">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-widest">You Receive</Text>
                <Text className="text-[10px] text-[#707971] font-jakarta-medium">Slippage: 0.1%</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1.5 bg-[#f0fdf4] px-3 py-1.5 rounded-full border border-[#eff4ef]">
                  <View className={`w-5 h-5 rounded-full items-center justify-center ${swapDirection === 'USDC_TO_KES' ? 'bg-[#006c4e]' : 'bg-[#1d4ed8]'}`}>
                    <Text className="text-white text-[9px] font-jakarta-bold">{swapDirection === 'USDC_TO_KES' ? 'K' : 'U'}</Text>
                  </View>
                  <Text className="text-[13px] font-jakarta-bold text-[#0c2010]">{swapDirection === 'USDC_TO_KES' ? 'KES' : 'USDC'}</Text>
                </View>
                <Text className="flex-1 text-right text-[26px] font-jakarta-extrabold text-[#0c2010]">{estimatedOutput}</Text>
              </View>
            </View>

            <View className="flex-row justify-between mb-1">
              <Text className="text-[11px] text-white/50 font-jakarta-medium">Fee (0.5%)</Text>
              <Text className="text-[11px] text-white/80 font-jakarta-bold">
                {swapDirection === 'KES_TO_USDC' ? formatKES(Number(inputAmount || 0) * FEE_RATE) : `${(Number(inputAmount || 0) * FEE_RATE).toFixed(2)} USDC`}
              </Text>
            </View>

            {!!swapError && (
              <View className="bg-white/10 border border-red-400/30 rounded-xl px-4 py-2.5 mt-4">
                <Text className="text-red-300 text-[12px] font-jakarta-semibold">{swapError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSwap}
              disabled={isSwapping}
              activeOpacity={0.85}
              className="bg-[#10b981] py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg mt-5"
            >
              {isSwapping ? (
                <ActivityIndicator color="#031813" size="small" />
              ) : (
                <Text className="text-[#031813] font-jakarta-extrabold text-[13px] uppercase tracking-widest">Confirm Protection Swap</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Swap History */}
          <View className="pt-2 border-t border-[#bfc9bf]/30 mb-8">
            <Text className="font-jakarta-bold text-[#0c2010] text-[18px] mb-4">Swap History</Text>
            {isLoading ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator color="#0b4d2e" />
              </View>
            ) : swapHistory.length === 0 ? (
              <View className="py-10 items-center justify-center">
                <Text className="text-[#707971] font-jakarta-medium">No swap history yet.</Text>
              </View>
            ) : (
              <View className="gap-6">
                {swapHistory.slice(0, 10).map((tx) => (
                  <View key={tx._id} className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4 flex-1 mr-2">
                      <View className="w-[46px] h-[46px] rounded-full bg-[#eff4ef] items-center justify-center">
                        <MaterialIcons name="sync-alt" size={18} color="#006c4e" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[14px] font-jakarta-bold text-[#0c2010]" numberOfLines={1}>
                          {formatKES(tx.kesAmount || 0)} <Text className="text-[#707971]">→</Text> {(tx.usdcAmount || 0).toFixed(2)} USDC
                        </Text>
                        <Text className="text-[11px] text-[#707971] mt-0.5 font-jakarta-medium">
                          {new Date(tx.createdAt).toLocaleDateString()} · 1:{rate.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View className="px-2.5 py-1 bg-[#e7f8ef] rounded-full">
                      <Text className="text-[#006c4e] text-[9px] font-jakarta-bold uppercase tracking-wider">Completed</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
