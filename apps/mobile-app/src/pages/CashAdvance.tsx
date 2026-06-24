import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/config';
import { useAuth } from '../context/AuthContext';

export default function CashAdvance({ navigation }: any) {
  const { merchant } = useAuth();
  const [trustData, setTrustData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const res = await api.get('/api/trust-score');
        setTrustData(res.data);
      } catch (err) {
        console.error('Failed to fetch trust score', err);
        setTrustData({ eligibleForAdvance: false, current: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    if (merchant) {
      fetchScore();
    } else {
      setIsLoading(false);
    }
  }, [merchant]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00351d" />
        </View>
      </SafeAreaView>
    );
  }

  const isEligible = trustData?.eligibleForAdvance || false;

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full z-50 bg-[#f4f3f0] pt-2 pb-4">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6">
          <View className="flex-row items-center gap-3">
            <View className="w-[42px] h-[42px] rounded-full bg-[#efeeeb] flex items-center justify-center overflow-hidden border border-[#c0c9c0]/20">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDT_TCBfPtbFc1Ud_JlyySnGTrR6kWG4-FDxCWiud06FawPuJIGnGkGmFpQiQfR3lb4Wi9mE6XnhhaL3Dlwh8Y6XBt8wkMwJJP1z-EfqRCMbk_rJk74-7A6SljJJjLjeZyUwMyLmSW1yTtYEAbNev34tE6B4_D_tuVYONSncBjLFNgASjHsvddu0uTJZHFxfGQT7dUKXNcX3q2wAS76NSeVOFIkAEtxpaYG56urTH9ozzJhftQjnhmUeUos3-Hoy7Eb9XcGxiH1hwg' }}
                className="w-full h-full"
              />
            </View>
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
                <Text className="text-[15px] text-[#404942] font-jakarta-medium leading-relaxed max-w-[220px]">Based on your Trust Score of {trustData?.current}</Text>
              </View>
            </View>

            <View className="bg-[#00351d] text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5 mb-10 text-center">
              <View className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl"></View>
              
              <View className="relative z-10 flex flex-col items-center">
                <View className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 mb-6">
                  <MaterialIcons name="verified" size={40} color="#b1f1c6" />
                </View>
                <Text className="font-jakarta-extrabold text-[28px] text-white tracking-tight mb-2">You are Eligible!</Text>
                <Text className="text-[14px] text-white/70 font-jakarta-medium text-center max-w-[280px] leading-relaxed mb-8">
                  You are eligible to apply for your first cash advance. Our lending team will be reaching out soon with your official credit limit.
                </Text>
                
                <TouchableOpacity className="w-full bg-[#b1f1c6] py-4 rounded-xl flex-row items-center justify-center shadow-lg shadow-[#b1f1c6]/20 active:opacity-80">
                  <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Request Credit Limit Review</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="bg-white rounded-[40px] p-8 shadow-sm mb-10 border border-[#c0c9c0]/10">
              <View className="flex-col gap-8 relative z-10">
                <View className="space-y-1">
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#006c4e]" />
                    <Text className="text-[11px] font-jakarta-bold uppercase tracking-[0.15em] text-[#006c4e]">Active Advance</Text>
                  </View>
                  <Text className="font-jakarta-bold text-[40px] text-[#00351d] tracking-tight leading-tight mb-1">KES 0</Text>
                  <Text className="text-[14px] text-[#404942] font-jakarta-medium">No active advance currently</Text>
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

            <View className="bg-white rounded-[40px] p-8 mb-6 border border-[#c0c9c0]/20 shadow-sm items-center text-center">
              <View className="w-16 h-16 bg-[#faf9f6] rounded-full flex items-center justify-center mb-6 border border-[#efeeeb]">
                <MaterialIcons name="lock" size={28} color="rgba(0,53,29,0.3)" />
              </View>
              <Text className="text-[20px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-2">Keep building your Trust Score</Text>
              <Text className="text-[14px] text-[#707971] font-jakarta-medium text-center leading-relaxed max-w-[260px] mb-6">
                You need a Trust Score of at least 85 to unlock Cash Advances. Keep processing payments!
              </Text>
              <TouchableOpacity className="bg-[#00351d] px-8 py-3.5 rounded-xl shadow-lg active:opacity-80">
                <Text className="text-white font-jakarta-bold text-[13px] uppercase tracking-widest">View Trust Score</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-4 mb-6">
              <View className="flex-1 bg-white p-7 rounded-[32px] shadow-sm border border-[#c0c9c0]/10">
                <Text className="text-[#404942] text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-4">Trust Score</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-[#00351d] text-[40px] font-jakarta-extrabold tracking-tight">{trustData?.current || 0}</Text>
                  <Text className="text-[#00c48c] font-jakarta-bold text-[13px] ml-1">/100</Text>
                </View>
              </View>
              <View className="flex-1 bg-white p-7 rounded-[32px] shadow-sm border border-[#c0c9c0]/10">
                <Text className="text-[#404942] text-[10px] font-jakarta-bold uppercase tracking-[0.15em] mb-4">Days Active</Text>
                <Text className="text-[#00351d] text-[40px] font-jakarta-extrabold tracking-tight">68</Text>
              </View>
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
