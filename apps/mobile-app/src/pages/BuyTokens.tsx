import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';
import { hapticSuccess, hapticError } from '../utils/haptics';
import TransactionSuccessCard from '../components/ui/TransactionSuccessCard';

// Electricity (KPLC) is the only utility on a dedicated NCBA rail today —
// see apps/mobile-app/src/pages/BulkPay.tsx's DEDICATED_RAIL_UTILITIES.
const TOKEN_TYPES = [
  { id: 'electricity', label: 'Electricity', sub: 'Kenya Power (KPLC)', enabled: true },
];

const ACCOUNT_TYPES = [
  { id: 'KPLC_PREPAID' as const, label: 'Prepaid', desc: 'Buy an electricity token' },
  { id: 'KPLC' as const, label: 'Postpaid', desc: 'Pay down your existing bill' },
];

type CheckState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  customerName: string;
  error: string;
};

export default function BuyTokens({ navigation }: any) {
  const { merchant, refreshSession } = useAuth();
  const [accountType, setAccountType] = useState<'KPLC' | 'KPLC_PREPAID'>('KPLC_PREPAID');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [check, setCheck] = useState<CheckState>({ status: 'idle', customerName: '', error: '' });
  const isPrepaid = accountType === 'KPLC_PREPAID';
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [completedTx, setCompletedTx] = useState<any>(null);

  const merchantPhone = merchant?.phone || '';
  const resetCheck = () => setCheck({ status: 'idle', customerName: '', error: '' });

  const handleVerifyMeter = async () => {
    if (!/^\d{5,15}$/.test(meterNumber.trim())) {
      setCheck({ status: 'error', customerName: '', error: 'Enter a valid numeric meter number.' });
      return;
    }
    if (!merchantPhone) {
      setCheck({ status: 'error', customerName: '', error: 'Your account has no registered phone number to notify.' });
      return;
    }
    setCheck({ status: 'loading', customerName: '', error: '' });
    try {
      const endpoint = isPrepaid ? 'validate-kplc-prepaid-meter' : 'validate-kplc-meter';
      const res = await api.post(`/api/bulkpay/${endpoint}`, {
        meterNumber: meterNumber.trim(),
        msisdn: merchantPhone,
      });
      setCheck({ status: 'success', customerName: res.data?.customerName || '', error: '' });
    } catch (e: any) {
      setCheck({ status: 'error', customerName: '', error: e?.response?.data?.message || 'Could not verify this meter number.' });
    }
  };

  const numericAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const canPay = check.status === 'success' && numericAmount > 0;

  const openPin = () => {
    if (!canPay) return;
    setPin('');
    setPinError('');
    setShowPin(true);
  };

  const handleBuyToken = async () => {
    if (pin.length !== 4) return;
    setIsPaying(true);
    try {
      // A KPLC Prepaid payee is saved first (same as Add Payee in BulkPay) so
      // authorizeBatch can resolve a real Payee with utilityProvider/
      // accountNumber set — an inline batchRow with no payeeMatch is created
      // as a generic Mobile Money payee server-side and would silently skip
      // the dedicated KPLC rail. See bulkPayController.js#authorizeBatch.
      const payeeRes = await api.post('/api/bulkpay/payees', {
        name: `KPLC ${isPrepaid ? 'Token' : 'Bill'} · ${meterNumber.trim()}`,
        type: 'utility',
        utilityType: 'Electricity',
        utilityProvider: accountType,
        accountNumber: meterNumber.trim(),
        phone: merchantPhone,
        defaultAmount: numericAmount,
      });
      const payee = payeeRes.data;

      const res = await api.post('/api/bulkpay/authorize', {
        batchRows: [{
          payeeMatch: payee._id,
          name: payee.name,
          type: 'utility',
          phone: merchantPhone,
          grossAmount: numericAmount,
          netAmount: numericAmount,
        }],
        fundingSource: merchant?.businessName || 'Main Business Account',
        pin,
      });

      const tx = res.data?.batch?.transactions?.[0];
      setCompletedTx({
        reference: tx?.receiptNumber || res.data?.batch?.batchReference,
        createdAt: new Date().toISOString(),
        status: tx?.status || 'pending',
        type: isPrepaid ? 'ncba_kplc_prepaid' : 'ncba_kplc',
        amount: numericAmount,
      });
      hapticSuccess();
      setShowPin(false);
      setSuccess(true);
      refreshSession();
    } catch (e: any) {
      hapticError();
      const message = e?.response?.data?.message || `Could not ${isPrepaid ? 'buy this token' : 'pay this bill'}. Please try again.`;
      if (e?.response?.status === 401) {
        setPin('');
      } else {
        setShowPin(false);
      }
      setPinError(message);
    } finally {
      setIsPaying(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Buy Tokens" showBack={false} />
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-6">
            <TransactionSuccessCard
              amount={numericAmount}
              methodLabel={isPrepaid ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill'}
              recipientDisplay={`Meter ${meterNumber.trim()}`}
              phoneNumber={merchantPhone}
              transaction={completedTx}
              onDone={() => navigation?.navigate('Home')}
              doneLabel="Back to Dashboard"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Buy Tokens" subtitle="Kenya Power electricity payments" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-6">
          <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Token Type</Text>
          <View className="flex-row gap-2 mb-6">
            {TOKEN_TYPES.map((t) => (
              <View key={t.id} className="flex-1 px-3 py-3 rounded-xl border items-center justify-center bg-[#00351d] border-[#00351d]">
                <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-wide text-center text-white">{t.label}</Text>
                <Text className="text-[9px] font-jakarta-medium mt-0.5 text-center text-[#5efeb3]">{t.sub}</Text>
              </View>
            ))}
          </View>

          <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Account Type</Text>
          <View className="flex-row gap-2 p-1.5 bg-white rounded-2xl border border-[#e7ece7] mb-6">
            {ACCOUNT_TYPES.map((opt) => {
              const isActive = accountType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => { resetCheck(); setAccountType(opt.id); }}
                  className={`flex-1 py-2.5 rounded-xl items-center ${isActive ? 'bg-[#00351d]' : ''}`}
                >
                  <Text className={`text-[11px] font-jakarta-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#9ca3af]'}`}>{opt.label}</Text>
                  <Text className={`text-[9px] font-jakarta-medium mt-0.5 text-center ${isActive ? 'text-[#5efeb3]' : 'text-[#9ca3af]'}`}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="bg-white rounded-[28px] border border-[#eff4ef] shadow-sm p-5 mb-6">
            <View className="flex-row items-center gap-3 mb-5">
              <View className="bg-[#f7faf7] rounded-xl px-2.5 py-2 border border-[#eff4ef]">
                <Image source={require('../../assets/kplc icon.png')} style={{ width: 32, height: 32 }} resizeMode="contain" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-jakarta-extrabold text-[#00351d]">{isPrepaid ? 'Kenya Power Prepaid' : 'Kenya Power Postpaid'}</Text>
                <Text className="text-[10.5px] text-[#707971] font-jakarta-medium mt-0.5">
                  {isPrepaid ? 'Buy an electricity token for any meter' : "Pay down the balance on an existing bill"}
                </Text>
              </View>
            </View>

            <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">Meter Number</Text>
            <TextInput
              value={meterNumber}
              onChangeText={(t) => { resetCheck(); setMeterNumber(t.replace(/\D/g, '')); }}
              keyboardType="numeric"
              placeholder="e.g. 107803292"
              placeholderTextColor="#a1a1aa"
              className="bg-[#f0fdf4] border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-4"
            />

            <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1.5">Amount (KES)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g. 1,000"
              placeholderTextColor="#a1a1aa"
              className="bg-[#f0fdf4] border border-[#e7ece7] rounded-xl px-4 py-3 text-[#0c2010] font-jakarta-bold text-[14px] mb-4"
            />

            <TouchableOpacity
              onPress={handleVerifyMeter}
              disabled={check.status === 'loading' || !meterNumber.trim()}
              style={{ opacity: check.status === 'loading' || !meterNumber.trim() ? 0.6 : 1 }}
              className="bg-amber-600 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-jakarta-bold text-[11px] uppercase tracking-wider">
                {check.status === 'loading' ? 'Verifying…' : 'Verify Meter'}
              </Text>
            </TouchableOpacity>

            {check.status === 'success' && (
              <View className="flex-row items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 mt-3">
                <Feather name="check-circle" size={16} color="#059669" />
                <View className="flex-1">
                  <Text className="text-[13px] font-jakarta-bold text-[#0c2010]">{check.customerName || 'Meter verified'}</Text>
                  <Text className="text-[11px] text-[#707971] font-jakarta-medium mt-0.5">
                    {isPrepaid ? 'This meter is ready for a token purchase.' : 'This meter is ready for a bill payment.'}
                  </Text>
                </View>
              </View>
            )}
            {check.status === 'error' && (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-3 mt-3">
                <Feather name="alert-circle" size={14} color="#dc2626" />
                <Text className="text-[12px] font-jakarta-bold text-red-700 flex-1">{check.error}</Text>
              </View>
            )}

            {/* Notification number is fixed to the merchant's own registered
                phone, never editable here — KPLC's SMS always lands on the
                account's primary number, not an arbitrary one typed into a
                form. */}
            <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-dashed border-[#eff4ef]">
              <Feather name="message-circle" size={13} color="#5b645c" />
              <Text className="text-[11px] text-[#5b645c] font-jakarta-medium flex-1">
                {isPrepaid ? 'Token' : 'Payment confirmation'} sent via SMS to your registered number{merchantPhone ? ` · ${formatPhoneDisplay(merchantPhone)}` : ''}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating CTA bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-[#eff4ef] px-6 pt-3 pb-7">
        <View className="w-full max-w-lg mx-auto">
          <TouchableOpacity
            onPress={openPin}
            disabled={!canPay}
            style={{ opacity: canPay ? 1 : 0.5 }}
            className="w-full bg-[#00351d] h-[56px] rounded-full items-center justify-center"
          >
            <Text className="text-white font-jakarta-bold text-[15px]">
              {numericAmount > 0
                ? `${isPrepaid ? 'Buy Token' : 'Pay Bill'} · KES ${numericAmount.toLocaleString()}`
                : isPrepaid ? 'Buy Token' : 'Pay Bill'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── PIN Modal ── */}
      <Modal visible={showPin} transparent animationType="slide" onRequestClose={() => !isPaying && setShowPin(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end bg-black/50">
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => !isPaying && setShowPin(false)} />
            <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto">
              <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-full bg-[#00351d] items-center justify-center mb-4">
                  <Feather name="lock" size={24} color="#5efeb3" />
                </View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#0c2010] mb-1">
                  {isPrepaid ? 'Confirm Purchase' : 'Confirm Payment'}
                </Text>
                <Text className="text-[#707971] font-jakarta-medium text-[12px] text-center">
                  Enter your Payment PIN to {isPrepaid ? 'buy this token' : 'pay this bill'}
                </Text>
              </View>
              <TextInput
                value={pin}
                onChangeText={(t) => { setPinError(''); setPin(t.replace(/\D/g, '').slice(0, 4)); }}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                editable={!isPaying}
                className="bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-5 py-4 text-[#0c2010] font-jakarta-bold text-[20px] tracking-[0.5em] text-center mb-3"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
                autoFocus
              />
              {!!pinError && (
                <Text className="text-[12px] text-red-600 font-jakarta-bold text-center mb-3">{pinError}</Text>
              )}
              <TouchableOpacity
                onPress={handleBuyToken}
                disabled={pin.length !== 4 || isPaying}
                className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center mt-3"
                style={{ opacity: pin.length !== 4 || isPaying ? 0.7 : 1 }}
              >
                {isPaying ? <ActivityIndicator color="#fff" /> : (
                  <Text className="text-white font-jakarta-bold text-[15px]">{isPrepaid ? 'Confirm & Buy' : 'Confirm & Pay'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
