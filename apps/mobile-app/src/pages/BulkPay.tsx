import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BulkPay() {
  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full bg-[#faf9f6] pt-4 pb-2 z-40">
        <View className="w-full max-w-lg mx-auto px-6">
          <View className="flex-row justify-between items-center w-full">
            <View className="flex-row items-center gap-4">
              <Feather name="menu" size={24} color="#00351d" />
              <Text className="font-jakarta-bold tracking-tight text-2xl text-[#00351d]">Bulk Payments</Text>
            </View>
            <View className="w-10 h-10 rounded-full bg-[#efeeeb] overflow-hidden border border-[#c0c9c0]/20">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDT_TCBfPtbFc1Ud_JlyySnGTrR6kWG4-FDxCWiud06FawPuJIGnGkGmFpQiQfR3lb4Wi9mE6XnhhaL3Dlwh8Y6XBt8wkMwJJP1z-EfqRCMbk_rJk74-7A6SljJJjLjeZyUwMyLmSW1yTtYEAbNev34tE6B4_D_tuVYONSncBjLFNgASjHsvddu0uTJZHFxfGQT7dUKXNcX3q2wAS76NSeVOFIkAEtxpaYG56urTH9ozzJhftQjnhmUeUos3-Hoy7Eb9XcGxiH1hwg' }}
                className="w-full h-full"
              />
            </View>
          </View>

          <View className="flex-row gap-8 mt-6 border-b border-[#c0c9c0]/20">
            <TouchableOpacity className="pb-2">
              <Text className="text-[#707971] font-jakarta-bold">Payees</Text>
            </TouchableOpacity>
            <TouchableOpacity className="border-b-2 border-[#00351d] pb-2">
              <Text className="text-[#00351d] font-jakarta-bold">Batches</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-lg mx-auto px-6 py-6">
          <View className="bg-[#b1f1c6] rounded-[24px] px-6 py-5 mb-10 overflow-hidden relative">
            <View className="flex-row justify-between items-center">
              <View className="flex-col max-w-[140px]">
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#115132] text-xl">Active Batch Volume</Text>
                <Text className="text-[#002110] font-jakarta-bold text-[10px] tracking-widest uppercase opacity-60 mt-1">Collect. Pay. Grow.</Text>
              </View>
              <View className="flex-row gap-6">
                <View className="items-end">
                  <Text className="text-[10px] text-[#115132] font-jakarta-bold uppercase tracking-tighter opacity-70">Total Pending</Text>
                  <Text className="text-xl font-jakarta-bold text-[#00351d]">KES 412K</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] text-[#115132] font-jakarta-bold uppercase tracking-tighter opacity-70">Scheduled</Text>
                  <Text className="text-xl font-jakarta-bold text-[#00351d]">03</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="space-y-8">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-jakarta-bold text-[#00351d] tracking-tight">Recent Activity</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-[#006c4e] font-jakarta-bold text-sm">Filter by Status</Text>
                <Feather name="filter" size={14} color="#006c4e" />
              </View>
            </View>

            <View className="relative pl-6">
              <View className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-[#c0c9c0]/30" />

              <View className="relative mb-6">
                <View className="absolute -left-[29px] top-4 w-4 h-4 rounded-full bg-[#006c4e] border-4 border-[#faf9f6] z-10" />
                <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-2xl p-5 shadow-sm border border-[#c0c9c0]/10 ml-2">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[16px] font-jakarta-extrabold text-[#1b1c1a]">March Payroll</Text>
                      <View className="px-2 py-0.5 bg-[#83f5c6]/30 rounded-full">
                        <Text className="text-[#007151] text-[9px] font-jakarta-bold uppercase tracking-widest">Completed</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1">
                      <Feather name="calendar" size={12} color="#707971" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">14 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">12 recipients</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-widest">Total Disbursed</Text>
                      <Text className="text-lg font-jakarta-extrabold text-[#00351d]">KES 184,250</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="relative mb-6">
                <View className="absolute -left-[29px] top-4 w-4 h-4 rounded-full bg-[#f59e0b] border-4 border-[#faf9f6] z-10" />
                <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-2xl p-5 shadow-sm border border-[#c0c9c0]/10 ml-2">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[16px] font-jakarta-extrabold text-[#1b1c1a]">Fruit Suppliers</Text>
                      <View className="px-2 py-0.5 bg-amber-100 rounded-full">
                        <Text className="text-amber-800 text-[9px] font-jakarta-bold uppercase tracking-widest">Scheduled</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1">
                      <Feather name="clock" size={12} color="#707971" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">18 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">08 recipients</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-widest">Estimated Total</Text>
                      <Text className="text-lg font-jakarta-extrabold text-[#00351d]">KES 52,400</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="relative mb-2">
                <View className="absolute -left-[29px] top-4 w-4 h-4 rounded-full bg-[#006c4e] border-4 border-[#faf9f6] z-10" />
                <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-2xl p-5 shadow-sm border border-[#c0c9c0]/10 ml-2">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[16px] font-jakarta-extrabold text-[#1b1c1a]">Rent & Utilities</Text>
                      <View className="px-2 py-0.5 bg-[#83f5c6]/30 rounded-full">
                        <Text className="text-[#007151] text-[9px] font-jakarta-bold uppercase tracking-widest">Completed</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1">
                      <Feather name="calendar" size={12} color="#707971" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">01 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-xs font-jakarta-medium">04 recipients</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[9px] text-[#707971] font-jakarta-bold uppercase tracking-widest">Total Disbursed</Text>
                      <Text className="text-lg font-jakarta-extrabold text-[#00351d]">KES 120,000</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.9} className="mt-12 bg-[#00351d] rounded-[24px] p-8 relative overflow-hidden shadow-lg shadow-[#00351d]/20">
            <View className="relative z-10">
              <Text className="text-white text-2xl font-jakarta-bold mb-2">Create New Batch</Text>
              <Text className="text-[#b1f1c6]/70 text-sm max-w-[240px] font-jakarta-medium leading-relaxed">Streamline your payouts by grouping multiple payees into a single ledger.</Text>
              <View className="mt-6 flex-row items-center self-start gap-2 bg-[#1D9E75] px-6 py-3 rounded-full">
                <Feather name="plus-circle" size={18} color="white" />
                <Text className="text-white font-jakarta-bold text-sm">Start New Disbursal</Text>
              </View>
            </View>
            <View className="absolute -right-4 -bottom-4 opacity-20">
              <Feather name="layers" size={120} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
