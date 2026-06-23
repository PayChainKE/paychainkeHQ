import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import api from '../api/config';

const ITEMS_PER_PAGE = 20;

export default function Transactions({ navigation }: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await api.get('/api/transactions');
        if (res.data.success) {
          setTransactions(res.data.transactions || []);
        }
      } catch (error) {
        console.error("Error fetching transactions", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTransactions = transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
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
            {isLoading ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator color="#0B4D2E" size="large" />
              </View>
            ) : currentTransactions.length === 0 ? (
              <View className="py-20 items-center justify-center">
                <Text className="text-[#707971] font-jakarta-medium">No transactions found</Text>
              </View>
            ) : currentTransactions.map((tx, index) => (
              <View 
                key={tx._id || index} 
                className={`flex-row items-center justify-between py-3 px-4 ${
                  index !== currentTransactions.length - 1 ? 'border-b border-[#efeeeb]/50' : ''
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-[#efeeeb] items-center justify-center overflow-hidden">
                    <Text className="text-[#404942] font-jakarta-bold text-[11px]">
                      {tx.senderName ? tx.senderName.substring(0, 2).toUpperCase() : 'TX'}
                    </Text>
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-jakarta-bold text-[14px] text-[#1b1c1a]">
                        {tx.senderName || 'Unknown'}
                      </Text>
                      {tx.status === 'COMPLETED' && <MaterialIcons name="verified" size={12} color="#006c4e" />}
                    </View>
                    <Text className="text-[#707971] text-[10px] font-jakarta-medium mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {tx.type}
                    </Text>
                  </View>
                </View>
                <Text className={`font-jakarta-bold text-[13px] ${tx.type === 'INBOUND' ? 'text-[#006c4e]' : 'text-[#1b1c1a]'}`}>
                  {tx.type === 'INBOUND' ? '+' : '-'} {formatCurrency(tx.amount)}
                </Text>
              </View>
            ))}
          </View>

          {/* Pagination Controls */}
          {!isLoading && transactions.length > 0 && (
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
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
