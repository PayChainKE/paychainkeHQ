import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';

const { width } = Dimensions.get('window');

export default function PinSetup() {
  const { setAppPin } = useAuth();

  const [step, setStep] = useState<'setup' | 'confirm' | 'password'>('setup');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  // Only reached if the server already has an appPin for this merchant (e.g.
  // set from another device, or a reinstall) — see pinAlreadySet below. This
  // device has no local record of it, so re-proving identity with the
  // account password is required before the server will let it be replaced.
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErr, setPasswordErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPin = step === 'setup' ? pin : confirmPin;

  const handlePress = (digit: string) => {
    if (step === 'setup') {
      if (pin.length < 4) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 4) {
          setTimeout(() => setStep('confirm'), 300);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + digit;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 4) {
          setTimeout(() => verifyPins(newConfirmPin), 300);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'setup') {
      setPin(prev => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const verifyPins = async (finalConfirmPin: string) => {
    if (pin !== finalConfirmPin) {
      showAlert('Error', 'PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('setup');
      return;
    }

    try {
      await setAppPin(pin);
    } catch (err: any) {
      if (err?.response?.data?.pinAlreadySet) {
        // Not a real failure — this account already has a PIN set (a
        // different device, or a previous install on this one). Ask for the
        // password once instead of bouncing back to "set a PIN" with no
        // explanation.
        setStep('password');
        return;
      }
      showAlert('Could not save PIN', err?.response?.data?.error || 'Please check your connection and try again.');
      setPin('');
      setConfirmPin('');
      setStep('setup');
    }
  };

  const handleConfirmWithPassword = async () => {
    if (!password) {
      setPasswordErr('Enter your account password to continue.');
      return;
    }
    setPasswordErr('');
    setSubmitting(true);
    try {
      await setAppPin(pin, password);
    } catch (err: any) {
      setSubmitting(false);
      setPasswordErr(err?.response?.data?.error || 'Please check your connection and try again.');
    }
  };

  if (step === 'password') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-8 pt-12">
          <View className="w-16 h-16 bg-[#006c4e] rounded-full justify-center items-center mb-6">
            <Feather name="shield" size={26} color="white" />
          </View>
          <Text className="text-white text-[24px] font-jakarta-bold mb-2">Confirm It's You</Text>
          <Text className="text-[#68dbae] text-[14px] font-jakarta-medium mb-8">
            This account already has a PIN set from another device. Enter your account password to replace it with the one you just chose.
          </Text>

          {passwordErr ? (
            <View className="bg-red-500/10 border border-red-400/30 p-4 rounded-xl flex-row items-center mb-6">
              <Feather name="alert-circle" size={18} color="#f87171" />
              <Text className="text-red-300 text-[12px] font-jakarta-bold ml-3 flex-1">{passwordErr}</Text>
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

          <TouchableOpacity onPress={handleConfirmWithPassword} disabled={submitting} className="w-full bg-[#006c4e] py-4 rounded-2xl flex-row justify-center items-center">
            {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-jakarta-bold text-[16px]">Set PIN</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setStep('setup'); setPin(''); setConfirmPin(''); setPassword(''); setPasswordErr(''); }}
            className="mt-6 self-center"
          >
            <Text className="text-white/40 font-jakarta-bold text-[13px]">Choose a different PIN</Text>
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
          {step === 'setup' ? 'Set Your App PIN' : 'Confirm Your PIN'}
        </Text>
        <Text className="text-[#68dbae] text-[14px] font-jakarta-medium text-center mb-12">
          {step === 'setup' ? 'Secure your PayChain app with a 4-digit PIN.' : 'Enter the same 4-digit PIN to confirm.'}
        </Text>

        <View className="flex-row justify-center space-x-6 mb-16">
          {[0, 1, 2, 3].map((index) => (
            <View 
              key={index} 
              className={`w-4 h-4 rounded-full ${index < currentPin.length ? 'bg-[#68dbae]' : 'bg-[#1b3a2a]'} mx-2`}
            />
          ))}
        </View>

        <View className="w-full max-w-[300px]">
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
                      className="w-[70px] h-[70px] justify-center items-center rounded-full"
                    >
                      <Feather name="delete" size={24} color="white" />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity 
                    key={colIndex} 
                    onPress={() => handlePress(item)}
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
