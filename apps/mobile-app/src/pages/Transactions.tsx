import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';

// Mock generator for 45 transactions
const generateMockTransactions = () => {
  const types = ['M-Pesa', 'Bank Transfer', 'USDC Pay'];
  const names = ['Alice Mumbua', 'Brian Kimani', 'Jane Otieno', 'David Mutua', 'Sarah Wanjiku', 'John Doe', 'Mary Kamau', 'Peter Ochieng'];
  const transactions = [];
  
  for (let i = 0; i < 45; i++) {
    const isVerified = Math.random() > 0.5;
    const type = types[Math.floor(Math.random() * types.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const amount = Math.floor(Math.random() * 10000) + 100;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const hour = Math.floor(Math.random() * 12) + 1;
    const min = Math.floor(Math.random() * 60).toString().padStart(2, '0');
    const ampm = Math.random() > 0.5 ? 'AM' : 'PM';
    
    transactions.push({
      id: i.toString(),
      name,
      initials,
      type,
      amount: `+KES ${amount.toLocaleString()}`,
      time: `${hour}:${min} ${ampm}`,
      verified: isVerified,
    });
  }
  return transactions;
};

const allTransactions = generateMockTransactions();
const ITEMS_PER_PAGE = 20;

export default function Transactions({ navigation }: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTransactions = allTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row items-center border-b border-[#efeeeb]">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white rounded-full items-center justify-center border border-[#efeeeb] shadow-sm">
          <Feather name="arrow-left" size={20} color="#00351d" />
        </TouchableOpacity>
        <Text className="text-xl font-jakarta-bold text-[#1b1c1a] ml-4">All Transactions</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-6">
          
          {/* Table Container */}
          <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#c0c9c0]/10 mb-6">
            {currentTransactions.map((tx, index) => (
              <View 
                key={tx.id} 
                className={`flex-row items-center justify-between py-3 px-4 ${
                  index !== currentTransactions.length - 1 ? 'border-b border-[#efeeeb]/50' : ''
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-[#efeeeb] items-center justify-center">
                    <Text className="text-[#404942] font-jakarta-bold text-[11px]">{tx.initials}</Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-jakarta-bold text-[14px] text-[#1b1c1a]">{tx.name}</Text>
                      {tx.verified && <MaterialIcons name="verified" size={12} color="#006c4e" />}
                    </View>
                    <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5">{tx.time} • {tx.type}</Text>
                  </View>
                </View>
                <Text className="text-[#006c4e] font-jakarta-bold text-[13px]">{tx.amount}</Text>
              </View>
            ))}
          </View>

          {/* Pagination Controls */}
          <View className="flex-row items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-[#c0c9c0]/10">
            <TouchableOpacity 
              onPress={handlePrev}
              disabled={currentPage === 1}
              className={`flex-row items-center px-4 py-2 rounded-full ${currentPage === 1 ? 'opacity-50' : 'bg-[#e7f8ef]'}`}
            >
              <Feather name="chevron-left" size={16} color={currentPage === 1 ? "#a1a1aa" : "#006c4e"} />
              <Text className={`font-jakarta-bold text-xs ml-1 ${currentPage === 1 ? 'text-[#a1a1aa]' : 'text-[#006c4e]'}`}>Prev</Text>
            </TouchableOpacity>

            <Text className="text-[#707971] text-xs font-jakarta-bold uppercase tracking-widest">
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity 
              onPress={handleNext}
              disabled={currentPage === totalPages}
              className={`flex-row items-center px-4 py-2 rounded-full ${currentPage === totalPages ? 'opacity-50' : 'bg-[#e7f8ef]'}`}
            >
              <Text className={`font-jakarta-bold text-xs mr-1 ${currentPage === totalPages ? 'text-[#a1a1aa]' : 'text-[#006c4e]'}`}>Next</Text>
              <Feather name="chevron-right" size={16} color={currentPage === totalPages ? "#a1a1aa" : "#006c4e"} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
