import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBiometrics, biometricLabel } from '../hooks/useBiometrics';

// Give the screen a beat to actually finish mounting/transitioning before
// invoking the OS biometric sheet — calling authenticateAsync the instant
// this component mounts can race the React Navigation screen transition
// (a known expo-local-authentication + react-navigation gotcha where the
// prompt silently fails to present, or gets dismissed instantly, looking
// to the user like "biometrics never popped up").
const AUTO_PROMPT_DELAY_MS = 350;

export default function PinEntry() {
  const { appPin, unlockApp, logout, isBiometricsEnabled } = useAuth();
  const { support, authenticate } = useBiometrics();
  const [pin, setPin] = useState('');
  // idle: nothing attempted yet (or PIN pad only) · prompting: OS sheet is
  // (or should be) up · failed: the last attempt was cancelled/failed, so a
  // manual retry affordance is shown instead of silently going quiet.
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'prompting' | 'failed'>('idle');
  const autoTriggeredRef = useRef(false);

  const method = biometricLabel(support.types);

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
    if (!isBiometricsEnabled || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    const timer = setTimeout(triggerBiometric, AUTO_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBiometricsEnabled]);

  const handlePress = (digit: string) => {
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

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === appPin) {
      unlockApp();
    } else {
      Alert.alert('Incorrect PIN', 'Please try again.');
      setPin('');
    }
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
        <Text className="text-[#68dbae] text-[14px] font-jakarta-medium text-center mb-8">
          Enter your 4-digit PIN to access your dashboard.
        </Text>

        {isBiometricsEnabled && (
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

        <TouchableOpacity onPress={logout} className="mt-4">
          <Text className="text-[#68dbae] font-jakarta-bold text-[14px]">Log out instead</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
