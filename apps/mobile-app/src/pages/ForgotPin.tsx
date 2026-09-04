import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Same lockout keys PinEntry.tsx tracks failed-PIN-guess attempts under —
// a successful reset here means whatever was locked no longer applies.
const ATTEMPTS_KEY = 'paychain_pin_failed_attempts';
const LOCKED_UNTIL_KEY = 'paychain_pin_locked_until';

export default function ForgotPin({ navigation }: any) {
  const { setAppPin, unlockApp } = useAuth();

  // password: prove it's really them (the one thing a stranger holding the
  // unlocked phone wouldn't know) before letting a new PIN be set at all —
  // setup/confirm: same 4-digit entry PinSetup.tsx uses for the first PIN.
  const [step, setStep] = useState<'password' | 'setup' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const currentPin = step === 'setup' ? pin : confirmPin;

  const handleContinuePassword = () => {
    if (!password) {
      setErr('Enter your account password to continue.');
      return;
    }
    setErr('');
    setStep('setup');
  };

  const handlePress = (digit: string) => {
    if (step === 'setup') {
      if (pin.length < 4) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 4) setTimeout(() => setStep('confirm'), 300);
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
      Alert.alert('Error', 'PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('setup');
      return;
    }

    setChecking(true);
    try {
      await setAppPin(pin, password);
      await Promise.all([
        SecureStore.deleteItemAsync(ATTEMPTS_KEY),
        SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY),
      ]);
      unlockApp();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Could not reset your PIN. Please try again.';
      Alert.alert('Could not reset PIN', message);
      setPin('');
      setConfirmPin('');
      // A wrong/rejected password means going back to the setup step is
      // pointless — send them back to re-enter the password instead.
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        setStep('password');
        setPassword('');
      } else {
        setStep('setup');
      }
    } finally {
      setChecking(false);
    }
  };

  if (step === 'password') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-8 pt-12">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mb-8 w-10 h-10 justify-center">
            <Feather name="arrow-left" size={22} color="white" />
          </TouchableOpacity>

          <View className="w-16 h-16 bg-[#006c4e] rounded-full justify-center items-center mb-6">
            <Feather name="key" size={26} color="white" />
          </View>
          <Text className="text-white text-[24px] font-jakarta-bold mb-2">Reset Your PIN</Text>
          <Text className="text-[#68dbae] text-[14px] font-jakarta-medium mb-8">
            Enter your account password to confirm it's you, then set a new 4-digit PIN.
          </Text>

          {err ? (
            <View className="bg-red-500/10 border border-red-400/30 p-4 rounded-xl flex-row items-center mb-6">
              <Feather name="alert-circle" size={18} color="#f87171" />
              <Text className="text-red-300 text-[12px] font-jakarta-bold ml-3 flex-1">{err}</Text>
            </View>
          ) : null}

          <Text className="text-[#68dbae] text-[11px] font-jakarta-bold uppercase tracking-widest mb-2">Password</Text>
          <View className="flex-row items-center w-full bg-white/5 border border-white/10 rounded-2xl pr-4 mb-8">
            <TextInput
              className="flex-1 py-4 px-5 text-[16px] font-jakarta-medium text-white"
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

          <TouchableOpacity onPress={handleContinuePassword} className="w-full bg-[#006c4e] py-4 rounded-2xl flex-row justify-center items-center">
            <Text className="text-white font-jakarta-bold text-[16px]">Continue</Text>
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
        <Text className="text-[#68dbae] text-[14px] font-jakarta-medium text-center mb-12">
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
