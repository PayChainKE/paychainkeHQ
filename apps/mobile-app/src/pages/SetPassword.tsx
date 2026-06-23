import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function SetPassword({ navigation }: any) {
  const [password, setPassword] = useState('K@mauStore2024');
  const [confirmPassword, setConfirmPassword] = useState('K@mauStore2024');

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-lg mx-auto flex-1">
            <View className="pt-10 px-8 items-center text-center">
              <View className="w-12 h-12 rounded-full bg-[#b1f1c6] items-center justify-center mb-6">
                <Feather name="unlock" size={24} color="#115132" />
              </View>
              <Text className="text-[22px] font-jakarta-bold text-[#1b1c1a] tracking-tight mb-2 text-center">Set your password</Text>
              <Text className="text-sm text-[#404942] text-center font-jakarta-medium px-4">
                Welcome, James. Set a permanent password before accessing your dashboard.
              </Text>
            </View>

            <View className="mt-8 px-6">
              <View className="bg-[#b1f1c6]/30 p-4 rounded-xl flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#0b4d2e] items-center justify-center mr-4">
                  <Text className="text-white font-jakarta-bold text-sm">JK</Text>
                </View>
                <View className="flex-col">
                  <Text className="text-sm font-jakarta-bold text-[#1b1c1a] leading-tight">James Kamau</Text>
                  <Text className="text-xs text-[#115132] mt-1 font-jakarta-medium">Kamau General Store</Text>
                </View>
              </View>
            </View>

            <View className="mt-10 px-8 flex-1">
              <View className="mb-8">
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#404942] mb-1">New Password</Text>
                <TextInput 
                  className="w-full bg-transparent border-b border-[#707971]/30 py-3 text-[#1b1c1a] font-jakarta-medium text-[16px]"
                  placeholder="••••••••"
                  placeholderTextColor="#c0c9c0"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                
                <View className="mt-4 flex-row items-center justify-between">
                  <View className="flex-row gap-1.5 flex-1 max-w-[180px]">
                    <View className="h-1 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1 rounded-full bg-[#006c4e] flex-1"></View>
                  </View>
                  <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-wider">Strong</Text>
                </View>

                <View className="mt-6 space-y-3">
                  <View className="flex-row items-center mb-2">
                    <Feather name="check-circle" size={16} color="#006c4e" />
                    <Text className="text-[12px] text-[#006c4e] font-jakarta-medium ml-2">At least 8 characters</Text>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Feather name="check-circle" size={16} color="#006c4e" />
                    <Text className="text-[12px] text-[#006c4e] font-jakarta-medium ml-2">One uppercase letter</Text>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Feather name="check-circle" size={16} color="#006c4e" />
                    <Text className="text-[12px] text-[#006c4e] font-jakarta-medium ml-2">One number</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Feather name="circle" size={16} color="#404942" style={{ opacity: 0.6 }} />
                    <Text className="text-[12px] text-[#404942]/60 font-jakarta-medium ml-2">One special character</Text>
                  </View>
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-[10px] font-jakarta-bold uppercase tracking-widest text-[#404942] mb-1">Confirm Password</Text>
                <TextInput 
                  className="w-full bg-transparent border-b border-[#707971]/30 py-3 text-[#1b1c1a] font-jakarta-medium text-[16px]"
                  placeholder="••••••••"
                  placeholderTextColor="#c0c9c0"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <View className="mt-3 flex-row items-center">
                  <Text className="text-[12px] font-jakarta-medium text-[#006c4e] mr-1">Passwords match</Text>
                  <Feather name="check" size={14} color="#006c4e" />
                </View>
              </View>
            </View>

            <View className="px-8 pb-12 pt-4">
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Main')}>
                <LinearGradient
                  colors={['#00351d', '#0b4d2e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="w-full h-[52px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#0b4d2e]/20"
                >
                  <Text className="text-white font-jakarta-bold mr-2 text-[15px]">Set Password & Continue</Text>
                  <Feather name="arrow-right" size={18} color="white" />
                </LinearGradient>
              </TouchableOpacity>
              
              <View className="mt-8 flex-row items-center justify-center opacity-50">
                <Feather name="lock" size={14} color="#1b1c1a" />
                <Text className="text-[11px] font-jakarta-medium text-[#1b1c1a] ml-2">Encrypted and never stored in plain text</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
