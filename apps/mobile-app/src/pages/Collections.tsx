import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Collections() {
  return (
    <View className="flex-1 bg-[#faf9f6]">
      <LinearGradient
        colors={['#0B4D2E', '#1D9E75']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full pt-16 pb-6 px-6 z-40 rounded-b-[24px]"
      >
        <View className="w-full max-w-lg mx-auto flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3 gap-3">
            <View className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhK7YduPHU9dGzfjcz09QTf6DlHfeeh5cRnFqZViYjsow6zWLu23unhSmjIB9TqI8ql6TdZ48pP-FXV79LBv_QMg1248JJdJZhHZociysxaBGiR9ml2HFqvAKmaZJ30euHI85aUw3-zhgSBTR1PbcxwwcCRCBDE9BtSA31soB3_uE-0ETTCuTtILHt80oT39Lu0Kwd5JIjFPgwi3oHakX_htxixmpOHex914DSfg1IpdPjZjAwmgRY6Kesrn99s3HdfjFlHbB9RZY' }}
                className="w-full h-full"
              />
            </View>
            <View>
              <Text className="text-white text-[22px] font-jakarta-bold tracking-tight leading-tight">Collections</Text>
              <Text className="text-white/70 text-xs font-jakarta-medium tracking-wide">Till PC847291</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity activeOpacity={0.8}>
              <Feather name="search" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}>
              <Feather name="sliders" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        className="flex-1 -mt-4 z-10"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-lg mx-auto px-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-4 pb-6 pt-2 overflow-visible">
            <View className="bg-white p-5 rounded-2xl shadow-sm w-44 mr-4">
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-widest mb-1">Today</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#006c4e]">KES 18,450</Text>
              <View className="flex-row items-center mt-2 gap-1">
                <Feather name="credit-card" size={12} color="#68dbae" />
                <Text className="text-[11px] font-jakarta-semibold text-[#404942]">12 payments</Text>
              </View>
            </View>

            <View className="bg-[#f4f3f0] p-5 rounded-2xl w-44 mr-4">
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-widest mb-1">This Week</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#404942]">KES 142.2k</Text>
              <View className="flex-row items-center mt-2 gap-1">
                <Feather name="trending-up" size={12} color="#707971" />
                <Text className="text-[11px] font-jakarta-semibold text-[#707971]">84 payments</Text>
              </View>
            </View>

            <View className="bg-[#f4f3f0] p-5 rounded-2xl w-44 mr-4">
              <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-widest mb-1">This Month</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-2xl text-[#404942]">KES 2.4M</Text>
              <View className="flex-row items-center mt-2 gap-1">
                <Feather name="calendar" size={12} color="#707971" />
                <Text className="text-[11px] font-jakarta-semibold text-[#707971]">342 payments</Text>
              </View>
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-8 mr-2">
            <TouchableOpacity className="px-5 py-2 rounded-full bg-[#00351d] shadow-md shadow-[#00351d]/10 mr-2">
              <Text className="text-white text-xs font-jakarta-bold">All</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-5 py-2 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-xs font-jakarta-semibold">Today</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-5 py-2 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-xs font-jakarta-semibold">Inbound</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-5 py-2 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-xs font-jakarta-semibold">Outbound</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-5 py-2 rounded-full bg-[#e9e8e5] mr-4">
              <Text className="text-[#404942] text-xs font-jakarta-semibold">FX</Text>
            </TouchableOpacity>
          </ScrollView>

          <View className="px-1">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-jakarta-extrabold uppercase tracking-widest text-[#707971]">Today — KES 18,450</Text>
              <Text className="text-[10px] font-jakarta-medium text-[#707971]">12 Total</Text>
            </View>

            <View className="space-y-4 gap-4">
              <TouchableOpacity activeOpacity={0.8} className="bg-white p-4 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#006c4e]/10 items-center justify-center overflow-hidden">
                    <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBG5CaKePfWPmBF5zxCzCUMgQXnrJPMOR32D5Ec2geLcUSysY-1VPnw54Iy52rc8c-jC549DEHDtSKLJ-XOkTxdjC11Mae5BgiSU3RA4DdyuI5fskPb7m1mls-yy0wbGYKjNKcFNSO7SEp6nQlnQmEZhgyxFAFH5CifI2OqIkXasN6Brb0zY3RUTEqmncP1RnnUEuuXr8LE4HUk7SPC0IK5RlqMcpDGU7_Q_WLO8UcAv3Q8EVySYxXq-jYqc_mANxHj8iD_DBH_Tng' }} className="w-full h-full" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-sm">Peter Otieno</Text>
                    <View className="flex-row items-center mt-1 gap-1.5">
                      <Text className="text-[11px] font-jakarta-medium text-[#707971]">QJX8472KL</Text>
                      <View className="flex-row items-center gap-1 bg-[#006c4e]/10 px-1.5 py-0.5 rounded">
                        <Feather name="shield" size={10} color="#006c4e" />
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e]">Verified</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-jakarta-bold text-[#006c4e] text-sm">+KES 1,500</Text>
                  <Text className="text-[10px] text-[#707971] font-jakarta-medium mt-1">14:22</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} className="bg-white p-4 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden">
                    <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6N8VwNbg3kIrAt3Vu7TDGvVho_8EpGPzNmCd4iujIRRELVqivQM36jxfTLrK5yff--a-tw2eJcIYpYBeHkCUeK5QBe1-5DK8RNA5_EY4K4UY7ENEx0MRd2TaxO63OKOBRlci08T8xyh8VyuAFAqkG9SttYOSxjm17v5xs1zk68_VBr8aM66YSgPu39fcXnQ-w0GuDrlanv4k7BwsxLU06eUQEXB7GUz4MSXCgtVyI1SxP0RuLH-HiKnCf8VZgao3akxJE3BEu0Uc' }} className="w-full h-full" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-sm">Sarah Wanjiku</Text>
                    <View className="flex-row items-center mt-1 gap-1.5">
                      <Text className="text-[11px] font-jakarta-medium text-[#707971]">RKP9102MN</Text>
                      <View className="flex-row items-center gap-1 bg-[#006c4e]/10 px-1.5 py-0.5 rounded">
                        <Feather name="shield" size={10} color="#006c4e" />
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e]">Verified</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-jakarta-bold text-[#006c4e] text-sm">+KES 4,200</Text>
                  <Text className="text-[10px] text-[#707971] font-jakarta-medium mt-1">13:05</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} className="bg-white p-4 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden">
                    <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBZh_BWu0AY_qlfqx3VzO0hS_0op9XPcdXCNNPq9ckbNZFTzJJH-sQTPazRb61dlhsWeXMNNBmwCxc6Hl3Bekcp_AS5Kt7qRflkjtzb-ZlRTxBpELG8k0WW5Z6JObIwC0TtdWm1vJSQ-574LU6G8zTIyrjxUTuqwP-eYtyv6NVyGdazVFPinspiYKuDUn24A4HOiuoTQsHGGXErv5Rqk9YgrI3cvzPrujcnhq0Rbz1M7MjFFHU_3Sa4gEjQlorJPCf3pUuVTHBozE' }} className="w-full h-full" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-sm">Emmanuel Korir</Text>
                    <View className="flex-row items-center mt-1 gap-1.5">
                      <Text className="text-[11px] font-jakarta-medium text-[#707971]">LBT5521XP</Text>
                      <View className="flex-row items-center gap-1 bg-[#006c4e]/10 px-1.5 py-0.5 rounded">
                        <Feather name="shield" size={10} color="#006c4e" />
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e]">Verified</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-jakarta-bold text-[#006c4e] text-sm">+KES 850</Text>
                  <Text className="text-[10px] text-[#707971] font-jakarta-medium mt-1">11:48</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
