import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [bulkPayAlerts, setBulkPayAlerts] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full z-50 bg-[#faf9f6]/80 border-b border-[#c0c9c0]/10">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-[#0b4d2e] flex items-center justify-center">
              <Text className="text-white text-xs font-jakarta-bold">JK</Text>
            </View>
            <Text className="font-jakarta-bold tracking-tight text-[#00351d] text-lg">Merchant Store</Text>
          </View>
          <TouchableOpacity>
            <MaterialIcons name="notifications" size={24} color="#00351d" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-32">
          <View className="flex-col items-center mb-10">
            <View className="relative">
              <LinearGradient
                colors={['#00351d', '#0b4d2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-32 h-32 rounded-full flex items-center justify-center shadow-xl mb-4 border-4 border-[#efeeeb]"
              >
                <Text className="text-white text-4xl font-jakarta-extrabold">JK</Text>
              </LinearGradient>
              <View className="absolute bottom-4 right-0 w-8 h-8 bg-[#006c4e] rounded-full flex items-center justify-center border-2 border-[#faf9f6]">
                <MaterialIcons name="verified" size={16} color="white" />
              </View>
            </View>
            <Text className="text-2xl font-jakarta-bold text-[#00351d] tracking-tight mb-1">Kamau General Store</Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#006c4e] text-lg mb-4">Collect. Pay. Grow.</Text>
            <View className="flex-row gap-2">
              <View className="px-3 py-1 rounded-full bg-[#83f5c6]/30 flex-row items-center gap-1.5">
                <View className="w-1.5 h-1.5 rounded-full bg-[#006c4e]" />
                <Text className="text-[#007151] text-xs font-jakarta-bold uppercase tracking-wider">Active</Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-[#b1f1c6] flex-row items-center gap-1.5">
                <MaterialIcons name="check-circle" size={14} color="#115132" />
                <Text className="text-[#115132] text-xs font-jakarta-bold uppercase tracking-wider">KYC Verified</Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-sm font-jakarta-bold uppercase tracking-[0.1em] text-[#707971] mb-4">Business Information</Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="w-full bg-white p-6 rounded-2xl shadow-sm shadow-[#00351d]/5">
                <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1">Till Number</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xl font-jakarta-extrabold text-[#00351d] tracking-tight">PC847291</Text>
                  <TouchableOpacity className="p-2 rounded-full hover:bg-[#efeeeb]">
                    <MaterialIcons name="content-copy" size={20} color="#006c4e" />
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-1 bg-white p-5 rounded-2xl shadow-sm shadow-[#00351d]/5 min-w-[140px]">
                <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1">Member Since</Text>
                <Text className="font-jakarta-semibold text-[#1b1c1a]">Oct 2023</Text>
              </View>
              <View className="flex-1 bg-white p-5 rounded-2xl shadow-sm shadow-[#00351d]/5 min-w-[140px]">
                <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-1">Onboarded By</Text>
                <Text className="font-jakarta-semibold text-[#1b1c1a]">Self-Registered</Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-sm font-jakarta-bold uppercase tracking-[0.1em] text-[#707971] mb-4">Personal Details</Text>
            <View className="bg-white rounded-2xl shadow-sm shadow-[#00351d]/5 overflow-hidden">
              <View className="p-5 flex-row items-center justify-between border-b border-[#efeeeb]/50">
                <View>
                  <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-0.5">Full Name</Text>
                  <Text className="font-jakarta-medium text-[#1b1c1a]">James Kamau</Text>
                </View>
                <MaterialIcons name="person" size={20} color="#707971" style={{ opacity: 0.4 }} />
              </View>
              <View className="p-5 flex-row items-center justify-between border-b border-[#efeeeb]/50">
                <View>
                  <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-0.5">Email Address</Text>
                  <Text className="font-jakarta-medium text-[#1b1c1a]">james@kamau.co</Text>
                </View>
                <MaterialIcons name="mail" size={20} color="#707971" style={{ opacity: 0.4 }} />
              </View>
              <View className="p-5 flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-wider mb-0.5">Phone Number</Text>
                  <Text className="font-jakarta-medium text-[#1b1c1a]">+254 712 847 291</Text>
                </View>
                <MaterialIcons name="phone-iphone" size={20} color="#707971" style={{ opacity: 0.4 }} />
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-sm font-jakarta-bold uppercase tracking-[0.1em] text-[#707971] mb-4">Security</Text>
            <View className="bg-white rounded-2xl shadow-sm shadow-[#00351d]/5 overflow-hidden">
              <TouchableOpacity className="w-full p-5 flex-row items-center justify-between border-b border-[#efeeeb]/50 active:bg-[#f4f3f0]">
                <View className="flex-row items-center gap-4">
                  <View className="w-10 h-10 rounded-full bg-[#d3e7e0] flex items-center justify-center">
                    <MaterialIcons name="lock-reset" size={20} color="#394a45" />
                  </View>
                  <View>
                    <Text className="font-jakarta-semibold text-[#1b1c1a]">Change Password</Text>
                    <Text className="text-xs text-[#707971] font-jakarta-medium mt-0.5">Last updated 3 months ago</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color="#707971" />
              </TouchableOpacity>
              
              <View className="w-full p-5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-10 h-10 rounded-full bg-[#83f5c6] flex items-center justify-center">
                    <MaterialIcons name="devices" size={20} color="#007151" />
                  </View>
                  <View>
                    <Text className="font-jakarta-semibold text-[#1b1c1a]">Active Session</Text>
                    <Text className="text-xs text-[#006c4e] font-jakarta-medium mt-0.5">iPhone 15 Pro • Nairobi, KE</Text>
                  </View>
                </View>
                <View className="px-2 py-1 rounded-md bg-[#efeeeb]">
                  <Text className="text-[10px] font-jakarta-bold uppercase text-[#707971]">Current</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mb-12">
            <Text className="text-sm font-jakarta-bold uppercase tracking-[0.1em] text-[#707971] mb-4">Notifications</Text>
            <View className="bg-white rounded-2xl shadow-sm shadow-[#00351d]/5 overflow-hidden">
              <View className="p-5 flex-row items-center justify-between border-b border-[#efeeeb]/50">
                <View>
                  <Text className="font-jakarta-semibold text-[#1b1c1a]">Payment Alerts</Text>
                  <Text className="text-xs text-[#707971] font-jakarta-medium mt-0.5">Get notified when a customer pays</Text>
                </View>
                <Switch 
                  value={paymentAlerts}
                  onValueChange={setPaymentAlerts}
                  trackColor={{ false: '#e3e2df', true: '#006c4e' }}
                  thumbColor="#ffffff"
                />
              </View>
              <View className="p-5 flex-row items-center justify-between">
                <View>
                  <Text className="font-jakarta-semibold text-[#1b1c1a]">Bulk Pay Completion</Text>
                  <Text className="text-xs text-[#707971] font-jakarta-medium mt-0.5">Confirmations for payroll & supplier runs</Text>
                </View>
                <Switch 
                  value={bulkPayAlerts}
                  onValueChange={setBulkPayAlerts}
                  trackColor={{ false: '#e3e2df', true: '#006c4e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity className="w-full py-4 mb-8 bg-[#ffdad6] rounded-2xl flex-row items-center justify-center gap-2 active:scale-[0.98]">
            <MaterialIcons name="logout" size={20} color="#93000a" />
            <Text className="text-[#93000a] font-jakarta-bold text-[15px]">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
