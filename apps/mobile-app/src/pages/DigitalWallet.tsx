import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { isCreditTransaction, isDebitTransaction } from '../utils/transactionDirection';

function formatKES(n: number | null | undefined) {
  if (n == null) return 'KES 0.00';
  return `KES ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Destination = 'bank' | 'mpesa';
type FundingMethod = 'mobile';

export default function DigitalWallet({ navigation }: any) {
  const { merchant, refreshSession } = useAuth();
  const walletActivated = !!merchant?.stellarPublicKey;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usdcBalance, setUsdcBalance] = useState(merchant?.usdcBalance || 0);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const hasSynced = useRef(false);

  // Withdraw
  const destinations: Array<{ id: Destination; name: string; type: string; acc: string; icon: keyof typeof Feather.glyphMap; verified: boolean }> = [
    {
      id: 'bank',
      name: merchant?.settlementBankName || 'Bank Transfer',
      type: 'Bank',
      acc: merchant?.settlementBankAccount ? `**** ${String(merchant.settlementBankAccount).slice(-4)}` : 'Not Configured',
      icon: 'briefcase',
      verified: !!merchant?.settlementBankAccount,
    },
    {
      id: 'mpesa',
      name: 'M-PESA Number',
      type: 'Mobile',
      acc: merchant?.settlementMobile ? `07** *** ${String(merchant.settlementMobile).slice(-3)}` : 'Not Configured',
      icon: 'smartphone',
      verified: !!merchant?.settlementMobile,
    },
  ];
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [destination, setDestination] = useState<Destination>('bank');
  const [destinationValue, setDestinationValue] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const selectedDest = destinations.find((d) => d.id === destination)!;

  // Settlement settings
  const [showSettings, setShowSettings] = useState(false);
  const [settleBankName, setSettleBankName] = useState('');
  const [settleBankAccount, setSettleBankAccount] = useState('');
  const [settleMobile, setSettleMobile] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Payment link
  const [linkAmount, setLinkAmount] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Top up
  const [showTopUp, setShowTopUp] = useState(false);
  const [fundingMethod, setFundingMethod] = useState<FundingMethod | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPhone, setTopUpPhone] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [stkStatusText, setStkStatusText] = useState('');

  // app.paychain.co.ke, not the marketing site (paychain.co.ke) — that's
  // where /pay/account/:account actually lives (merchant-dashboard's
  // App.jsx). Previously pointed at the marketing site, which has no such
  // route and would have 404'd on every scan.
  const qrData = `https://app.paychain.co.ke/pay/account/${merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}&margin=10&bgcolor=FFFFFF&color=00351D`;

  const fetchData = useCallback(async () => {
    try {
      if (merchant?.stellarPublicKey && !hasSynced.current) {
        hasSynced.current = true;
        try {
          const syncRes = await api.post('/api/transactions/sync-wallet');
          if (syncRes.data?.success) setUsdcBalance(syncRes.data.usdcBalance ?? syncRes.data.balance ?? 0);
        } catch (e) {
          console.error('Failed to sync wallet', e);
        }
      }
      const [txRes, rateRes] = await Promise.all([
        api.get('/api/transactions'),
        api.get('/api/transactions/live-rate').catch(() => null),
      ]);
      const list = Array.isArray(txRes.data) ? txRes.data : Array.isArray(txRes.data?.transactions) ? txRes.data.transactions : [];
      setTransactions(list);
      if (rateRes?.data?.success) setLiveRate(rateRes.data.rate);
    } catch (err) {
      console.error('Failed to load wallet data', err);
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.stellarPublicKey]);

  useEffect(() => {
    if (merchant) fetchData();
    else setIsLoading(false);
  }, [merchant, fetchData]);

  useEffect(() => {
    if (showSettings && merchant) {
      setSettleBankName(merchant.settlementBankName || '');
      setSettleBankAccount(merchant.settlementBankAccount || '');
      setSettleMobile(merchant.settlementMobile || '');
    }
  }, [showSettings, merchant]);

  const handleActivateWallet = async () => {
    setActivateError('');
    setIsActivating(true);
    try {
      await api.post('/api/transactions/activate-wallet');
      await refreshSession();
      Alert.alert('Wallet Activated', 'Your Stellar wallet address is ready.');
    } catch (err: any) {
      setActivateError(err?.response?.data?.error || 'Failed to activate wallet.');
    } finally {
      setIsActivating(false);
    }
  };

  const copyAddress = async () => {
    const addr = merchant?.stellarPublicKey;
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    Alert.alert('Address Copied', 'Wallet address copied to clipboard.');
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amount) || amount <= 0) return;
    if (!destinationValue) {
      Alert.alert('Missing Account Details', 'Please enter the destination account details.');
      return;
    }
    setIsWithdrawing(true);
    try {
      if (selectedDest.type === 'Mobile') {
        const phone = destinationValue.replace(/^(?:\+?254|0)/, '254');
        await api.post('/api/callbacks/b2c-request', { phone, amount });
        Alert.alert('Withdrawal Processing', `KES ${withdrawAmount} sent to phone. B2C transfer initiated.`);
      } else {
        await api.post('/api/transactions/send-money', {
          amount,
          destination,
          reference: `Withdrawal to ${destinationValue}`,
        });
        Alert.alert('Withdrawal Initiated', `KES ${withdrawAmount} sent to destination.`);
      }
      setWithdrawAmount('');
      setDestinationValue('');
      await refreshSession();
      fetchData();
    } catch (err: any) {
      Alert.alert('Withdrawal Failed', err?.response?.data?.error || err?.response?.data?.message || 'Failed to withdraw funds.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await api.put('/api/auth/merchant/profile', {
        settlementBankName: settleBankName,
        settlementBankAccount: settleBankAccount,
        settlementMobile: settleMobile,
      });
      await refreshSession();
      setShowSettings(false);
      Alert.alert('Settings Saved', 'Your settlement destinations have been updated.');
    } catch (err: any) {
      Alert.alert('Failed to Save', err?.response?.data?.error || 'Could not save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const generatePaymentLink = async () => {
    const amount = Number(linkAmount);
    if (!linkAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to generate a link.');
      return;
    }
    setIsGeneratingLink(true);
    try {
      const res = await api.post('/api/transactions/payment-link', { amount });
      if (res.data?.success) {
        setGeneratedLink(`https://paychain.co.ke/pay/${res.data.linkId}`);
      }
    } catch (err: any) {
      Alert.alert('Generation Failed', err?.response?.data?.error || 'Failed to generate secure payment link.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyPaymentLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    Alert.alert('Link Copied', 'Payment link copied to clipboard.');
  };

  const shareQR = async () => {
    try {
      await Share.share({
        message: `Scan to pay ${merchant?.businessName || 'Merchant'} on PayChain: ${qrData}`,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const copyQrLink = async () => {
    await Clipboard.setStringAsync(qrData);
    Alert.alert('Link Copied', 'Payment link copied to clipboard.');
  };

  const exportQrPdf = async () => {
    setIsExportingPdf(true);
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; background:#0b0e14; color:#fff; margin:0; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; }
        img { width:260px; height:260px; border-radius:20px; margin-bottom:24px; border:6px solid #fff; padding:12px; background:#fff; }
        h1 { font-size:20px; color:#5efeb3; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.2em; }
        p { font-size:14px; margin:4px 0; letter-spacing:0.08em; color:#c0e5d3; }
      </style></head><body>
        <img src="${qrUrl}" />
        <h1>Settlement QR</h1>
        <p>ACC: ${merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending'}</p>
        <p>MERCHANT: ${merchant?.businessName || 'Merchant'}</p>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'PayChain Settlement QR', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('QR Ready', `Saved to: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export the QR code.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const closeTopUp = () => {
    setShowTopUp(false);
    setFundingMethod(null);
    setTopUpAmount('');
    setTopUpPhone('');
    setStkStatusText('');
  };

  const submitMobileTopUp = async () => {
    if (!topUpAmount || !topUpPhone) return;
    setIsProcessingTopUp(true);
    setStkStatusText('Initiating STK Push...');
    try {
      const pushRes = await api.post('/api/callbacks/stk-push', {
        amount: Number(topUpAmount),
        phone: topUpPhone,
        merchantId: merchant?._id,
      });
      const checkoutId = pushRes.data.checkoutRequestId;
      setStkStatusText('Awaiting PIN on phone...');

      let attempts = 0;
      const maxAttempts = 20;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.get(`/api/callbacks/stk-status/${checkoutId}`);
          if (statusRes.data.status === 'success') {
            clearInterval(poll);
            Alert.alert('Top Up Successful', `Successfully funded ${topUpAmount} KES via M-Pesa.`);
            await refreshSession();
            fetchData();
            closeTopUp();
            setIsProcessingTopUp(false);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(poll);
            Alert.alert('Top Up Failed', statusRes.data.resultDesc || 'User cancelled or request failed.');
            setStkStatusText('');
            setIsProcessingTopUp(false);
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            Alert.alert('Timeout', 'The request timed out. Please try again.');
            setStkStatusText('');
            setIsProcessingTopUp(false);
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 3000);
    } catch (err: any) {
      setStkStatusText('');
      setIsProcessingTopUp(false);
      if (err?.response?.status >= 500) {
        Alert.alert('Check Your Phone', 'The STK prompt may have been sent. If you see an M-PESA prompt, enter your PIN. Otherwise try again.');
      } else {
        Alert.alert('STK Push Failed', err?.response?.data?.error || 'Could not send STK Push. Please try again.');
      }
    }
  };

  const activityMeta = (tx: any) => {
    const isOut = isDebitTransaction(tx.type);
    const isIn = isCreditTransaction(tx.type);
    return {
      label: isIn ? 'Funds Deposit' : isOut ? 'Funds Withdrawal' : 'Currency Swap',
      icon: (isIn ? 'log-in' : isOut ? 'log-out' : 'refresh-cw') as keyof typeof Feather.glyphMap,
      color: isIn ? '#059669' : isOut ? '#d97706' : '#2563eb',
      bg: isIn ? '#e7f8ef' : isOut ? '#fef3e7' : '#eef2ff',
      sign: isIn ? '+' : isOut ? '-' : '',
      amount: tx.type === 'fx_swap' ? `${(tx.usdcAmount || 0).toFixed(2)} USDC` : formatKES(tx.kesAmount || tx.amount || 0),
    };
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Digital Wallet" subtitle="Global settlement, local liquidity" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-8">

          {/* Hero: USDC + KES balance */}
          {walletActivated ? (
            <View className="bg-[#0A0D14] rounded-[32px] p-6 mb-4 relative overflow-hidden border border-[#1E2532] shadow-2xl">
              <View className="absolute top-0 right-0 w-72 h-72 bg-[#2775CA]/10 rounded-full -mr-32 -mt-32" />
              <View className="relative z-10">
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center gap-2 bg-[#1A212D] border border-[#2A3441] rounded-full px-3 py-1.5">
                    <View className="w-4 h-4 rounded-full bg-[#2775CA] items-center justify-center">
                      <Text className="text-[9px] text-white font-jakarta-extrabold">$</Text>
                    </View>
                    <Text className="text-[9px] font-jakarta-bold tracking-[0.15em] uppercase text-[#8B98A9]">USDC Network</Text>
                  </View>
                </View>

                <Text className="text-[#8B98A9] text-[10px] font-jakarta-extrabold uppercase tracking-[0.2em] mb-1">Global Settlement Balance</Text>
                <View className="flex-row items-baseline gap-2 mb-3">
                  <Text className="text-white text-[32px] font-jakarta-extrabold tracking-tight">{usdcBalance.toFixed(2)}</Text>
                  <Text className="text-[#2775CA] text-[16px] font-jakarta-bold">USDC</Text>
                </View>

                <TouchableOpacity onPress={copyAddress} activeOpacity={0.85} className="flex-row items-center gap-2 self-start px-3 py-1.5 bg-[#1A212D] rounded-full border border-[#2A3441] mb-6">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#35D07F]" />
                  <Text className="text-[10px] text-[#8B98A9] font-jakarta-medium tracking-wider">
                    {merchant?.stellarPublicKey ? `${merchant.stellarPublicKey.slice(0, 6)}...${merchant.stellarPublicKey.slice(-4)}` : '—'}
                  </Text>
                  <Feather name="copy" size={11} color="#8B98A9" />
                </TouchableOpacity>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => navigation?.navigate('InflationShield')}
                    activeOpacity={0.85}
                    className="flex-1 py-3 bg-[#1A212D] rounded-2xl items-center justify-center border border-[#2A3441] flex-row gap-2"
                  >
                    <MaterialIcons name="swap-horiz" size={16} color="#8B98A9" />
                    <Text className="text-white text-[10px] font-jakarta-extrabold uppercase tracking-widest">Swap KES</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowTopUp(true)}
                    activeOpacity={0.85}
                    className="flex-1 py-3 bg-[#2775CA] rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-[#2775CA]/30"
                  >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text className="text-white text-[10px] font-jakarta-extrabold uppercase tracking-widest">Top Up</Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-[#1E2532]/60">
                  <Text className="text-[8px] font-jakarta-extrabold uppercase tracking-[0.2em] text-[#8B98A9]/50">Supported Networks</Text>
                  <Text className="text-[8px] font-jakarta-bold text-[#8B98A9]/70 uppercase tracking-widest">Stellar · USDC · Polygon · Celo</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="bg-[#0A0D14] rounded-[32px] p-7 mb-4 items-center border border-[#1E2532] shadow-2xl relative overflow-hidden">
              <View className="absolute top-0 right-0 w-56 h-56 bg-[#2775CA]/10 rounded-full -mr-20 -mt-20" />
              <View className="relative z-10 items-center">
                <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2775CA]/10 border border-[#2775CA]/20 mb-4">
                  <MaterialIcons name="stars" size={12} color="#2775CA" />
                  <Text className="text-[#2775CA] text-[9px] font-jakarta-extrabold uppercase tracking-[0.2em]">One-time setup</Text>
                </View>
                <View className="w-14 h-14 rounded-full bg-[#1A212D] items-center justify-center border border-[#2A3441] mb-4">
                  <MaterialIcons name="account-balance-wallet" size={26} color="#2775CA" />
                </View>
                <Text className="text-white font-jakarta-bold text-[15px] mb-1.5">Digital Wallet Not Yet Active</Text>
                <Text className="text-[#8B98A9] text-[11px] text-center mb-1.5 max-w-[240px] leading-relaxed">
                  Activate once to get your Stellar wallet address. Unlocks USDC settlement and Inflation Shield.
                </Text>
                <Text className="text-[#8B98A9]/50 text-[10px] font-jakarta-medium mb-5">Takes under 10 seconds. Cannot be undone.</Text>

                {!!activateError && (
                  <View className="w-full bg-white/5 border border-red-400/30 rounded-2xl px-4 py-3 mb-4">
                    <Text className="text-red-300 text-[11px] font-jakarta-semibold">{activateError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleActivateWallet}
                  disabled={isActivating}
                  activeOpacity={0.85}
                  className="w-full py-3.5 bg-[#2775CA] rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-[#2775CA]/30"
                >
                  {isActivating ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <MaterialIcons name="bolt" size={17} color="#fff" />
                      <Text className="text-white text-[12px] font-jakarta-extrabold uppercase tracking-widest">Activate Digital Wallet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View className="bg-white rounded-[32px] p-6 mb-8 border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 relative overflow-hidden">
            <View className="flex-row justify-between items-start mb-5">
              <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                <Text className="text-[#006c4e] text-[9px] font-jakarta-extrabold uppercase tracking-[0.15em]">Local Liquidity</Text>
              </View>
              <View className="w-10 h-10 rounded-xl bg-[#e7f8ef] items-center justify-center">
                <MaterialIcons name="payments" size={18} color="#006c4e" />
              </View>
            </View>
            <Text className="text-[#707971]/60 text-[10px] font-jakarta-bold uppercase tracking-widest mb-1">Available for Withdrawal</Text>
            <Text className="text-[#00351d] text-[30px] font-jakarta-extrabold tracking-tight mb-4">{formatKES(merchant?.kesBalance || 0)}</Text>
            {liveRate != null && walletActivated && (
              <Text className="text-[#707971] text-[11px] font-jakarta-medium">1 USDC ≈ {formatKES(liveRate)}</Text>
            )}
          </View>

          {/* Withdraw Funds */}
          <View className="bg-white rounded-[32px] p-6 mb-8 border border-[#eff4ef] shadow-sm shadow-[#00351d]/5">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">Withdraw Funds</Text>
                <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-70">Settlement Destination</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettings(true)} className="w-11 h-11 rounded-2xl bg-[#f7faf7] items-center justify-center border border-[#eff4ef]">
                <Feather name="settings" size={18} color="#707971" />
              </TouchableOpacity>
            </View>

            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Amount to Withdraw (KES)</Text>
            <TextInput
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="0.00"
              placeholderTextColor="#a1a1aa"
              className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d] mb-5"
            />

            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Destination</Text>
            <View className="gap-3 mb-5">
              {destinations.map((dest) => {
                const active = destination === dest.id;
                return (
                  <TouchableOpacity
                    key={dest.id}
                    onPress={() => setDestination(dest.id)}
                    activeOpacity={0.85}
                    className={`flex-row items-center gap-3 p-4 rounded-2xl border ${active ? 'bg-[#00351d] border-[#00351d]' : 'bg-[#f7faf7] border-[#eff4ef]'}`}
                  >
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${active ? 'border-[#5efeb3]' : 'border-[#bfc9bf]'}`}>
                      {active && <View className="w-2 h-2 rounded-full bg-[#5efeb3]" />}
                    </View>
                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${active ? 'bg-white/10' : 'bg-white'}`}>
                      <Feather name={dest.icon} size={16} color={active ? '#5efeb3' : '#00351d'} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text className={`text-[14px] font-jakarta-bold ${active ? 'text-white' : 'text-[#00351d]'}`}>{dest.name}</Text>
                        {dest.verified && <Feather name="check-circle" size={12} color={active ? '#5efeb3' : '#059669'} />}
                      </View>
                      <Text className={`text-[11px] font-jakarta-medium mt-0.5 ${active ? 'text-white/60' : 'text-[#707971]'}`}>
                        {dest.type} · {dest.acc}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">
              {selectedDest.type === 'Bank' ? 'Bank Account Number' : 'M-PESA Number'}
            </Text>
            {selectedDest.type === 'Bank' ? (
              <TextInput
                value={destinationValue}
                onChangeText={setDestinationValue}
                placeholder={merchant?.settlementBankAccount || 'e.g. 1122334455'}
                placeholderTextColor="#a1a1aa"
                keyboardType="number-pad"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d] mb-2"
              />
            ) : (
              <ValidatedTextInput
                kind="phoneKE"
                value={destinationValue}
                onChangeText={setDestinationValue}
                placeholder={merchant?.settlementMobile || '07xxxxxxxx'}
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d]"
              />
            )}
            {!selectedDest.verified && (
              <View className="flex-row items-center gap-1.5 mt-2 mb-1">
                <Feather name="alert-triangle" size={12} color="#b45309" />
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-wider text-[#b45309]">Not configured in settings</Text>
              </View>
            )}

            <View className="bg-[#f0fdf4] rounded-2xl border border-[#e7ece7] p-4 flex-row items-start gap-3 mt-4 mb-6">
              <Feather name="info" size={15} color="#006c4e" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[12px] text-[#006c4e] font-jakarta-medium leading-relaxed">
                Withdrawals are typically processed within <Text className="font-jakarta-extrabold">minutes</Text>.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount}
              activeOpacity={0.9}
              className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-[#00351d]/20"
              style={{ opacity: isWithdrawing || !withdrawAmount ? 0.5 : 1 }}
            >
              {isWithdrawing ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Confirm Withdrawal</Text>
                  <Feather name="send" size={14} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* My QR */}
          <View className="bg-[#0B0E14] rounded-[32px] p-6 mb-8 border border-[#1E2532] shadow-2xl relative overflow-hidden">
            <View className="absolute top-0 right-0 w-72 h-72 bg-[#2775CA]/5 rounded-full -mr-32 -mt-32" />
            <View className="relative z-10">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-white text-[24px] mb-1">My QR</Text>
              <Text className="text-[#8B98A9] text-[9px] font-jakarta-extrabold uppercase tracking-[0.2em] mb-6">Professional Settlement Tool</Text>

              <View className="items-center mb-6">
                <View className="bg-white p-3 rounded-[20px] mb-4 w-[180px] h-[180px] items-center justify-center">
                  <Image source={{ uri: qrUrl }} style={{ width: 160, height: 160, borderRadius: 12 }} />
                </View>
                <View className="bg-[#2775CA]/10 border border-[#2775CA]/20 rounded-md px-2.5 py-1 mb-2">
                  <Text className="text-[#2775CA] text-[9px] font-jakarta-extrabold uppercase tracking-[0.2em]">Settlement QR</Text>
                </View>
                <Text className="text-white text-[14px] font-jakarta-bold tracking-widest">ACC: {merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending'}</Text>
                <Text className="text-[#8B98A9] text-[9px] font-jakarta-bold uppercase tracking-widest mt-1">{merchant?.businessName || 'Merchant'}</Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity onPress={shareQR} activeOpacity={0.85} className="flex-1 py-3.5 bg-[#131722] border border-[#1E2532] rounded-2xl items-center gap-1.5">
                  <Feather name="share-2" size={16} color="#8B98A9" />
                  <Text className="text-[#8B98A9] text-[8px] font-jakarta-extrabold uppercase tracking-widest">Share QR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={exportQrPdf} disabled={isExportingPdf} activeOpacity={0.85} className="flex-1 py-3.5 bg-[#131722] border border-[#1E2532] rounded-2xl items-center gap-1.5">
                  {isExportingPdf ? <ActivityIndicator color="#8B98A9" size="small" /> : <Feather name="file-text" size={16} color="#8B98A9" />}
                  <Text className="text-[#8B98A9] text-[8px] font-jakarta-extrabold uppercase tracking-widest">Export PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyQrLink} activeOpacity={0.85} className="flex-1 py-3.5 bg-[#131722] border border-[#1E2532] rounded-2xl items-center gap-1.5">
                  <Feather name="copy" size={16} color="#8B98A9" />
                  <Text className="text-[#8B98A9] text-[8px] font-jakarta-extrabold uppercase tracking-widest">Copy Link</Text>
                </TouchableOpacity>
              </View>

              {/* Payment Link Generator */}
              <View className="mt-8 pt-6 border-t border-[#1E2532]">
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-2xl bg-[#131722] items-center justify-center border border-[#1E2532]">
                    <Feather name="link" size={17} color="#2775CA" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-jakarta-bold text-white text-[15px]">Generate Payment Link</Text>
                    <Text className="text-[#8B98A9] text-[10px] font-jakarta-medium mt-0.5">Share a secure link for a specific amount.</Text>
                  </View>
                </View>

                <View className="flex-row gap-2.5">
                  <View className="flex-1 bg-[#0B0E14] rounded-2xl border border-[#1E2532] px-4 justify-center">
                    <ValidatedTextInput
                      kind="amount"
                      optional
                      value={linkAmount}
                      onChangeText={(v) => { setLinkAmount(v); setGeneratedLink(''); }}
                      placeholder="0.00"
                      placeholderTextColor="#3a4250"
                      className="py-4 text-[15px] font-jakarta-extrabold text-white"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={generatePaymentLink}
                    disabled={isGeneratingLink || !linkAmount}
                    activeOpacity={0.85}
                    className="px-6 bg-[#2775CA] rounded-2xl items-center justify-center"
                    style={{ opacity: isGeneratingLink || !linkAmount ? 0.5 : 1 }}
                  >
                    {isGeneratingLink ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text className="text-white text-[11px] font-jakarta-extrabold uppercase tracking-widest">Generate</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {!!generatedLink && (
                  <View className="mt-5 bg-[#0B0E14] rounded-2xl border border-[#1E2532] p-4 flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[9px] font-jakarta-bold text-[#8B98A9] uppercase tracking-widest mb-1">Link Ready</Text>
                      <Text className="text-[12px] font-jakarta-bold text-white" numberOfLines={1}>{generatedLink}</Text>
                    </View>
                    <TouchableOpacity onPress={copyPaymentLink} className="px-4 py-2.5 bg-[#131722] border border-[#1E2532] rounded-xl">
                      <Feather name="copy" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Bank Transfer / EFT / PesaLink — PayChain Account */}
          <View className="bg-white rounded-[32px] p-6 mb-8 border border-[#eff4ef] shadow-sm shadow-[#00351d]/5">
            <View className="flex-row items-start gap-4 mb-4">
              <View className="w-11 h-11 rounded-2xl bg-blue-50 items-center justify-center">
                <MaterialIcons name="account-balance" size={20} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-[0.2em] text-[#707971] mb-1">Bank Transfer · EFT · PesaLink</Text>
                <Text className="font-jakarta-extrabold text-[16px] text-[#00351d] tracking-tight">PayChain Account</Text>
                <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-1 leading-relaxed">
                  Customers can also pay directly from their bank using this dedicated account number.
                </Text>
              </View>
            </View>
            {/* Full NCBA virtual account is null until NCBA assigns the
                institution prefix — falls back to the 8-digit merchant
                code, already safe to use (matched inside NCBA's Narrative
                field), before showing a true pending state. */}
            {(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode) ? (
              <View className="flex-row items-center justify-between bg-[#f0fdf4] rounded-2xl px-5 py-4">
                <Text className="font-jakarta-extrabold text-[16px] text-[#00351d] tracking-widest">{merchant.ncbaVirtualAccountNumber || merchant.ncbaMerchantCode}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const value = merchant.ncbaVirtualAccountNumber || merchant.ncbaMerchantCode;
                    await Clipboard.setStringAsync(value);
                    Alert.alert('Copied', 'PayChain Account number copied to clipboard.');
                  }}
                  activeOpacity={0.85}
                  className="p-2.5 bg-[#006c4e] rounded-xl"
                >
                  <Feather name="copy" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                <Feather name="clock" size={15} color="#b45309" />
                <Text className="text-amber-700 text-[11px] font-jakarta-extrabold uppercase tracking-widest">Pending bank assignment</Text>
              </View>
            )}
          </View>

          {/* Recent Wallet Activity */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-jakarta-bold text-[#0c2010]">Recent Wallet Activity</Text>
              <TouchableOpacity onPress={() => navigation?.navigate('Transactions')}>
                <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-widest">View All</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#bfc9bf]/10">
              {isLoading ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator color="#0b4d2e" />
                </View>
              ) : transactions.length === 0 ? (
                <View className="py-10 items-center justify-center">
                  <Text className="text-[#707971] font-jakarta-medium">No transaction history yet</Text>
                </View>
              ) : (
                transactions.slice(0, 5).map((tx, index, arr) => {
                  const meta = activityMeta(tx);
                  return (
                    <View key={tx._id || index} className={`flex-row items-center py-3 px-4 ${index !== Math.min(arr.length - 1, 4) ? 'border-b border-[#eff4ef]/50' : ''}`}>
                      <View style={{ backgroundColor: meta.bg }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
                        <Feather name={meta.icon} size={16} color={meta.color} />
                      </View>
                      <View className="flex-1 min-w-0 mr-2">
                        <Text className="font-jakarta-bold text-[13px] text-[#0c2010]">{meta.label}</Text>
                        <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5">
                          {new Date(tx.createdAt || tx.timestamp).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-jakarta-bold text-[13px] text-[#0c2010]">{meta.sign}{meta.amount}</Text>
                        <View style={{ backgroundColor: tx.status === 'completed' ? '#e7f8ef' : '#fef3e7' }} className="px-2 py-0.5 rounded-full mt-1">
                          <Text style={{ color: tx.status === 'completed' ? '#006c4e' : '#b45309' }} className="text-[8px] font-jakarta-extrabold uppercase tracking-widest">{tx.status}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Settlement Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowSettings(false)} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl" style={{ maxHeight: '90%' }}>
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" />
            </View>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#0c2010]">Settlement Details</Text>
                <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-70">Configure where to withdraw your funds</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-[#f7faf7] items-center justify-center">
                <Feather name="x" size={18} color="#00351d" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="briefcase" size={15} color="#059669" />
                <Text className="font-jakarta-bold text-[16px] text-[#00351d]">Bank Account</Text>
              </View>
              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Bank Name</Text>
              <TextInput
                value={settleBankName}
                onChangeText={setSettleBankName}
                placeholder="e.g. KCB Bank"
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d] mb-4"
              />
              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Account Number</Text>
              <TextInput
                value={settleBankAccount}
                onChangeText={setSettleBankAccount}
                placeholder="e.g. 1122334455"
                placeholderTextColor="#a1a1aa"
                keyboardType="number-pad"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d] mb-6"
              />

              <View className="h-[1px] bg-[#eff4ef] mb-6" />

              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="smartphone" size={15} color="#059669" />
                <Text className="font-jakarta-bold text-[16px] text-[#00351d]">Mobile Money</Text>
              </View>
              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">M-PESA Number</Text>
              <ValidatedTextInput
                kind="phoneKE"
                value={settleMobile}
                onChangeText={setSettleMobile}
                placeholder="07xxxxxxxx"
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d]"
              />
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveSettings}
              disabled={isSavingSettings}
              className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20 mt-6"
              style={{ opacity: isSavingSettings ? 0.7 : 1 }}
            >
              {isSavingSettings ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text className="text-white font-jakarta-bold text-[15px] mr-2">Save Settings</Text>
                  <Feather name="save" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Top Up Modal */}
      <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={closeTopUp}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={closeTopUp} />
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl" style={{ maxHeight: '90%' }}>
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" />
            </View>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">
                  {fundingMethod === 'mobile' ? 'Mobile Money' : 'Select Funding Method'}
                </Text>
                <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-70">
                  {fundingMethod ? 'Complete your deposit' : 'Choose how to top up your wallet'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => (fundingMethod ? setFundingMethod(null) : closeTopUp())}
                className="w-10 h-10 rounded-full bg-[#f7faf7] items-center justify-center"
              >
                <Feather name={fundingMethod ? 'arrow-left' : 'x'} size={18} color="#00351d" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!fundingMethod ? (
                <View className="gap-3">
                  {[
                    { id: 'mobile' as const, name: 'Mobile Money', desc: 'M-Pesa, Airtel Money', icon: 'smartphone' as const, bg: '#e7f8ef', color: '#059669' },
                  ].map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      onPress={() => setFundingMethod(method.id)}
                      activeOpacity={0.85}
                      className="flex-row items-center justify-between p-5 rounded-2xl border border-[#eff4ef]"
                    >
                      <View className="flex-row items-center gap-4">
                        <View style={{ backgroundColor: method.bg }} className="w-12 h-12 rounded-2xl items-center justify-center">
                          <Feather name={method.icon} size={20} color={method.color} />
                        </View>
                        <View>
                          <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">{method.name}</Text>
                          <Text className="text-[11px] text-[#707971] font-jakarta-medium">{method.desc}</Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color="#b3b9b4" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View className="gap-5">
                  <View className="bg-[#e7f8ef] p-5 rounded-2xl border border-emerald-100 flex-row items-start gap-3">
                    <Feather name="smartphone" size={15} color="#059669" style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-[12px] text-[#065f46] font-jakarta-medium leading-relaxed">
                      Enter the amount and your mobile number. We'll send an <Text className="font-jakarta-extrabold">STK Push</Text> to your phone for instant top-up.
                    </Text>
                  </View>

                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Amount to Top Up (KES)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={topUpAmount}
                      onChangeText={setTopUpAmount}
                      placeholder="Min 100"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>
                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">M-Pesa / Airtel Number</Text>
                    <ValidatedTextInput
                      kind="phoneKE"
                      value={topUpPhone}
                      onChangeText={setTopUpPhone}
                      placeholder="0712 345 678"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={submitMobileTopUp}
                    disabled={isProcessingTopUp || !topUpAmount || !topUpPhone}
                    className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
                    style={{ opacity: isProcessingTopUp || !topUpAmount || !topUpPhone ? 0.5 : 1 }}
                  >
                    {isProcessingTopUp ? (
                      <View className="flex-row items-center gap-3">
                        <ActivityIndicator color="#fff" size="small" />
                        <Text className="text-white text-[12px] font-jakarta-bold">{stkStatusText}</Text>
                      </View>
                    ) : (
                      <>
                        <Text className="text-white font-jakarta-bold text-[15px] mr-2">Request STK Push</Text>
                        <Feather name="send" size={16} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
