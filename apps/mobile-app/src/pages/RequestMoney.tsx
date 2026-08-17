import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { getAppUrl } from '../utils/appUrl';

type OptionId = 'mpesa' | 'link';

const OPTIONS: Array<{ id: OptionId; title: string; description: string; icon: string; tag: string }> = [
  { id: 'mpesa', title: 'Instant M-PESA Prompt', description: 'Send a payment prompt to their M-PESA phone', icon: 'smartphone', tag: 'Most Popular' },
  { id: 'link', title: 'Payment Link', description: 'Create a shareable payment link', icon: 'link', tag: 'Versatile' },
];

function OptionIcon({ icon, size, color }: { icon: string; size: number; color: string }) {
  return <Feather name={icon as keyof typeof Feather.glyphMap} size={size} color={color} />;
}

export default function RequestMoney({ navigation, route }: any) {
  const { merchant, refreshSession } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedOption, setSelectedOption] = useState<OptionId | null>(null);

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  // Previously a failed/timed-out STK request only showed an Alert and left
  // the merchant on the same amount/phone form — indistinguishable from
  // never having submitted. Now routes to the same step-3 outcome screen
  // success already uses, in its failed variant.
  const [requestFailed, setRequestFailed] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [feePreview, setFeePreview] = useState<{ baseAmount: number; fee: number; total: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // The customer on the other end of an M-PESA prompt never sees any
  // PayChain screen (unlike Payment Links / Pay Account, which show this
  // same breakdown before the customer submits) — the prompt is a fixed
  // Safaricom template with no room to explain a fee, so a merchant
  // requesting KES 100 has their customer see a prompt for KES 113 with no
  // context. Showing the merchant the true total here, before they send it,
  // means they know to mention it to the customer themselves (a customer
  // also now gets a heads-up SMS — see buildPaymentRequestSms on the
  // backend).
  useEffect(() => {
    const numericAmount = Number(amount);
    if (selectedOption !== 'mpesa' || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeePreview(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get('/api/transactions/checkout-preview', { params: { amount: numericAmount } });
        if (res.data?.success) setFeePreview(res.data);
      } catch {
        setFeePreview(null);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [amount, selectedOption]);

  const resetForm = () => {
    setAmount('');
    setPhone('');
    setGeneratedLink('');
    setStatusText('');
    setCopied(false);
    setRequestFailed(false);
    setFailureReason('');
  };

  const handleSelect = (id: OptionId) => {
    setSelectedOption(id);
    resetForm();
    setStep(2);
  };

  // Dashboard's Quick Action tiles navigate here with { preset: 'mpesa' | 'link' }
  // to skip the selection step entirely.
  useEffect(() => {
    const preset = route?.params?.preset as OptionId | undefined;
    if (preset && OPTIONS.some((o) => o.id === preset)) handleSelect(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMpesaPrompt = async () => {
    if (!amount || Number(amount) <= 0 || !phone) {
      Alert.alert('Missing Details', 'Enter a valid amount and phone number.');
      return;
    }

    setIsSubmitting(true);
    setStatusText('Sending M-PESA prompt...');
    try {
      const pushRes = await api.post('/api/callbacks/stk-push', {
        amount: Number(amount),
        phone,
        merchantId: merchant?._id,
        purpose: 'request_money',
      });

      const checkoutId = pushRes.data.checkoutRequestId;
      setStatusText('Awaiting PIN on their phone...');

      let attempts = 0;
      const maxAttempts = 20; // 20 * 3s = 60s
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.get(`/api/callbacks/stk-status/${checkoutId}`);

          if (statusRes.data.status === 'success') {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsSubmitting(false);
            setStatusText('');
            await refreshSession();
            setStep(3);
          } else if (statusRes.data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsSubmitting(false);
            setStatusText('');
            setRequestFailed(true);
            setFailureReason(statusRes.data.resultDesc || 'They cancelled or the request failed.');
            setStep(3);
          } else if (attempts >= maxAttempts) {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsSubmitting(false);
            setStatusText('');
            setRequestFailed(true);
            setFailureReason('The request timed out waiting for a response.');
            setStep(3);
          }
        } catch (e) {
          console.error('STK status poll error', e);
        }
      }, 3000);
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusText('');
      if (err?.response?.status >= 500) {
        setRequestFailed(true);
        setFailureReason('The prompt may have been sent. If they see an M-PESA popup, they can still enter their PIN — check your transaction history shortly.');
      } else {
        setRequestFailed(true);
        setFailureReason(err?.response?.data?.error || 'Could not send M-PESA prompt.');
      }
      setStep(3);
    }
  };

  const createPaymentLink = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/transactions/payment-link', { amount: Number(amount) });
      if (res.data?.success) {
        setGeneratedLink(`${getAppUrl()}/pay/${res.data.linkId}`);
        setStep(3);
      }
    } catch (err: any) {
      Alert.alert('Generation Failed', err?.response?.data?.error || 'Failed to generate payment link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (selectedOption === 'mpesa') return sendMpesaPrompt();
    if (selectedOption === 'link') return createPaymentLink();
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    setCopied(true);
  };

  const shareLink = async () => {
    if (!generatedLink) return;
    try {
      await Share.share({ message: `Please pay ${merchant?.businessName || 'me'} via PayChain: ${generatedLink}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  const goBack = () => {
    if (step === 1) navigation?.goBack();
    else setStep((s) => s - 1);
  };

  const selected = OPTIONS.find((o) => o.id === selectedOption);

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Request Money" subtitle={step === 1 ? 'Get paid, your way' : selected?.title} onBack={goBack} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-6">

          {/* Step 1 — Option selection */}
          {step === 1 && (
            <View className="gap-3">
              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => handleSelect(opt.id)}
                  activeOpacity={0.85}
                  className="bg-white rounded-[28px] border border-[#eff4ef] p-6 shadow-sm shadow-[#00351d]/5"
                >
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="w-12 h-12 rounded-2xl bg-[#00351d] items-center justify-center">
                      <OptionIcon icon={opt.icon} size={20} color="#5efeb3" />
                    </View>
                    <View className="bg-[#f7faf7] px-3 py-1.5 rounded-full">
                      <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-[0.15em] text-[#707971]">{opt.tag}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[20px] text-[#00351d] mb-1.5">{opt.title}</Text>
                  <Text className="text-[12px] text-[#707971] font-jakarta-medium leading-relaxed">{opt.description}</Text>
                </TouchableOpacity>
              ))}

              <View className="bg-[#00351d] rounded-[28px] p-6 mt-3">
                <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#5efeb3] mb-1 opacity-80">Developer Friendly</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[19px] text-white mb-1">Integrate our Request API</Text>
                <Text className="text-[12px] text-white/60 font-jakarta-medium">Automate collections with our REST endpoints. Contact support@paychain.co.ke.</Text>
              </View>
            </View>
          )}

          {/* Step 2 — Details */}
          {step === 2 && selected && (
            <View>
              <View className="items-center mb-8">
                <View className="w-16 h-16 rounded-2xl bg-[#00351d] items-center justify-center mb-4">
                  <OptionIcon icon={selected.icon} size={26} color="#5efeb3" />
                </View>
                <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4">
                  {selected.id === 'mpesa'
                    ? "We'll send an M-PESA prompt to this number for them to complete."
                    : "Set an amount and we'll generate a secure, shareable link."}
                </Text>
              </View>

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Amount (KES)</Text>
              <ValidatedTextInput
                kind="amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d] mb-2"
              />
              {feePreview && (
                <View className="mb-5 px-1">
                  <View className="flex-row justify-between">
                    <Text className="text-[12px] text-[#707971] font-jakarta-medium">They'll be asked to pay</Text>
                    <Text className="text-[12px] font-jakarta-extrabold text-[#00351d]">KES {feePreview.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                  {feePreview.fee > 0 && (
                    <Text className="text-[10px] text-[#707971] font-jakarta-medium opacity-70 mt-0.5">
                      Includes a KES {feePreview.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })} transaction fee on top of your KES {feePreview.baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} request.
                    </Text>
                  )}
                </View>
              )}

              {selected.id === 'mpesa' && (
                <>
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Customer's M-PESA Number</Text>
                  <ValidatedTextInput
                    kind="phoneKE"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0712 345 678"
                    placeholderTextColor="#a1a1aa"
                    className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d]"
                  />
                </>
              )}
            </View>
          )}

          {/* Step 3 — Result */}
          {step === 3 && selected && (
            <View className="items-center pt-4">
              <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 border-4 ${selected.id === 'mpesa' && requestFailed ? 'bg-[#fdeaea] border-[#f8d2d2]' : 'bg-[#e7f8ef] border-[#d5f3e4]'}`}>
                <Feather name={selected.id === 'mpesa' && requestFailed ? 'x-circle' : 'check-circle'} size={36} color={selected.id === 'mpesa' && requestFailed ? '#c0392b' : '#006c4e'} />
              </View>

              {selected.id === 'mpesa' ? (
                requestFailed ? (
                  <>
                    <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#c0392b] mb-2 text-center">Request Failed</Text>
                    <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4 mb-8">
                      {failureReason}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#00351d] mb-2 text-center">Payment Received</Text>
                    <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4 mb-8">
                      KES {Number(amount).toLocaleString()} has been credited to your PayChain balance.
                    </Text>
                  </>
                )
              ) : (
                <>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#00351d] mb-2 text-center">Link Ready to Share</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4 mb-5">
                    Share this link to collect KES {Number(amount).toLocaleString()}.
                  </Text>
                  <View className="w-full bg-white border border-[#eff4ef] rounded-2xl p-4 mb-5">
                    <Text className="text-[13px] font-jakarta-bold text-[#00351d]" numberOfLines={1}>{generatedLink}</Text>
                  </View>
                  <View className="flex-row gap-3 w-full mb-8">
                    <TouchableOpacity
                      onPress={copyLink}
                      activeOpacity={0.85}
                      className="flex-1 bg-[#f7faf7] py-3.5 rounded-2xl items-center justify-center border border-[#eff4ef] flex-row gap-2"
                    >
                      <Feather name={copied ? 'check' : 'copy'} size={14} color="#00351d" />
                      <Text className="text-[#00351d] font-jakarta-extrabold text-[11px] uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={shareLink}
                      activeOpacity={0.85}
                      className="flex-1 bg-[#00351d] py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25 flex-row gap-2"
                    >
                      <Feather name="share-2" size={14} color="#fff" />
                      <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Share</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <TouchableOpacity
                // Retry keeps the amount/phone already entered — just clear
                // the failed state so a successful second attempt doesn't
                // still show this same failure screen.
                onPress={selected.id === 'mpesa' && requestFailed ? () => { setRequestFailed(false); setFailureReason(''); setStep(2); } : () => navigation?.navigate('Home')}
                activeOpacity={0.9}
                className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20"
              >
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">
                  {selected.id === 'mpesa' && requestFailed ? 'Try Again' : 'Back to Dashboard'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA (step 2 only) */}
      {step === 2 && (
        <View className="px-6 pb-6 pt-3 bg-[#f0fdf4] border-t border-[#eff4ef]">
          <TouchableOpacity
            onPress={handlePrimaryAction}
            disabled={isSubmitting || !amount || (selectedOption === 'mpesa' && !phone)}
            activeOpacity={0.9}
            className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
            style={{ backgroundColor: isSubmitting || !amount || (selectedOption === 'mpesa' && !phone) ? '#e0e5e0' : '#00351d' }}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#00351d" size="small" />
                <Text className="text-[#707971] font-jakarta-extrabold text-[12px] uppercase tracking-widest">{statusText || 'Processing...'}</Text>
              </>
            ) : (
              <Text className={`font-jakarta-extrabold text-[12px] uppercase tracking-widest ${!amount || (selectedOption === 'mpesa' && !phone) ? 'text-[#a1a1aa]' : 'text-white'}`}>
                {selectedOption === 'mpesa' ? 'Send Prompt' : 'Generate Link'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
