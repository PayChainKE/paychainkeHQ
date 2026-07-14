import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';

export default function MyAccountsTab() {
  const { merchant } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const accountsData = [
    {
      service: 'PayChain',
      accountNumber: merchant?.paybillAccount || '84729',
      type: 'M-Pesa Paybill',
      name: merchant?.businessName || 'Merchant',
      linkedTransferAccount: 'Linked to M-Pesa',
      manager: merchant?.name || 'Owner',
      status: 'Active'
    },
    {
      service: 'NCBA Bank',
      // ncbaVirtualAccountNumber is null until NCBA_INSTITUTION_PREFIX is
      // configured on the backend (i.e. until NCBA assigns PayChain's
      // 4-digit institution code) — show a pending state, not an error.
      accountNumber: merchant?.ncbaVirtualAccountNumber || 'Pending bank assignment',
      type: 'Bank / EFT / PesaLink',
      name: merchant?.businessName || 'Merchant',
      linkedTransferAccount: 'Direct bank transfer',
      manager: merchant?.name || 'Owner',
      status: merchant?.ncbaVirtualAccountNumber ? 'Active' : 'Pending'
    }
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">

        {/* Page Header */}
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">My Accounts</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">
            Manage your registered PayChain accounts, linked transfer accounts, and assigned managers.
          </Text>
        </View>

        {/* Search */}
        <View className="relative mb-8 shadow-sm">
          <Feather name="search" size={20} color="#b3b9b4" style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
          <TextInput
            placeholder="Search accounts..."
            className="w-full bg-white border border-[#eff4ef] rounded-2xl py-4 pl-12 pr-4 text-[15px] font-jakarta-medium text-[#00351d]"
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#b3b9b4"
          />
        </View>

        <View className="flex-row items-center justify-between mb-4 px-1">
          <Text className="text-[14px] font-jakarta-bold text-[#00351d]">Registered Accounts</Text>
          <Text className="text-[12px] font-jakarta-bold text-[#006c4e] uppercase tracking-widest">{accountsData.length} active</Text>
        </View>

        <View className="gap-5">
          {accountsData.map((account, idx) => (
            <View key={idx} className="bg-white rounded-[28px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 overflow-hidden">
              <LinearGradient colors={['rgba(0,108,78,0.05)', 'rgba(0,108,78,0)']} className="absolute inset-0 h-24" />

              <View className="p-6">
                <View className="flex-row justify-between items-start mb-6">
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-2xl bg-[#006c4e] flex items-center justify-center shadow-md shadow-[#006c4e]/30">
                      <MaterialIcons name="point-of-sale" size={22} color="white" />
                    </View>
                    <View>
                      <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight">{account.name}</Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-[#006c4e]" />
                        <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-widest">{account.service}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="bg-[#e6f4ea] px-3 py-1.5 rounded-full border border-[#006c4e]/10">
                    <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">{account.type}</Text>
                  </View>
                </View>

                <View className="bg-[#f0fdf4] rounded-2xl p-5 border border-[#eff4ef] gap-4">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[12px] text-[#707971] font-jakarta-bold uppercase tracking-widest">Account No</Text>
                    <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight">{account.accountNumber}</Text>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-[12px] text-[#707971] font-jakarta-bold uppercase tracking-widest">Manager</Text>
                    <Text className="text-[14px] font-jakarta-bold text-[#00351d]">{account.manager}</Text>
                  </View>

                  <View className="h-[1px] bg-[#eff4ef] w-full" />

                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="account-balance" size={14} color="#707971" />
                      <Text className="text-[12px] text-[#707971] font-jakarta-medium">{account.linkedTransferAccount}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#b3b9b4" />
                  </View>
                </View>

              </View>
            </View>
          ))}
        </View>

      </View>
    </ScrollView>
  );
}
