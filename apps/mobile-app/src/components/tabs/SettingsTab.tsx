import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ValidatedTextInput } from '../../components/ValidatedTextInput';
import { useAuth } from '../../context/AuthContext';

export default function SettingsTab() {
  const { merchant, logout } = useAuth();
  const [kraPin, setKraPin] = useState(merchant?.kraPin || '');
  const [businessNumber, setBusinessNumber] = useState(merchant?.businessNumber || '');
  const [kraPinLocked, setKraPinLocked] = useState(!!merchant?.kraPin);
  const [businessNumberLocked, setBusinessNumberLocked] = useState(!!merchant?.businessNumber);

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        
        {/* Header Section */}
        <View className="mb-8">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Global Settings</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">
            Manage your business profile and workspace preferences.
          </Text>
        </View>

        {/* Administrator Profile Card */}
        <View className="bg-white rounded-[32px] border border-[#efeeeb] shadow-md shadow-[#00351d]/5 mb-6 overflow-hidden">
          <LinearGradient colors={['rgba(0,108,78,0.03)', 'rgba(0,108,78,0)']} className="absolute inset-0 h-32" />
          
          <View className="p-7">
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <Text className="font-jakarta-extrabold text-[22px] text-[#00351d] tracking-tight">Identity Vault</Text>
                <Text className="text-[10px] text-[#006c4e] font-jakarta-bold uppercase tracking-[0.2em] mt-1">Administrator Profile</Text>
              </View>
              <View className="bg-[#006c4e]/10 px-4 py-2 rounded-full border border-[#006c4e]/10 flex-row items-center gap-1.5 shadow-sm">
                <View className="w-2 h-2 rounded-full bg-[#006c4e]" />
                <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Verified</Text>
              </View>
            </View>

            <View className="gap-6">
              <View>
                <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Primary Contact</Text>
                <View className="w-full bg-[#faf9f6] border border-[#efeeeb] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight">{merchant?.businessName || "N/A"}</Text>
                  <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" />
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Email Address</Text>
                <View className="w-full bg-[#faf9f6] border border-[#efeeeb] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight">{merchant?.email || "N/A"}</Text>
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Phone Number</Text>
                <View className="w-full bg-[#faf9f6] border border-[#efeeeb] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight">{merchant?.phone || "N/A"}</Text>
                  <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" />
                </View>
              </View>

              <View className="h-[1px] bg-[#efeeeb] w-full my-2" />

              <View>
                <View className="flex-row justify-between items-center mb-2.5 pr-1">
                  <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] pl-1 opacity-80">KRA PIN</Text>
                  {kraPinLocked && (
                    <TouchableOpacity onPress={() => setKraPinLocked(false)} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full">
                      <Feather name="edit-2" size={12} color="#006c4e" />
                      <Text className="text-[#006c4e] text-[9px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View className="relative">
                  <ValidatedTextInput kind="kraPin" value={kraPin} onChangeText={setKraPin}
                    placeholder="e.g. P123456789A" placeholderTextColor="#b3b9b4" editable={!kraPinLocked}
                    className={`w-full bg-white border border-[#efeeeb] rounded-2xl py-4 px-5 text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight ${kraPinLocked ? 'bg-[#faf9f6] text-[#707971]' : 'shadow-md shadow-[#006c4e]/10 border-[#006c4e]/30'}`} />
                  {kraPinLocked && (
                    <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ position: 'absolute', right: 20, top: 18 }} />
                  )}
                </View>
              </View>

              <View>
                <View className="flex-row justify-between items-center mb-2.5 pr-1">
                  <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] pl-1 opacity-80">Business Reg Number</Text>
                  {businessNumberLocked && (
                    <TouchableOpacity onPress={() => setBusinessNumberLocked(false)} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full">
                      <Feather name="edit-2" size={12} color="#006c4e" />
                      <Text className="text-[#006c4e] text-[9px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View className="relative">
                  <ValidatedTextInput kind="businessReg" optional value={businessNumber} onChangeText={setBusinessNumber}
                    placeholder="e.g. PVT-XXXXXX" placeholderTextColor="#b3b9b4" editable={!businessNumberLocked}
                    className={`w-full bg-white border border-[#efeeeb] rounded-2xl py-4 px-5 text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight ${businessNumberLocked ? 'bg-[#faf9f6] text-[#707971]' : 'shadow-md shadow-[#006c4e]/10 border-[#006c4e]/30'}`} />
                  {businessNumberLocked && (
                    <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ position: 'absolute', right: 20, top: 18 }} />
                  )}
                </View>
              </View>

            </View>

            <TouchableOpacity className="w-full bg-[#00351d] py-4 rounded-2xl mt-8 flex-row items-center justify-center gap-2 shadow-lg shadow-[#00351d]/30 active:opacity-80">
              <MaterialIcons name="sync" size={20} color="white" />
              <Text className="text-white font-jakarta-extrabold text-[13px] uppercase tracking-widest">Update Profile Data</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Sign Out Button */}
        <TouchableOpacity 
          onPress={logout}
          className="w-full bg-white py-5 rounded-[24px] flex-row items-center justify-center gap-3 border border-[#ba1a1a]/20 shadow-sm mt-4 active:bg-[#ffeceb]"
        >
          <Feather name="log-out" size={20} color="#ba1a1a" />
          <Text className="text-[#ba1a1a] font-jakarta-extrabold text-[16px] tracking-tight">Sign Out Safely</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
