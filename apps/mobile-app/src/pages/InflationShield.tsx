import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InflationShield({ navigation }: any) {
  const [kesAmount, setKesAmount] = useState('10,000');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full bg-[#f4f3f0] z-50 pt-2 pb-4">
        <View className="w-full max-w-lg mx-auto px-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 rounded-full hover:bg-black/5">
              <Feather name="arrow-left" size={24} color="#00351d" />
            </TouchableOpacity>
            <Text className="font-jakarta-bold tracking-tight text-[22px] text-[#00351d]">Inflation Shield</Text>
          </View>
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] tracking-tight">PayChain</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          <View className="space-y-1 mb-8">
            <Text className="text-[#006c4e] font-jakarta-bold tracking-[0.2em] text-[10px] uppercase mb-1">Protect Your Wealth</Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[44px] text-[#00351d] leading-tight tracking-tight">Collect. Pay. Grow.</Text>
          </View>

          <View className="flex-row gap-4 mb-10">
            <View className="flex-1 bg-[#094d2e] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#094d2e]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="account-balance-wallet" size={100} color="white" />
              </View>
              <Text className="text-[#96d4ab] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">KES Balance</Text>
              <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight leading-tight">KES{'\n'}184,250</Text>
            </View>
            <View className="flex-1 bg-[#354641] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#354641]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="shield" size={100} color="white" />
              </View>
              <Text className="text-[#a0b4ad] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">USDC Vault</Text>
              <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight leading-tight">312.50{'\n'}USDC</Text>
            </View>
          </View>

          <View className="space-y-4 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-jakarta-extrabold text-[22px] text-[#00351d] leading-tight tracking-tight">KES <Feather name="arrow-right" size={20} color="#00351d" />{'\n'}USDC</Text>
              <View className="flex-row items-center gap-2 bg-[#e9e8e5] px-4 py-2.5 rounded-full max-w-[170px]">
                <View className="w-2 h-2 rounded-full bg-[#006c4e] self-start mt-1" />
                <Text className="text-[11px] font-jakarta-bold text-[#404942] leading-tight">1 USDC = KES 130.00 • 0.5%{'\n'}fee</Text>
              </View>
            </View>

            <View className="relative z-10">
              <View className="bg-white p-6 rounded-[32px] shadow-sm mb-[2px] border border-[#c0c9c0]/20">
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-[0.1em]">You Send</Text>
                  <TouchableOpacity>
                    <Text className="text-[#006c4e] text-[11px] font-jakarta-bold tracking-[0.1em]">MAX</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Text className="font-jakarta-extrabold text-[18px] text-[#1b1c1a]">K</Text>
                    </View>
                    <Text className="text-[20px] font-jakarta-extrabold text-[#1b1c1a]">KES</Text>
                  </View>
                  <TextInput 
                    className="text-right text-[36px] font-jakarta-extrabold text-[#00351d] flex-1 ml-4 tracking-tight"
                    value={kesAmount}
                    onChangeText={setKesAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View className="absolute left-[50%] -ml-7 top-[50%] -mt-7 z-20">
                <TouchableOpacity activeOpacity={0.8} className="bg-[#004d2e] w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-[#004d2e]/30 border-4 border-[#faf9f6]">
                  <MaterialIcons name="swap-vert" size={28} color="white" />
                </TouchableOpacity>
              </View>

              <View className="bg-[#f4f3f0] p-6 rounded-[32px] border border-[#c0c9c0]/20">
                <View className="flex-row justify-between items-center mb-5 mt-2">
                  <Text className="text-[#404942] text-[11px] font-jakarta-bold uppercase tracking-[0.1em]">You Receive</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-full bg-[#2775ca] flex items-center justify-center shadow-md shadow-[#2775ca]/20">
                      <MaterialIcons name="attach-money" size={24} color="white" />
                    </View>
                    <Text className="text-[20px] font-jakarta-extrabold text-[#1b1c1a]">USDC</Text>
                  </View>
                  <Text className="text-[36px] font-jakarta-extrabold text-[#006c4e] tracking-tight">76.92</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="bg-[#e7f8ef] p-6 rounded-[32px] space-y-4 mb-10 border border-[#006c4e]/5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Amount to swap</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">KES 10,000</Text>
            </View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Transaction Fee (0.5%)</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">KES 50.00</Text>
            </View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Applied Rate</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">130.00 KES/USDC</Text>
            </View>
            <View className="h-[1px] bg-[#006c4e]/10 mb-4" />
            <View className="flex-row justify-between items-center">
              <Text className="text-[#006c4e] font-jakarta-bold text-[15px]">You will receive</Text>
              <Text className="text-[#1b1c1a] text-[20px] font-jakarta-extrabold tracking-tight">76.54 USDC</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.9} className="w-full bg-[#002110] rounded-full px-6 py-5 flex-row items-center justify-between shadow-xl shadow-[#002110]/20 mb-10">
            <Text className="text-white font-jakarta-bold text-[16px] tracking-wide">Swap KES 10,000 for 76.54 USDC</Text>
            <Feather name="arrow-right" size={22} color="white" />
          </TouchableOpacity>

          <View className="pt-2 border-t border-[#c0c9c0]/30 mb-8">
            <TouchableOpacity 
              className="flex-row items-center justify-between py-4"
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.8}
            >
              <Text className="font-jakarta-bold text-[#1b1c1a] text-[18px]">Recent Swaps</Text>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#1b1c1a" />
            </TouchableOpacity>

            {isExpanded && (
              <View className="mt-4 space-y-6 gap-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-[46px] h-[46px] rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Feather name="trending-up" size={20} color="#006c4e" />
                    </View>
                    <View>
                      <Text className="text-[15px] font-jakarta-bold text-[#1b1c1a]">Swapped KES for USDC</Text>
                      <Text className="text-[12px] text-[#707971] mt-0.5 font-jakarta-medium">Oct 24, 2026 • 2:14 PM</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-[15px] font-jakarta-bold text-[#006c4e]">+450.00 USDC</Text>
                    <Text className="text-[12px] text-[#707971] mt-0.5">-KES 58,500</Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-[46px] h-[46px] rounded-full bg-[#efeeeb] flex items-center justify-center">
                      <Feather name="trending-up" size={20} color="#006c4e" />
                    </View>
                    <View>
                      <Text className="text-[15px] font-jakarta-bold text-[#1b1c1a]">Swapped KES for USDC</Text>
                      <Text className="text-[12px] text-[#707971] mt-0.5 font-jakarta-medium">Oct 18, 2026 • 10:45 AM</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-[15px] font-jakarta-bold text-[#006c4e]">+120.00 USDC</Text>
                    <Text className="text-[12px] text-[#707971] mt-0.5">-KES 15,600</Text>
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
