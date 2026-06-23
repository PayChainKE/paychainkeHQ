import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InflationShield({ navigation }: any) {
  const [kesAmount, setKesAmount] = useState('10,000');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full bg-[#efeeeb]/80 z-50">
        <View className="w-full max-w-lg mx-auto px-6 py-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full hover:bg-black/5">
              <Feather name="arrow-left" size={24} color="#00351d" />
            </TouchableOpacity>
            <Text className="font-jakarta-bold tracking-tight text-xl text-[#00351d]">Inflation Shield</Text>
          </View>
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-xl text-[#00351d]">PayChain</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-8 pb-12">
          <View className="space-y-1 mb-8">
            <Text className="text-[#006c4e] font-jakarta-bold tracking-[0.2em] text-[10px] uppercase">Protect Your Wealth</Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-4xl text-[#00351d]">Collect. Pay. Grow.</Text>
          </View>

          <View className="flex-row gap-4 mb-8">
            <View className="flex-1 bg-[#0b4d2e] p-6 rounded-2xl relative overflow-hidden">
              <View className="absolute -right-4 -top-4 opacity-10">
                <MaterialIcons name="account-balance-wallet" size={80} color="white" />
              </View>
              <Text className="text-[#96d4ab] text-xs font-jakarta-bold uppercase tracking-wider mb-2">KES Balance</Text>
              <Text className="text-white text-2xl font-jakarta-extrabold tracking-tight">KES 184,250</Text>
            </View>
            <View className="flex-1 bg-[#354641] p-6 rounded-2xl relative overflow-hidden">
              <View className="absolute -right-4 -top-4 opacity-10">
                <MaterialIcons name="shield" size={80} color="white" />
              </View>
              <Text className="text-[#a0b4ad] text-xs font-jakarta-bold uppercase tracking-wider mb-2">USDC Vault</Text>
              <Text className="text-white text-2xl font-jakarta-extrabold tracking-tight">312.50 USDC</Text>
            </View>
          </View>

          <View className="space-y-4 mb-8">
            <View className="flex-row items-center justify-between px-2 mb-4">
              <Text className="font-jakarta-bold text-lg text-[#00351d]">KES → USDC</Text>
              <View className="flex-row items-center gap-2 bg-[#e9e8e5] px-3 py-1.5 rounded-full">
                <View className="w-2 h-2 rounded-full bg-[#006c4e]" />
                <Text className="text-[11px] font-jakarta-bold text-[#404942]">1 USDC = KES 130.00 • 0.5% fee</Text>
              </View>
            </View>

            <View className="relative z-10">
              <View className="bg-white p-6 rounded-t-2xl shadow-sm mb-[2px]">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-[#404942] text-xs font-jakarta-bold uppercase tracking-widest">You Send</Text>
                  <TouchableOpacity>
                    <Text className="text-[#006c4e] text-xs font-jakarta-bold">MAX</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Text className="font-jakarta-bold text-[#00351d]">K</Text>
                    </View>
                    <Text className="text-xl font-jakarta-extrabold text-[#00351d]">KES</Text>
                  </View>
                  <TextInput 
                    className="text-right text-3xl font-jakarta-extrabold text-[#00351d] flex-1 ml-4"
                    value={kesAmount}
                    onChangeText={setKesAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View className="absolute left-[50%] -ml-6 top-[50%] -mt-6 z-20">
                <TouchableOpacity activeOpacity={0.8} className="bg-[#006c4e] w-12 h-12 rounded-full flex items-center justify-center shadow-xl border-4 border-[#faf9f6]">
                  <MaterialIcons name="swap-vert" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <View className="bg-[#efeeeb] p-6 rounded-b-2xl">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-[#404942] text-xs font-jakarta-bold uppercase tracking-widest">You Receive</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-[#2775ca] flex items-center justify-center shadow-lg">
                      <MaterialIcons name="monetization-on" size={20} color="white" />
                    </View>
                    <Text className="text-xl font-jakarta-extrabold text-[#00351d]">USDC</Text>
                  </View>
                  <Text className="text-3xl font-jakarta-extrabold text-[#006c4e]">76.92</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="bg-[#b1f1c6]/30 p-6 rounded-2xl space-y-4 mb-8 gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-[#115132] font-jakarta-medium text-sm">Amount to swap</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-sm">KES 10,000</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-[#115132] font-jakarta-medium text-sm">Transaction Fee (0.5%)</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-sm">KES 50.00</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-[#115132] font-jakarta-medium text-sm">Applied Rate</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-sm">130.00 KES/USDC</Text>
            </View>
            <View className="h-[1px] bg-[#115132]/10 my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-[#115132] font-jakarta-bold">You will receive</Text>
              <Text className="text-[#00351d] text-xl font-jakarta-extrabold">76.54 USDC</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.8} className="w-full h-[52px] bg-[#00351d] rounded-xl flex-row items-center justify-center gap-2 shadow-lg mb-8">
            <Text className="text-white font-jakarta-bold text-sm tracking-wide">Swap KES 10,000 for 76.54 USDC</Text>
            <Feather name="arrow-right" size={18} color="white" />
          </TouchableOpacity>

          <View className="pt-4 border-t border-[#c0c9c0]/20 mb-8">
            <TouchableOpacity 
              className="flex-row items-center justify-between py-2"
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.8}
            >
              <Text className="font-jakarta-bold text-[#00351d] text-lg">Recent Swaps</Text>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#00351d" />
            </TouchableOpacity>

            {isExpanded && (
              <View className="mt-6 space-y-6 gap-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Feather name="trending-up" size={18} color="#006c4e" />
                    </View>
                    <View>
                      <Text className="text-sm font-jakarta-bold text-[#00351d]">Swapped KES for USDC</Text>
                      <Text className="text-xs text-[#404942] mt-0.5 font-jakarta-medium">Oct 24, 2026 • 2:14 PM</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-jakarta-bold text-[#00351d]">+450.00 USDC</Text>
                    <Text className="text-xs text-[#ba1a1a] mt-0.5">-KES 58,500</Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Feather name="trending-up" size={18} color="#006c4e" />
                    </View>
                    <View>
                      <Text className="text-sm font-jakarta-bold text-[#00351d]">Swapped KES for USDC</Text>
                      <Text className="text-xs text-[#404942] mt-0.5 font-jakarta-medium">Oct 18, 2026 • 10:45 AM</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-jakarta-bold text-[#00351d]">+120.00 USDC</Text>
                    <Text className="text-xs text-[#ba1a1a] mt-0.5">-KES 15,600</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
