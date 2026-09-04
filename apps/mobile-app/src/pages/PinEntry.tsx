import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { useBiometrics, biometricLabel } from '../hooks/useBiometrics';

// Give the screen a beat to actually finish mounting/transitioning before
// invoking the OS biometric sheet — calling authenticateAsync the instant
// this component mounts can race the React Navigation screen transition
// (a known expo-local-authentication + react-navigation gotcha where the
// prompt silently fails to present, or gets dismissed instantly, looking
// to the user like "biometrics never popped up").
const AUTO_PROMPT_DELAY_MS = 350;

// This PIN also authorizes real money movement (see AuthContext.tsx —
// "THE single Payment PIN"), yet verifyPin previously had zero
// attempt-limiting: no counter, no lockout, just an unlimited offline
// compare against the SecureStore-cached PIN. SupportPage.tsx's FAQ tells
// merchants "You get 5 attempts before your account is temporarily locked
// for 15 minutes" — that promise only held for server-side flows
// (set-app-pin/reset-app-pin's pinLimiter); this local unlock gate enforced
// nothing. Persisted in SecureStore (not just component state) so
// force-quitting/reopening the app doesn't reset the counter.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPTS_KEY = 'paychain_pin_failed_attempts';
const LOCKED_UNTIL_KEY = 'paychain_pin_locked_until';

async function loadLockoutState(): Promise<{ attempts: number; lockedUntil: number | null }> {
  const [attemptsRaw, lockedUntilRaw] = await Promise.all([
    SecureStore.getItemAsync(ATTEMPTS_KEY),
    SecureStore.getItemAsync(LOCKED_UNTIL_KEY),
  ]);
  return {
    attempts: parseInt(attemptsRaw || '0', 10) || 0,
    lockedUntil: lockedUntilRaw ? parseInt(lockedUntilRaw, 10) : null,
  };
}

async function clearLockoutState() {
  await Promise.all([
    SecureStore.deleteItemAsync(ATTEMPTS_KEY),
    SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY),
  ]);
}

function formatRetryTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PinEntry({ navigation }: any) {
  const { appPin, unlockApp, logout, isBiometricsEnabled } = useAuth();
  const { support, authenticate } = useBiometrics();
  const [pin, setPin] = useState('');
  // idle: nothing attempted yet (or PIN pad only) · prompting: OS sheet is
  // (or should be) up · failed: the last attempt was cancelled/failed, so a
  // manual retry affordance is shown instead of silently going quiet.
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'prompting' | 'failed'>('idle');
  const autoTriggeredRef = useRef(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const method = biometricLabel(support.types);
  const isLocked = !!lockedUntil && lockedUntil > now;

  // Load any lockout persisted from a previous attempt (or a previous app
  // session — see the SecureStore rationale above).
  useEffect(() => {
    loadLockoutState().then((state) => {
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setLockedUntil(state.lockedUntil);
      }
    });
  }, []);

  // Tick every second while locked so the countdown/re-enable is live.
  useEffect(() => {
    if (!isLocked) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  useEffect(() => {
    if (lockedUntil && lockedUntil <= now) {
      setLockedUntil(null);
      clearLockoutState();
    }
  }, [now, lockedUntil]);

  const triggerBiometric = async () => {
    setBiometricStatus('prompting');
    const result = await authenticate('Unlock PayChain');
    if (result.success) {
      unlockApp();
      return;
    }
    // A cancelled prompt (user backed out) goes back to idle quietly — an
    // actual failure (wrong finger, hardware error, etc.) surfaces the
    // retry row so the user isn't left guessing why nothing happened.
    setBiometricStatus(result.cancelled ? 'idle' : 'failed');
  };

  useEffect(() => {
    if (!isBiometricsEnabled || autoTriggeredRef.current || isLocked) return;
    autoTriggeredRef.current = true;
    const timer = setTimeout(triggerBiometric, AUTO_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBiometricsEnabled, isLocked]);

  const handlePress = (digit: string) => {
    if (isLocked) return;
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => verifyPin(newPin), 300);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = async (enteredPin: string) => {
    if (enteredPin === appPin) {
      await clearLockoutState();
      unlockApp();
      return;
    }

    const { attempts } = await loadLockoutState();
    const nextAttempts = attempts + 1;
    setPin('');

    if (nextAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      await Promise.all([
        SecureStore.setItemAsync(ATTEMPTS_KEY, String(nextAttempts)),
        SecureStore.setItemAsync(LOCKED_UNTIL_KEY, String(until)),
      ]);
      setLockedUntil(until);
      setNow(Date.now());
      Alert.alert('Too Many Attempts', 'Your account is temporarily locked for 15 minutes.');
      return;
    }

    await SecureStore.setItemAsync(ATTEMPTS_KEY, String(nextAttempts));
    Alert.alert('Incorrect PIN', `Please try again. ${MAX_ATTEMPTS - nextAttempts} attempt${MAX_ATTEMPTS - nextAttempts === 1 ? '' : 's'} remaining.`);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-1 px-8 pt-12 items-center justify-center">
        <View className="w-16 h-16 bg-[#006c4e] rounded-full justify-center items-center mb-6">
          <Feather name="shield" size={28} color="white" />
        </View>
        <Text className="text-white text-[24px] font-jakarta-bold mb-2">
          Unlock PayChain
        </Text>
        <Text className={`text-[14px] font-jakarta-medium text-center mb-8 ${isLocked ? 'text-red-400' : 'text-[#68dbae]'}`}>
          {isLocked
            ? `Too many incorrect attempts. Try again in ${formatRetryTime(lockedUntil! - now)}.`
            : 'Enter your 4-digit PIN to access your dashboard.'}
        </Text>

        {isBiometricsEnabled && !isLocked && (
          <TouchableOpacity
            onPress={triggerBiometric}
            disabled={biometricStatus === 'prompting'}
            className={`flex-row items-center gap-2 px-5 py-3 rounded-full mb-8 ${biometricStatus === 'failed' ? 'bg-red-500/10 border border-red-400/30' : 'bg-white/5 border border-white/10'}`}
          >
            {biometricStatus === 'prompting' ? (
              <ActivityIndicator size="small" color="#68dbae" />
            ) : (
              <MaterialIcons name="fingerprint" size={18} color={biometricStatus === 'failed' ? '#f87171' : '#68dbae'} />
            )}
            <Text className={`font-jakarta-bold text-[13px] ${biometricStatus === 'failed' ? 'text-red-400' : 'text-[#68dbae]'}`}>
              {biometricStatus === 'prompting' ? `Waiting for ${method}…` : biometricStatus === 'failed' ? `Try ${method} Again` : `Use ${method}`}
            </Text>
          </TouchableOpacity>
        )}

        <View className="flex-row justify-center space-x-6 mb-16">
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              className={`w-4 h-4 rounded-full ${index < pin.length ? 'bg-[#68dbae]' : 'bg-[#1b3a2a]'} mx-2`}
            />
          ))}
        </View>

        <View className="w-full max-w-[300px] mb-8">
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'delete']
          ].map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-between mb-6">
              {row.map((item, colIndex) => {
                if (item === '') {
                  return <View key={colIndex} style={{ width: 70 }} />;
                }
                if (item === 'delete') {
                  return (
                    <TouchableOpacity
                      key={colIndex}
                      onPress={handleDelete}
                      disabled={isLocked}
                      className="w-[70px] h-[70px] justify-center items-center rounded-full"
                    >
                      <Feather name="delete" size={24} color={isLocked ? '#3d4f45' : 'white'} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={colIndex}
                    onPress={() => handlePress(item)}
                    disabled={isLocked}
                    className={`w-[70px] h-[70px] justify-center items-center rounded-full ${isLocked ? 'bg-[#142a1e]' : 'bg-[#1b3a2a]'}`}
                  >
                    <Text className={`text-[28px] font-jakarta-bold ${isLocked ? 'text-[#3d4f45]' : 'text-white'}`}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPin')} disabled={isLocked} className="mt-4">
          <Text className={`font-jakarta-bold text-[14px] ${isLocked ? 'text-[#3d4f45]' : 'text-[#68dbae]'}`}>Forgot PIN?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} className="mt-4">
          <Text className="text-white/40 font-jakarta-bold text-[13px]">Log out instead</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
