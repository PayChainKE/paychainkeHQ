import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';

const STEPS = [
  {
    icon: 'unlock' as const,
    title: 'Enable Biometrics',
    body: 'Turn on Face ID or Touch ID for instant, secure sign-in — no password needed.',
  },
  {
    icon: 'lock' as const,
    title: 'Change Password',
    body: 'Update your password any time from here — you\'ll need your current password to confirm the change.',
  },
  {
    icon: 'grid' as const,
    title: 'Change PIN',
    body: 'Your Payment PIN authorizes every transfer you make. Change it any time, or reset it if you forget.',
  },
];

// Shows exactly once, on a merchant's first visit to the Security tab —
// same server-gated one-time pattern as the other walkthroughs.
export default function SecurityWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenSecurityWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenSecurityWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    setSaving(true);
    try {
      await api.put('/api/auth/merchant/security-walkthrough');
    } catch (err) {
      console.error('Failed to save security walkthrough completion', err);
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
                  {isLast ? 'Got it' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
