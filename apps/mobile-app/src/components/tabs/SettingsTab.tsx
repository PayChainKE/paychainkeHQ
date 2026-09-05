import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ValidatedTextInput } from '../../components/ValidatedTextInput';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/config';

export default function SettingsTab() {
  const { merchant, logout, refreshSession } = useAuth();
  const [kraPin, setKraPin] = useState(merchant?.kraPin || '');
  const [businessNumber, setBusinessNumber] = useState(merchant?.businessNumber || '');
  const [kraPinLocked, setKraPinLocked] = useState(!!merchant?.kraPin);
  const [businessNumberLocked, setBusinessNumberLocked] = useState(!!merchant?.businessNumber);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  async function handleProfileSave() {
    setIsSavingProfile(true);
    try {
      const res = await api.put('/api/auth/merchant/profile', { kraPin, businessNumber });
      if (res.data.success) {
        Alert.alert('Success', 'Profile updated successfully.');
        await refreshSession();
        setKraPinLocked(!!kraPin);
        setBusinessNumberLocked(!!businessNumber);
      }
    } catch (err: any) {
      Alert.alert('Failed to update profile', err.response?.data?.error || 'Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        
        {/* Header Section */}
        <View className="mb-8">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Global Settings</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold leading-relaxed opacity-80">
            Manage your business profile and workspace preferences.
          </Text>
        </View>

        {/* Administrator Profile Card */}
        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-md shadow-[#00351d]/5 mb-6 overflow-hidden">
          <LinearGradient colors={['rgba(0,108,78,0.03)', 'rgba(0,108,78,0)']} className="absolute inset-0 h-32" />
          
          <View className="p-7">
            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-1 min-w-0 pr-3">
                <Text className="font-jakarta-extrabold text-[22px] text-[#00351d] tracking-tight">Identity Vault</Text>
                <Text className="text-[10px] text-[#006c4e] font-jakarta-bold uppercase tracking-[0.2em] mt-1" numberOfLines={1} ellipsizeMode="tail">Administrator Profile</Text>
              </View>
              {merchant?.status === 'locked' ? (
                <View className="bg-red-50 px-4 py-2 rounded-full border border-red-100 flex-row items-center gap-1.5 shadow-sm flex-shrink-0">
                  <MaterialIcons name="lock" size={12} color="#dc2626" />
                  <Text className="text-red-600 text-[10px] font-jakarta-extrabold uppercase tracking-widest">Locked</Text>
                </View>
              ) : (
                <View className="bg-[#006c4e]/10 px-4 py-2 rounded-full border border-[#006c4e]/10 flex-row items-center gap-1.5 shadow-sm flex-shrink-0">
                  <View className="w-2 h-2 rounded-full bg-[#006c4e]" />
                  <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Verified</Text>
                </View>
              )}
            </View>

            <View className="gap-6">
              <View>
                <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Primary Contact</Text>
                <View className="w-full bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight flex-1 min-w-0 pr-2" numberOfLines={1} ellipsizeMode="tail">{merchant?.businessName || "N/A"}</Text>
                  <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ flexShrink: 0 }} />
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Email Address</Text>
                <View className="w-full bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight">{merchant?.email || "N/A"}</Text>
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2.5 pl-1 opacity-80">Phone Number</Text>
                <View className="w-full bg-[#f0fdf4] border border-[#eff4ef] rounded-2xl py-4 px-5 flex-row items-center justify-between">
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight flex-1 min-w-0 pr-2" numberOfLines={1} ellipsizeMode="tail">{merchant?.phone || "N/A"}</Text>
                  <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ flexShrink: 0 }} />
                </View>
              </View>

              {/* Account Activity — same identity/security fields as the
                  web dashboard's Profile.jsx grid, condensed for mobile. */}
              <View className="flex-row flex-wrap -mx-1.5">
                {([
                  { label: 'Member Since', value: merchant?.createdAt ? new Date(merchant.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A' },
                  { label: 'Last Sign In', value: merchant?.lastLogin ? new Date(merchant.lastLogin).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A' },
                  { label: 'Sign In Count', value: merchant?.loginCount?.toString() || '1' },
                  { label: '2FA Setup', value: 'Yes', status: true },
                ]).map((item) => (
                  <View key={item.label} className="w-1/2 px-1.5 mb-3">
                    <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.15em] mb-1.5 pl-0.5 opacity-70">{item.label}</Text>
                    <View className="bg-[#f0fdf4] border border-[#eff4ef] rounded-xl py-2.5 px-3.5 flex-row items-center justify-between">
                      <Text className="text-[12px] font-jakarta-extrabold text-[#00351d]" numberOfLines={1}>{item.value}</Text>
                      {item.status !== undefined && (
                        <View className={`w-1.5 h-1.5 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <View className="h-[1px] bg-[#eff4ef] w-full my-2" />

              <View>
                <View className="flex-row justify-between items-center mb-2.5 pr-1">
                  <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] pl-1 opacity-80">KRA PIN</Text>
                  {kraPinLocked && (
                    <TouchableOpacity onPress={() => setKraPinLocked(false)} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full">
                      <Feather name="edit-2" size={12} color="#006c4e" />
                      <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View className="relative">
                  {/* Right padding reserved to match whichever overlay is
                      showing — previously fixed at px-5 regardless, so the
                      "eTIMS Verified" pill (the widest of the two) sat
                      directly on top of the typed PIN's tail end instead of
                      beside it. */}
                  <ValidatedTextInput kind="kraPin" value={kraPin} onChangeText={setKraPin}
                    placeholder="e.g. P051892647A" placeholderTextColor="#b3b9b4" editable={!kraPinLocked}
                    className={`w-full bg-white border border-[#eff4ef] rounded-2xl py-4 pl-5 text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight ${
                      kraPinLocked
                        ? 'bg-[#f0fdf4] text-[#5b645c] pr-12'
                        : merchant?.isKRAVerified && merchant?.kraPin === kraPin
                        ? 'shadow-md shadow-[#006c4e]/10 border-[#006c4e]/30 pr-[128px]'
                        : 'shadow-md shadow-[#006c4e]/10 border-[#006c4e]/30 pr-5'
                    }`} />
                  {kraPinLocked && (
                    <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ position: 'absolute', right: 20, top: 18 }} />
                  )}
                  {!kraPinLocked && merchant?.isKRAVerified && merchant?.kraPin === kraPin && (
                    <View className="flex-row items-center gap-1 bg-[#e7f8ef] border border-emerald-100 px-2 py-1 rounded-lg" style={{ position: 'absolute', right: 10, top: 12 }}>
                      <MaterialIcons name="verified-user" size={12} color="#059669" />
                      <Text className="text-emerald-700 text-[10px] font-jakarta-extrabold uppercase tracking-widest">eTIMS Verified</Text>
                    </View>
                  )}
                </View>
              </View>

              <View>
                <View className="flex-row justify-between items-center mb-2.5 pr-1">
                  <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] pl-1 opacity-80">Business Reg Number</Text>
                  {businessNumberLocked && (
                    <TouchableOpacity onPress={() => setBusinessNumberLocked(false)} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full">
                      <Feather name="edit-2" size={12} color="#006c4e" />
                      <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View className="relative">
                  <ValidatedTextInput kind="businessReg" optional value={businessNumber} onChangeText={setBusinessNumber}
                    placeholder="e.g. PVT-XXXXXX" placeholderTextColor="#b3b9b4" editable={!businessNumberLocked}
                    className={`w-full bg-white border border-[#eff4ef] rounded-2xl py-4 px-5 text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight ${businessNumberLocked ? 'bg-[#f0fdf4] text-[#5b645c]' : 'shadow-md shadow-[#006c4e]/10 border-[#006c4e]/30'}`} />
                  {businessNumberLocked && (
                    <MaterialIcons name="lock-outline" size={16} color="#b3b9b4" style={{ position: 'absolute', right: 20, top: 18 }} />
                  )}
                </View>
              </View>

            </View>

            <TouchableOpacity
              onPress={handleProfileSave}
              disabled={isSavingProfile}
              className="w-full bg-[#00351d] py-4 rounded-2xl mt-8 flex-row items-center justify-center gap-2 shadow-lg shadow-[#00351d]/30 active:opacity-80"
              style={isSavingProfile ? { opacity: 0.6 } : undefined}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialIcons name="sync" size={20} color="white" />
                  <Text className="text-white font-jakarta-extrabold text-[13px] uppercase tracking-widest">Update Profile Data</Text>
                </>
              )}
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
