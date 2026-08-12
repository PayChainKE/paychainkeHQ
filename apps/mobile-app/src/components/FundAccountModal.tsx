import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from './ValidatedTextInput';
import { formatAccountNumber } from '../utils/formatAccountNumber';
import api from '../api/config';

// Mirrors the merchant-dashboard's FundAccountModal.jsx exactly — same
// three funding methods, same endpoints, same copy — so a merchant sees
// the identical flow on either app. Always reachable from Dashboard.tsx
// (unlike DigitalWallet.tsx's own Top Up modal, which is hidden behind the
// digitalWallet feature flag that's off by default for new signups — a
// merchant in that state previously had NO way to fund their account from
// the app at all).

type FundingMethod = 'mobile' | 'bank' | 'paybill';

const PAYBILL_BUSINESS_NUMBER = '880100';

const formatKES = (amount: number | string) => {
  const n = Number(amount) || 0;
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export default function FundAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { merchant, refreshSession } = useAuth();

  const [method, setMethod] = useState<FundingMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'sent' | 'success'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ncbaAccountDisplay = merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending bank assignment';
  const ncbaAccountIsUsable = !!(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const reset = () => {
    stopPolling();
    setMethod(null);
    setAmount('');
    setPhone('');
    setStatusText('');
    setPhase('idle');
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const submitMobileTopUp = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid amount greater than 0.');
      return;
    }
    if (!phone || phone.length < 9) {
      Alert.alert('Invalid Number', 'Enter a valid Kenyan phone number.');
      return;
    }

    setIsLoading(true);
    setStatusText('Sending STK Push...');
    setPhase('idle');

    try {
      const res = await api.post('/api/callbacks/stk-push', {
        phone,
        amount: Number(amount),
        merchantId: merchant?._id,
      });
      const checkoutId = res.data.checkoutRequestId;
      setPhase('sent');
      setStatusText('Awaiting PIN on your phone...');

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.get(`/api/callbacks/stk-status/${checkoutId}`);
          if (statusRes.data.status === 'success') {
            stopPolling();
            setPhase('success');
            setStatusText('');
            await refreshSession();
            setTimeout(handleClose, 1800);
          } else if (statusRes.data.status === 'failed') {
            stopPolling();
            setPhase('idle');
            setStatusText('');
            setIsLoading(false);
            Alert.alert('Payment Declined', statusRes.data.resultDesc || 'M-PESA PIN was incorrect or request was cancelled.');
          } else if (attempts >= 20) {
            stopPolling();
            setPhase('idle');
            setStatusText('');
            setIsLoading(false);
            Alert.alert('Timed Out', 'No response from M-PESA after 60s. If you entered your PIN, funds will reflect shortly.');
          }
        } catch { /* silent poll error */ }
      }, 3000);
    } catch (err: any) {
      setPhase('idle');
      setStatusText('');
      setIsLoading(false);
      if (err?.response?.status >= 500) {
        Alert.alert('Check Your Phone', 'The STK prompt may have been sent. If you see an M-PESA prompt, enter your PIN. Otherwise try again.');
      } else {
        Alert.alert('Failed to Send', err?.response?.data?.error || 'Could not initiate STK Push. Please try again.');
      }
    }
  };

  const METHOD_TITLE: Record<FundingMethod, string> = { mobile: 'Mobile Money Top-up', bank: 'Bank Transfer Details', paybill: 'Pay via Paybill' };
  const PAYBILL_STEPS = [
    'Go to the Lipa na M-PESA menu',
    'Select Paybill',
    `Enter ${PAYBILL_BUSINESS_NUMBER} as the business number`,
    `Enter ${formatAccountNumber(ncbaAccountDisplay)} as the account number`,
    'Enter the amount',
    'Enter M-PESA PIN',
  ];

  const CopyRow = ({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) => (
    <View className="mb-3">
      <Text className="text-[10px] font-jakarta-extrabold text-[#707971] uppercase tracking-widest mb-1.5">{label}</Text>
      <View className="flex-row items-center justify-between bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3.5">
        <Text className="font-jakarta-bold text-[#0c2010] text-[14px] flex-1 mr-2">{formatAccountNumber(value)}</Text>
        <TouchableOpacity
          onPress={() => copy(label, value)}
          disabled={disabled}
          className="w-9 h-9 rounded-xl bg-white border border-[#eff4ef] items-center justify-center"
          style={disabled ? { opacity: 0.3 } : undefined}
        >
          <Feather name="copy" size={14} color="#059669" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={handleClose} />
        <View className="w-full max-w-lg mx-auto bg-white rounded-t-[36px] px-6 pt-4 pb-8 mt-auto shadow-2xl" style={{ maxHeight: '90%' }}>
          <View className="items-center mb-4"><View className="w-12 h-1.5 bg-[#e7ece7] rounded-full" /></View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010]">
                {method ? METHOD_TITLE[method] : 'Fund Your Account'}
              </Text>
              <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-70">
                {method ? `Account: ${ncbaAccountDisplay}` : 'Choose how to top up your balance'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (method ? setMethod(null) : handleClose())}
              className="w-10 h-10 rounded-full bg-[#f7faf7] items-center justify-center"
            >
              <Feather name={method ? 'arrow-left' : 'x'} size={18} color="#00351d" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!method ? (
              <View className="gap-3">
                {([
                  { id: 'mobile' as const, name: 'Mobile Money', desc: 'M-Pesa, Airtel Money — instant', icon: 'smartphone' as const },
                  { id: 'bank' as const, name: 'Bank Transfer', desc: 'Transfer from your bank account', icon: 'credit-card' as const },
                  { id: 'paybill' as const, name: 'Paybill', desc: `Lipa na M-Pesa · ${PAYBILL_BUSINESS_NUMBER}`, icon: 'hash' as const },
                ]).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setMethod(m.id)}
                    activeOpacity={0.85}
                    className="flex-row items-center justify-between p-5 rounded-2xl border border-[#eff4ef]"
                  >
                    <View className="flex-row items-center gap-4">
                      <View className="w-12 h-12 rounded-2xl items-center justify-center bg-[#e7f8ef]">
                        <Feather name={m.icon} size={20} color="#059669" />
                      </View>
                      <View>
                        <Text className="font-jakarta-bold text-[15px] text-[#0c2010]">{m.name}</Text>
                        <Text className="text-[11px] text-[#707971] font-jakarta-medium">{m.desc}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color="#b3b9b4" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : method === 'mobile' ? (
              phase === 'sent' ? (
                <View className="items-center py-6">
                  <View className="w-20 h-20 rounded-full bg-[#e7f8ef] items-center justify-center mb-5">
                    <Feather name="send" size={32} color="#059669" />
                  </View>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010] mb-1">Check Your Phone</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center mb-4">
                    An M-PESA prompt has been sent to <Text className="font-jakarta-extrabold text-[#0c2010]">{phone}</Text>.{'\n'}Enter your PIN to complete the top-up.
                  </Text>
                  <View className="flex-row items-center gap-2 mb-4">
                    <ActivityIndicator size="small" color="#059669" />
                    <Text className="text-[11px] font-jakarta-bold text-[#059669]">Waiting for confirmation...</Text>
                  </View>
                  <Text className="text-[10px] text-[#a1a1aa] mb-3">Top-up: {formatKES(amount)}</Text>
                  <TouchableOpacity onPress={() => { stopPolling(); setPhase('idle'); setIsLoading(false); }}>
                    <Text className="text-[11px] text-[#707971] underline">Didn't receive it? Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : phase === 'success' ? (
                <View className="items-center py-8">
                  <View className="w-20 h-20 rounded-full bg-[#e7f8ef] items-center justify-center mb-4">
                    <Feather name="check-circle" size={40} color="#059669" />
                  </View>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#0c2010] mb-1">Top-Up Received!</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium">{formatKES(amount)} added to your account.</Text>
                </View>
              ) : (
                <View className="gap-5">
                  <View className="bg-[#e7f8ef] p-4 rounded-2xl border border-emerald-100 flex-row items-start gap-3">
                    <Feather name="smartphone" size={15} color="#059669" style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-[12px] text-[#065f46] font-jakarta-medium leading-relaxed">
                      Enter the amount and your mobile number. We'll send an <Text className="font-jakarta-extrabold">STK Push</Text> to your phone for instant top-up.
                    </Text>
                  </View>
                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Amount to Top Up (KES)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="Min 100"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>
                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">M-Pesa / Airtel Number</Text>
                    <ValidatedTextInput
                      kind="phoneKE"
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="0712 345 678"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={submitMobileTopUp}
                    disabled={isLoading || !amount || !phone || phone.length < 9}
                    className="w-full bg-[#00351d] h-[56px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
                    style={{ opacity: isLoading || !amount || !phone || phone.length < 9 ? 0.5 : 1 }}
                  >
                    {isLoading ? (
                      <View className="flex-row items-center gap-3">
                        <ActivityIndicator color="#fff" size="small" />
                        <Text className="text-white text-[12px] font-jakarta-bold">{statusText}</Text>
                      </View>
                    ) : (
                      <>
                        <Text className="text-white font-jakarta-bold text-[15px] mr-2">Send STK Push</Text>
                        <Feather name="send" size={16} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                  <Text className="text-center text-[10px] text-[#a1a1aa] font-jakarta-medium">Secured by M-PESA · No PIN shared with PayChain</Text>
                </View>
              )
            ) : method === 'bank' ? (
              <View>
                <View className="bg-[#e7f8ef] border border-emerald-100 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
                  <Feather name="info" size={15} color="#059669" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-[12px] text-[#065f46] font-jakarta-medium leading-relaxed">
                    {merchant?.ncbaVirtualAccountNumber
                      ? 'Pay via M-Pesa Paybill above, or transfer directly from your bank using this account number. Funds reflect automatically once cleared.'
                      : ncbaAccountIsUsable
                        ? 'Your dedicated PayChain Account is still being finalized — use this temporary account number via M-Pesa Paybill for now. It will upgrade automatically once your bank assigns your full account.'
                        : "Bank transfer isn't available on your account yet — your dedicated PayChain Account is still being assigned."}
                  </Text>
                </View>
                <CopyRow label="Bank" value="PayChain Settlement Account" />
                <CopyRow label="Paybill Number" value={PAYBILL_BUSINESS_NUMBER} />
                <CopyRow label="Account Name" value={merchant?.businessName || ''} />
                <CopyRow label="PayChain Account" value={ncbaAccountDisplay} disabled={!ncbaAccountIsUsable} />
                <TouchableOpacity onPress={handleClose} className="w-full bg-[#f0fdf4] py-3.5 rounded-2xl items-center mt-2">
                  <Text className="font-jakarta-bold text-[13px] text-[#404942]">Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View className="bg-[#e7f8ef] border border-emerald-100 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
                  <Feather name="info" size={15} color="#059669" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-[12px] text-[#065f46] font-jakarta-medium leading-relaxed">
                    {ncbaAccountIsUsable
                      ? 'Share these steps with your customers, or use them yourself to top up — funds reflect on your balance automatically once M-PESA confirms.'
                      : 'Your dedicated account number is still being assigned — this account is not ready to receive Paybill payments yet.'}
                  </Text>
                </View>
                <View className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl p-5 mb-5">
                  <Text className="text-[10px] font-jakarta-extrabold text-[#707971] uppercase tracking-widest mb-4">Instructions for you and your customers</Text>
                  {PAYBILL_STEPS.map((step, i) => (
                    <View key={i} className="flex-row items-start gap-3 mb-3">
                      <View className="w-6 h-6 rounded-full bg-[#00351d] items-center justify-center mt-0.5">
                        <Text className="text-[#5efeb3] text-[11px] font-jakarta-extrabold">{i + 1}</Text>
                      </View>
                      <Text className="flex-1 text-[13px] font-jakarta-medium text-[#0c2010] leading-relaxed">{step}</Text>
                    </View>
                  ))}
                </View>
                <CopyRow label="Business Number" value={PAYBILL_BUSINESS_NUMBER} />
                <CopyRow label="Account Number" value={ncbaAccountDisplay} disabled={!ncbaAccountIsUsable} />
                <TouchableOpacity onPress={handleClose} className="w-full bg-[#f0fdf4] py-3.5 rounded-2xl items-center mt-2">
                  <Text className="font-jakarta-bold text-[13px] text-[#404942]">Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
