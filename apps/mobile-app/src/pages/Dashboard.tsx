import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-lg mx-auto flex-1">
          {/* Header Area */}
          <LinearGradient
            colors={['#1D9E75', '#0B4D2E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="px-6 pt-6 pb-20 rounded-b-[40px] z-0"
          >
            <View className="flex-row justify-between items-center mb-8">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30">
                  <Text className="text-white font-jakarta-bold text-sm">JK</Text>
                </View>
                <View>
                  <Text className="text-white/80 text-[11px] font-jakarta-medium uppercase tracking-wider mb-0.5">Good morning 👋</Text>
                  <Text className="text-white text-lg font-jakarta-bold">Kamau General Store</Text>
                </View>
              </View>
              <TouchableOpacity className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                <MaterialIcons name="notifications" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View className="mb-2">
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1.5 }} className="text-[52px] text-white leading-none">
                KES 184,250
              </Text>
              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-[#83f5c6] font-jakarta-medium text-sm">+KES 18,450 today</Text>
                <View className="bg-white/20 px-3 py-1.5 rounded-full">
                  <Text className="text-white text-[10px] font-jakarta-bold uppercase tracking-widest">Till No: PC847291</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Action Buttons (overlapping) */}
          <View className="px-6 flex-row justify-between -mt-10 mb-8 z-10">
            <TouchableOpacity className="items-center" activeOpacity={0.8}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2">
                <View className="w-10 h-10 rounded-full bg-[#b1f1c6] items-center justify-center">
                  <Feather name="plus-circle" size={20} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2">
                <View className="w-10 h-10 rounded-full bg-[#efeeeb] items-center justify-center">
                  <MaterialIcons name="payments" size={20} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('InflationShield')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2">
                <View className="w-10 h-10 rounded-full bg-[#83f5c6] items-center justify-center">
                  <MaterialIcons name="swap-horiz" size={20} color="#00351d" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/10 items-center justify-center mb-2">
                <View className="w-10 h-10 rounded-full bg-[#e8eaf6] items-center justify-center">
                  <Feather name="trending-up" size={20} color="#3f51b5" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#1b1c1a] uppercase tracking-widest">Advance</Text>
            </TouchableOpacity>
          </View>

          {/* Growth Ribbon */}
          <View className="px-6 mb-8">
            <View className="bg-[#b1f1c6] rounded-[24px] p-5 flex-row items-center justify-between shadow-sm">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] mb-1">
                  Collect. Pay. Grow.
                </Text>
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">
                  Merchant Estate Status: Elite
                </Text>
              </View>
              <View className="w-8 h-8 rounded-full bg-[#83f5c6] items-center justify-center">
                <MaterialIcons name="verified-user" size={16} color="#00351d" />
              </View>
            </View>
          </View>

          {/* Digital Ledgers */}
          <View className="mb-8">
            <View className="px-6 flex-row items-center justify-between mb-4">
              <Text className="text-lg font-jakarta-bold text-[#1b1c1a]">Digital Ledgers</Text>
              <TouchableOpacity>
                <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-widest">View All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 overflow-visible" contentContainerStyle={{ paddingRight: 40 }}>
              <View className="bg-[#0b4d2e] w-[280px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#0b4d2e]/30">
                <View className="absolute -right-8 -top-8 opacity-10">
                  <MaterialIcons name="account-balance-wallet" size={140} color="white" />
                </View>
                <Text className="text-[#96d4ab] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">Operating Balance</Text>
                <Text className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">KES 184,250</Text>
                <View className="flex-row items-center gap-1.5 mt-4">
                  <Feather name="arrow-up" size={14} color="#96d4ab" />
                  <Text className="text-[#96d4ab] text-[13px] font-jakarta-medium">12.4% vs last month</Text>
                </View>
              </View>

              <View className="bg-[#1e293b] w-[200px] h-[160px] rounded-[32px] p-6 mr-4 relative overflow-hidden shadow-md shadow-[#1e293b]/30">
                <View className="absolute -right-4 -top-4 opacity-10">
                  <MaterialIcons name="shield" size={100} color="white" />
                </View>
                <Text className="text-[#94a3b8] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-2">USDC Vault</Text>
                <Text className="text-white text-3xl font-jakarta-extrabold tracking-tight mb-auto">312.50</Text>
                <View className="flex-row items-center gap-1.5 mt-4">
                  <Feather name="refresh-cw" size={14} color="#94a3b8" />
                  <Text className="text-[#94a3b8] text-[13px] font-jakarta-medium">≈ KES 40,625</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Today's Performance */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#c0c9c0]/10">
              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.15em] mb-6">Today's Performance</Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Revenue</Text>
                  <Text className="text-[#006c4e] text-[16px] font-jakarta-extrabold">KES 18,450</Text>
                </View>
                <View className="w-[1px] h-full bg-[#efeeeb]" />
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Payments</Text>
                  <Text className="text-[#1b1c1a] text-[16px] font-jakarta-extrabold">12</Text>
                </View>
                <View className="w-[1px] h-full bg-[#efeeeb]" />
                <View>
                  <Text className="text-[#1b1c1a] text-[10px] font-jakarta-bold uppercase tracking-wider mb-1">Avg Ticket</Text>
                  <Text className="text-[#1b1c1a] text-[16px] font-jakarta-extrabold">KES 1,537</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Recent Activity */}
          <View className="px-6 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-jakarta-bold text-[#1b1c1a]">Recent Activity</Text>
              <TouchableOpacity>
                <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-widest">See Records</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#c0c9c0]/10">
              <View className="flex-row items-center justify-between p-4 border-b border-[#efeeeb]/50">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#83f5c6] items-center justify-center">
                    <Text className="text-[#00351d] font-jakarta-bold text-sm">AM</Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-jakarta-bold text-[15px] text-[#1b1c1a]">Alice Mumbua</Text>
                      <MaterialIcons name="verified" size={14} color="#006c4e" />
                    </View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5">09:42 AM • M-Pesa</Text>
                  </View>
                </View>
                <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                  <Text className="text-[#006c4e] font-jakarta-bold text-sm">+KES 1,500</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between p-4 border-b border-[#efeeeb]/50">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center">
                    <Text className="text-[#404942] font-jakarta-bold text-sm">BK</Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-jakarta-bold text-[15px] text-[#1b1c1a]">Brian Kimani</Text>
                      <MaterialIcons name="verified" size={14} color="#006c4e" />
                    </View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5">09:15 AM • Bank Transfer</Text>
                  </View>
                </View>
                <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                  <Text className="text-[#006c4e] font-jakarta-bold text-sm">+KES 4,200</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-full bg-[#efeeeb] items-center justify-center">
                    <Text className="text-[#404942] font-jakarta-bold text-sm">JO</Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-jakarta-bold text-[15px] text-[#1b1c1a]">Jane Otieno</Text>
                      <MaterialIcons name="verified" size={14} color="#006c4e" />
                    </View>
                    <Text className="text-[#707971] text-[11px] font-jakarta-medium mt-0.5">08:50 AM • USDC Pay</Text>
                  </View>
                </View>
                <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                  <Text className="text-[#006c4e] font-jakarta-bold text-sm">+KES 850</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Available Cash Advance */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[40px] p-6 shadow-sm border-2 border-[#006c4e]">
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-[0.1em] mb-1">Available Cash Advance</Text>
                  <Text className="text-[#1b1c1a] text-3xl font-jakarta-bold tracking-tight">KES 150,000</Text>
                </View>
                <View className="w-14 h-14 rounded-full border-4 border-[#006c4e] items-center justify-center border-r-[#efeeeb] rotate-45">
                  <View className="-rotate-45 items-center justify-center">
                    <Text className="font-jakarta-bold text-[#1b1c1a] text-xs">74</Text>
                    <Text className="text-[7px] text-[#707971] font-jakarta-bold uppercase tracking-wider">Score</Text>
                  </View>
                </View>
              </View>

              <View className="h-3 w-full bg-[#efeeeb] rounded-full mb-6 overflow-hidden">
                <View className="h-full bg-[#006c4e] w-[45%] rounded-full" />
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <MaterialIcons name="check-circle" size={16} color="#006c4e" />
                  <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-wider">Cash Advance Eligible</Text>
                </View>
                <TouchableOpacity className="bg-[#002110] px-5 py-2.5 rounded-full">
                  <Text className="text-white text-[11px] font-jakarta-bold uppercase tracking-wider">Unlock Funds</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
