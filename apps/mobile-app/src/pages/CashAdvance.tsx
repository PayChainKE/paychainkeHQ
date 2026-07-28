import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Linking } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/config';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import TopBar from '../components/layout/TopBar';

const CASH_ADVANCE_LEARN_MORE_URL = 'https://www.paychain.co.ke/products/cash-advance';
const TENOR_OPTIONS = [7, 14, 21, 30, 45, 60];
const ACTIVE_STATUSES = ['pending', 'reviewing', 'approved'];

const STEPS = [
  { id: 1, label: 'Advance Details' },
  { id: 2, label: 'Business Snapshot' },
  { id: 3, label: 'Review & Submit' },
];

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

function formatKES(n: number | null | undefined) {
  if (n == null) return 'KES 0.00';
  return `KES ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function UnavailableNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <View className="flex-row items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
      <MaterialIcons name="info" size={18} color="#f59e0b" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-[13px] text-amber-900 font-jakarta-medium leading-relaxed">
          Cash advance is not available at this time. Keep using your PayChain account and check for your loan limit updates.{' '}
          <Text
            onPress={() => Linking.openURL(CASH_ADVANCE_LEARN_MORE_URL)}
            className="font-jakarta-extrabold underline"
          >
            Learn more about cash advance
          </Text>
        </Text>
      </View>
      <TouchableOpacity onPress={() => setDismissed(true)} className="p-1 -mt-1 -mr-1">
        <Feather name="x" size={16} color="#f59e0b" />
      </TouchableOpacity>
    </View>
  );
}

function PageHeader() {
  return (
    <View className="mb-8">
      <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[30px] text-[#00351d] tracking-tight leading-tight">Cash Advance</Text>
      <Text className="text-[#707971] text-[13px] font-jakarta-medium mt-1.5 opacity-80 leading-relaxed">
        Get extra cash for your business today. We take back a small bit from your daily sales until it's paid — no paperwork needed.
      </Text>
    </View>
  );
}

function StatusCard({ application, celebratory }: { application: any; celebratory?: boolean }) {
  const meta = STATUS_META[application.status] || STATUS_META.pending;
  return (
    <View className="bg-[#00351d] rounded-[32px] p-8 shadow-2xl relative overflow-hidden border border-white/5">
      <View className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40" />
      <View className="relative z-10">
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-2xl bg-white/10 items-center justify-center border border-white/10 mb-6">
            <MaterialIcons name={meta.icon} size={36} color="#5efeb3" />
          </View>
          {celebratory && (
            <View className="flex-row items-center gap-1.5 mb-3">
              <MaterialIcons name="auto-awesome" size={13} color="#5efeb3" />
              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#5efeb3]">Application submitted</Text>
            </View>
          )}
          <Text className="font-jakarta-extrabold text-[24px] text-white tracking-tight mb-2 text-center">{meta.label}</Text>
          <Text className="text-[13px] text-white/70 font-jakarta-medium text-center leading-relaxed max-w-[300px]">{meta.sub}</Text>
        </View>

        {application.status === 'approved' && application.approvedLimit ? (
          <View className="bg-white/10 border border-white/10 rounded-2xl p-6 mb-6 items-center">
            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-white/60 mb-1">Approved Credit Limit</Text>
            <Text className="font-jakarta-extrabold text-[28px] text-[#5efeb3]">{formatKES(application.approvedLimit)}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 items-center">
            <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Requested</Text>
            <Text className="text-[12px] font-jakarta-bold text-white text-center">{formatKES(application.requestedAmount)}</Text>
          </View>
          <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 items-center">
            <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Repayment Period</Text>
            <Text className="text-[12px] font-jakarta-bold text-white text-center">{application.tenorDays} days</Text>
          </View>
          <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 items-center">
            <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1">Submitted</Text>
            <Text className="text-[12px] font-jakarta-bold text-white text-center">{new Date(application.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {application.reviewNotes ? (
          <View className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <Text className="text-[9px] font-jakarta-extrabold uppercase tracking-widest text-white/50 mb-1.5">Note from our team</Text>
            <Text className="text-[13px] text-white/80 leading-relaxed">{application.reviewNotes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DeclinedBanner({ application, onApplyAgain }: { application: any; onApplyAgain: () => void }) {
  return (
    <View className="bg-white p-6 rounded-[28px] border border-rose-100 shadow-sm mb-6">
      <View className="flex-row items-start gap-4">
        <View className="w-12 h-12 rounded-xl bg-rose-50 items-center justify-center">
          <Feather name="x-circle" size={22} color="#f43f5e" />
        </View>
        <View className="flex-1">
          <Text className="font-jakarta-extrabold text-[16px] text-[#00351d] mb-1">Your previous application wasn't approved</Text>
          <Text className="text-[13px] text-[#707971] font-jakarta-medium opacity-80 leading-relaxed mb-1">
            {application.reviewNotes || 'Keep building your transaction history and trust score, then feel free to apply again.'}
          </Text>
          <TouchableOpacity onPress={onApplyAgain} className="mt-3 flex-row items-center gap-1.5">
            <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]">Apply again</Text>
            <Feather name="arrow-right" size={13} color="#00351d" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View className={`px-5 py-4 flex-row items-start justify-between gap-4 ${isLast ? '' : 'border-b border-[#eff4ef]'}`}>
      <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971]/70">{label}</Text>
      <Text className="text-[13px] font-jakarta-bold text-[#00351d] text-right flex-1 ml-4">{value}</Text>
    </View>
  );
}

export default function CashAdvance({ navigation }: any) {
  const { merchant } = useAuth();

  const [trustData, setTrustData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
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

  const formDisabled = !!(merchant?.features && merchant.features.cashAdvanceForm === false);

  useEffect(() => {
    const load = async () => {
      try {
        const [trustRes, appsRes] = await Promise.allSettled([
          api.get('/api/trust-score'),
          api.get('/api/cash-advance/my-applications'),
        ]);
        setTrustData(trustRes.status === 'fulfilled' ? trustRes.value.data : { eligibleForAdvance: false, current: 0 });
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

  const startForm = () => {
    setShowForm(true);
    setFormStep(1);
    setJustSubmitted(null);
    setFormError('');
  };

  const resetFormFields = () => {
    setRequestedAmount('');
    setTenorDays(30);
    setPurpose('');
    setMonthlyRevenueEstimate('');
    setYearsInOperation('');
    setBusinessAddress('');
  };

  const validateStep1 = () => {
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 1000) {
      setFormError('Enter a requested amount of at least KES 1,000.');
      return false;
    }
    if (purpose.trim().length < 10) {
      setFormError('Describe what the funds are for (at least 10 characters).');
      return false;
    }
    setFormError('');
    return true;
  };

  const goNext = () => {
    if (formStep === 1 && !validateStep1()) return;
    setFormStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => setFormStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/api/cash-advance/apply', {
        requestedAmount: Number(requestedAmount),
        tenorDays: Number(tenorDays),
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

  if (isLoading || !trustData) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00351d" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Feature disabled by admin ──────────────────────────────────────────
  if (formDisabled) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Cash Advance" showBack={false} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <PageHeader />
            <View className="bg-white rounded-2xl shadow-sm border border-[#eff4ef] p-12 items-center">
              <View className="w-24 h-24 rounded-full bg-[#f7faf7] items-center justify-center mb-6 border border-[#eff4ef]">
                <MaterialIcons name="lock" size={36} color="#707971" />
              </View>
              <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] mb-3 text-center">Applications Are Currently Paused</Text>
              <Text className="text-[15px] text-[#707971] font-jakarta-medium text-center leading-relaxed max-w-[280px] opacity-80 mb-6">
                Cash advance applications aren't open for your account right now. Contact support for details.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('mailto:support@paychain.co.ke?subject=Cash%20Advance%20Application')}
                className="bg-[#0B0E14] px-8 py-3.5 rounded-xl"
              >
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Contact Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Not eligible yet ────────────────────────────────────────────────────
  if (!trustData.eligibleForAdvance) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Cash Advance" showBack={false} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <UnavailableNotice />
            <PageHeader />
            <View className="bg-white rounded-2xl shadow-sm border border-[#eff4ef] p-12 items-center">
              <View className="w-24 h-24 rounded-full bg-[#f7faf7] items-center justify-center mb-6 border border-[#eff4ef]">
                <Feather name="shield" size={32} color="#00351d" />
              </View>
              <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] mb-3 text-center">Keep building your Trust Score</Text>
              <Text className="text-[15px] text-[#707971] font-jakarta-medium text-center leading-relaxed max-w-[280px] opacity-80 mb-6">
                Your Trust Score needs to reach 85 before you can get a Cash Advance. Keep transacting through your PayChain account and your score will keep going up!
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(CASH_ADVANCE_LEARN_MORE_URL)}
                className="bg-[#0B0E14] px-8 py-3.5 rounded-xl"
              >
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Learn More</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Just submitted ──────────────────────────────────────────────────────
  if (justSubmitted) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Cash Advance" showBack={false} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <PageHeader />
            <StatusCard application={justSubmitted} celebratory />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Has an active application ───────────────────────────────────────────
  if (activeApplication && !showForm) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <TopBar title="Cash Advance" showBack={false} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-8">
            <PageHeader />
            <StatusCard application={activeApplication} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Application form (3-step wizard) ────────────────────────────────────
  if (showForm) {
    return (
      <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="w-full max-w-lg mx-auto px-6 pt-6">
            <TouchableOpacity
              onPress={() => (formStep === 1 ? setShowForm(false) : goBack())}
              className="flex-row items-center gap-2 mb-6"
            >
              <Feather name="arrow-left" size={16} color="#94a3a0" />
              <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#94a3a0]">
                {formStep === 1 ? 'Cancel' : 'Previous Step'}
              </Text>
            </TouchableOpacity>

            <View className="items-center mb-8">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[28px] text-[#00351d] tracking-tight mb-2 text-center">Cash Advance Application</Text>
              <Text className="text-[#707971] font-jakarta-medium opacity-70 text-center text-[13px] leading-relaxed max-w-[280px]">
                A quick, three-step application. Based on your Trust Score of {trustData.current}, our credit team will review and respond within 1-2 business days.
              </Text>
            </View>

            <View className="flex-row items-center justify-between mb-10 px-2">
              {STEPS.map((s) => (
                <React.Fragment key={s.id}>
                  <View className="items-center">
                    <View className={`w-9 h-9 rounded-full items-center justify-center border-2 ${formStep >= s.id ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#cdffd8]'}`}>
                      {formStep > s.id ? (
                        <Feather name="check" size={16} color="white" />
                      ) : (
                        <Text className={`font-jakarta-extrabold text-[13px] ${formStep >= s.id ? 'text-white' : 'text-[#a7f3d0]'}`}>{s.id}</Text>
                      )}
                    </View>
                    <Text className={`mt-2 text-[8px] uppercase tracking-widest font-jakarta-extrabold text-center max-w-[70px] ${formStep >= s.id ? 'text-[#00351d]' : 'text-[#a7f3d0]'}`}>{s.label}</Text>
                  </View>
                  {s.id !== 3 && <View className="flex-1 h-[2px] bg-[#cdffd8] mx-1 -mt-4" />}
                </React.Fragment>
              ))}
            </View>

            <View className="bg-white rounded-[32px] border border-[#e5e7eb] shadow-lg p-6">
              {formStep === 1 && (
                <View className="gap-6">
                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">How much do you need? (KES)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={requestedAmount}
                      onChangeText={setRequestedAmount}
                      placeholder="50,000"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-6 py-5 text-[22px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>

                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Preferred repayment period</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {TENOR_OPTIONS.map((days) => (
                        <TouchableOpacity
                          key={days}
                          onPress={() => setTenorDays(days)}
                          className={`px-4 py-3 rounded-2xl border ${tenorDays === days ? 'bg-[#00351d] border-[#00351d]' : 'bg-[#f7faf7] border-[#eff4ef]'}`}
                        >
                          <Text className={`text-[11px] font-jakarta-extrabold uppercase ${tenorDays === days ? 'text-white' : 'text-[#00351d]/70'}`}>{days}d</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">What's this advance for?</Text>
                    <TextInput
                      value={purpose}
                      onChangeText={setPurpose}
                      multiline
                      numberOfLines={4}
                      placeholder="e.g. Restocking inventory ahead of the festive season..."
                      placeholderTextColor="#a1a1aa"
                      textAlignVertical="top"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-6 py-5 text-[14px] font-jakarta-medium text-[#00351d] min-h-[110px]"
                    />
                  </View>
                </View>
              )}

              {formStep === 2 && (
                <View className="gap-6">
                  <View className="flex-row gap-4">
                    <View className="flex-1">
                      <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Avg. monthly revenue</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={monthlyRevenueEstimate}
                        onChangeText={setMonthlyRevenueEstimate}
                        placeholder="Optional"
                        placeholderTextColor="#a1a1aa"
                        className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-5 py-4 text-[16px] font-jakarta-extrabold text-[#00351d]"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Years in operation</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={yearsInOperation}
                        onChangeText={setYearsInOperation}
                        placeholder="Optional"
                        placeholderTextColor="#a1a1aa"
                        className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-5 py-4 text-[16px] font-jakarta-extrabold text-[#00351d]"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Business address</Text>
                    <TextInput
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                      placeholder="Optional"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-5 py-4 text-[14px] font-jakarta-medium text-[#00351d]"
                    />
                  </View>

                  <View>
                    <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d]/60 mb-2 ml-1">Best contact number</Text>
                    <ValidatedTextInput
                      kind="phoneKE"
                      optional
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="0712 345 678"
                      placeholderTextColor="#a1a1aa"
                      className="bg-[#f7faf7] border border-[#eff4ef] rounded-3xl px-5 py-4 text-[16px] font-jakarta-extrabold text-[#00351d]"
                    />
                  </View>
                </View>
              )}

              {formStep === 3 && (
                <View className="gap-5">
                  <View className="items-center mb-2">
                    <View className="w-14 h-14 rounded-2xl bg-[#f7faf7] items-center justify-center mb-4">
                      <MaterialIcons name="fact-check" size={26} color="#00351d" />
                    </View>
                    <Text className="text-[18px] font-jakarta-extrabold text-[#00351d] mb-1">Review your application</Text>
                    <Text className="text-[13px] text-[#707971] font-jakarta-medium opacity-70">Double-check the details below before submitting.</Text>
                  </View>

                  <View className="bg-[#f7faf7] rounded-3xl border border-[#eff4ef]">
                    <SummaryRow label="Requested amount" value={requestedAmount ? formatKES(Number(requestedAmount)) : '—'} />
                    <SummaryRow label="Repayment period" value={`${tenorDays} days`} />
                    <SummaryRow label="Purpose" value={purpose || '—'} />
                    {!!monthlyRevenueEstimate && <SummaryRow label="Avg. monthly revenue" value={formatKES(Number(monthlyRevenueEstimate))} />}
                    {!!yearsInOperation && <SummaryRow label="Years in operation" value={yearsInOperation} />}
                    {!!businessAddress && <SummaryRow label="Business address" value={businessAddress} />}
                    {!!contactPhone && <SummaryRow label="Contact number" value={contactPhone} />}
                    <SummaryRow label="Current Trust Score" value={`${trustData.current} / 100`} isLast />
                  </View>

                  <Text className="text-[11px] text-[#707971]/60 font-jakarta-medium text-center leading-relaxed px-4">
                    By submitting, you confirm the information above is accurate. Our credit team will review your application and get back to you within 1-2 business days.
                  </Text>
                </View>
              )}

              {!!formError && (
                <View className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl px-4 py-3 mt-6">
                  <Text className="text-[#b91c1c] text-[12px] font-jakarta-semibold">{formError}</Text>
                </View>
              )}

              <View className="flex-row gap-3 pt-8">
                {formStep > 1 && (
                  <TouchableOpacity
                    onPress={goBack}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-[#f7faf7] rounded-2xl items-center border border-[#eff4ef]"
                  >
                    <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-widest text-[#94a3a0]">Back</Text>
                  </TouchableOpacity>
                )}
                {formStep < 3 ? (
                  <TouchableOpacity
                    onPress={goNext}
                    className="flex-1 py-4 bg-[#00351d] rounded-2xl items-center flex-row justify-center gap-2"
                  >
                    <Text className="text-white text-[11px] font-jakarta-extrabold uppercase tracking-widest">Continue</Text>
                    <Feather name="arrow-right" size={14} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-[#5efeb3] rounded-2xl items-center flex-row justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#00351d" size="small" />
                    ) : (
                      <Text className="text-[#00351d] text-[11px] font-jakarta-extrabold uppercase tracking-widest">Submit Application</Text>
                    )}
                  </TouchableOpacity>
                )}
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
      <TopBar title="Cash Advance" showBack={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-8">
          <PageHeader />

          {latestApplication?.status === 'declined' && (
            <DeclinedBanner application={latestApplication} onApplyAgain={startForm} />
          )}

          <View className="bg-[#00351d] rounded-[32px] p-8 shadow-2xl relative overflow-hidden border border-white/5">
            <View className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40" />
            <View className="relative z-10 items-center">
              <View className="w-20 h-20 rounded-2xl bg-white/10 items-center justify-center border border-white/10 mb-6">
                <MaterialIcons name="verified" size={36} color="#5efeb3" />
              </View>
              <Text className="font-jakarta-extrabold text-[24px] text-white tracking-tight mb-2 text-center">You are Eligible!</Text>
              <Text className="text-[14px] text-white/70 font-jakarta-medium text-center max-w-[300px] leading-relaxed mb-8">
                Based on your Trust Score of {trustData.current}, you are eligible to apply for a cash advance. Complete a short application and our lending team will review it within 1-2 business days.
              </Text>
              <TouchableOpacity onPress={startForm} className="bg-[#5efeb3] px-8 py-4 rounded-xl w-full items-center">
                <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Start Application</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
