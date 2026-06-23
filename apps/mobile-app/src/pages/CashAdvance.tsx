import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function CashAdvance({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full z-50 bg-[#efeeeb]/80">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-[#0b4d2e] flex items-center justify-center overflow-hidden">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUxomkKEjPwCaoMLGbD9x39GaT4SxlJPOQxmFjMxF-lNtzLIPTj5tlO6KSToQb3-XZ5sNoe2piLrmGahv9fwOwbRU7Es2Z3B9VWkolQafIrHf68Qvg92mKVCTLhEzyBpbjss0bmGzvBc_lrahfyyvUtToEP8i6I7tKFoyj5YdAv_8QVU30ca1TDl3tOYF4RaXtyHgHnvHVptxv6cql0qlXQDjzj6P3mQlC70E0lnpsTrEDhLQEen26XJ5Y8MNyKhiHmBw2lt5ikyo' }}
                className="w-full h-full"
              />
            </View>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#0b4d2e]">PayChain</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity>
              <MaterialIcons name="notifications" size={24} color="#0b4d2e" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-lg mx-auto px-6 pt-8 pb-32">
          <View className="flex-col gap-2 mb-8">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-[#b1f1c6] rounded-2xl flex items-center justify-center">
                <MaterialIcons name="payments" size={24} color="#00351d" />
              </View>
              <View>
                <Text className="font-jakarta-extrabold text-3xl tracking-tight text-[#00351d]">Cash Advance</Text>
                <Text className="text-sm text-[#404942] font-jakarta-medium">Based on your 5-month history</Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-[24px] p-8 shadow-sm shadow-[#00351d]/10 overflow-hidden mb-8">
            <View className="flex-col gap-6 relative z-10">
              <View className="space-y-1">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="w-2 h-2 rounded-full bg-[#006c4e]" />
                  <Text className="text-xs font-jakarta-bold uppercase tracking-widest text-[#006c4e]">Active Advance</Text>
                </View>
                <Text className="font-jakarta-bold text-4xl text-[#00351d] tracking-tighter">KES 150,000</Text>
                <Text className="text-xs text-[#404942] font-jakarta-medium mt-1">Disbursed 1 Feb 2026</Text>
              </View>

              <View className="space-y-3 gap-3">
                <View className="flex-row justify-between items-end">
                  <View className="space-y-0.5">
                    <Text className="text-[11px] font-jakarta-bold text-[#404942] uppercase tracking-wider mb-1">Repayment Progress</Text>
                    <Text className="text-sm font-jakarta-semibold text-[#00351d]">KES 67,500 repaid of 150K</Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#00351d]">45%</Text>
                </View>
                <View className="h-4 w-full bg-[#efeeeb] rounded-full overflow-hidden">
                  <LinearGradient
                    colors={['#00351d', '#006c4e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="h-full rounded-full w-[45%]"
                  />
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-[11px] font-jakarta-bold text-[#404942] uppercase tracking-widest">45% complete</Text>
                  <Text className="text-[11px] font-jakarta-bold text-[#404942] uppercase tracking-widest">Est. done 15 Apr 2026</Text>
                </View>
              </View>

              <View className="pt-4 border-t border-[#c0c9c0]/20 mt-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-[#404942] font-jakarta-medium">Rate</Text>
                  <Text className="text-sm font-jakarta-bold text-[#00351d]">8% of daily collections</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="bg-[#b1f1c6] rounded-2xl p-6 flex-row items-start gap-4 mb-8">
            <Feather name="info" size={20} color="#115132" className="mt-1" />
            <View className="flex-1 space-y-1">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-lg text-[#115132] leading-tight mb-1">Automated Repayment</Text>
              <Text className="text-sm text-[#002110] leading-relaxed font-jakarta-medium">
                8% of each day's collections automatically applied to your advance.{' '}
                <Text className="font-jakarta-bold">No manual transfers required.</Text>
              </Text>
            </View>
          </View>

          <View className="space-y-6 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-jakarta-bold text-xl text-[#00351d]">Advance History</Text>
              <TouchableOpacity className="flex-row items-center gap-1">
                <Text className="text-xs font-jakarta-bold uppercase tracking-widest text-[#006c4e]">Filter</Text>
                <Feather name="chevron-down" size={16} color="#006c4e" />
              </TouchableOpacity>
            </View>

            <View className="space-y-4 gap-4">
              <View className="bg-[#f4f3f0] p-5 rounded-2xl flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-10 h-10 rounded-full bg-[#e3e2df] flex items-center justify-center">
                    <MaterialIcons name="receipt-long" size={20} color="#404942" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#00351d] text-[15px]">KES 85,000</Text>
                    <Text className="text-xs text-[#404942] font-jakarta-medium mt-0.5">Oct 2025 — Jan 2026</Text>
                  </View>
                </View>
                <View className="px-3 py-1 bg-[#83f5c6] rounded-full">
                  <Text className="text-[#007151] text-[10px] font-jakarta-bold uppercase tracking-widest">Completed</Text>
                </View>
              </View>

              <View className="bg-[#f4f3f0] p-5 rounded-2xl flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-10 h-10 rounded-full bg-[#e3e2df] flex items-center justify-center">
                    <MaterialIcons name="receipt-long" size={20} color="#404942" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#00351d] text-[15px]">KES 40,000</Text>
                    <Text className="text-xs text-[#404942] font-jakarta-medium mt-0.5">June 2025 — Aug 2025</Text>
                  </View>
                </View>
                <View className="px-3 py-1 bg-[#83f5c6] rounded-full">
                  <Text className="text-[#007151] text-[10px] font-jakarta-bold uppercase tracking-widest">Completed</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
