import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBiometrics } from '../hooks/useBiometrics';

export default function PinEntry() {
  const { appPin, unlockApp, logout, isBiometricsEnabled } = useAuth();
  const { authenticate } = useBiometrics();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!isBiometricsEnabled) return;
    (async () => {
      const result = await authenticate('Unlock PayChain');
      if (result.success) unlockApp();
    })();
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
        <Text className="text-[#68dbae] text-[14px] font-jakarta-medium text-center mb-12">
          Enter your 4-digit PIN to access your dashboard.
        </Text>

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
