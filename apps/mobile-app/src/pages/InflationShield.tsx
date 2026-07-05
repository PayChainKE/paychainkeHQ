import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

function MoveMoneyCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="rounded-[30px] overflow-hidden bg-white border border-[#c0c9c0]/30 shadow-sm shadow-[#00351d]/5">
      <View className="p-5 flex-row items-center gap-4">
        <View style={{ backgroundColor: accent + '18' }} className="w-14 h-14 rounded-[22px] items-center justify-center">
          <MaterialIcons name={icon} size={26} color={accent} />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-[17px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight mb-1">{title}</Text>
          <Text className="text-[12px] font-jakarta-medium text-[#707971] leading-relaxed">{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#b3b9b4" />
      </View>
    </TouchableOpacity>
  );
}

export default function InflationShield({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full bg-[#f4f3f0] z-50 pt-2 pb-4 border-b border-[#efeeeb]">
        <View className="w-full max-w-lg mx-auto px-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 rounded-full">
              <Feather name="arrow-left" size={24} color="#00351d" />
            </TouchableOpacity>
            <View>
              <Text className="text-[#707971] text-[10px] font-jakarta-bold uppercase tracking-[0.2em] mb-0.5">Money Hub</Text>
              <Text className="font-jakarta-bold tracking-tight text-[22px] text-[#00351d]">Move Money</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] tracking-tight">PayChain</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          <View className="space-y-1 mb-8">
            <Text className="text-[#006c4e] font-jakarta-bold tracking-[0.2em] text-[10px] uppercase mb-1">Premium actions</Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-4xl text-[#00351d] leading-tight tracking-tight">Send, add, request.</Text>
          </View>

          <View className="flex-row gap-4 mb-10">
            <View className="flex-1 bg-[#094d2e] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#094d2e]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="account-balance-wallet" size={100} color="white" />
              </View>
              <Text className="text-[#96d4ab] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">KES Balance</Text>
              <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight leading-tight">KES{'
'}184,250</Text>
            </View>
            <View className="flex-1 bg-[#1e293b] p-6 rounded-[32px] relative overflow-hidden shadow-lg shadow-[#1e293b]/20">
              <View className="absolute -right-6 -top-6 opacity-10">
                <MaterialIcons name="verified-user" size={100} color="white" />
              </View>
              <Text className="text-[#94a3b8] text-[10px] font-jakarta-bold uppercase tracking-[0.1em] mb-3">Move Money</Text>
              <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight leading-tight">Secure{'
'}Hub</Text>
            </View>
          </View>

          <View className="gap-4 mb-10">
            <MoveMoneyCard title="Send Money" subtitle="Transfer to staff, suppliers, or other wallets." icon="north-east" accent="#006c4e" onPress={() => navigation?.navigate('Pay')} />
            <MoveMoneyCard title="Add Money" subtitle="Top up your balance and keep funds ready." icon="add-circle-outline" accent="#1d4ed8" onPress={() => navigation?.navigate('Collections')} />
            <MoveMoneyCard title="Request Money" subtitle="Ask a customer or partner to pay you now." icon="request-page" accent="#b45309" onPress={() => navigation?.navigate('Collections')} />
          </View>

          <View className="bg-[#e7f8ef] p-6 rounded-[32px] space-y-4 mb-10 border border-[#006c4e]/5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Transfer confidence</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">Verified workflow</Text>
            </View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Security</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">Biometric ready</Text>
            </View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#006c4e] font-jakarta-medium text-[13px]">Experience</Text>
              <Text className="text-[#00351d] font-jakarta-bold text-[14px]">Premium merchant flow</Text>
            </View>
            <View className="h-[1px] bg-[#006c4e]/10 mb-4" />
            <View className="flex-row justify-between items-center">
              <Text className="text-[#006c4e] font-jakarta-bold text-[15px]">Available options</Text>
              <Text className="text-[#1b1c1a] text-[20px] font-jakarta-extrabold tracking-tight">3 actions</Text>
            </View>
          </View>

          <View className="pt-2 border-t border-[#c0c9c0]/30 mb-8">
            <Text className="font-jakarta-bold text-[#1b1c1a] text-[18px] mb-4">Recent Moves</Text>
            <View className="mt-2 space-y-6 gap-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-[46px] h-[46px] rounded-full bg-[#efeeeb] flex items-center justify-center">
                    <Feather name="send" size={20} color="#006c4e" />
                  </View>
                  <View>
                    <Text className="text-[15px] font-jakarta-bold text-[#1b1c1a]">Sent money to supplier</Text>
                    <Text className="text-[12px] text-[#707971] mt-0.5 font-jakarta-medium">Today • 2:14 PM</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[15px] font-jakarta-bold text-[#006c4e]">-KES 58,500</Text>
                  <Text className="text-[12px] text-[#707971] mt-0.5">Completed</Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-[46px] h-[46px] rounded-full bg-[#efeeeb] flex items-center justify-center">
                    <Feather name="download" size={20} color="#1d4ed8" />
                  </View>
                  <View>
                    <Text className="text-[15px] font-jakarta-bold text-[#1b1c1a]">Added funds to balance</Text>
                    <Text className="text-[12px] text-[#707971] mt-0.5 font-jakarta-medium">Yesterday • 10:45 AM</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[15px] font-jakarta-bold text-[#1d4ed8]">+KES 15,600</Text>
                  <Text className="text-[12px] text-[#707971] mt-0.5">Completed</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
