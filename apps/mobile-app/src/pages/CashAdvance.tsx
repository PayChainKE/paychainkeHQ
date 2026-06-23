import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function CashAdvance({ navigation }: any) {
  const [isEligible, setIsEligible] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full z-50 bg-[#f4f3f0] pt-2 pb-4">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => setIsEligible(!isEligible)}>
              <View className="w-[42px] h-[42px] rounded-full bg-[#efeeeb] flex items-center justify-center overflow-hidden border border-[#c0c9c0]/20">
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDT_TCBfPtbFc1Ud_JlyySnGTrR6kWG4-FDxCWiud06FawPuJIGnGkGmFpQiQfR3lb4Wi9mE6XnhhaL3Dlwh8Y6XBt8wkMwJJP1z-EfqRCMbk_rJk74-7A6SljJJjLjeZyUwMyLmSW1yTtYEAbNev34tE6B4_D_tuVYONSncBjLFNgASjHsvddu0uTJZHFxfGQT7dUKXNcX3q2wAS76NSeVOFIkAEtxpaYG56urTH9ozzJhftQjnhmUeUos3-Hoy7Eb9XcGxiH1hwg' }}
                  className="w-full h-full"
                />
              </View>
            </TouchableOpacity>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[26px] text-[#00351d] tracking-tight">PayChain</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity className="w-10 h-10 items-center justify-center">
              <MaterialIcons name="notifications" size={26} color="#00351d" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {isEligible ? (
          <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
            <View className="flex-row items-start gap-4 mb-10">
              <View className="w-16 h-16 bg-[#b1f1c6] rounded-[24px] flex items-center justify-center shadow-sm">
                <MaterialIcons name="payments" size={32} color="#00351d" />
              </View>
              <View className="flex-1 mt-1">
                <Text className="font-jakarta-extrabold text-[34px] tracking-tight text-[#00351d] leading-tight mb-1">Cash Advance</Text>
                <Text className="text-[15px] text-[#404942] font-jakarta-medium leading-relaxed max-w-[220px]">Based on your 5-month transaction history</Text>
              </View>
            </View>

            <View className="bg-white rounded-[40px] p-8 shadow-md shadow-[#00351d]/5 mb-10 border border-[#c0c9c0]/10">
              <View className="flex-col gap-8 relative z-10">
                <View className="space-y-1">
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#006c4e]" />
                    <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.15em] text-[#006c4e]">Active Advance</Text>
                  </View>
                  <Text className="font-jakarta-bold text-[40px] text-[#00351d] tracking-tight leading-tight mb-1">KES 150,000</Text>
                  <Text className="text-[14px] text-[#404942] font-jakarta-medium">Disbursed 1 Feb 2026</Text>
                </View>

                <View className="space-y-4">
                  <View className="flex-row justify-between items-end mb-1">
                    <View className="space-y-1">
                      <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-[0.1em] mb-1">Repayment Progress</Text>
                      <Text className="text-[15px] font-jakarta-medium text-[#1b1c1a]">KES 67,500 repaid of KES 150,000</Text>
                    </View>
                    <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[34px] text-[#00351d] leading-none mb-1">45<Text className="text-[20px]">%</Text></Text>
                  </View>
                  <View className="h-[14px] w-full bg-[#efeeeb] rounded-full overflow-hidden mb-1">
                    <View className="h-full rounded-full w-[45%] bg-[#006c4e]" />
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[10px] font-jakarta-bold text-[#404942] uppercase tracking-[0.1em]">45% complete</Text>
                    <Text className="text-[10px] font-jakarta-bold text-[#404942] uppercase tracking-[0.1em]">Est. done 15 Apr 2026</Text>
                  </View>
                </View>

                <View className="pt-6 border-t border-[#c0c9c0]/30 mt-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[16px] text-[#404942] font-jakarta-medium">Rate</Text>
                    <Text className="text-[16px] font-jakarta-bold text-[#00351d]">8% of daily collections</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="bg-[#b1f1c6] rounded-[32px] p-7 flex-row items-start gap-4 mb-10 shadow-sm">
              <View className="w-6 h-6 rounded-full bg-[#00351d] flex items-center justify-center mt-1">
                <Text className="text-[#b1f1c6] font-jakarta-bold text-[14px] italic">i</Text>
              </View>
              <View className="flex-1">
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] leading-tight mb-2">Automated Repayment</Text>
                <Text className="text-[15px] text-[#00351d] leading-relaxed font-jakarta-medium pr-2">
                  8% of each day's collections automatically applied to your advance.{' '}
                  <Text className="font-jakarta-bold">No manual transfers required.</Text>
                </Text>
              </View>
            </View>

            <View className="space-y-6 mb-8">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-jakarta-bold text-[22px] text-[#00351d] tracking-tight">Advance History</Text>
                <TouchableOpacity className="flex-row items-center gap-1.5 py-2">
                  <Text className="text-[12px] font-jakarta-bold uppercase tracking-[0.15em] text-[#006c4e]">Filter</Text>
                  <Feather name="chevron-down" size={18} color="#006c4e" />
                </TouchableOpacity>
              </View>

              <View className="space-y-4 gap-4">
                <View className="bg-[#f4f3f0] p-6 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10">
                  <View className="flex-row items-center gap-4">
                    <View className="w-[46px] h-[46px] rounded-full bg-[#e3e2df] flex items-center justify-center">
                      <MaterialIcons name="receipt-long" size={24} color="#404942" />
                    </View>
                    <View>
                      <Text className="font-jakarta-bold text-[#00351d] text-[18px] tracking-tight mb-0.5">KES 85,000</Text>
                      <Text className="text-[13px] text-[#707971] font-jakarta-medium">Oct 2025 — Jan 2026</Text>
                    </View>
                  </View>
                  <View className="px-3.5 py-1.5 bg-[#83f5c6] rounded-full">
                    <Text className="text-[#007151] text-[10px] font-jakarta-bold uppercase tracking-[0.1em]">Completed</Text>
                  </View>
                </View>

                <View className="bg-[#f4f3f0] p-6 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10">
                  <View className="flex-row items-center gap-4">
                    <View className="w-[46px] h-[46px] rounded-full bg-[#e3e2df] flex items-center justify-center">
                      <MaterialIcons name="receipt-long" size={24} color="#404942" />
                    </View>
                    <View>
                      <Text className="font-jakarta-bold text-[#00351d] text-[18px] tracking-tight mb-0.5">KES 40,000</Text>
                      <Text className="text-[13px] text-[#707971] font-jakarta-medium">June 2025 — Aug 2025</Text>
                    </View>
                  </View>
                  <View className="px-3.5 py-1.5 bg-[#83f5c6] rounded-full">
                    <Text className="text-[#007151] text-[10px] font-jakarta-bold uppercase tracking-[0.1em]">Completed</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
            <View className="items-center mb-10">
              <View className="w-[84px] h-[84px] bg-[#b1f1c6] rounded-full flex items-center justify-center mb-6 shadow-sm">
                <MaterialIcons name="payments" size={40} color="#00351d" />
              </View>
              <Text className="font-jakarta-extrabold text-[36px] tracking-tight text-[#00351d] mb-3">Cash Advance</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[24px] text-[#00351d] text-center max-w-[280px] leading-tight">Grow your business with PayChain Capital</Text>
            </View>

            <View className="bg-[#f4f3f0] rounded-[40px] p-8 mb-6 border border-[#c0c9c0]/20">
              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.2em] mb-8">Eligibility Journey</Text>
              
              <View className="relative mb-6">
                <View className="absolute top-[21px] left-8 right-8 h-[2px] bg-[#e3e2df]" />
                
                <View className="flex-row justify-between relative z-10">
                  <View className="items-center w-[72px]">
                    <View className="w-[42px] h-[42px] rounded-full bg-[#006c4e] flex items-center justify-center mb-3">
                      <Feather name="check" size={20} color="white" />
                    </View>
                    <Text className="text-[#006c4e] font-jakarta-bold text-[12px]">Month 1</Text>
                  </View>

                  <View className="items-center w-[72px]">
                    <View className="w-[42px] h-[42px] rounded-full bg-[#006c4e] flex items-center justify-center mb-3">
                      <Feather name="check" size={20} color="white" />
                    </View>
                    <Text className="text-[#006c4e] font-jakarta-bold text-[12px]">Month 2</Text>
                  </View>

                  <View className="items-center w-[72px]">
                    <View className="w-[42px] h-[42px] rounded-full bg-[#faf9f6] border-[3px] border-[#00351d] flex items-center justify-center mb-3">
                      <MaterialIcons name="lock" size={18} color="#00351d" />
                    </View>
                    <Text className="text-[#1b1c1a] font-jakarta-bold text-[12px]">Month 3</Text>
                  </View>
                </View>
              </View>

              <View className="flex-row justify-end mt-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[#1b1c1a] font-jakarta-bold text-[13px]">You are here</Text>
                  <Feather name="arrow-right" size={16} color="#1b1c1a" />
                </View>
              </View>
            </View>

            <View className="flex-row gap-4 mb-6">
              <View className="flex-1 bg-white p-7 rounded-[32px] shadow-sm border border-[#c0c9c0]/10">
                <Text className="text-[#404942] text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-4">Trust Score</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-[#00351d] text-[40px] font-jakarta-extrabold tracking-tight">74</Text>
                  <Text className="text-[#00c48c] font-jakarta-bold text-[13px] ml-1">/100</Text>
                </View>
              </View>
              <View className="flex-1 bg-white p-7 rounded-[32px] shadow-sm border border-[#c0c9c0]/10">
                <Text className="text-[#404942] text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-4">Days Active</Text>
                <Text className="text-[#00351d] text-[40px] font-jakarta-extrabold tracking-tight">68</Text>
              </View>
            </View>

            <View className="bg-[#00351d] p-8 rounded-[40px] flex-row items-center justify-between shadow-xl shadow-[#00351d]/20 mb-10">
              <View>
                <Text className="text-[#b1f1c6] text-[10px] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Est. Eligibility Date</Text>
                <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight">12 Apr 2026</Text>
              </View>
              <View className="opacity-20">
                <MaterialIcons name="calendar-today" size={48} color="#b1f1c6" />
              </View>
            </View>

            <View className="px-6 mb-12">
              <Text className="text-center text-[#404942] font-jakarta-medium text-[16px] leading-relaxed">
                Keep collecting with <Text className="font-jakarta-bold text-[#00351d]">PayChain</Text> to unlock your first advance.
              </Text>
            </View>

            <View className="bg-[#f4f3f0] rounded-[40px] p-8 border border-[#c0c9c0]/20 mb-8">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[28px] text-[#00351d] mb-8 tracking-tight">The Capital Promise</Text>
              
              <View className="space-y-8">
                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="description" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">No paperwork</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">Everything is verified through your existing transaction history. No bank visits required.</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="money-off" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">No fixed monthly fees</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">We don't charge interest. A single flat service fee is agreed upfront.</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-5">
                  <MaterialIcons name="trending-up" size={24} color="#006c4e" className="mt-1" />
                  <View className="flex-1">
                    <Text className="text-[#00351d] font-jakarta-bold text-[16px] mb-2">Repay as you earn</Text>
                    <Text className="text-[#404942] font-jakarta-medium text-[14px] leading-relaxed">Repayments happen automatically as a small percentage of your daily sales.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
