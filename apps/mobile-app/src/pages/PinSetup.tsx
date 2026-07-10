import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function PinSetup() {
  const { setAppPin } = useAuth();
  
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

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
    } else {
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
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const verifyPins = async (finalConfirmPin: string) => {
    if (pin === finalConfirmPin) {
      await setAppPin(pin);
    } else {
      Alert.alert('Error', 'PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('setup');
    }
  };

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
