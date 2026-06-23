import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Dashboard() {
  return (
    <ScrollView 
      className="flex-1 bg-[#faf9f6]" 
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-lg mx-auto flex-1">
        {/* Header & Tagline */}
        <View className="px-6 pt-8 pb-4">
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#1b1c1a] opacity-80">
            Collect. Pay. Grow.
          </Text>
          <View className="flex-row justify-between items-end mt-4">
            <View>
              <Text className="text-sm font-jakarta-medium text-[#1b1c1a] opacity-60 uppercase tracking-widest mb-1">
                Available Balance
              </Text>
              <Text 
                style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1 }} 
                className="text-[56px] text-[#1b1c1a] leading-none"
              >
                KSh 0<Text className="text-3xl text-[#1b1c1a] opacity-50">.00</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Actions (Merchant's Seal) */}
        <View className="px-6 flex-row space-x-4 mb-8 gap-4 mt-2">
          <TouchableOpacity className="flex-1 rounded-[24px] overflow-hidden" activeOpacity={0.9}>
            <LinearGradient
              colors={['#00351d', '#0b4d2e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-row items-center justify-center py-4 px-4"
            >
              <Feather name="arrow-down-left" size={20} color="white" />
              <Text className="text-white font-jakarta-bold ml-2 text-base">Collect</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 bg-[#efeeeb] rounded-[24px] flex-row items-center justify-center py-4 px-4" activeOpacity={0.9}>
            <Feather name="arrow-up-right" size={20} color="#1b1c1a" />
            <Text className="text-[#1b1c1a] font-jakarta-bold ml-2 text-base">Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Growth Ribbon */}
        <View className="bg-[#b1f1c6] py-5 mb-8">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
            <View className="mr-8">
              <Text className="text-[#00351d] text-sm uppercase tracking-widest font-jakarta-bold opacity-70 mb-1">Weekly Volume</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-3xl text-[#00351d]">KSh 0.00</Text>
            </View>
            <View className="mr-8">
              <Text className="text-[#00351d] text-sm uppercase tracking-widest font-jakarta-bold opacity-70 mb-1">Transactions</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-3xl text-[#00351d]">0</Text>
            </View>
            <View className="mr-6">
              <Text className="text-[#00351d] text-sm uppercase tracking-widest font-jakarta-bold opacity-70 mb-1">Active Customers</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-3xl text-[#00351d]">0</Text>
            </View>
          </ScrollView>
        </View>

        {/* Recent Activity Card */}
        <View className="px-6">
          <Text className="text-sm font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest mb-4">
            Recent Activity
          </Text>
          <View className="bg-white rounded-[24px] p-6 shadow-sm">
            <View className="items-center justify-center py-8">
              <Feather name="inbox" size={32} color="#1b1c1a" style={{ opacity: 0.2 }} />
              <Text className="text-[#1b1c1a] opacity-50 font-jakarta-medium mt-4">No transactions yet</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
