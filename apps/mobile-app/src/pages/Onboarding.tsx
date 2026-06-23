import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    title: 'Welcome to PayChain',
    description: 'The complete financial dashboard for modern merchants.',
    image: require('../../assets/vectors/welcome.png')
  },
  {
    title: 'Collect Payments',
    description: 'Accept M-Pesa, card, and crypto payments instantly.',
    image: require('../../assets/vectors/collect.png')
  },
  {
    title: 'Bulk Payouts',
    description: 'Pay your suppliers and employees with a single click.',
    image: require('../../assets/vectors/bulk payout.png')
  },
  {
    title: 'Inflation Shield',
    description: 'Protect your revenue using secure stablecoin balances.',
    image: require('../../assets/vectors/inflation shield.png')
  },
  {
    title: 'Cash Advance',
    description: 'Access instant, collateral-free credit to grow your business.',
    image: require('../../assets/vectors/grow.png')
  }
];

export default function Onboarding({ navigation }: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { completeOnboarding } = useAuth();
  
  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      completeOnboarding();
      navigation.navigate('Login', { initialTab: 'signup' });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.navigate('Login', { initialTab: 'signup' });
  };

  const currentSlide = ONBOARDING_DATA[currentIndex];

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]">
      <View className="flex-row justify-between items-center px-6 pt-4">
        <View className="flex-row space-x-1">
          {ONBOARDING_DATA.map((_, index) => (
            <View 
              key={index} 
              className={`h-1.5 rounded-full ${index === currentIndex ? 'w-6 bg-[#006c4e]' : 'w-2 bg-[#d1d5db]'}`} 
              style={{ marginRight: 4 }}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-[#707971] font-jakarta-bold text-[14px]">Skip</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <Image 
          source={currentSlide.image} 
          style={{ width: width * 0.8, height: width * 0.8, resizeMode: 'contain' }} 
        />
        <View className="mt-12 items-center w-full">
          <Text className="text-[#1b1c1a] text-[28px] font-jakarta-bold text-center mb-4 tracking-tight">
            {currentSlide.title}
          </Text>
          <Text className="text-[#707971] text-[15px] font-jakarta-medium text-center leading-relaxed px-4">
            {currentSlide.description}
          </Text>
        </View>
      </View>

      <View className="px-8 pb-12 pt-4">
        <TouchableOpacity 
          onPress={handleNext}
          className="w-full bg-[#06201b] py-5 rounded-2xl flex-row justify-center items-center shadow-lg shadow-[#06201b]/20"
        >
          <Text className="text-white font-jakarta-bold text-[16px]">
            {currentIndex === ONBOARDING_DATA.length - 1 ? "Get Started" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
