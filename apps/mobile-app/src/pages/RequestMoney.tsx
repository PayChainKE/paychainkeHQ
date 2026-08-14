import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { getAppUrl } from '../utils/appUrl';

type OptionId = 'mpesa' | 'link' | 'qr';

// 'qr' renders via MaterialIcons ('qr-code-2', same glyph MyAccountsTab.tsx
// already uses) instead of Feather — Feather has no QR icon, so `icon` is
// loosely typed here and each render site picks the right icon set by id.
const OPTIONS: Array<{ id: OptionId; title: string; description: string; icon: string; tag: string }> = [
  { id: 'mpesa', title: 'Instant M-PESA Prompt', description: 'Send a payment prompt to their M-PESA phone', icon: 'smartphone', tag: 'Most Popular' },
  { id: 'link', title: 'Payment Link', description: 'Create a shareable payment link', icon: 'link', tag: 'Versatile' },
  { id: 'qr', title: 'Scan to Pay QR', description: 'Show a QR code for them to scan in M-PESA', icon: 'qr-code-2', tag: 'In Person' },
];

function OptionIcon({ id, icon, size, color }: { id: OptionId; icon: string; size: number; color: string }) {
  if (id === 'qr') return <MaterialIcons name="qr-code-2" size={size} color={color} />;
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
  const [qrCodeDataUri, setQrCodeDataUri] = useState('');
  const [qrPaid, setQrPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const resetForm = () => {
    setAmount('');
    setPhone('');
    setGeneratedLink('');
    setStatusText('');
    setCopied(false);
    setQrCodeDataUri('');
    setQrPaid(false);
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
            Alert.alert('Request Failed', statusRes.data.resultDesc || 'They cancelled or the request failed.');
          } else if (attempts >= maxAttempts) {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsSubmitting(false);
            setStatusText('');
            Alert.alert('Timeout', 'The request timed out. Please try again.');
          }
        } catch (e) {
          console.error('STK status poll error', e);
        }
      }, 3000);
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusText('');
      if (err?.response?.status >= 500) {
        Alert.alert('Check Their Phone', 'The prompt may have been sent. If they see an M-PESA popup, they can still enter their PIN.');
      } else {
        Alert.alert('Request Failed', err?.response?.data?.error || 'Could not send M-PESA prompt.');
      }
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

  const generateQr = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/callbacks/generate-qr', { amount: Number(amount) });
      setQrCodeDataUri(res.data.qrCodeDataUri);
      setStep(3);

      // Same poll shape as sendMpesaPrompt, reusing the same stk-status
      // endpoint — a QR request is tracked the same way an STK one is, just
      // via a PayChain-generated reference instead of NCBA's own
      // transaction ID. Doesn't block navigation — the QR is already shown.
      const checkoutId = res.data.reference;
      let attempts = 0;
      const maxAttempts = 100; // 100 * 3s = 5min — a counter QR may sit unscanned longer than a push prompt
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.get(`/api/callbacks/stk-status/${checkoutId}`);
          if (statusRes.data.status === 'success') {
            if (pollRef.current) clearInterval(pollRef.current);
            await refreshSession();
            setQrPaid(true);
          } else if (statusRes.data.status === 'failed' || attempts >= maxAttempts) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e) {
          console.error('QR status poll error', e);
        }
      }, 3000);
    } catch (err: any) {
      Alert.alert('Generation Failed', err?.response?.data?.error || 'Failed to generate QR code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (selectedOption === 'mpesa') return sendMpesaPrompt();
    if (selectedOption === 'link') return createPaymentLink();
    if (selectedOption === 'qr') return generateQr();
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
                      <OptionIcon id={opt.id} icon={opt.icon} size={20} color="#5efeb3" />
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
                  <OptionIcon id={selected.id} icon={selected.icon} size={26} color="#5efeb3" />
                </View>
                <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4">
                  {selected.id === 'mpesa'
                    ? "We'll send an M-PESA prompt to this number for them to complete."
                    : selected.id === 'qr'
                    ? "Set an amount and we'll generate a QR code for them to scan and pay in M-PESA."
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
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d] mb-5"
              />

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
          {step === 3 && selected && selected.id === 'qr' && !qrPaid && (
            <View className="items-center pt-4">
              <View className="bg-white border border-[#eff4ef] rounded-[28px] p-4 mb-6 shadow-sm shadow-[#00351d]/5">
                <Image source={{ uri: qrCodeDataUri }} style={{ width: 224, height: 224 }} resizeMode="contain" />
              </View>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#00351d] mb-2 text-center">Show This to Your Customer</Text>
              <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4 mb-2">
                They scan this in their M-PESA app to pay KES {Number(amount).toLocaleString()}. This updates automatically once paid.
              </Text>
              <Text className="text-[11px] text-[#a1a1aa] font-jakarta-medium text-center mb-5">Long-press the code to save it</Text>
              <View className="flex-row items-center gap-2 mb-8">
                <ActivityIndicator color="#006c4e" size="small" />
                <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-widest text-[#006c4e]">Waiting for payment...</Text>
              </View>

              <TouchableOpacity
                onPress={() => navigation?.navigate('Home')}
                activeOpacity={0.9}
                className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20"
              >
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && selected && (selected.id !== 'qr' || qrPaid) && (
            <View className="items-center pt-4">
              <View className="w-20 h-20 rounded-full bg-[#e7f8ef] items-center justify-center mb-6 border-4 border-[#d5f3e4]">
                <Feather name="check-circle" size={36} color="#006c4e" />
              </View>

              {selected.id === 'mpesa' || selected.id === 'qr' ? (
                <>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#00351d] mb-2 text-center">Payment Received</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4 mb-8">
                    KES {Number(amount).toLocaleString()} has been credited to your PayChain balance.
                  </Text>
                </>
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
                onPress={() => navigation?.navigate('Home')}
                activeOpacity={0.9}
                className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20"
              >
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Back to Dashboard</Text>
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
                {selectedOption === 'mpesa' ? 'Send Prompt' : selectedOption === 'qr' ? 'Generate QR Code' : 'Generate Link'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
