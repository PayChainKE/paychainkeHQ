import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ValidatedTextInput } from '../../components/ValidatedTextInput';

export default function SecurityTab() {
  const { merchant } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  return (
    <ScrollView className="flex-1 bg-[#022415]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <LinearGradient colors={['#00351d', '#022415']} className="absolute inset-0" />
      
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12 relative z-10">
        
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="font-jakarta-extrabold text-[28px] text-white tracking-tight leading-tight">Security Vault</Text>
            <Text className="text-[#b1f1c6] text-[11px] font-jakarta-bold uppercase tracking-[0.2em] mt-1 opacity-80">Encryption & Access Rules</Text>
          </View>
          <View className="w-12 h-12 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
            <MaterialIcons name="security" size={24} color="#b1f1c6" />
          </View>
        </View>

        {/* Change Password */}
        <View className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-6 shadow-xl relative overflow-hidden">
          <View className="absolute top-0 right-0 w-32 h-32 bg-[#b1f1c6]/10 rounded-full -mr-16 -mt-16 blur-xl" />
          
          <View className="flex-row items-center gap-3 mb-6 relative z-10">
            <View className="w-10 h-10 rounded-xl bg-[#006c4e] flex items-center justify-center shadow-md shadow-[#006c4e]/50">
              <Feather name="lock" size={20} color="white" />
            </View>
            <View>
              <Text className="text-[16px] font-jakarta-extrabold text-white tracking-tight">Password</Text>
              <Text className="text-[10px] text-white/50 font-jakarta-medium mt-0.5">Change your access credentials</Text>
            </View>
          </View>
          
          <View className="gap-4 relative z-10">
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">Current password</Text>
              <TextInput 
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#b1f1c6]/30"
              />
            </View>
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">New password</Text>
              <TextInput 
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={newPassword}
                onChangeText={setNewPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#b1f1c6]/30"
              />
            </View>
            <View>
              <Text className="text-[9px] text-white/50 font-jakarta-bold uppercase tracking-widest pl-1 mb-2">Confirm new password</Text>
              <TextInput 
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-5 text-[15px] font-jakarta-medium text-white focus:border-[#b1f1c6]/30"
              />
            </View>
          </View>
        </View>

        {/* Advanced Auth */}
        <View className="bg-white/5 rounded-[32px] p-7 border border-white/10 mb-8 shadow-xl relative overflow-hidden">
          <View className="absolute bottom-0 left-0 w-40 h-40 bg-[#f59e0b]/10 rounded-full -ml-20 -mb-20 blur-2xl" />
          
          <View className="flex-row items-center gap-3 mb-6 relative z-10">
            <View className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center border border-[#f59e0b]/30">
              <MaterialIcons name="admin-panel-settings" size={22} color="#fcd34d" />
            </View>
            <View>
              <Text className="text-[16px] font-jakarta-extrabold text-white tracking-tight">Advanced Methods</Text>
              <Text className="text-[10px] text-white/50 font-jakarta-medium mt-0.5">Biometrics & Bulk Pay authorization</Text>
            </View>
          </View>

          <View className="space-y-6 gap-6 relative z-10">
            {/* Bulk Pay PIN */}
            <View className="bg-black/20 p-5 rounded-2xl border border-white/5">
              <Text className="text-[14px] font-jakarta-extrabold text-white mb-4">Reset Bulk Pay PIN</Text>
              <View className="gap-3">
                <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Current PIN (4 digits)" placeholderTextColor="rgba(255,255,255,0.2)"
                  value={currentPin} onChangeText={setCurrentPin}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                <View className="flex-row gap-3">
                  <ValidatedTextInput kind="pin4" secureTextEntry placeholder="New" placeholderTextColor="rgba(255,255,255,0.2)"
                    value={newPin} onChangeText={setNewPin} containerClassName="flex-1"
                    className="bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                  <ValidatedTextInput kind="pin4" secureTextEntry placeholder="Confirm" placeholderTextColor="rgba(255,255,255,0.2)"
                    value={confirmNewPin} onChangeText={setConfirmNewPin} containerClassName="flex-1"
                    className="bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-[14px] text-white text-center font-jakarta-bold tracking-[0.5em]" />
                </View>
                <TouchableOpacity className="w-full py-3.5 rounded-xl bg-[#f59e0b] items-center mt-2 shadow-lg shadow-[#f59e0b]/20 active:bg-[#d97706]">
                  <Text className="text-[#022415] font-jakarta-extrabold text-[11px] uppercase tracking-widest">Update Authorization PIN</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Security Questions */}
            <TouchableOpacity className="w-full flex-row items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5 active:bg-white/5">
              <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MaterialIcons name="help-outline" size={22} color="#9ca3af" />
                </View>
                <View>
                  <Text className="text-[15px] font-jakarta-extrabold text-white">Security Questions</Text>
                  <Text className="text-[11px] text-white/50 font-jakarta-medium mt-0.5">3 questions configured</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            {/* Biometric Login */}
            <View className="w-full flex-row items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5">
              <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MaterialIcons name="fingerprint" size={22} color={merchant?.biometricsEnabled ? "#b1f1c6" : "#9ca3af"} />
                </View>
                <View>
                  <Text className="text-[15px] font-jakarta-extrabold text-white">Biometric Login</Text>
                  <Text className="text-[11px] text-white/50 font-jakarta-medium mt-0.5">
                    {merchant?.biometricsEnabled ? 'Active on this device' : 'Use Touch ID or Face ID'}
                  </Text>
                </View>
              </View>
              {merchant?.biometricsEnabled ? (
                <View className="bg-[#b1f1c6]/20 p-2 rounded-full">
                  <MaterialIcons name="check" size={16} color="#b1f1c6" />
                </View>
              ) : (
                <TouchableOpacity className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl active:bg-white/20">
                  <Text className="text-[10px] text-white font-jakarta-extrabold uppercase tracking-widest">Setup</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>

        <TouchableOpacity className="bg-[#006c4e] w-full py-4.5 rounded-2xl flex-row items-center justify-center gap-2 shadow-xl shadow-[#006c4e]/40 active:opacity-80">
          <Feather name="shield" size={18} color="white" />
          <Text className="text-white font-jakarta-extrabold text-[13px] uppercase tracking-widest py-1">Save Vault Changes</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
