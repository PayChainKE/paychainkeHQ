import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [bulkPayAlerts, setBulkPayAlerts] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full z-50 bg-[#f4f3f0] pt-2 pb-4">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6">
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-full bg-[#00351d] flex items-center justify-center shadow-sm">
              <Text className="text-white text-[12px] font-jakarta-bold tracking-widest">JK</Text>
            </View>
            <Text className="font-jakarta-bold tracking-tight text-[#00351d] text-[18px]">Merchant Store</Text>
          </View>
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <MaterialIcons name="notifications" size={26} color="#00351d" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          {/* Header Section */}
          <View className="flex-col items-center mb-12">
            <View className="relative mb-6">
              <View className="w-[120px] h-[120px] rounded-full bg-[#00351d] flex items-center justify-center shadow-lg shadow-[#00351d]/10">
                <Text className="text-white text-[48px] font-jakarta-extrabold tracking-tight">JK</Text>
              </View>
              <View className="absolute bottom-1 right-1 w-[30px] h-[30px] bg-[#006c4e] rounded-full flex items-center justify-center border-[3px] border-[#faf9f6] shadow-sm">
                <MaterialIcons name="verified" size={14} color="white" />
              </View>
            </View>
            <Text className="text-[26px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-1">Kamau General Store</Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#006c4e] text-[20px] mb-5 tracking-wide">Collect. Pay. Grow.</Text>
            <View className="flex-row gap-3">
              <View className="px-4 py-2 rounded-full bg-[#b1f1c6] flex-row items-center gap-2 border border-[#006c4e]/5 shadow-sm shadow-[#b1f1c6]/20">
                <View className="w-1.5 h-1.5 rounded-full bg-[#006c4e]" />
                <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-[0.1em]">Active</Text>
              </View>
              <View className="px-4 py-2 rounded-full bg-[#b1f1c6] flex-row items-center gap-1.5 border border-[#006c4e]/5 shadow-sm shadow-[#b1f1c6]/20">
                <MaterialIcons name="check-circle" size={14} color="#006c4e" />
                <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-[0.1em]">KYC Verified</Text>
              </View>
            </View>
          </View>

          {/* Business Information Section */}
          <View className="mb-10">
            <Text className="text-[12px] font-jakarta-bold uppercase tracking-[0.15em] text-[#707971] mb-5 ml-2">Business Information</Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="w-full bg-white p-7 rounded-[40px] shadow-sm border border-[#c0c9c0]/10">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-2">Till Number</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[24px] font-jakarta-extrabold text-[#00351d] tracking-tight">PC847291</Text>
                  <TouchableOpacity className="p-2 -mr-2 rounded-full active:bg-[#efeeeb]">
                    <MaterialIcons name="content-copy" size={24} color="#006c4e" />
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-1 bg-white p-7 rounded-[40px] shadow-sm border border-[#c0c9c0]/10 min-w-[150px]">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-3">Member Since</Text>
                <Text className="font-jakarta-medium text-[#1b1c1a] text-[18px]">Oct 2023</Text>
              </View>
              <View className="flex-1 bg-white p-7 rounded-[40px] shadow-sm border border-[#c0c9c0]/10 min-w-[150px]">
                <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-3">Onboarded By</Text>
                <Text className="font-jakarta-medium text-[#1b1c1a] text-[18px] leading-tight">Self-Registered</Text>
              </View>
            </View>
          </View>

          {/* Personal Details Section */}
          <View className="mb-10">
            <Text className="text-[12px] font-jakarta-bold uppercase tracking-[0.15em] text-[#707971] mb-5 ml-2">Personal Details</Text>
            <View className="bg-white rounded-[40px] shadow-sm border border-[#c0c9c0]/10">
              <View className="p-7 flex-row items-center justify-between border-b border-[#efeeeb]/60">
                <View>
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-1.5">Full Name</Text>
                  <Text className="font-jakarta-medium text-[16px] text-[#1b1c1a]">James Kamau</Text>
                </View>
                <MaterialIcons name="person" size={24} color="#b3b9b4" />
              </View>
              <View className="p-7 flex-row items-center justify-between border-b border-[#efeeeb]/60">
                <View>
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-1.5">Email Address</Text>
                  <Text className="font-jakarta-medium text-[16px] text-[#1b1c1a]">james@kamau.co</Text>
                </View>
                <MaterialIcons name="mail" size={22} color="#b3b9b4" />
              </View>
              <View className="p-7 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.15em] mb-1.5">Phone Number</Text>
                  <Text className="font-jakarta-medium text-[16px] text-[#1b1c1a]">+254 712 847 291</Text>
                </View>
                <MaterialIcons name="phone-iphone" size={22} color="#b3b9b4" />
              </View>
            </View>
          </View>

          {/* Security Section */}
          <View className="mb-10">
            <Text className="text-[12px] font-jakarta-bold uppercase tracking-[0.15em] text-[#707971] mb-5 ml-2">Security</Text>
            <View className="bg-white rounded-[40px] shadow-sm border border-[#c0c9c0]/10">
              <TouchableOpacity className="w-full p-6 flex-row items-center justify-between border-b border-[#efeeeb]/60 active:bg-[#faf9f6]">
                <View className="flex-row items-center gap-5">
                  <View className="w-[46px] h-[46px] rounded-full bg-[#d3e7e0] flex items-center justify-center">
                    <MaterialIcons name="lock-reset" size={24} color="#1b1c1a" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[16px] text-[#1b1c1a] mb-0.5">Change Password</Text>
                    <Text className="text-[12px] text-[#707971] font-jakarta-medium">Last updated 3 months ago</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={22} color="#707971" className="opacity-70" />
              </TouchableOpacity>
              
              <View className="w-full p-6 flex-row items-center justify-between">
                <View className="flex-row items-center gap-5">
                  <View className="w-[46px] h-[46px] rounded-full bg-[#83f5c6] flex items-center justify-center shadow-sm shadow-[#83f5c6]/30">
                    <MaterialIcons name="devices" size={24} color="#00351d" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[16px] text-[#1b1c1a] mb-0.5">Active Session</Text>
                    <Text className="text-[12px] text-[#006c4e] font-jakarta-medium">iPhone 15 Pro • Nairobi, KE</Text>
                  </View>
                </View>
                <View className="px-3 py-1.5 rounded-full bg-[#efeeeb]">
                  <Text className="text-[10px] font-jakarta-bold uppercase tracking-[0.15em] text-[#707971]">Current</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Notifications Section */}
          <View className="mb-12">
            <Text className="text-[12px] font-jakarta-bold uppercase tracking-[0.15em] text-[#707971] mb-5 ml-2">Notifications</Text>
            <View className="bg-white rounded-[40px] shadow-sm border border-[#c0c9c0]/10">
              <View className="p-7 flex-row items-center justify-between border-b border-[#efeeeb]/60">
                <View className="flex-1 pr-4">
                  <Text className="font-jakarta-bold text-[16px] text-[#1b1c1a] mb-0.5">Payment Alerts</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium">Get notified when a customer pays</Text>
                </View>
                <Switch 
                  value={paymentAlerts}
                  onValueChange={setPaymentAlerts}
                  trackColor={{ false: '#e3e2df', true: '#00351d' }}
                  thumbColor="#ffffff"
                />
              </View>
              <View className="p-7 flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="font-jakarta-bold text-[16px] text-[#1b1c1a] mb-0.5">Bulk Pay Completion</Text>
                  <Text className="text-[13px] text-[#707971] font-jakarta-medium">Confirmations for payroll & supplier runs</Text>
                </View>
                <Switch 
                  value={bulkPayAlerts}
                  onValueChange={setBulkPayAlerts}
                  trackColor={{ false: '#e3e2df', true: '#00351d' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity className="w-full bg-[#ffeceb] py-5 rounded-[40px] flex-row items-center justify-center gap-3 active:bg-[#ffd6d3] transition-colors border border-[#ffb4ab]/20 shadow-sm shadow-[#ffb4ab]/10">
            <Feather name="log-out" size={22} color="#ba1a1a" />
            <Text className="text-[#ba1a1a] font-jakarta-bold text-[18px]">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
