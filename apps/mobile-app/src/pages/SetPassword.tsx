import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SetPassword({ navigation }: any) {
  const [password, setPassword] = useState('••••••••••••••');
  const [confirmPassword, setConfirmPassword] = useState('••••••••••••••');

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-lg mx-auto flex-1">
            <View className="pt-16 px-8 items-center text-center">
              <View className="w-14 h-14 rounded-full bg-[#e7f8ef] items-center justify-center mb-6">
                <MaterialIcons name="lock-reset" size={28} color="#006c4e" />
              </View>
              <Text className="text-[26px] font-jakarta-bold text-[#1b1c1a] tracking-tight mb-3 text-center">Set your password</Text>
              <Text className="text-[15px] text-[#404942] text-center font-jakarta-medium px-2 leading-relaxed">
                Welcome, James. Set a permanent password before accessing your dashboard.
              </Text>
            </View>

            <View className="mt-10 px-8">
              <View className="bg-[#e7f8ef] py-4 px-5 rounded-[32px] flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-[#00351d] items-center justify-center mr-4">
                  <Text className="text-white font-jakarta-bold text-[15px]">JK</Text>
                </View>
                <View className="flex-col">
                  <Text className="text-[16px] font-jakarta-bold text-[#1b1c1a] leading-tight">James Kamau</Text>
                  <Text className="text-[13px] text-[#006c4e] mt-1 font-jakarta-medium">Kamau General Store</Text>
                </View>
              </View>
            </View>

            <View className="mt-10 px-8 flex-1">
              <View className="mb-8">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#404942] mb-2">New Password</Text>
                <View className="w-full border border-[#c0c9c0]/60 bg-white rounded-md h-[52px] justify-center px-4">
                  <TextInput 
                    className="text-[#1b1c1a] font-jakarta-bold text-[22px] tracking-[0.2em] pt-2"
                    placeholder="••••••••"
                    placeholderTextColor="#c0c9c0"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
                
                <View className="mt-4 flex-row items-center justify-between">
                  <View className="flex-row gap-2 flex-1 max-w-[200px]">
                    <View className="h-1.5 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1.5 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1.5 rounded-full bg-[#006c4e] flex-1"></View>
                    <View className="h-1.5 rounded-full bg-[#006c4e] flex-1"></View>
                  </View>
                  <Text className="text-[11px] font-jakarta-bold text-[#006c4e] uppercase tracking-[0.1em]">Strong</Text>
                </View>

                <View className="mt-6 space-y-3.5">
                  <View className="flex-row items-center">
                    <MaterialIcons name="check-circle" size={18} color="#006c4e" />
                    <Text className="text-[13px] text-[#006c4e] font-jakarta-medium ml-2.5">At least 8 characters</Text>
                  </View>
                  <View className="flex-row items-center">
                    <MaterialIcons name="check-circle" size={18} color="#006c4e" />
                    <Text className="text-[13px] text-[#006c4e] font-jakarta-medium ml-2.5">One uppercase letter</Text>
                  </View>
                  <View className="flex-row items-center">
                    <MaterialIcons name="check-circle" size={18} color="#006c4e" />
                    <Text className="text-[13px] text-[#006c4e] font-jakarta-medium ml-2.5">One number</Text>
                  </View>
                  <View className="flex-row items-center">
                    <MaterialIcons name="circle" size={18} color="#9aa49c" />
                    <Text className="text-[13px] text-[#707971] font-jakarta-medium ml-2.5">One special character</Text>
                  </View>
                </View>
              </View>

              <View className="mb-10">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#404942] mb-2">Confirm Password</Text>
                <View className="w-full border border-[#c0c9c0]/60 bg-white rounded-md h-[52px] justify-center px-4">
                  <TextInput 
                    className="text-[#1b1c1a] font-jakarta-bold text-[22px] tracking-[0.2em] pt-2"
                    placeholder="••••••••"
                    placeholderTextColor="#c0c9c0"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
                <View className="mt-3 flex-row items-center">
                  <Text className="text-[13px] font-jakarta-medium text-[#006c4e] mr-1.5">Passwords match</Text>
                  <Feather name="check" size={16} color="#006c4e" />
                </View>
              </View>
            </View>

            <View className="px-8 pb-12 pt-2">
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Main')}>
                <View className="w-full h-[60px] bg-[#00351d] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20">
                  <Text className="text-white font-jakarta-bold mr-2 text-[17px]">Set Password & Continue</Text>
                  <Feather name="arrow-right" size={20} color="white" />
                </View>
              </TouchableOpacity>
              
              <View className="mt-8 flex-row items-center justify-center opacity-60">
                <MaterialIcons name="lock" size={16} color="#404942" />
                <Text className="text-[12px] font-jakarta-medium text-[#404942] ml-2">Encrypted and never stored in plain text</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
