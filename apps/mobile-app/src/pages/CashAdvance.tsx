import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../api/config';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';

const TENOR_OPTIONS = [7, 14, 21, 30, 45, 60];
const ACTIVE_STATUSES = ['pending', 'reviewing', 'approved'];

const STATUS_META: Record<string, { label: string; sub: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  pending: {
    label: 'Application Submitted',
    sub: "We've received your application and our credit team is reviewing it. This usually takes 1-2 business days.",
    icon: 'schedule',
  },
  reviewing: {
    label: 'Under Review',
    sub: 'Your application is being actively reviewed by our credit team. We may reach out for a quick verification call.',
    icon: 'schedule',
  },
  approved: {
    label: "You're Approved!",
    sub: 'Congratulations — your cash advance has been approved. Funds will be disbursed to your PayChain balance shortly.',
    icon: 'check-circle',
  },
};

function formatKES(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount || 0);
}

export default function CashAdvance({ navigation }: any) {
  const { merchant } = useAuth();
  const [trustData, setTrustData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<any>(null);
  const [formError, setFormError] = useState('');

  const [requestedAmount, setRequestedAmount] = useState('');
  const [tenorDays, setTenorDays] = useState(30);
  const [purpose, setPurpose] = useState('');
  const [monthlyRevenueEstimate, setMonthlyRevenueEstimate] = useState('');
  const [yearsInOperation, setYearsInOperation] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const initials = merchant?.businessName ? merchant.businessName.substring(0, 2).toUpperCase() : '??';
  const formDisabled = !!(merchant?.features && merchant.features.cashAdvanceForm === false);

  useEffect(() => {
    const load = async () => {
      try {
        const [trustRes, appsRes] = await Promise.allSettled([
          api.get('/api/trust-score'),
          api.get('/api/cash-advance/my-applications'),
        ]);
        if (trustRes.status === 'fulfilled') {
          setTrustData(trustRes.value.data);
        } else {
          setTrustData({ eligibleForAdvance: false, current: 0 });
        }
        if (appsRes.status === 'fulfilled') {
          setApplications(appsRes.value.data?.applications || []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (merchant) {
      if (!contactPhone && merchant.phone) setContactPhone(merchant.phone);
      load();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant]);

  const latestApplication = applications[0] || null;
  const activeApplication = latestApplication && ACTIVE_STATUSES.includes(latestApplication.status) ? latestApplication : null;
  const isEligible = trustData?.eligibleForAdvance || false;

  const resetFormFields = () => {
    setRequestedAmount('');
    setTenorDays(30);
    setPurpose('');
    setMonthlyRevenueEstimate('');
    setYearsInOperation('');
    setBusinessAddress('');
  };

  const startForm = () => {
    setFormError('');
    setJustSubmitted(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 1000) {
      setFormError('Enter a requested amount of at least KES 1,000.');
      return;
    }
    if (purpose.trim().length < 10) {
      setFormError('Describe what the funds are for (at least 10 characters).');
      return;
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await api.post('/api/cash-advance/apply', {
        requestedAmount: amount,
        tenorDays,
        purpose: purpose.trim(),
        monthlyRevenueEstimate: monthlyRevenueEstimate === '' ? null : Number(monthlyRevenueEstimate),
        yearsInOperation: yearsInOperation === '' ? null : Number(yearsInOperation),
        businessAddress: businessAddress.trim() || null,
        contactPhone: contactPhone.trim() || null,
      });
      const application = res.data?.application;
      setApplications((prev) => [application, ...prev]);
      setJustSubmitted(application);
      setShowForm(false);
      resetFormFields();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Could not submit your application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00351d" />
        </View>
      </SafeAreaView>
    );
  }

  const Header = ({ subtitle }: { subtitle: string }) => (
    <LinearGradient
      colors={['#0b4d2e', '#1D9E75']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-full pt-[40px] pb-[16px] px-6 z-40 rounded-b-[24px] shadow-sm shadow-[#0b4d2e]/10"
    >
      <View className="w-full max-w-lg mx-auto flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {showForm ? (
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/25"
            >
              <Feather name="arrow-left" size={17} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30">
              <Text className="text-white font-jakarta-bold text-sm">{initials}</Text>
            </View>
          )}
          <View>
            <Text className="text-white text-[20px] font-jakarta-bold tracking-tight leading-tight">Cash Advance</Text>
            <Text className="text-white/70 text-[12px] font-jakarta-medium tracking-wide">{subtitle}</Text>
          </View>
        </View>
        {!showForm && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/25"
          >
            <Feather name="bell" size={17} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  // ── Feature disabled by admin ──────────────────────────────────────────
  if (formDisabled) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <Header subtitle="Not available" />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-16 items-center text-center">
            <View className="w-24 h-24 rounded-full bg-white items-center justify-center mb-6 border border-[#eff4ef] shadow-sm">
              <MaterialIcons name="lock" size={36} color="rgba(0,53,29,0.3)" />
            </View>
            <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-3 text-center">Applications Are Currently Paused</Text>
            <Text className="text-[14px] text-[#707971] font-jakarta-medium text-center leading-relaxed max-w-[280px]">
              Cash advance applications aren't open for your account right now. Reach out to your PayChain account manager for details.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Application form ───────────────────────────────────────────────────
  if (showForm) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <Header subtitle="New application" />
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <Text className="text-[13px] text-[#707971] font-jakarta-medium mb-8 leading-relaxed">
              Based on your Trust Score of {trustData?.current}, our credit team will review and respond within 1-2 business days.
            </Text>

            <View className="bg-white rounded-[32px] border border-[#bfc9bf]/20 shadow-sm p-6 gap-6">
              <View>
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">How much do you need? (KES)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={requestedAmount}
                  onChangeText={setRequestedAmount}
                  placeholder="50,000"
                  placeholderTextColor="#a1a1aa"
                  className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[22px] font-jakarta-extrabold text-[#00351d]"
                />
              </View>

              <View>
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">Preferred repayment period</Text>
                <View className="flex-row flex-wrap gap-2">
                  {TENOR_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      onPress={() => setTenorDays(days)}
                      className={`px-4 py-2.5 rounded-xl border ${tenorDays === days ? 'bg-[#00351d] border-[#00351d]' : 'bg-[#f0fdf4] border-[#eff4ef]'}`}
                    >
                      <Text className={`text-[12px] font-jakarta-bold ${tenorDays === days ? 'text-white' : 'text-[#404942]'}`}>{days}d</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">What's this advance for?</Text>
                <TextInput
                  value={purpose}
                  onChangeText={setPurpose}
                  multiline
                  numberOfLines={4}
                  placeholder="e.g. Restocking inventory ahead of the festive season..."
                  placeholderTextColor="#a1a1aa"
                  textAlignVertical="top"
                  className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-5 py-4 text-[14px] font-jakarta-medium text-[#00351d] min-h-[100px]"
                />
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">Avg. monthly revenue</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={monthlyRevenueEstimate}
                    onChangeText={setMonthlyRevenueEstimate}
                    placeholder="Optional"
                    placeholderTextColor="#a1a1aa"
                    className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[15px] font-jakarta-bold text-[#00351d]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">Years in operation</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={yearsInOperation}
                    onChangeText={setYearsInOperation}
                    placeholder="Optional"
                    placeholderTextColor="#a1a1aa"
                    className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[15px] font-jakarta-bold text-[#00351d]"
                  />
                </View>
              </View>

              <View>
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">Business address</Text>
                <TextInput
                  value={businessAddress}
                  onChangeText={setBusinessAddress}
                  placeholder="Optional"
                  placeholderTextColor="#a1a1aa"
                  className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-5 py-3.5 text-[14px] font-jakarta-medium text-[#00351d]"
                />
              </View>

              <View>
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-2">Best contact number</Text>
                <ValidatedTextInput
                  kind="phoneKE"
                  optional
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="0712 345 678"
                  placeholderTextColor="#a1a1aa"
                  className="bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl px-5 py-3.5 text-[15px] font-jakarta-bold text-[#00351d]"
                />
              </View>

              {!!formError && (
                <View className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl px-4 py-3">
                  <Text className="text-[#b91c1c] text-[12px] font-jakarta-semibold">{formError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${isSubmitting ? 'bg-[#5efeb3]/60' : 'bg-[#00351d]'}`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Has an active or just-submitted application ────────────────────────
  const statusApplication = justSubmitted || activeApplication;
  if (statusApplication) {
    const meta = STATUS_META[statusApplication.status] || STATUS_META.pending;
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <Header subtitle={meta.label} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <View className="bg-[#00351d] rounded-[40px] p-8 shadow-2xl relative overflow-hidden border border-white/5">
              <View className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40" />
              <View className="relative z-10 items-center">
                <View className="w-20 h-20 rounded-2xl bg-white/10 items-center justify-center border border-white/10 mb-6">
                  <MaterialIcons name={meta.icon} size={36} color="#5efeb3" />
                </View>
                {justSubmitted && (
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <Feather name="check-circle" size={12} color="#5efeb3" />
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#5efeb3]">Application submitted</Text>
                  </View>
                )}
                <Text className="font-jakarta-extrabold text-[24px] text-white tracking-tight mb-2 text-center">{meta.label}</Text>
                <Text className="text-[13px] text-white/70 font-jakarta-medium text-center leading-relaxed mb-6">{meta.sub}</Text>

                {statusApplication.status === 'approved' && statusApplication.approvedLimit ? (
                  <View className="bg-white/10 border border-white/10 rounded-2xl p-5 mb-4 items-center w-full">
                    <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/60 mb-1">Approved Credit Limit</Text>
                    <Text className="font-jakarta-extrabold text-[26px] text-[#5efeb3]">{formatKES(statusApplication.approvedLimit)}</Text>
                  </View>
                ) : null}

                <View className="flex-row w-full gap-2">
                  <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 items-center">
                    <Text className="text-[8px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Requested</Text>
                    <Text className="text-[12px] font-jakarta-bold text-white">{formatKES(statusApplication.requestedAmount)}</Text>
                  </View>
                  <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 items-center">
                    <Text className="text-[8px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Repayment</Text>
                    <Text className="text-[12px] font-jakarta-bold text-white">{statusApplication.tenorDays} days</Text>
                  </View>
                  <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 items-center">
                    <Text className="text-[8px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Submitted</Text>
                    <Text className="text-[12px] font-jakarta-bold text-white">{new Date(statusApplication.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>

                {statusApplication.reviewNotes ? (
                  <View className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4 w-full">
                    <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1.5">Note from our team</Text>
                    <Text className="text-[13px] text-white/80 leading-relaxed">{statusApplication.reviewNotes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Not eligible yet ────────────────────────────────────────────────────
  if (!isEligible) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <Header subtitle="Building eligibility" />
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
            <View className="items-center mb-10">
              <View className="w-[84px] h-[84px] bg-[#5efeb3] rounded-full flex items-center justify-center mb-6 shadow-sm">
                <MaterialIcons name="payments" size={40} color="#00351d" />
              </View>
              <Text className="font-jakarta-extrabold text-[36px] tracking-tight text-[#00351d] mb-3">Cash Advance</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[24px] text-[#00351d] text-center max-w-[280px] leading-tight">Grow your business with PayChain Capital</Text>
            </View>

            <View className="bg-white rounded-[40px] p-8 mb-6 border border-[#bfc9bf]/20 shadow-sm items-center text-center">
              <View className="w-16 h-16 bg-[#f0fdf4] rounded-full flex items-center justify-center mb-6 border border-[#eff4ef]">
                <MaterialIcons name="lock" size={28} color="rgba(0,53,29,0.3)" />
              </View>
              <Text className="text-[20px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-2">Keep building your Trust Score</Text>
              <Text className="text-[14px] text-[#707971] font-jakarta-medium text-center leading-relaxed max-w-[260px]">
                Your Trust Score is {trustData?.current ?? 0}/100. Keep transacting through your PayChain account and your score will keep going up!
              </Text>
            </View>

            <View className="bg-[#f7faf7] rounded-[40px] p-8 border border-[#bfc9bf]/20 mb-8">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[28px] text-[#00351d] mb-8 tracking-tight">The Capital Promise</Text>

              <View className="space-y-8">
                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="description" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">No paperwork</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">Everything is verified through your existing transaction history. No bank visits required.</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="money-off" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">No fixed monthly fees</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">We don't charge interest. A single flat service fee is agreed upfront.</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="trending-up" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">Repay as you earn</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">Repayments happen automatically as a small percentage of your daily sales.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Eligible, no active application — CTA to start one ─────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <Header subtitle="Eligible for advance" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          {latestApplication?.status === 'declined' && (
            <View className="bg-white p-6 rounded-[28px] border border-rose-100 shadow-sm mb-8">
              <View className="flex-row items-start gap-4">
                <View className="w-12 h-12 rounded-xl bg-rose-50 items-center justify-center">
                  <Feather name="x-circle" size={22} color="#e11d48" />
                </View>
                <View className="flex-1">
                  <Text className="font-jakarta-bold text-[16px] text-[#00351d] mb-1">Your previous application wasn't approved</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium leading-relaxed mb-3">
                    {latestApplication.reviewNotes || 'Keep building your transaction history and trust score, then feel free to apply again.'}
                  </Text>
                  <TouchableOpacity onPress={startForm} className="flex-row items-center gap-1.5">
                    <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-widest text-[#006c4e]">Apply again</Text>
                    <Feather name="arrow-right" size={13} color="#006c4e" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View className="flex-row items-start gap-4 mb-10">
            <View className="w-16 h-16 bg-[#5efeb3] rounded-[24px] flex items-center justify-center shadow-sm">
              <MaterialIcons name="payments" size={32} color="#00351d" />
            </View>
            <View className="flex-1 mt-1">
              <Text className="font-jakarta-extrabold text-[34px] tracking-tight text-[#00351d] leading-tight mb-1">Cash Advance</Text>
              <Text className="text-[15px] text-[#404942] font-jakarta-medium leading-relaxed max-w-[220px]">Based on your Trust Score of {trustData?.current}</Text>
            </View>
          </View>

          <View className="bg-[#00351d] rounded-[40px] p-8 shadow-2xl relative overflow-hidden border border-white/5 mb-10">
            <View className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40" />
            <View className="relative z-10 items-center">
              <View className="w-20 h-20 rounded-2xl bg-white/10 items-center justify-center border border-white/10 mb-6">
                <MaterialIcons name="verified" size={40} color="#5efeb3" />
              </View>
              <Text className="font-jakarta-extrabold text-[28px] text-white tracking-tight mb-2 text-center">You are Eligible!</Text>
              <Text className="text-[14px] text-white/70 font-jakarta-medium text-center max-w-[280px] leading-relaxed mb-8">
                Based on your Trust Score of {trustData?.current}, you are eligible to apply for a cash advance. Complete a short application and our lending team will review it within 1-2 business days.
              </Text>
              <TouchableOpacity onPress={startForm} className="w-full bg-[#5efeb3] py-4 rounded-xl flex-row items-center justify-center shadow-lg shadow-[#5efeb3]/20 active:opacity-80">
                <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Start Application</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="bg-[#5efeb3] rounded-[32px] p-7 flex-row items-start gap-4 mb-10 shadow-sm">
            <View className="w-6 h-6 rounded-full bg-[#00351d] flex items-center justify-center mt-1">
              <Text className="text-[#5efeb3] font-jakarta-bold text-[14px] italic">i</Text>
            </View>
            <View className="flex-1">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] leading-tight mb-2">Automated Repayment</Text>
              <Text className="text-[15px] text-[#00351d] leading-relaxed font-jakarta-medium pr-2">
                A share of each day's collections is automatically applied to your advance once disbursed.{' '}
                <Text className="font-jakarta-bold">No manual transfers required.</Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
