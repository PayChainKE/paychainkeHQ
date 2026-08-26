import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';

const STEPS = [
  {
    icon: 'sun' as const,
    title: 'Welcome to PayChain',
    body: "A 60-second tour of what you can do here — skip anytime.",
  },
  {
    icon: 'home' as const,
    title: 'Home',
    body: 'Your balance, recent activity, and quick actions at a glance.',
  },
  {
    icon: 'send' as const,
    title: 'Send & Request Money',
    body: 'Move money to M-Pesa or bank instantly, or request payment from a customer.',
  },
  {
    icon: 'users' as const,
    title: 'Bulk Payments',
    body: 'Pay salaries, suppliers, or many recipients at once — upload a list, review, and send.',
  },
  {
    icon: 'arrow-down-circle' as const,
    title: 'Collections',
    body: 'Create invoices and collect payments, then track who has paid.',
  },
  {
    icon: 'trending-up' as const,
    title: 'Cash Advance',
    body: 'Short-term working capital, made available against your transaction history.',
  },
  {
    icon: 'grid' as const,
    title: 'More',
    body: 'Complete your business profile, manage security, and reach support anytime.',
  },
];

// Shows exactly once, on a merchant's first login after signup — gated
// server-side (Merchant.hasSeenOnboardingWalkthrough) so it never reappears
// on another device or after a re-login. Self-contained: mount it once
// (Dashboard.tsx) with no props.
export default function MerchantWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenOnboardingWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenOnboardingWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    setSaving(true);
    try {
      await api.put('/api/auth/merchant/onboarding-walkthrough');
    } catch (err) {
      console.error('Failed to save walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/60 justify-end sm:justify-center">
        <View className="bg-white rounded-t-[32px] overflow-hidden">
          <View className="h-1.5 w-full bg-[#00c876]" />
          <View className="px-7 pt-6 pb-8">
            {/* Progress + Skip */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row" style={{ gap: 6 }}>
                {STEPS.map((_, i) => (
                  <View
                    key={i}
                    className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-[#00c876]' : 'w-1.5 bg-[#d1fae5]'}`}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={finish} disabled={saving}>
                <Text className="text-[#0c2010]/40 font-jakarta-bold text-[11px] uppercase tracking-widest">
                  Skip
                </Text>
              </TouchableOpacity>
            </View>

            {/* Step content */}
            <View className="items-center py-2">
              <View className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center mb-5">
                <Feather name={current.icon} size={28} color="#047857" />
              </View>
              <Text className="text-[#00c876] font-jakarta-bold text-[10px] uppercase tracking-[2px] mb-1.5">
                Step {step + 1} of {STEPS.length}
              </Text>
              <Text className="text-[#0c2010] font-jakarta-bold text-[22px] text-center tracking-tight mb-3">
                {current.title}
              </Text>
              <Text className="text-[#707971] font-jakarta-medium text-[14px] text-center leading-relaxed px-2">
                {current.body}
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row items-center mt-7" style={{ gap: 12 }}>
              {step > 0 && (
                <TouchableOpacity
                  onPress={() => setStep((s) => s - 1)}
                  disabled={saving}
                  className="flex-1 py-4 rounded-2xl items-center"
                >
                  <Text className="text-[#0c2010]/60 font-jakarta-bold text-[12px] uppercase tracking-widest">
                    Back
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
                disabled={saving}
                className="py-4 rounded-2xl items-center bg-[#06201b]"
                style={{ flex: 2 }}
              >
                <Text className="text-white font-jakarta-bold text-[12px] uppercase tracking-widest">
                  {isLast ? 'Get Started' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
