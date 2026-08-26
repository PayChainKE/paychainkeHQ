import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, Easing, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';
import api from '../api/config';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';
import TransactionSuccessCard, { PayeeDraft } from '../components/ui/TransactionSuccessCard';

// 4-dot loading indicator for the CTA button — a plain spinner read as "stuck"
// to merchants during the PIN-verify + transfer round trip; this staggered
// bounce reads as active progress instead. Same Animated-API loop pattern as
// SettlementQrCard.tsx/BiometricSetup.tsx elsewhere in this app.
function BouncingDots({ color = '#fff' }: { color?: string }) {
  const dots = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 120),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View className="flex-row items-center gap-1.5">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color,
            transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }}
        />
      ))}
    </View>
  );
}

// Same shape/colour as the confirm-step PIN field's filled state — swapped
// in for that field while the PIN-verify + transfer call is in flight, so
// the "dots" the merchant just entered are what visibly signals loading
// instead of a generic spinner elsewhere on screen.
function PinBounceBoxes() {
  const dots = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 120),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View className="flex-row items-center justify-center gap-3">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          className="w-14 h-16 rounded-2xl bg-[#00351d] items-center justify-center"
          style={{ transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}
        >
          <View className="w-2.5 h-2.5 rounded-full bg-white" />
        </Animated.View>
      ))}
    </View>
  );
}

function formatKES(n: number | null | undefined) {
  if (n == null) return 'Ksh 0.00';
  return `Ksh ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Destination = 'mpesa-primary' | 'mobile' | 'bank' | 'till' | 'paybill';

const DESTINATIONS: Array<{ id: Destination; label: string; icon: keyof typeof MaterialIcons.glyphMap; hint: string; feeLabel: string }> = [
  { id: 'mpesa-primary', label: 'Primary M-PESA Number', icon: 'smartphone', hint: 'Your registered phone number', feeLabel: 'Varies' },
  { id: 'mobile', label: 'Any M-PESA Number', icon: 'smartphone', hint: 'Send to any Kenyan mobile number', feeLabel: 'Varies' },
  { id: 'bank', label: 'Bank Account', icon: 'account-balance', hint: 'Direct bank transfer', feeLabel: 'Varies' },
  { id: 'till', label: 'Till Number', icon: 'point-of-sale', hint: 'Pay to a Safaricom Till', feeLabel: 'Varies' },
  { id: 'paybill', label: 'Paybill', icon: 'receipt-long', hint: 'Pay to a Paybill number', feeLabel: 'Varies' },
];

// Mirrors merchant-dashboard's SendMoney.jsx and backend/config/lipaNaMpesaTariffCard.js's
// LIPA_NA_MPESA_B2B_BANDS (2026-08-12 tiered schedule) — recomputed server-side in
// mpesaController.js#initiateB2B via getLipaNaMpesaTariff regardless of what this
// estimate shows. This used to be a flat KES 30 mirroring the now-removed
// NCBA_LIPA_NA_MPESA_FLAT_FEE_KES; the estimate was never updated when the backend
// moved to this tiered table, so it was showing KES 30 for transfers (e.g. KES 50)
// that actually cost KES 0.
const B2B_TARIFF_BANDS: Array<{ max: number; totalFee: number }> = [
  { max: 100,      totalFee: 0   },
  { max: 500,      totalFee: 10  },
  { max: 1_000,    totalFee: 15  },
  { max: 2_500,    totalFee: 23  },
  { max: 5_000,    totalFee: 27  },
  { max: 10_000,   totalFee: 35  },
  { max: 20_000,   totalFee: 57  },
  { max: 30_000,   totalFee: 64  },
  { max: 40_000,   totalFee: 72  },
  { max: 50_000,   totalFee: 79  },
  { max: 100_000,  totalFee: 86  },
  { max: 150_000,  totalFee: 104 },
  { max: 200_000,  totalFee: 122 },
  { max: 250_000,  totalFee: 140 },
];
function estimateB2bFee(amount: number) {
  if (!amount || amount <= 0) return 0;
  const band = B2B_TARIFF_BANDS.find((b) => amount <= b.max) || B2B_TARIFF_BANDS[B2B_TARIFF_BANDS.length - 1];
  return band.totalFee;
}

// Mirrors backend/config/mpesaB2cTariffCard.js's combined
// B2C_REGISTERED_USER_BANDS (Safaricom's real cost) + B2C_SERVICE_FEE_BANDS
// (PayChain's own tiered markup, 2026-08-12) — getB2cTariff sums both
// server-side. This used to add a flat KES 10 PayChain markup, which the
// backend replaced with a tiered schedule (KES 0-200 depending on amount);
// the estimate was never updated to match, so it understated the real
// charge at every amount above the lowest band.
const B2C_TARIFF_BANDS: Array<{ max: number; totalFee: number }> = [
  { max: 49,      totalFee: 0   },
  { max: 100,     totalFee: 5   },
  { max: 500,     totalFee: 11  },
  { max: 1_000,   totalFee: 17  },
  { max: 1_500,   totalFee: 24  },
  { max: 2_500,   totalFee: 29  },
  { max: 3_500,   totalFee: 34  },
  { max: 5_000,   totalFee: 37  },
  { max: 7_500,   totalFee: 57  },
  { max: 10_000,  totalFee: 67  },
  { max: 20_000,  totalFee: 84  },
  { max: 50_000,  totalFee: 113 },
  { max: 100_000, totalFee: 163 },
  { max: 250_000, totalFee: 213 },
];
function estimateB2cFee(amount: number) {
  if (!amount || amount <= 0) return 0;
  const band = B2C_TARIFF_BANDS.find((b) => amount <= b.max) || B2C_TARIFF_BANDS[B2C_TARIFF_BANDS.length - 1];
  return band.totalFee;
}

// Mirrors backend/config/bankTransferTariffCard.js — see dashboard
// SendMoney.jsx's equivalent comment for why a flat KES 50 was wrong (real
// PesaLink tiers run up to KES 210, RTGS is a flat KES 430).
const PESALINK_BANDS = [
  { max: 500,      totalFee: 50  },
  { max: 3_500,    totalFee: 97  },
  { max: 7_000,    totalFee: 122 },
  { max: 10_000,   totalFee: 147 },
  { max: 250_000,  totalFee: 210 },
];
const RTGS_TOTAL_FEE = 430;

function estimateBankFee(rail: 'pesalink' | 'rtgs', amount: number) {
  if (rail === 'rtgs') return RTGS_TOTAL_FEE;
  if (!amount || amount <= 0) return 0;
  const band = PESALINK_BANDS.find((b) => amount <= b.max) || PESALINK_BANDS[PESALINK_BANDS.length - 1];
  return band.totalFee;
}

export default function SendMoney({ navigation }: any) {
  const { merchant, refreshSession, setAppPin } = useAuth();

  // Snapshotted once at mount, not derived live from `merchant` — see the
  // matching fix/comment in apps/merchant-dashboard/src/pages/SendMoney.jsx.
  // A future change to setAppPin() that syncs merchant.hasAppPin mid-flow
  // would otherwise flip confirmStep out from under an in-progress wizard
  // and strand the CTA on a step no render branch matches.
  const [hasPin] = useState(() => !!merchant?.hasAppPin);
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState<Destination | ''>('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [paybillAccountRef, setPaybillAccountRef] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankCodes, setBankCodes] = useState<{ code: string; name: string }[]>([]);
  const [bankRail, setBankRail] = useState<'pesalink' | 'rtgs'>('pesalink');
  // RTGS-only fields — see dashboard SendMoney.jsx's equivalent comment.
  const [beneficiaryCountry, setBeneficiaryCountry] = useState('KE');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [purposeCode, setPurposeCode] = useState('MSC');
  // Which mobile wallet network to pay into — see dashboard SendMoney.jsx's
  // equivalent comment.
  const [provider, setProvider] = useState<'safaricom' | 'airtel'>('safaricom');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [success, setSuccess] = useState(false);
  const [completedTx, setCompletedTx] = useState<any>(null);
  // See SendMoney.jsx's identical state for why: locks the confirm step to
  // a single attempt once a transfer is actually submitted, since NCBA can
  // accept and complete a transfer while returning a response this app
  // reads as a failure — re-tapping Confirm in that case would risk a
  // second real transfer.
  const [confirmLocked, setConfirmLocked] = useState(false);

  const selectedDest = DESTINATIONS.find((d) => d.id === destination);
  const isMobileDest = destination === 'mpesa-primary' || destination === 'mobile';
  const isB2bDest = destination === 'till' || destination === 'paybill';
  const fee = isMobileDest ? estimateB2cFee(Number(amount) || 0) : isB2bDest ? estimateB2bFee(Number(amount) || 0) : destination === 'bank' ? estimateBankFee(bankRail, Number(amount) || 0) : 0;
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

  const canContinue = () => {
    if (step === 1) return !!destination;
    if (step === 2) {
      return (
        !!amount &&
        Number(amount) > 0 &&
        (!isMobileDest || (Number(amount) >= 50 && Number(amount) <= 250000)) &&
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
        // A wrong PIN here is safe to let the merchant retry immediately:
        // no transfer attempt has happened yet.
        try {
          await api.post('/api/auth/merchant/verify-payment-pin', { pin });
        } catch (pinErr: any) {
          if (pinErr?.response?.status === 401) {
            setPinError('Incorrect PIN. Please try again.');
            setPin('');
            return;
          }
          throw pinErr;
        }

        let tx: any = null;
        if (isMobileDest) {
          const { data } = await api.post('/api/callbacks/b2c-request', {
            phone: recipientAccount,
            amount: Number(amount),
            destination: selectedDest?.label,
            fee,
            reference,
            pin,
            provider,
          });
          tx = data.transaction;
        } else if (destination === 'bank') {
          const { data } = await api.post('/api/v1/openbanking/bank-payout', {
            bankCode,
            accountNumber: recipientAccount,
            accountName: reference || undefined,
            amount: Number(amount),
            narration: reference || `Transfer to ${recipientAccount}`,
            pin,
            rail: bankRail,
            ...(bankRail === 'rtgs' ? { beneficiaryCountry, beneficiaryAddress: beneficiaryAddress || undefined, purposeCode } : {}),
          });
          tx = data.transaction;
        } else {
          const { data } = await api.post('/api/callbacks/b2b-request', {
            billType: destination, // 'till' | 'paybill'
            partyB: recipientAccount,
            accountReference: isB2bDest ? (paybillAccountRef || undefined) : undefined,
            amount: Number(amount),
            reference: reference || `Transfer to ${recipientAccount}`,
            pin,
          });
          tx = data.transaction;
        }

        await refreshSession();
        setCompletedTx(tx);
        setSuccess(true);
      } catch (e: any) {
        const msg = e?.response?.data?.error || 'Transfer failed. Please try again.';
        Alert.alert('Transfer Failed', msg);
        setPinError(msg);
        setConfirmLocked(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTryAgain = () => {
    setConfirmLocked(false);
    setPinError('');
    setPin('');
  };

  const goBack = () => {
    if (step > 1) { setConfirmLocked(false); setStep((s) => s - 1); }
    else navigation?.goBack();
  };

  if (success) {
    const methodLabel = isMobileDest
      ? `M-PESA (${provider === 'airtel' ? 'Airtel Money' : 'Safaricom'})`
      : destination === 'bank'
      ? `Bank Transfer · ${bankRail === 'rtgs' ? 'RTGS' : 'PesaLink'}`
      : destination === 'till'
      ? 'Till Payment'
      : 'Paybill Payment';

    const recipientDisplay =
      destination === 'bank'
        ? `${recipientAccount}${bankCode ? ` · ${bankCodes.find((b) => b.code === bankCode)?.name || bankCode}` : ''}`
        : destination === 'paybill'
        ? `Paybill ${recipientAccount}${paybillAccountRef ? ` · Acc ${paybillAccountRef}` : ''}`
        : destination === 'till'
        ? `Till ${recipientAccount}${paybillAccountRef ? ` · Acc ${paybillAccountRef}` : ''}`
        : formatPhoneDisplay(recipientAccount);

    const phoneNumber = isMobileDest ? recipientAccount : merchant?.phone;

    const payeeDraft: PayeeDraft | null = isMobileDest
      ? {
          name: reference || recipientAccount, type: 'contractor', paymentMethod: 'Mobile Money',
          mobileMoneyType: 'Personal Number', mobileNetwork: provider, phone: recipientAccount,
        }
      : destination === 'bank'
      ? {
          name: reference || recipientAccount, type: 'contractor', paymentMethod: 'Bank',
          bankName: bankCodes.find((b) => b.code === bankCode)?.name || '', accountNumber: recipientAccount, bankCode,
        }
      : destination === 'till'
      ? {
          name: reference || `Till ${recipientAccount}`, type: 'contractor', paymentMethod: 'Mobile Money',
          mobileMoneyType: 'Buy Goods', tillNumber: recipientAccount, businessAccount: paybillAccountRef || undefined,
        }
      : destination === 'paybill'
      ? {
          name: reference || `Paybill ${recipientAccount}`, type: 'contractor', paymentMethod: 'Mobile Money',
          mobileMoneyType: 'Paybill', paybillNumber: recipientAccount, businessAccount: paybillAccountRef,
        }
      : null;

    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Send Money" showBack={false} />
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 16 }}>
          <TransactionSuccessCard
            amount={Number(amount)}
            methodLabel={methodLabel}
            recipientDisplay={recipientDisplay}
            phoneNumber={phoneNumber}
            transaction={completedTx}
            payeeDraft={payeeDraft}
            onViewTransactions={() => navigation?.navigate('Transactions')}
            onDone={() => navigation?.navigate('Home')}
          />
        </ScrollView>
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
                    RTGS sends to banks outside PesaLink's network, including other East African countries. Settles same business day, ~3 hours. KES only for now.
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

              {isB2bDest && (
                <View className="mb-5">
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">
                    {destination === 'paybill' ? 'Account Number' : 'Account Reference (Optional)'}
                  </Text>
                  <TextInput
                    value={paybillAccountRef}
                    onChangeText={setPaybillAccountRef}
                    placeholder={destination === 'paybill' ? 'Account Number' : 'Account Reference'}
                    placeholderTextColor="#a1a1aa"
                    className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[15px] font-jakarta-bold text-[#00351d]"
                  />
                  {destination === 'till' && (
                    <Text className="text-[10px] text-[#a1a1aa] mt-2 ml-1">
                      Only needed if this turns out to be registered as a Paybill on Safaricom's side.
                    </Text>
                  )}
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
              {isMobileDest && (
                <Text className="text-[11px] font-jakarta-bold mt-2 text-[#a1a1aa]">
                  Mobile Money transfers: min KES 50, max KES 250,000 per transaction
                </Text>
              )}
              {Number(amount) > 0 && isMobileDest && (Number(amount) < 50 || Number(amount) > 250000) && (
                <Text className="text-[11px] font-jakarta-bold mt-2 text-red-500">
                  {Number(amount) < 50 ? 'Amount must be at least KES 50' : 'Amount cannot exceed KES 250,000 per transaction'}
                </Text>
              )}
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
                  ...(destination === 'bank' ? [['Transfer Speed', bankRail === 'rtgs' ? 'International (RTGS)' : 'Instant (PesaLink)']] : []),
                  ...(destination === 'bank' && bankRail === 'rtgs' ? [['Beneficiary Country', ({ KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda' } as Record<string, string>)[beneficiaryCountry] || beneficiaryCountry]] : []),
                  ...(isMobileDest ? [['Network', provider === 'airtel' ? 'Airtel Money' : 'M-PESA']] : []),
                  ['Recipient', formatPhoneDisplay(recipientAccount)],
                  ...(isB2bDest && paybillAccountRef ? [['Account Number', paybillAccountRef]] : []),
                  ['Amount', formatKES(Number(amount) || 0)],
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

              {confirmLocked ? (
                <View>
                  <View className="items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-6">
                    <Feather name="alert-circle" size={28} color="#dc2626" />
                    <Text className="text-[13px] font-jakarta-bold text-red-700 text-center">{pinError}</Text>
                    <Text className="text-[11px] text-red-700/70 font-jakarta-medium text-center">
                      If you're not sure this went through, check your Transactions page before trying again — don't submit the same transfer twice.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleTryAgain}
                    activeOpacity={0.9}
                    className="w-full py-4 rounded-2xl items-center justify-center mt-4 border border-[#eff4ef]"
                  >
                    <Text className="font-jakarta-extrabold text-[12px] uppercase tracking-widest text-[#00351d]">Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 text-center">Enter Payment PIN</Text>
                  {isLoading ? (
                    <PinBounceBoxes />
                  ) : (
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
                  )}
                  {pinError ? (
                    <View className="flex-row items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
                      <Feather name="alert-circle" size={14} color="#dc2626" />
                      <Text className="text-[12px] font-jakarta-bold text-red-700">{pinError}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA — hidden once the confirm step is locked; the status card
          above owns the only available action (Try Again) then. */}
      {!(step === confirmStep && confirmLocked) && (
      <View className="px-6 pb-6 pt-3 bg-[#f0fdf4] border-t border-[#eff4ef]">
        <TouchableOpacity
          onPress={goNext}
          disabled={!canContinue() || isLoading}
          activeOpacity={0.9}
          className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
          style={{ backgroundColor: canContinue() && !isLoading ? '#00351d' : '#e0e5e0' }}
        >
          {isLoading ? (
            <BouncingDots />
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
      )}
    </SafeAreaView>
  );
}
