import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';

function formatKES(n: number | null | undefined) {
  if (n == null) return 'KES 0.00';
  return `KES ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Destination = 'mpesa-primary' | 'mobile' | 'bank' | 'till' | 'paybill';

const DESTINATIONS: Array<{ id: Destination; label: string; icon: keyof typeof MaterialIcons.glyphMap; hint: string; feeLabel: string }> = [
  { id: 'mpesa-primary', label: 'Primary M-PESA Number', icon: 'smartphone', hint: 'Your registered phone number', feeLabel: 'Varies' },
  { id: 'mobile', label: 'Any M-PESA Number', icon: 'smartphone', hint: 'Send to any Kenyan mobile number', feeLabel: 'Varies' },
  { id: 'bank', label: 'Bank Account', icon: 'account-balance', hint: 'Direct bank transfer', feeLabel: 'KES 50.00' },
  { id: 'till', label: 'Till Number', icon: 'point-of-sale', hint: 'Pay to a Safaricom Till', feeLabel: 'Varies' },
  { id: 'paybill', label: 'Paybill', icon: 'receipt-long', hint: 'Pay to a Paybill number', feeLabel: 'Varies' },
];

// Mirrors merchant-dashboard's SendMoney.jsx and backend/config/revenueRateCard.js's
// NCBA_LIPA_NA_MPESA_FLAT_FEE_KES — the exact flat fee mpesaController.js#initiateB2B
// charges server-side. Not a Safaricom-cost estimate (B2B isn't modeled there); this
// is PayChain's own flat margin.
const PAYCHAIN_B2B_FLAT_FEE_KES = 30;
function estimateB2bFee(amount: number) {
  if (!amount || amount <= 0) return 0;
  return PAYCHAIN_B2B_FLAT_FEE_KES;
}

// Mirrors backend/config/mpesaB2cTariffCard.js — Safaricom's real M-Pesa B2C
// ("Business Bouquet") tariff bands, plus PayChain's flat KES 10 markup.
// That backend table is authoritative; this is only an estimate so the
// merchant sees an honest number before confirming.
const B2C_SAFARICOM_BANDS = [
  { max: 100, fee: 0 },
  { max: 500, fee: 5 },
  { max: 1_000, fee: 5 },
  { max: 1_500, fee: 5 },
  { max: 2_500, fee: 9 },
  { max: 3_500, fee: 9 },
  { max: 5_000, fee: 9 },
  { max: 7_500, fee: 11 },
  { max: 10_000, fee: 11 },
  { max: 15_000, fee: 11 },
  { max: 20_000, fee: 11 },
  { max: 25_000, fee: 13 },
  { max: 250_000, fee: 13 },
];
const PAYCHAIN_B2C_MARKUP_KES = 10;
function estimateB2cFee(amount: number) {
  if (!amount || amount <= 0) return PAYCHAIN_B2C_MARKUP_KES;
  const band = B2C_SAFARICOM_BANDS.find((b) => amount <= b.max) || B2C_SAFARICOM_BANDS[B2C_SAFARICOM_BANDS.length - 1];
  return band.fee + PAYCHAIN_B2C_MARKUP_KES;
}

export default function SendMoney({ navigation }: any) {
  const { merchant, refreshSession, setAppPin } = useAuth();

  const hasPin = !!merchant?.hasAppPin;
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState<Destination | ''>('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [paybillAccountRef, setPaybillAccountRef] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankCodes, setBankCodes] = useState<{ code: string; name: string }[]>([]);
  const [bankRail, setBankRail] = useState<'pesalink' | 'eft' | 'rtgs'>('pesalink');
  // RTGS-only fields — see dashboard SendMoney.jsx's equivalent comment.
  const [beneficiaryCountry, setBeneficiaryCountry] = useState('KE');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [purposeCode, setPurposeCode] = useState('MSC');
  // Which mobile wallet network to pay into — see dashboard SendMoney.jsx's
  // equivalent comment.
  const [provider, setProvider] = useState<'safaricom' | 'airtel'>('safaricom');
  // Optional "look up by phone number" convenience — see dashboard
  // SendMoney.jsx's equivalent comment for why this can't return an
  // account number, only a bank + holder's name.
  const [showPhoneLookup, setShowPhoneLookup] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [phoneLookup, setPhoneLookup] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    destName: string;
    banks: { bankCode: string; bankName: string; isDefault: boolean }[];
    error: string;
  }>({ status: 'idle', destName: '', banks: [], error: '' });
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [success, setSuccess] = useState(false);

  const selectedDest = DESTINATIONS.find((d) => d.id === destination);
  const isMobileDest = destination === 'mpesa-primary' || destination === 'mobile';
  const isB2bDest = destination === 'till' || destination === 'paybill';
  const fee = isMobileDest ? estimateB2cFee(Number(amount) || 0) : isB2bDest ? estimateB2bFee(Number(amount) || 0) : destination === 'bank' ? 50 : 0;
  const totalAmount = Number(amount || 0) + fee;
  const balance = merchant?.kesBalance || 0;

  const confirmStep = hasPin ? 3 : 4;

  useEffect(() => setPinError(''), [pin, newPin, confirmPin]);

  const fetchBankCodes = useCallback(async () => {
    if (bankCodes.length > 0) return;
    try {
      const res = await api.get('/api/v1/openbanking/bank-codes');
      setBankCodes(res.data?.bankCodes || []);
    } catch (e) {
      console.warn('Failed to load bank codes', e);
    }
  }, [bankCodes.length]);

  const handlePhoneLookup = async () => {
    if (!lookupPhone) return;
    setPhoneLookup({ status: 'loading', destName: '', banks: [], error: '' });
    try {
      const res = await api.post('/api/v1/openbanking/pesalink-lookup-phone', { phoneNumber: lookupPhone });
      const { destName, banks } = res.data;
      setPhoneLookup({ status: 'success', destName, banks, error: '' });
      if (banks.length === 1) setBankCode(banks[0].bankCode);
      if (!reference) setReference(destName);
    } catch (e: any) {
      setPhoneLookup({ status: 'error', destName: '', banks: [], error: e.response?.data?.error || 'Could not look up this number.' });
    }
  };

  const canContinue = () => {
    if (step === 1) return !!destination;
    if (step === 2) {
      return (
        !!amount &&
        Number(amount) > 0 &&
        !!recipientAccount &&
        (destination !== 'bank' || !!bankCode) &&
        (destination !== 'bank' || bankRail !== 'rtgs' || !!beneficiaryCountry) &&
        (destination !== 'paybill' || !!paybillAccountRef)
      );
    }
    if (!hasPin && step === 3) return newPin.length === 4 && confirmPin.length === 4;
    if (step === confirmStep) return pin.length === 4;
    return true;
  };

  const goNext = async () => {
    if (step < (hasPin ? confirmStep : confirmStep - 1)) {
      setStep((s) => s + 1);
      return;
    }

    // PIN setup step (first time)
    if (!hasPin && step === 3) {
      if (newPin.length < 4) { setPinError('PIN must be exactly 4 digits.'); return; }
      if (newPin !== confirmPin) { setPinError('PINs do not match. Please re-enter.'); return; }
      setIsLoading(true);
      try {
        await setAppPin(newPin);
        setStep(4);
      } catch (e: any) {
        setPinError(e?.response?.data?.error || 'Failed to save PIN. Try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Confirm & send step
    if (step === confirmStep) {
      if (totalAmount > balance) {
        Alert.alert('Insufficient Balance', `You need ${formatKES(totalAmount)} but only have ${formatKES(balance)}.`);
        return;
      }
      if (pin.length < 4) { setPinError('Enter your 4-digit payment PIN.'); return; }

      setIsLoading(true);
      try {
        await api.post('/api/auth/merchant/verify-payment-pin', { pin });

        if (isMobileDest) {
          await api.post('/api/callbacks/b2c-request', {
            phone: recipientAccount,
            amount: Number(amount),
            destination: selectedDest?.label,
            fee,
            reference,
            pin,
            provider,
          });
        } else if (destination === 'bank') {
          await api.post('/api/v1/openbanking/bank-payout', {
            bankCode,
            accountNumber: recipientAccount,
            accountName: reference || undefined,
            amount: Number(amount),
            narration: reference || `Transfer to ${recipientAccount}`,
            pin,
            rail: bankRail,
            ...(bankRail === 'rtgs' ? { beneficiaryCountry, beneficiaryAddress: beneficiaryAddress || undefined, purposeCode } : {}),
          });
        } else {
          await api.post('/api/callbacks/b2b-request', {
            billType: destination, // 'till' | 'paybill'
            partyB: recipientAccount,
            accountReference: destination === 'paybill' ? paybillAccountRef : undefined,
            amount: Number(amount),
            reference: reference || `Transfer to ${recipientAccount}`,
            pin,
          });
        }

        await refreshSession();
        setSuccess(true);
      } catch (e: any) {
        const msg = e?.response?.data?.error || 'Transfer failed. Please try again.';
        if (e?.response?.status === 401) {
          setPinError('Incorrect PIN. Please try again.');
          setPin('');
        } else {
          Alert.alert('Transfer Failed', msg);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigation?.goBack();
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Send Money" showBack={false} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-[#e7f8ef] items-center justify-center mb-6 border-4 border-[#d5f3e4]">
            <Feather name="check-circle" size={44} color="#006c4e" />
          </View>
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[30px] text-[#00351d] mb-2 text-center">Transfer Sent</Text>
          <Text className="text-[#707971] font-jakarta-medium text-center mb-1">
            {formatKES(Number(amount))} {isMobileDest ? 'via M-PESA' : destination === 'bank' ? 'via Bank Transfer' : destination === 'till' ? 'to Till' : 'to Paybill'}
          </Text>
          <Text className="text-[12px] font-jakarta-medium text-[#00351d]/40 mb-10">→ {recipientAccount}</Text>
          <TouchableOpacity
            onPress={() => navigation?.navigate('Transactions')}
            activeOpacity={0.9}
            className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20 mb-3"
          >
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">View Transactions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.navigate('Home')} activeOpacity={0.7}>
            <Text className="text-[#00351d]/50 font-jakarta-bold text-[12px]">Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Send Money" subtitle="Secured with your PayChain payment PIN" onBack={goBack} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-6">

          {/* Step 1 — Destination */}
          {step === 1 && (
            <View>
              <View className="flex-row items-center gap-3 p-4 rounded-2xl bg-[#e7f8ef] border border-[#d5f3e4] mb-6">
                <View className="w-10 h-10 rounded-xl bg-[#00351d] items-center justify-center">
                  <Feather name="credit-card" size={16} color="#5efeb3" />
                </View>
                <View>
                  <Text className="text-[10px] font-jakarta-extrabold text-[#006c4e] uppercase tracking-widest">Available Balance</Text>
                  <Text className="text-[20px] font-jakarta-extrabold text-[#00351d]">{formatKES(balance)}</Text>
                </View>
              </View>

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-3 ml-1">Send To</Text>
              <View className="gap-2.5">
                {DESTINATIONS.map((d) => {
                  const active = destination === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => {
                        setDestination(d.id);
                        setRecipientAccount(d.id === 'mpesa-primary' ? merchant?.phone || '' : '');
                        if (d.id === 'bank') fetchBankCodes();
                      }}
                      activeOpacity={0.85}
                      className={`flex-row items-center gap-3 p-4 rounded-2xl border-2 ${active ? 'border-[#00351d] bg-[#f0fdf4]' : 'border-[#eff4ef] bg-white'}`}
                    >
                      <View className={`w-10 h-10 rounded-xl items-center justify-center ${active ? 'bg-[#00351d]' : 'bg-[#f7faf7]'}`}>
                        <MaterialIcons name={d.icon} size={18} color={active ? '#5efeb3' : '#707971'} />
                      </View>
                      <View className="flex-1">
                        <Text className={`text-[14px] font-jakarta-bold ${active ? 'text-[#00351d]' : 'text-[#0c2010]'}`}>{d.label}</Text>
                        <Text className="text-[10px] text-[#707971] font-jakarta-medium mt-0.5">{d.hint}</Text>
                      </View>
                      {active && <Feather name="check-circle" size={18} color="#00351d" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 2 — Payment Details */}
          {step === 2 && (
            <View>
              <View className="flex-row items-center gap-3 p-3.5 rounded-xl bg-[#f7faf7] border border-[#eff4ef] mb-5">
                <View className="w-8 h-8 rounded-lg bg-[#00351d] items-center justify-center">
                  {selectedDest && <MaterialIcons name={selectedDest.icon} size={15} color="#5efeb3" />}
                </View>
                <View>
                  <Text className="text-[12px] font-jakarta-bold text-[#0c2010]">{selectedDest?.label}</Text>
                </View>
              </View>

              {destination === 'bank' && (
                <View className="mb-5">
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Transfer Speed</Text>
                  <View className="flex-row gap-2">
                    {([
                      { id: 'pesalink', title: 'Instant', hint: 'PesaLink · 24/7' },
                      { id: 'eft', title: 'Next Business Day', hint: 'EFT · Mon–Fri' },
                      { id: 'rtgs', title: 'International', hint: 'RTGS · ~3 hrs' },
                    ] as const).map((opt) => {
                      const active = bankRail === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => { setBankRail(opt.id); setBankCode(''); }}
                          activeOpacity={0.85}
                          className={`flex-1 p-3 rounded-2xl border-2 ${active ? 'border-[#00351d] bg-[#f0fdf4]' : 'border-[#eff4ef] bg-white'}`}
                        >
                          <Text className={`text-[12px] font-jakarta-bold ${active ? 'text-[#00351d]' : 'text-[#0c2010]'}`}>{opt.title}</Text>
                          <Text className="text-[9px] text-[#707971] font-jakarta-medium mt-0.5">{opt.hint}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {destination === 'bank' && bankRail !== 'rtgs' && (
                <View className="mb-5">
                  {!showPhoneLookup ? (
                    <TouchableOpacity onPress={() => setShowPhoneLookup(true)} className="mb-3">
                      <Text className="text-[12px] font-jakarta-bold text-[#00351d] underline">Know their phone number instead?</Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="mb-3 p-4 rounded-2xl bg-[#f7faf7] border border-[#eff4ef]">
                      <Text className="text-[10px] text-[#707971] font-jakarta-medium leading-relaxed mb-3">
                        We'll look up which bank this number is registered with for PesaLink. This only confirms the bank and holder's name — you'll still need to enter and confirm the actual account number with them.
                      </Text>
                      <View className="flex-row gap-2">
                        <TextInput
                          value={lookupPhone}
                          onChangeText={setLookupPhone}
                          keyboardType="phone-pad"
                          placeholder="0712 345 678"
                          placeholderTextColor="#a1a1aa"
                          className="flex-1 bg-white border border-[#eff4ef] rounded-2xl px-4 py-3 text-[13px] font-jakarta-bold text-[#00351d]"
                        />
                        <TouchableOpacity
                          onPress={handlePhoneLookup}
                          disabled={!lookupPhone || phoneLookup.status === 'loading'}
                          className="px-4 justify-center rounded-2xl bg-[#00351d]"
                          style={{ opacity: !lookupPhone || phoneLookup.status === 'loading' ? 0.4 : 1 }}
                        >
                          <Text className="text-white text-[12px] font-jakarta-bold">
                            {phoneLookup.status === 'loading' ? 'Looking up…' : 'Look Up'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {phoneLookup.status === 'success' && (
                        <View className="mt-3 p-3 rounded-xl bg-[#f0fdf4] border border-[#d1fae5]">
                          <Text className="text-[12px] font-jakarta-bold text-[#065f46]">{phoneLookup.destName}</Text>
                          {phoneLookup.banks.length > 1 ? (
                            <View className="flex-row flex-wrap gap-1.5 mt-2">
                              {phoneLookup.banks.map((b) => (
                                <TouchableOpacity
                                  key={b.bankCode}
                                  onPress={() => setBankCode(b.bankCode)}
                                  className={`px-3 py-1.5 rounded-lg border ${bankCode === b.bankCode ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
                                >
                                  <Text className={`text-[11px] font-jakarta-bold ${bankCode === b.bankCode ? 'text-white' : 'text-[#404942]'}`}>{b.bankName}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : (
                            <Text className="text-[11px] text-[#065f46] mt-1">Registered with {phoneLookup.banks[0]?.bankName} — bank selection filled in below.</Text>
                          )}
                        </View>
                      )}
                      {phoneLookup.status === 'error' && (
                        <Text className="text-[11px] font-jakarta-bold text-red-600 mt-2">{phoneLookup.error}</Text>
                      )}
                    </View>
                  )}

                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Bank</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {bankCodes.length === 0 && (
                      <Text className="text-[#707971] font-jakarta-medium text-[11px] py-2">Loading banks…</Text>
                    )}
                    {bankCodes.map((b) => (
                      <TouchableOpacity
                        key={b.code}
                        onPress={() => setBankCode(b.code)}
                        className={`px-3 py-2 rounded-lg border ${bankCode === b.code ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
                      >
                        <Text className={`font-jakarta-bold text-[11px] ${bankCode === b.code ? 'text-white' : 'text-[#404942]'}`}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {destination === 'bank' && bankRail === 'rtgs' && (
                <View className="mb-5 p-4 rounded-2xl bg-[#f7faf7] border border-[#eff4ef]">
                  <Text className="text-[11px] text-[#707971] font-jakarta-medium leading-relaxed mb-3">
                    RTGS sends to banks outside PesaLink/EFT's network, including other East African countries. Settles same business day, ~3 hours. KES only for now.
                  </Text>
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2">Beneficiary Bank SWIFT Code</Text>
                  <TextInput
                    value={bankCode}
                    onChangeText={(t) => setBankCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    placeholder="e.g. KCBLKENX"
                    placeholderTextColor="#a1a1aa"
                    className="bg-white border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[#00351d] font-jakarta-bold text-[14px] mb-3"
                  />
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2">Beneficiary Country</Text>
                  <View className="flex-row flex-wrap gap-1.5 mb-3">
                    {([
                      { code: 'KE', label: 'Kenya' },
                      { code: 'UG', label: 'Uganda' },
                      { code: 'TZ', label: 'Tanzania' },
                      { code: 'RW', label: 'Rwanda' },
                    ]).map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => setBeneficiaryCountry(c.code)}
                        className={`px-3 py-2 rounded-lg border ${beneficiaryCountry === c.code ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
                      >
                        <Text className={`font-jakarta-bold text-[11px] ${beneficiaryCountry === c.code ? 'text-white' : 'text-[#404942]'}`}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2">
                    Beneficiary Address <Text className="text-[#a1a1aa] normal-case">(optional)</Text>
                  </Text>
                  <TextInput
                    value={beneficiaryAddress}
                    onChangeText={setBeneficiaryAddress}
                    placeholder="e.g. Nairobi"
                    placeholderTextColor="#a1a1aa"
                    className="bg-white border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[#00351d] font-jakarta-medium text-[14px] mb-3"
                  />
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2">Purpose of Payment Code</Text>
                  <TextInput
                    value={purposeCode}
                    onChangeText={(t) => setPurposeCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    placeholder="MSC"
                    placeholderTextColor="#a1a1aa"
                    className="bg-white border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[#00351d] font-jakarta-bold text-[14px]"
                  />
                  <Text className="text-[10px] text-[#707971] font-jakarta-medium mt-2">
                    "MSC" (Miscellaneous) works for most transfers. If your receiving bank asks for a specific purpose code, enter it here.
                  </Text>
                </View>
              )}

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">
                {destination === 'mpesa-primary' ? 'Your Registered Number' : destination === 'mobile' ? 'Phone Number' : destination === 'till' ? 'Till Number' : destination === 'paybill' ? 'Paybill Number' : 'Account Number'}
              </Text>
              {destination === 'mpesa-primary' ? (
                <View className="flex-row items-center bg-[#eff4ef] border border-[#e7ece7] rounded-2xl px-5 py-4 mb-5">
                  <Feather name="lock" size={14} color="#707971" style={{ marginRight: 8 }} />
                  <Text className="text-[15px] font-jakarta-bold text-[#00351d]">{formatPhoneDisplay(recipientAccount || merchant?.phone) || 'Not on file'}</Text>
                </View>
              ) : (
                <ValidatedTextInput
                  kind={destination === 'mobile' ? 'phoneKE' : destination === 'till' ? 'till' : destination === 'paybill' ? 'paybill' : 'integer'}
                  value={recipientAccount}
                  onChangeText={setRecipientAccount}
                  placeholder={destination === 'mobile' ? '0712 345 678' : destination === 'till' ? 'Till Number' : destination === 'paybill' ? 'Paybill Number' : 'Account Number'}
                  placeholderTextColor="#a1a1aa"
                  className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d] mb-5"
                />
              )}

              {isMobileDest && (
                <View className="mb-5">
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Network</Text>
                  <View className="flex-row gap-2 p-1.5 bg-[#f7faf7] rounded-2xl border border-[#eff4ef]">
                    {[
                      { id: 'safaricom' as const, label: 'M-PESA' },
                      { id: 'airtel' as const, label: 'Airtel Money' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setProvider(opt.id)}
                        className={`flex-1 py-2.5 rounded-xl items-center ${provider === opt.id ? 'bg-[#00351d]' : ''}`}
                      >
                        <Text className={`font-jakarta-bold text-[13px] ${provider === opt.id ? 'text-white' : 'text-[#707971]'}`}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {destination === 'paybill' && (
                <View className="mb-5">
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Account Number</Text>
                  <TextInput
                    value={paybillAccountRef}
                    onChangeText={setPaybillAccountRef}
                    placeholder="Account Number"
                    placeholderTextColor="#a1a1aa"
                    className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d]"
                  />
                </View>
              )}

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Amount (KES)</Text>
              <ValidatedTextInput
                kind="amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[18px] font-jakarta-extrabold text-[#00351d]"
              />
              {Number(amount) > 0 && (
                <Text className={`text-[11px] font-jakarta-bold mt-2 mb-1 ${totalAmount > balance ? 'text-red-500' : 'text-[#006c4e]'}`}>
                  Total deduction: {formatKES(totalAmount)}{totalAmount > balance ? ' — exceeds balance' : ''}
                </Text>
              )}

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1 mt-4">
                Reference <Text className="text-[#a1a1aa] normal-case">(optional)</Text>
              </Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. Supplier Payment, Rent"
                placeholderTextColor="#a1a1aa"
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[14px] font-jakarta-medium text-[#00351d]"
              />
            </View>
          )}

          {/* Step 3 — Set Payment PIN (first time only) */}
          {!hasPin && step === 3 && (
            <View>
              <View className="items-center mb-8">
                <View className="w-16 h-16 rounded-2xl bg-[#00351d] items-center justify-center mb-4">
                  <Feather name="lock" size={26} color="#5efeb3" />
                </View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[24px] text-[#00351d] mb-2">Set Payment PIN</Text>
                <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center leading-relaxed px-4">
                  Create a 4-digit PIN to authorise all money movements. This PIN is shared with every part of PayChain — web dashboard included.
                </Text>
              </View>

              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2 text-center">New PIN</Text>
              <TextInput
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                autoFocus
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[#00351d] font-jakarta-extrabold text-[20px] tracking-[0.5em] text-center mb-5"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
              />
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2 text-center">Confirm PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[#00351d] font-jakarta-extrabold text-[20px] tracking-[0.5em] text-center"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
              />
              {pinError ? (
                <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
                  <Feather name="alert-circle" size={14} color="#dc2626" />
                  <Text className="text-[12px] font-jakarta-bold text-red-700 flex-1">{pinError}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Confirm & Send step */}
          {step === confirmStep && (
            <View>
              <View className="bg-[#f7faf7] rounded-2xl border border-[#eff4ef] overflow-hidden mb-6">
                <View className="px-5 py-3 bg-[#00351d]">
                  <Text className="text-[10px] font-jakarta-extrabold text-[#5efeb3] uppercase tracking-widest">Transfer Summary</Text>
                </View>
                {([
                  ['Destination', selectedDest?.label || ''],
                  ...(destination === 'bank' && bankRail !== 'rtgs' ? [['Bank', bankCodes.find((b) => b.code === bankCode)?.name || bankCode]] : []),
                  ...(destination === 'bank' && bankRail === 'rtgs' ? [['Beneficiary Bank BIC', bankCode]] : []),
                  ...(destination === 'bank' ? [['Transfer Speed', bankRail === 'eft' ? 'Next Business Day (EFT)' : bankRail === 'rtgs' ? 'International (RTGS)' : 'Instant (PesaLink)']] : []),
                  ...(destination === 'bank' && bankRail === 'rtgs' ? [['Beneficiary Country', ({ KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda' } as Record<string, string>)[beneficiaryCountry] || beneficiaryCountry]] : []),
                  ...(isMobileDest ? [['Network', provider === 'airtel' ? 'Airtel Money' : 'M-PESA']] : []),
                  ['Recipient', formatPhoneDisplay(recipientAccount)],
                  ...(destination === 'paybill' ? [['Account Number', paybillAccountRef]] : []),
                  ['Amount', formatKES(Number(amount) || 0)],
                  ['Fee', formatKES(fee)],
                  ...(reference ? [['Reference', reference]] : []),
                ] as [string, string][]).map(([k, v]) => (
                  <View key={k} className="flex-row justify-between items-start gap-4 px-5 py-3 border-b border-[#eff4ef]">
                    <Text className="text-[11px] text-[#707971] font-jakarta-bold uppercase tracking-wider shrink-0">{k}</Text>
                    <Text className="text-[13px] font-jakarta-bold text-[#0c2010] text-right flex-shrink flex-1" numberOfLines={0}>{v}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between items-center px-5 py-4 bg-[#e7f8ef]">
                  <Text className="text-[11px] font-jakarta-extrabold text-[#006c4e] uppercase tracking-wider">Total Deducted</Text>
                  <Text className="text-[19px] font-jakarta-extrabold text-[#00351d]">{formatKES(totalAmount)}</Text>
                </View>
              </View>

              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 text-center">Enter Payment PIN</Text>
              <TextInput
                value={pin}
                onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                autoFocus
                className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[#00351d] font-jakarta-extrabold text-[20px] tracking-[0.5em] text-center"
                placeholder="••••"
                placeholderTextColor="#a1a1aa"
              />
              {pinError ? (
                <View className="flex-row items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
                  <Feather name="alert-circle" size={14} color="#dc2626" />
                  <Text className="text-[12px] font-jakarta-bold text-red-700">{pinError}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View className="px-6 pb-6 pt-3 bg-[#f0fdf4] border-t border-[#eff4ef]">
        <TouchableOpacity
          onPress={goNext}
          disabled={!canContinue() || isLoading}
          activeOpacity={0.9}
          className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
          style={{ backgroundColor: canContinue() && !isLoading ? '#00351d' : '#e0e5e0' }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : step === confirmStep ? (
            <>
              <Feather name="send" size={15} color={canContinue() ? '#5efeb3' : '#a1a1aa'} />
              <Text className={`font-jakarta-extrabold text-[12px] uppercase tracking-widest ${canContinue() ? 'text-white' : 'text-[#a1a1aa]'}`}>Confirm & Send</Text>
            </>
          ) : !hasPin && step === 3 ? (
            <Text className={`font-jakarta-extrabold text-[12px] uppercase tracking-widest ${canContinue() ? 'text-white' : 'text-[#a1a1aa]'}`}>Save PIN & Continue</Text>
          ) : (
            <>
              <Text className={`font-jakarta-extrabold text-[12px] uppercase tracking-widest ${canContinue() ? 'text-white' : 'text-[#a1a1aa]'}`}>Continue</Text>
              <Feather name="arrow-right" size={15} color={canContinue() ? '#5efeb3' : '#a1a1aa'} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
