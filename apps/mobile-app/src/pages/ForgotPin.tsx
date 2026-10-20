import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';
import { OtpInput } from '../components/OtpInput';

const { width } = Dimensions.get('window');

// Same lockout keys PinEntry.tsx tracks failed-PIN-guess attempts under —
// a successful reset here means whatever was locked no longer applies.
const ATTEMPTS_KEY = 'paychain_pin_failed_attempts';
const LOCKED_UNTIL_KEY = 'paychain_pin_locked_until';

// Same weak-PIN blocklist PinSetup.tsx rejects — a reset shouldn't be able
// to land back on a trivially guessable PIN either.
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '0123', '1234', '2345', '3456', '4567', '5678', '6789',
  '9876', '8765', '7654', '6543', '5432', '4321', '3210',
]);

type Step = 'choose' | 'otp' | 'password' | 'setup' | 'confirm';

// Two ways to prove it's really the merchant before a new PIN can be set:
// a code sent to the phone + email on file (works even if they've also
// forgotten their password — the common case), or their account password.
// Reached from the lock screen (PinEntry) and from Security settings
// (route.params.fromSettings), where it returns to settings instead of
// unlocking the app.
export default function ForgotPin({ navigation, route }: any) {
  usePreventScreenCapture(); // no-op on web

  const fromSettings = !!route?.params?.fromSettings;
  const { setAppPin, resetPinWithOtp, sendPinResetOtp, unlockApp } = useAuth();

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<'otp' | 'password'>('otp');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const currentPin = step === 'setup' ? pin : confirmPin;

  // As a hidden tab (fromSettings) this screen stays mounted between visits
  // — start fresh every time it's left, never mid-flow with an old code.
  useFocusEffect(useCallback(() => () => {
    if (!fromSettings) return;
    setStep('choose'); setMethod('otp'); setPassword(''); setCode('');
    setSentTo(''); setErr(''); setPin(''); setConfirmPin('');
  }, [fromSettings]));

  const leave = () => {
    if (fromSettings) navigation.navigate('More');
    else navigation.goBack();
  };

  const handleSendCode = async () => {
    setSending(true);
    setErr('');
    const res = await sendPinResetOtp();
    setSending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setSentTo([res.maskedPhone, res.maskedEmail].filter(Boolean).join(' and '));
    setMethod('otp');
    setCode('');
    setStep('otp');
  };

  const handleContinueCode = () => {
    if (code.length !== 6) {
      setErr('Enter the 6-digit code we sent you.');
      return;
    }
    setErr('');
    setStep('setup');
  };

  const handleContinuePassword = () => {
    if (!password) {
      setErr('Enter your account password to continue.');
      return;
    }
    setErr('');
    setMethod('password');
    setStep('setup');
  };

  const handlePress = (digit: string) => {
    if (step === 'setup') {
      if (pin.length < 4) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 4) {
          if (WEAK_PINS.has(newPin)) {
            setTimeout(() => {
              showAlert('Choose a Stronger PIN', 'Repeated or sequential digits (like 1234 or 0000) are too easy to guess. Please choose a different PIN.');
              setPin('');
            }, 300);
          } else {
            setTimeout(() => setStep('confirm'), 300);
          }
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + digit;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 4) setTimeout(() => verifyAndReset(newConfirmPin), 300);
      }
    }
  };

  const handleDelete = () => {
    if (step === 'setup') setPin((prev) => prev.slice(0, -1));
    else if (step === 'confirm') setConfirmPin((prev) => prev.slice(0, -1));
  };

  const verifyAndReset = async (finalConfirmPin: string) => {
    if (pin !== finalConfirmPin) {
      showAlert('Error', 'PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('setup');
      return;
    }

    setChecking(true);
    try {
      if (method === 'otp') await resetPinWithOtp(code, pin);
      else await setAppPin(pin, password);
      // expo-secure-store's web shim doesn't implement these calls (throws
      // "getValueWithKeyAsync is not a function") — same guard as
      // PinEntry.tsx's lockout helpers. Without it this throw happens AFTER
      // the PIN is already saved server-side but BEFORE unlockApp() below,
      // so the reset silently "succeeds" yet never opens the dashboard.
      if (Platform.OS !== 'web') {
        await Promise.all([
          SecureStore.deleteItemAsync(ATTEMPTS_KEY),
          SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY),
        ]);
      }
      if (fromSettings) {
        showAlert('PIN Reset', 'Your payment PIN has been reset.');
        navigation.navigate('More');
      } else {
        unlockApp();
      }
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Could not reset your PIN. Please try again.';
      showAlert('Could not reset PIN', message);
      setPin('');
      setConfirmPin('');
      // A rejected code/password means re-entering the PIN is pointless —
      // send them back to whichever proof failed.
      const status = e?.response?.status;
      if (status === 400 || status === 401 || status === 429) {
        if (method === 'otp') {
          setCode('');
          setStep(e?.response?.data?.codeExpired || status === 429 ? 'choose' : 'otp');
        } else {
          setPassword('');
          setStep('password');
        }
      } else {
        setStep('setup');
      }
    } finally {
      setChecking(false);
    }
  };

  const errorBox = err ? (
    <View className="bg-red-500/10 border border-red-400/30 p-4 rounded-xl flex-row items-center mb-6">
      <Feather name="alert-circle" size={18} color="#f87171" />
      <Text className="text-red-300 text-[12px] font-jakarta-bold ml-3 flex-1">{err}</Text>
    </View>
  ) : null;

  const header = (icon: any, title: string, subtitle: string, onBack: () => void) => (
    <>
      <TouchableOpacity onPress={onBack} className="mb-8 w-9 h-9 items-center justify-center">
        <Feather name="arrow-left" size={18} color="white" />
      </TouchableOpacity>
      <View className="w-16 h-16 bg-[#006c4e] rounded-full justify-center items-center mb-6">
        <Feather name={icon} size={26} color="white" />
      </View>
      <Text className="text-white text-[24px] font-jakarta-bold mb-2">{title}</Text>
      <Text className="text-[#68dbae] text-[14px] font-jakarta-bold mb-8">{subtitle}</Text>
    </>
  );

  if (step === 'choose') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-8 pt-12">
          {header('key', 'Reset Your PIN', "First, confirm it's you. We'll send a 6-digit code to the phone number and email on your account.", leave)}
          {errorBox}

          <TouchableOpacity onPress={handleSendCode} disabled={sending} className="w-full bg-[#006c4e] py-4 rounded-2xl flex-row justify-center items-center mb-4">
            {sending ? <ActivityIndicator color="white" /> : (
              <>
                <Feather name="message-square" size={18} color="white" />
                <Text className="text-white font-jakarta-bold text-[16px] ml-2">Send Me a Code</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setErr(''); setStep('password'); }} disabled={sending} className="w-full border border-white/15 py-4 rounded-2xl flex-row justify-center items-center">
            <Feather name="lock" size={16} color="#68dbae" />
            <Text className="text-[#68dbae] font-jakarta-bold text-[15px] ml-2">Use My Password Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'otp') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-8 pt-12">
          {header('message-square', 'Enter Your Code', `We sent a 6-digit code to ${sentTo || 'your phone and email'}. It expires in 10 minutes.`, () => { setErr(''); setStep('choose'); })}
          {errorBox}

          <View className="mb-8">
            <OtpInput value={code} onChange={setCode} autoFocus />
          </View>

          <TouchableOpacity onPress={handleContinueCode} disabled={code.length !== 6} style={{ opacity: code.length === 6 ? 1 : 0.5 }} className="w-full bg-[#006c4e] py-4 rounded-2xl flex-row justify-center items-center mb-4">
            <Text className="text-white font-jakarta-bold text-[16px]">Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSendCode} disabled={sending} className="items-center py-2">
            {sending ? <ActivityIndicator color="#68dbae" /> : (
              <Text className="text-[#68dbae] font-jakarta-bold text-[13px]">Didn't get it? Send a new code</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'password') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-8 pt-12">
          {header('key', 'Reset Your PIN', "Enter your account password to confirm it's you, then set a new 4-digit PIN.", () => { setErr(''); setStep('choose'); })}
          {errorBox}

          <Text className="text-[#68dbae] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Password</Text>
          <View className="flex-row items-center w-full bg-white/5 border border-white/10 rounded-2xl pr-4 mb-8">
            <TextInput
              className="flex-1 py-4 px-5 text-[16px] font-jakarta-bold text-white"
              placeholder="••••••••"
              placeholderTextColor="#5c7168"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#5c7168" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleContinuePassword} className="w-full bg-[#006c4e] py-4 rounded-2xl flex-row justify-center items-center mb-4">
            <Text className="text-white font-jakarta-bold text-[16px]">Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setErr(''); setStep('choose'); }} className="items-center py-2">
            <Text className="text-[#68dbae] font-jakarta-bold text-[13px]">Forgot your password too? Get a code instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-1 px-8 pt-12 items-center">
        <View className="w-16 h-16 bg-[#006c4e] rounded-full justify-center items-center mb-6">
          <Feather name="lock" size={28} color="white" />
        </View>
        <Text className="text-white text-[24px] font-jakarta-bold mb-2">
          {step === 'setup' ? 'Set a New PIN' : 'Confirm Your New PIN'}
        </Text>
        <Text className="text-[#68dbae] text-[14px] font-jakarta-bold text-center mb-12">
          {step === 'setup' ? 'Choose a new 4-digit PIN.' : 'Enter the same 4-digit PIN to confirm.'}
        </Text>

        {checking ? (
          <ActivityIndicator color="#68dbae" size="large" style={{ marginBottom: 48 }} />
        ) : (
          <View className="flex-row justify-center space-x-6 mb-16">
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                className={`w-4 h-4 rounded-full ${index < currentPin.length ? 'bg-[#68dbae]' : 'bg-[#1b3a2a]'} mx-2`}
              />
            ))}
          </View>
        )}

        <View className="w-full max-w-[300px]">
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'delete'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-between mb-6">
              {row.map((item, colIndex) => {
                if (item === '') return <View key={colIndex} style={{ width: 70 }} />;
                if (item === 'delete') {
                  return (
                    <TouchableOpacity key={colIndex} onPress={handleDelete} disabled={checking} className="w-[70px] h-[70px] justify-center items-center rounded-full">
                      <Feather name="delete" size={24} color="white" />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={colIndex}
                    onPress={() => handlePress(item)}
                    disabled={checking}
                    className="w-[70px] h-[70px] justify-center items-center rounded-full bg-[#1b3a2a]"
                  >
                    <Text className="text-white text-[28px] font-jakarta-bold">{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
