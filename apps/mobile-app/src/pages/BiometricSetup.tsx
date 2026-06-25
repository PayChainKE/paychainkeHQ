import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBiometrics } from '../hooks/useBiometrics';

export default function BiometricSetup() {
  const { completeBiometricSetup, unlockApp } = useAuth();
  const { support, checking, authenticate } = useBiometrics();

  useEffect(() => {
    if (checking) return;
    if (!support.available) {
      completeBiometricSetup(false);
      unlockApp();
    }
  }, [checking, support.available]);

  const handleEnable = async () => {
    const result = await authenticate('Enable Biometric Login');
    if (result.success) {
      await completeBiometricSetup(true);
      unlockApp();
    }
  };

  const handleSkip = () => {
    completeBiometricSetup(false);
    unlockApp();
  };

  if (checking || !support.available) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114] items-center justify-center">
        {/* Loading state while checking hardware (or skipping if unsupported) */}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b2114]">
      <View className="flex-1 px-8 items-center justify-center">
        <View className="w-24 h-24 bg-[#006c4e] rounded-full justify-center items-center mb-8">
          <MaterialIcons name="fingerprint" size={48} color="white" />
        </View>
        <Text className="text-white text-[28px] font-jakarta-bold text-center mb-4">
          Enable Fast Login
        </Text>
        <Text className="text-[#68dbae] text-[15px] font-jakarta-medium text-center mb-12 px-4 leading-relaxed">
          Log in instantly and securely using your fingerprint or Face ID. You won't need to type your PIN every time.
        </Text>

        <TouchableOpacity 
          onPress={handleEnable}
          className="w-full bg-[#68dbae] py-4 rounded-xl flex-row justify-center items-center mb-4"
        >
          <Text className="text-[#0b2114] font-jakarta-bold text-[16px]">
            Enable Biometrics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleSkip}
          className="py-4"
        >
          <Text className="text-[#68dbae] font-jakarta-bold text-[15px]">
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
