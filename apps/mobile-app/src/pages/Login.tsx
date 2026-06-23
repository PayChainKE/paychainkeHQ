import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login({ navigation }: any) {
  const [phone, setPhone] = useState('712 847 291');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#0B1F0F]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-lg mx-auto flex-1">
            <View className="px-8 pt-10 pb-8 flex-1 justify-end">
              <View className="mb-8">
                <Text className="text-white text-[24px] font-jakarta-bold tracking-tight">PayChain</Text>
                <Text className="text-[#68dbae] text-[12px] font-jakarta-bold tracking-[0.15em] uppercase opacity-90 mt-1">Merchant Portal</Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[44px] text-white leading-tight">Collect.</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[44px] text-[#68dbae] leading-tight">Pay.</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[44px] text-white leading-tight">Grow.</Text>
              </View>
            </View>

            <View className="bg-white w-full rounded-t-[32px] px-8 pt-10 pb-12 shadow-lg">
              <View className="space-y-2 mb-8">
                <Text className="text-[#1b1c1a] text-[22px] font-jakarta-bold tracking-tight">Sign in to your account</Text>
                <Text className="text-[#404942] text-[14px] leading-relaxed mt-2">Use your M-PESA phone number and the password provided during onboarding.</Text>
              </View>

              <View className="bg-[#83f5c6]/20 border-l-4 border-[#006c4e] p-4 rounded-r-md mb-8">
                <Text className="text-[#007151] text-[12px] leading-snug font-jakarta-medium">No account? Access is provided by your PayChain onboarding officer after approval.</Text>
              </View>

              <View className="mb-8">
                <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-widest mb-3">M-PESA Phone Number</Text>
                <View className="flex-row items-center border-b-2 border-[#c0c9c0]/50 pb-2">
                  <View className="bg-[#efeeeb] px-3 py-2 rounded-lg mr-3">
                    <Text className="text-[15px] font-jakarta-bold text-[#404942]">+254</Text>
                  </View>
                  <TextInput 
                    className="flex-1 text-[18px] font-jakarta-semibold text-[#1b1c1a] py-2"
                    placeholder="712 345 678"
                    placeholderTextColor="#c0c9c0"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-widest mb-3">Password</Text>
                <View className="flex-row items-center border-b-2 border-[#c0c9c0]/50 pb-2">
                  <TextInput 
                    className="flex-1 text-[18px] font-jakarta-semibold text-[#1b1c1a] py-2"
                    placeholder="••••••••"
                    placeholderTextColor="#c0c9c0"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                    <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#707971" />
                  </TouchableOpacity>
                </View>
                <Text className="text-[#404942] text-[12px] mt-3 italic opacity-80 font-jakarta-medium">First time? Use your temporary password.</Text>
              </View>

              <View className="pt-4">
                <TouchableOpacity 
                  className="w-full h-[56px] bg-[#006c4e] rounded-[16px] flex-row items-center justify-center shadow-lg shadow-[#006c4e]/30"
                  activeOpacity={0.8}
                  onPress={() => navigation.replace('Main')}
                >
                  <Text className="text-white font-jakarta-bold text-[17px] mr-2">Sign In</Text>
                  <Feather name="log-in" size={20} color="white" />
                </TouchableOpacity>

                <View className="mt-8 items-center">
                  <Text className="text-[#404942] text-[13px] font-jakarta-regular">
                    Forgot password?{' '}
                    <Text 
                      className="text-[#006c4e] font-jakarta-bold"
                      onPress={() => navigation.navigate('SetPassword')}
                    >
                      Set Password Flow
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
