import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as LocalAuthentication from 'expo-local-authentication';

export default function BiometricSetup() {
  const { completeBiometricSetup, unlockApp } = useAuth();
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hardware || !enrolled) {
        // Device doesn't support biometrics or none are enrolled, skip setup
        completeBiometricSetup(false);
        unlockApp();
      } else {
        setIsSupported(true);
      }
    };
    checkSupport();
  }, []);

  const handleEnable = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Biometric Login',
      });
      if (result.success) {
        await completeBiometricSetup(true);
        unlockApp();
      }
    } catch (error) {
      console.warn('Biometric setup failed', error);
    }
  };

  const handleSkip = () => {
    completeBiometricSetup(false);
    unlockApp();
  };

  if (isSupported === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b2114] items-center justify-center">
        {/* Loading state while checking hardware */}
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
