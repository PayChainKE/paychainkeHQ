import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Collections() {
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0B4D2E', '#1D9E75']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full pt-8 pb-6 px-6 z-40 rounded-b-[32px]"
      >
        <View className="w-full max-w-lg mx-auto flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3 gap-3">
            <View className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhK7YduPHU9dGzfjcz09QTf6DlHfeeh5cRnFqZViYjsow6zWLu23unhSmjIB9TqI8ql6TdZ48pP-FXV79LBv_QMg1248JJdJZhHZociysxaBGiR9ml2HFqvAKmaZJ30euHI85aUw3-zhgSBTR1PbcxwwcCRCBDE9BtSA31soB3_uE-0ETTCuTtILHt80oT39Lu0Kwd5JIjFPgwi3oHakX_htxixmpOHex914DSfg1IpdPjZjAwmgRY6Kesrn99s3HdfjFlHbB9RZY' }}
                className="w-full h-full"
              />
            </View>
            <View>
              <Text className="text-white text-[24px] font-jakarta-bold tracking-tight leading-tight">Collections</Text>
              <Text className="text-white/70 text-[13px] font-jakarta-medium tracking-wide">Till PC847291</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-5">
            <TouchableOpacity activeOpacity={0.8}>
              <Feather name="search" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}>
              <Feather name="sliders" size={22} color="white" />
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
            <View className="bg-white p-5 rounded-[24px] shadow-sm w-44 mr-4">
              <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-[0.1em] mb-1.5">Today</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[26px] text-[#006c4e]">KES 18,450</Text>
              <View className="flex-row items-center mt-3 gap-1.5">
                <Feather name="credit-card" size={14} color="#68dbae" />
                <Text className="text-[12px] font-jakarta-semibold text-[#404942]">12 payments</Text>
              </View>
            </View>

            <View className="bg-[#f4f3f0] p-5 rounded-[24px] w-44 mr-4">
              <Text className="text-[11px] font-jakarta-bold text-[#707971] uppercase tracking-[0.1em] mb-1.5">This Week</Text>
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[26px] text-[#404942]">KES 142.2k</Text>
              <View className="flex-row items-center mt-3 gap-1.5">
                <Feather name="trending-up" size={14} color="#707971" />
                <Text className="text-[12px] font-jakarta-semibold text-[#707971]">84 payments</Text>
              </View>
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-8 mr-2">
            <TouchableOpacity className="px-6 py-2.5 rounded-full bg-[#00351d] shadow-md shadow-[#00351d]/10 mr-2">
              <Text className="text-white text-[13px] font-jakarta-bold">All</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-6 py-2.5 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-[13px] font-jakarta-semibold">Today</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-6 py-2.5 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-[13px] font-jakarta-semibold">Inbound</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-6 py-2.5 rounded-full bg-[#e9e8e5] mr-2">
              <Text className="text-[#404942] text-[13px] font-jakarta-semibold">Outbound</Text>
            </TouchableOpacity>
          </ScrollView>

          <View className="px-2">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-[0.15em] text-[#707971]">Today — KES 18,450</Text>
              <Text className="text-[11px] font-jakarta-medium text-[#707971]">12 Total</Text>
            </View>

            <View className="space-y-4 gap-4">
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowReceipt(true)} className="bg-white p-4 rounded-[20px] flex-row items-center justify-between shadow-sm shadow-black/5">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#006c4e]/10 items-center justify-center overflow-hidden">
                    <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBG5CaKePfWPmBF5zxCzCUMgQXnrJPMOR32D5Ec2geLcUSysY-1VPnw54Iy52rc8c-jC549DEHDtSKLJ-XOkTxdjC11Mae5BgiSU3RA4DdyuI5fskPb7m1mls-yy0wbGYKjNKcFNSO7SEp6nQlnQmEZhgyxFAFH5CifI2OqIkXasN6Brb0zY3RUTEqmncP1RnnUEuuXr8LE4HUk7SPC0IK5RlqMcpDGU7_Q_WLO8UcAv3Q8EVySYxXq-jYqc_mANxHj8iD_DBH_Tng' }} className="w-full h-full" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-[15px]">Peter Otieno</Text>
                    <View className="flex-row items-center mt-1 gap-1.5">
                      <Text className="text-[11px] font-jakarta-medium text-[#707971]">QJX8472KL</Text>
                      <View className="flex-row items-center gap-1 bg-[#e7f8ef] px-1.5 py-0.5 rounded-sm">
                        <Feather name="shield" size={10} color="#006c4e" />
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e]">Verified</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-jakarta-bold text-[#006c4e] text-[15px]">+KES 1,500</Text>
                  <Text className="text-[11px] text-[#707971] font-jakarta-medium mt-1">14:22</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowReceipt(true)} className="bg-white p-4 rounded-[20px] flex-row items-center justify-between shadow-sm shadow-black/5">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden">
                    <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6N8VwNbg3kIrAt3Vu7TDGvVho_8EpGPzNmCd4iujIRRELVqivQM36jxfTLrK5yff--a-tw2eJcIYpYBeHkCUeK5QBe1-5DK8RNA5_EY4K4UY7ENEx0MRd2TaxO63OKOBRlci08T8xyh8VyuAFAqkG9SttYOSxjm17v5xs1zk68_VBr8aM66YSgPu39fcXnQ-w0GuDrlanv4k7BwsxLU06eUQEXB7GUz4MSXCgtVyI1SxP0RuLH-HiKnCf8VZgao3akxJE3BEu0Uc' }} className="w-full h-full" />
                  </View>
                  <View>
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-[15px]">Sarah Wanjiku</Text>
                    <View className="flex-row items-center mt-1 gap-1.5">
                      <Text className="text-[11px] font-jakarta-medium text-[#707971]">RKP9102MN</Text>
                      <View className="flex-row items-center gap-1 bg-[#e7f8ef] px-1.5 py-0.5 rounded-sm">
                        <Feather name="shield" size={10} color="#006c4e" />
                        <Text className="text-[10px] font-jakarta-bold text-[#006c4e]">Verified</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-jakarta-bold text-[#006c4e] text-[15px]">+KES 4,200</Text>
                  <Text className="text-[11px] text-[#707971] font-jakarta-medium mt-1">13:05</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Payment Verified Modal */}
      <Modal visible={showReceipt} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setShowReceipt(false)} />
          
          <View className="w-full max-w-lg mx-auto bg-white rounded-t-[40px] px-6 pt-4 pb-10 items-center mt-auto shadow-2xl">
            <View className="w-12 h-1.5 bg-[#e9e8e5] rounded-full mb-8" />
            
            <View className="w-16 h-16 rounded-full bg-[#e7f8ef] items-center justify-center mb-6">
              <MaterialIcons name="verified" size={32} color="#006c4e" />
            </View>
            
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-3xl text-[#1b1c1a] mb-2">Payment Verified</Text>
            <Text className="text-[15px] font-jakarta-medium text-[#707971] mb-8">Transaction settled successfully</Text>
            
            <View className="w-full bg-[#faf9f6] rounded-[32px] p-6 mb-8">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Amount</Text>
                <Text className="text-[17px] font-jakarta-bold text-[#1b1c1a]">KES 1,500.00</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Phone</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]">+254 701 *** 821</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Reference</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]">QJX8472KL</Text>
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.1em] text-[#707971]">Till Number</Text>
                <Text className="text-[15px] font-jakarta-semibold text-[#1b1c1a]">PC847291</Text>
              </View>
              
              <View className="w-full h-[1px] bg-[#e9e8e5] mb-5" />
              
              <View className="flex-row items-center gap-3">
                <Feather name="zap" size={18} color="#006c4e" />
                <View>
                  <Text className="font-jakarta-bold text-[#1b1c1a] text-[13px] mb-0.5">Verified via Safaricom Daraja API</Text>
                  <Text className="text-[#707971] text-[11px] font-jakarta-medium">Response latency: 94ms</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              className="w-full bg-[#00351d] h-[60px] rounded-full flex-row items-center justify-center shadow-lg shadow-[#00351d]/20"
              onPress={() => setShowReceipt(false)}
            >
              <Text className="text-white font-jakarta-bold text-[17px]">Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
