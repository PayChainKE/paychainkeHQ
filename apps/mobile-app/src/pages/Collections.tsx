import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const mockTransactions = [
  {
    id: '1',
    name: 'Peter Otieno',
    ref: 'QJX8472KL',
    verified: true,
    amount: '+KES 1,500',
    time: '14:22',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBG5CaKePfWPmBF5zxCzCUMgQXnrJPMOR32D5Ec2geLcUSysY-1VPnw54Iy52rc8c-jC549DEHDtSKLJ-XOkTxdjC11Mae5BgiSU3RA4DdyuI5fskPb7m1mls-yy0wbGYKjNKcFNSO7SEp6nQlnQmEZhgyxFAFH5CifI2OqIkXasN6Brb0zY3RUTEqmncP1RnnUEuuXr8LE4HUk7SPC0IK5RlqMcpDGU7_Q_WLO8UcAv3Q8EVySYxXq-jYqc_mANxHj8iD_DBH_Tng',
    color: '#006c4e'
  },
  {
    id: '2',
    name: 'Sarah Wanjiku',
    ref: 'RKP9102MN',
    verified: true,
    amount: '+KES 4,200',
    time: '13:05',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6N8VwNbg3kIrAt3Vu7TDGvVho_8EpGPzNmCd4iujIRRELVqivQM36jxfTLrK5yff--a-tw2eJcIYpYBeHkCUeK5QBe1-5DK8RNA5_EY4K4UY7ENEx0MRd2TaxO63OKOBRlci08T8xyh8VyuAFAqkG9SttYOSxjm17v5xs1zk68_VBr8aM66YSgPu39fcXnQ-w0GuDrlanv4k7BwsxLU06eUQEXB7GUz4MSXCgtVyI1SxP0RuLH-HiKnCf8VZgao3akxJE3BEu0Uc',
    color: '#1b1c1a'
  },
  {
    id: '3',
    name: 'Michael Kamau',
    ref: 'VBN2034ZX',
    verified: false,
    amount: '+KES 8,500',
    time: '11:45',
    image: '',
    initials: 'MK',
    color: '#475569'
  },
  {
    id: '4',
    name: 'Joy Njeri',
    ref: 'YTC9911PQ',
    verified: true,
    amount: '+KES 650',
    time: '09:12',
    image: '',
    initials: 'JN',
    color: '#f59e0b'
  },
  {
    id: '5',
    name: 'David Omondi',
    ref: 'PLO4421WW',
    verified: true,
    amount: '+KES 12,000',
    time: '08:05',
    image: '',
    initials: 'DO',
    color: '#2563eb'
  }
];

export default function Collections() {
  const [showReceipt, setShowReceipt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = mockTransactions.filter(tx => 
    tx.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tx.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.includes(searchQuery)
  );

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0B4D2E', '#1D9E75']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="w-full pt-[40px] pb-[16px] px-6 z-40 rounded-b-[24px] shadow-sm shadow-[#0b4d2e]/10"
      >
        <View className="w-full max-w-lg mx-auto flex-row items-center justify-between mb-2">
          <View className="flex-row items-center space-x-3 gap-3">
            <TouchableOpacity 
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30 ml-3"
            >
              <Text className="text-white font-jakarta-bold text-sm">JK</Text>
            </TouchableOpacity>
            <View>
              <Text className="text-white text-[20px] font-jakarta-bold tracking-tight leading-tight">Collections</Text>
              <Text className="text-white/70 text-[12px] font-jakarta-medium tracking-wide">Till PC847291</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        className="flex-1 z-10 mt-6"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-lg mx-auto px-4">
          {/* Summary Cards */}
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

          {/* Search and Filter Row */}
          <View className="flex-row items-center gap-3 mb-6 px-1">
            <View className="flex-1 flex-row items-center bg-white rounded-full px-4 py-3 shadow-sm border border-[#c0c9c0]/20">
              <Feather name="search" size={18} color="#707971" />
              <TextInput 
                className="flex-1 ml-2 text-[#1b1c1a] font-jakarta-medium text-[14px]"
                placeholder="Search transactions..."
                placeholderTextColor="#a1a1aa"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={18} color="#707971" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm border border-[#c0c9c0]/20">
              <Feather name="sliders" size={18} color="#00351d" />
            </TouchableOpacity>
          </View>

          {/* Pill Filters */}
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
              <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-[0.15em] text-[#707971]">
                {searchQuery ? `Search Results (${filteredTransactions.length})` : 'Today — KES 18,450'}
              </Text>
              {!searchQuery && <Text className="text-[11px] font-jakarta-medium text-[#707971]">12 Total</Text>}
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#c0c9c0]/10 mb-6">
              {filteredTransactions.length > 0 ? filteredTransactions.map((tx, index) => (
                <TouchableOpacity 
                  key={tx.id} 
                  activeOpacity={0.8} 
                  onPress={() => setShowReceipt(true)} 
                  className={`flex-row items-center justify-between py-3 px-4 ${
                    index !== filteredTransactions.length - 1 ? 'border-b border-[#efeeeb]/50' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: `${tx.color}15` }}>
                      {tx.image ? (
                        <Image source={{ uri: tx.image }} className="w-full h-full" />
                      ) : (
                        <Text style={{ color: tx.color }} className="font-jakarta-bold text-[11px]">{tx.initials}</Text>
                      )}
                    </View>
                    <View>
                      <View className="flex-row items-center gap-1">
                        <Text className="font-jakarta-bold text-[14px] text-[#1b1c1a]">{tx.name}</Text>
                        {tx.verified && <MaterialIcons name="verified" size={12} color="#006c4e" />}
                      </View>
                      <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5">{tx.time} • {tx.ref}</Text>
                    </View>
                  </View>
                  <Text className="font-jakarta-bold text-[#006c4e] text-[13px]">{tx.amount}</Text>
                </TouchableOpacity>
              )) : (
                <View className="items-center justify-center py-10">
                  <Text className="text-[#707971] font-jakarta-medium mt-4">No transactions found</Text>
                </View>
              )}
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
