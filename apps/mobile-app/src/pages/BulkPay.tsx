import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BulkPay() {
  const [activeTab, setActiveTab] = useState('Payees');

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="w-full bg-[#faf9f6] pt-4 pb-2 z-40">
        <View className="w-full max-w-lg mx-auto px-6">
          <View className="flex-row justify-between items-center w-full">
            <View className="flex-row items-center gap-4">
              <Feather name="menu" size={24} color="#00351d" />
              <Text className="font-jakarta-bold tracking-tight text-[22px] text-[#00351d]">Bulk Payments</Text>
            </View>
            <View className="w-10 h-10 rounded-full bg-[#efeeeb] overflow-hidden border border-[#c0c9c0]/20">
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDT_TCBfPtbFc1Ud_JlyySnGTrR6kWG4-FDxCWiud06FawPuJIGnGkGmFpQiQfR3lb4Wi9mE6XnhhaL3Dlwh8Y6XBt8wkMwJJP1z-EfqRCMbk_rJk74-7A6SljJJjLjeZyUwMyLmSW1yTtYEAbNev34tE6B4_D_tuVYONSncBjLFNgASjHsvddu0uTJZHFxfGQT7dUKXNcX3q2wAS76NSeVOFIkAEtxpaYG56urTH9ozzJhftQjnhmUeUos3-Hoy7Eb9XcGxiH1hwg' }}
                className="w-full h-full"
              />
            </View>
          </View>

          <View className="flex-row gap-8 mt-8 border-b border-[#c0c9c0]/30">
            <TouchableOpacity onPress={() => setActiveTab('Payees')} className={`pb-3 ${activeTab === 'Payees' ? 'border-b-[3px] border-[#00351d]' : ''}`}>
              <Text className={`font-jakarta-bold text-[15px] ${activeTab === 'Payees' ? 'text-[#00351d]' : 'text-[#707971]'}`}>Payees</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('Batches')} className={`pb-3 ${activeTab === 'Batches' ? 'border-b-[3px] border-[#00351d]' : ''}`}>
              <Text className={`font-jakarta-bold text-[15px] ${activeTab === 'Batches' ? 'text-[#00351d]' : 'text-[#707971]'}`}>Batches</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: activeTab === 'Payees' ? 80 : 120 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'Payees' ? (
          <View className="w-full max-w-lg mx-auto pt-6 flex-1">
            <View className="px-6 mb-8 flex-row justify-between items-end">
              <View>
                <Text className="text-[10px] font-jakarta-bold text-[#006c4e] uppercase tracking-[0.2em] mb-1">Operations</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#00351d] text-[32px] tracking-tight leading-tight">Manage Payees</Text>
              </View>
              <TouchableOpacity className="bg-[#00351d] px-4 py-2.5 rounded-lg flex-row items-center gap-1.5 shadow-sm shadow-[#00351d]/20">
                <Feather name="plus" size={16} color="white" />
                <Text className="text-white font-jakarta-bold text-[13px]">Add Payee</Text>
              </TouchableOpacity>
            </View>

            <View className="px-6">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 mb-8 overflow-visible">
                <TouchableOpacity className="bg-[#00351d] px-6 py-2.5 rounded-full shadow-md shadow-[#00351d]/20 mr-2">
                  <Text className="text-white font-jakarta-bold text-[13px]">All</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-[#efeeeb] px-5 py-2.5 rounded-full mr-2">
                  <Text className="text-[#404942] font-jakarta-bold text-[13px]">Employees</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-[#efeeeb] px-5 py-2.5 rounded-full mr-2">
                  <Text className="text-[#404942] font-jakarta-bold text-[13px]">Suppliers</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-[#efeeeb] px-5 py-2.5 rounded-full mr-4">
                  <Text className="text-[#404942] font-jakarta-bold text-[13px]">Utilities</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View className="px-6 space-y-4 mb-8">
              <TouchableOpacity activeOpacity={0.8} className="bg-white p-5 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10 mb-4">
                <View className="flex-row items-center gap-4">
                  <View className="relative">
                    <View className="w-[52px] h-[52px] rounded-full bg-[#b1f1c6] items-center justify-center">
                      <Text className="text-[#00351d] font-jakarta-extrabold text-[15px]">AM</Text>
                    </View>
                    <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#05c46b] border-2 border-white items-center justify-center">
                      <MaterialIcons name="person" size={10} color="white" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-[16px] font-jakarta-bold text-[#1b1c1a] tracking-tight">Alice Mumbua</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">Last paid: </Text>
                      <Text className="text-[#1b1c1a] text-[13px] font-jakarta-bold">KES 45,000</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                    <Text className="text-[#006c4e] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Employee</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#707971" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} className="bg-white p-5 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10 mb-4">
                <View className="flex-row items-center gap-4">
                  <View className="relative">
                    <View className="w-[52px] h-[52px] rounded-full bg-[#e9e8e5] items-center justify-center">
                      <Text className="text-[#1b1c1a] font-jakarta-extrabold text-[15px]">BK</Text>
                    </View>
                    <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#05c46b] border-2 border-white items-center justify-center">
                      <MaterialIcons name="local-shipping" size={10} color="white" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-[16px] font-jakarta-bold text-[#1b1c1a] tracking-tight">Brian Kimani</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">Last paid: </Text>
                      <Text className="text-[#1b1c1a] text-[13px] font-jakarta-bold">KES 122,500</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="bg-[#efeeeb] px-3 py-1.5 rounded-full">
                    <Text className="text-[#404942] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Supplier</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#707971" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} className="bg-white p-5 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10 mb-4">
                <View className="flex-row items-center gap-4">
                  <View className="relative">
                    <View className="w-[52px] h-[52px] rounded-full bg-[#e7f8ef] items-center justify-center">
                      <Text className="text-[#006c4e] font-jakarta-extrabold text-[15px]">JO</Text>
                    </View>
                    <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#05c46b] border-2 border-white items-center justify-center">
                      <MaterialIcons name="person" size={10} color="white" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-[16px] font-jakarta-bold text-[#1b1c1a] tracking-tight">Jane Otieno</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">Last paid: </Text>
                      <Text className="text-[#1b1c1a] text-[13px] font-jakarta-bold">KES 45,000</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                    <Text className="text-[#006c4e] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Employee</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#707971" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} className="bg-white p-5 rounded-[32px] flex-row items-center justify-between shadow-sm border border-[#c0c9c0]/10 mb-6">
                <View className="flex-row items-center gap-4">
                  <View className="relative">
                    <View className="w-[52px] h-[52px] rounded-full bg-[#fee2e2] items-center justify-center">
                      <Text className="text-[#b91c1c] font-jakarta-extrabold text-[15px]">KP</Text>
                    </View>
                    <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#707971] border-2 border-white items-center justify-center">
                      <MaterialIcons name="bolt" size={11} color="white" />
                    </View>
                  </View>
                  <View>
                    <Text className="text-[16px] font-jakarta-bold text-[#1b1c1a] tracking-tight">Kenya Power</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">Last paid: </Text>
                      <Text className="text-[#1b1c1a] text-[13px] font-jakarta-bold">KES 12,400</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="bg-[#efeeeb] px-3 py-1.5 rounded-full">
                    <Text className="text-[#404942] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Utility</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#707971" />
                </View>
              </TouchableOpacity>
            </View>

            <View className="bg-[#b1f1c6] pt-10 px-8 pb-32 rounded-t-[40px] relative overflow-hidden">
              <View className="relative z-10">
                <Text className="text-[#00351d] font-jakarta-extrabold text-[11px] tracking-[0.2em] uppercase mb-5">Growth Insight</Text>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#00351d] text-[30px] leading-tight max-w-[280px]">
                  Your bulk payments have saved 14 hours of manual processing this month.
                </Text>
              </View>
              <View className="absolute -right-8 top-12 opacity-30">
                <MaterialIcons name="trending-up" size={180} color="#006c4e" />
              </View>
            </View>
          </View>
        ) : (
          <View className="w-full max-w-lg mx-auto px-6 py-6">
            <View className="bg-[#b1f1c6] rounded-[40px] px-8 py-8 mb-10 overflow-hidden relative">
              <View className="flex-row justify-between items-start">
                <View className="flex-col max-w-[140px]">
                  <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[#00351d] text-[24px] leading-tight mb-3 tracking-tight">Active Batch Volume</Text>
                  <Text className="text-[#00351d] font-jakarta-bold text-[11px] tracking-[0.1em] uppercase opacity-70 leading-relaxed">COLLECT. PAY. GROW.</Text>
                </View>
                <View className="flex-row gap-6">
                  <View className="items-end">
                    <Text className="text-[10px] text-[#00351d] font-jakarta-bold uppercase tracking-wider opacity-70 mb-1 text-right">Total{'\n'}Pending</Text>
                    <Text className="text-[18px] font-jakarta-bold text-[#1b1c1a] tracking-tight mt-1">KES</Text>
                    <Text className="text-[24px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight -mt-1">412,000</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-[#00351d] font-jakarta-bold uppercase tracking-wider opacity-70 mb-1 text-right">Scheduled</Text>
                    <Text className="text-[28px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight mt-3">03</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="space-y-8">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-[18px] font-jakarta-bold text-[#1b1c1a] tracking-tight">Recent Activity</Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[#006c4e] font-jakarta-bold text-[13px]">Filter by Status</Text>
                  <MaterialIcons name="filter-list" size={18} color="#006c4e" />
                </View>
              </View>

              <View className="relative pl-6">
                <View className="absolute left-[7px] top-6 bottom-16 w-[1px] bg-[#c0c9c0]/50" />

                <View className="relative mb-6">
                  <View className="absolute -left-[24.5px] top-6 w-[13px] h-[13px] rounded-full bg-[#006c4e] z-10" />
                  <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-[32px] p-6 shadow-sm border border-[#c0c9c0]/10 ml-4">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center gap-3">
                        <Text className="text-[18px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight">March Payroll</Text>
                        <View className="px-3 py-1 bg-[#e7f8ef] rounded-full">
                          <Text className="text-[#006c4e] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Completed</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center gap-2 mb-6">
                      <Feather name="calendar" size={14} color="#707971" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">14 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">12 recipients</Text>
                    </View>

                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.1em] mb-1.5">Total Disbursed</Text>
                        <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] tracking-tight">KES 184,250</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color="#c0c9c0" />
                    </View>
                  </TouchableOpacity>
                </View>

                <View className="relative mb-6">
                  <View className="absolute -left-[24.5px] top-6 w-[13px] h-[13px] rounded-full bg-[#f59e0b] z-10" />
                  <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-[32px] p-6 shadow-sm border border-[#c0c9c0]/10 ml-4">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center gap-3">
                        <Text className="text-[18px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight">Fruit Suppliers</Text>
                        <View className="px-3 py-1 bg-[#fffbeb] rounded-full">
                          <Text className="text-[#b45309] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Scheduled</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center gap-2 mb-6">
                      <Feather name="clock" size={14} color="#707971" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">18 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">08 recipients</Text>
                    </View>

                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.1em] mb-1.5">Estimated Total</Text>
                        <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] tracking-tight">KES 52,400</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color="#c0c9c0" />
                    </View>
                  </TouchableOpacity>
                </View>

                <View className="relative mb-2">
                  <View className="absolute -left-[24.5px] top-6 w-[13px] h-[13px] rounded-full bg-[#006c4e] z-10" />
                  <TouchableOpacity activeOpacity={0.8} className="bg-white rounded-[32px] p-6 shadow-sm border border-[#c0c9c0]/10 ml-4">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center gap-3">
                        <Text className="text-[18px] font-jakarta-extrabold text-[#1b1c1a] tracking-tight">Rent & Utilities</Text>
                        <View className="px-3 py-1 bg-[#e7f8ef] rounded-full">
                          <Text className="text-[#006c4e] text-[9px] font-jakarta-bold uppercase tracking-[0.1em]">Completed</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center gap-2 mb-6">
                      <Feather name="calendar" size={14} color="#707971" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">01 Mar 2026</Text>
                      <View className="w-1 h-1 rounded-full bg-[#c0c9c0] mx-1" />
                      <Text className="text-[#707971] text-[13px] font-jakarta-medium">04 recipients</Text>
                    </View>

                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.1em] mb-1.5">Total Disbursed</Text>
                        <Text className="text-[22px] font-jakarta-extrabold text-[#00351d] tracking-tight">KES 120,000</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color="#c0c9c0" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.9} className="mt-8 bg-[#00351d] rounded-[40px] p-8 relative overflow-hidden shadow-lg shadow-[#00351d]/20 mb-8">
              <View className="relative z-10">
                <Text className="text-white text-[28px] font-jakarta-bold mb-3 tracking-tight">Create New Batch</Text>
                <Text className="text-[#b1f1c6]/70 text-[15px] max-w-[260px] font-jakarta-medium leading-relaxed">Streamline your payouts by grouping multiple payees into a single ledger.</Text>
                <View className="mt-8 flex-row items-center self-start gap-2.5 bg-[#05c46b] px-6 py-3.5 rounded-full shadow-lg shadow-[#05c46b]/30">
                  <Feather name="plus-circle" size={18} color="white" />
                  <Text className="text-white font-jakarta-bold text-[15px]">Start New Disbursal</Text>
                </View>
              </View>
              <View className="absolute -right-6 -bottom-6 opacity-20">
                <MaterialIcons name="payments" size={160} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {activeTab === 'Payees' && (
        <View className="absolute bottom-6 left-6 right-6 z-50">
          <TouchableOpacity activeOpacity={0.9} className="bg-[#002110] rounded-full px-7 py-4 flex-row items-center justify-between shadow-xl shadow-black/40">
            <View>
              <Text className="text-[#b1f1c6] font-jakarta-bold text-[10px] uppercase tracking-[0.2em] mb-1">3 Payees Selected</Text>
              <Text className="text-white font-jakarta-bold text-[22px] tracking-tight">KES 135,000</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-white font-jakarta-bold text-[17px]">Pay Now</Text>
              <Feather name="arrow-right" size={20} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
