import React from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View className="flex-1 bg-background">
      {/* Top Navigation Bar */}
      <View 
        className="absolute top-0 w-full z-50 bg-[#faf9f6]/95 flex-row items-center justify-between px-6 pb-4"
        style={{ paddingTop: Math.max(insets.top, 16) }}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-surface-container overflow-hidden items-center justify-center">
            <Image 
              source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCFnan-NR1yuVY5p293TQLb5XbDeYiQgx_KmI1n4XLfwJX6tYO52OA2xDRtYFyHio5yio5lOxVNbAcrjhjeOtzFY1Tn72qgu0xb_k-6RuvEQPaR-NXM_ci4sDmI3pcbrnYxkAsdLn7ZBHeaCpyJ3hbQUi8cMO3hMMr14hLAhQnr6_FnARdGRylUDEXUgCidJtrP3PuZN46FZbQ9QQsbZOxymblMXzsGdhA3inZXMsHmdgkzrlxGwavKm-Fs_1j8Rd5Lk2D1RoUaEbc" }} 
              className="w-full h-full"
            />
          </View>
          <Text className="font-headline text-[#00351d] text-lg">Merchant Store</Text>
        </View>
        <TouchableOpacity className="p-2 rounded-full items-center justify-center">
          <MaterialIcons name="notifications" size={24} color="#00351d" />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View className="flex-1" style={{ paddingTop: insets.top + 60, paddingBottom: 100 }}>
        {children}
      </View>

      {/* Bottom Navigation Bar */}
      <View 
        className="absolute bottom-0 w-full z-50 bg-white/95 rounded-t-[40px] shadow-lg shadow-black/10"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-row justify-around items-end pt-4 px-4">
          <TouchableOpacity className="items-center p-3">
            <MaterialIcons name="home" size={24} color="#707971" className="mb-1" />
            <Text className="text-[11px] font-label text-[#707971] uppercase tracking-wider">Home</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center p-3">
            <MaterialIcons name="account-balance-wallet" size={24} color="#707971" className="mb-1" />
            <Text className="text-[11px] font-label text-[#707971] uppercase tracking-wider">Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center p-3">
            <MaterialIcons name="payments" size={24} color="#707971" className="mb-1" />
            <Text className="text-[11px] font-label text-[#707971] uppercase tracking-wider">Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center p-3">
            <MaterialIcons name="trending-up" size={24} color="#707971" className="mb-1" />
            <Text className="text-[11px] font-label text-[#707971] uppercase tracking-wider">Advance</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center bg-[#00351d] rounded-full p-3 mb-1 shadow-lg shadow-black/20">
            <MaterialIcons name="grid-view" size={24} color="white" />
            <Text className="text-[11px] font-label text-white uppercase tracking-wider mt-1">More</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
