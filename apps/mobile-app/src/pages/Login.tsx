import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login({ navigation }: any) {
  const [phone, setPhone] = useState('712 847 291');
  const [password, setPassword] = useState('••••••••••');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#0b2114]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-lg mx-auto flex-1">
            <View className="px-8 pt-10 pb-8 flex-1 justify-end">
              <View className="mb-8">
                <Text className="text-white text-[24px] font-jakarta-bold tracking-tight">PayChain</Text>
                <Text className="text-[#68dbae] text-[12px] font-jakarta-bold tracking-[0.15em] uppercase mt-1">Merchant Portal</Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-4xl text-white leading-tight">Collect.</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-4xl text-[#68dbae] leading-tight">Pay.</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-4xl text-white leading-tight">Grow.</Text>
              </View>
            </View>

            <View className="bg-[#faf9f6] w-full rounded-t-[32px] px-8 pt-10 pb-16 shadow-lg">
              <View className="space-y-2 mb-8">
                <Text className="text-[#1b1c1a] text-[24px] font-jakarta-bold tracking-tight">Sign in to your account</Text>
                <Text className="text-[#404942] text-[15px] leading-relaxed mt-2 font-jakarta-medium">Use your M-PESA phone number and the password provided during onboarding.</Text>
              </View>

              <View className="bg-[#e7f8ef] border-l-4 border-[#006c4e] py-4 px-5 mb-10">
                <Text className="text-[#006c4e] text-[13px] leading-relaxed font-jakarta-medium">No account? Access is provided by your PayChain onboarding officer after approval.</Text>
              </View>

              <View className="mb-8">
                <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-4">M-PESA Phone Number</Text>
                <View className="flex-row items-center border-b border-[#c0c9c0] pb-3">
                  <View className="bg-[#efeeeb] px-4 py-2.5 rounded-full mr-4">
                    <Text className="text-[16px] font-jakarta-bold text-[#404942]">+254</Text>
                  </View>
                  <TextInput 
                    className="flex-1 text-[20px] font-jakarta-semibold text-[#1b1c1a]"
                    placeholder="712 847 291"
                    placeholderTextColor="#c0c9c0"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View className="mb-10">
                <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-4">Password</Text>
                <View className="flex-row items-center border-b border-[#c0c9c0] pb-3">
                  <TextInput 
                    className="flex-1 text-[24px] font-jakarta-bold text-[#1b1c1a] tracking-widest pt-2"
                    placeholder="••••••••"
                    placeholderTextColor="#c0c9c0"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                    <Feather name={showPassword ? "eye-off" : "eye"} size={22} color="#707971" />
                  </TouchableOpacity>
                </View>
                <Text className="text-[#707971] text-[13px] mt-4 italic font-jakarta-medium">First time? Use your temporary password.</Text>
              </View>

              <View className="pt-2">
                <TouchableOpacity 
                  className="w-full h-[60px] bg-[#006c4e] rounded-2xl flex-row items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => navigation.replace('Main')}
                >
                  <Text className="text-white font-jakarta-bold text-[18px] mr-2">Sign In</Text>
                  <Feather name="log-in" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
