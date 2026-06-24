import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import MyTillsTab from '../components/tabs/MyTillsTab';
import SupportTab from '../components/tabs/SupportTab';
import SettingsTab from '../components/tabs/SettingsTab';
import SecurityTab from '../components/tabs/SecurityTab';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('M Tills');

  const tabs = ['M Tills', 'Help & Support', 'Settings', 'Security'];

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      {/* Premium Header */}
      <View className="bg-white rounded-b-[32px] shadow-sm shadow-[#00351d]/5 pb-4 z-50">
        <View className="w-full max-w-lg mx-auto px-6 mb-6 pt-4 flex-row justify-between items-center">
          <View className="flex-row items-center gap-4">
            <LinearGradient
              colors={['#006c4e', '#00351d']}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-[#006c4e]/30"
            >
              <Text className="text-white text-[14px] font-jakarta-extrabold tracking-widest">JK</Text>
            </LinearGradient>
            <View>
              <Text className="text-[#707971] text-[11px] font-jakarta-bold uppercase tracking-widest mb-0.5">Workspace</Text>
              <Text className="font-jakarta-extrabold tracking-tight text-[#00351d] text-[22px]">Dashboard</Text>
            </View>
          </View>
          <TouchableOpacity className="w-12 h-12 rounded-full bg-[#f4f3f0] items-center justify-center border border-[#efeeeb]">
            <View className="absolute top-3 right-3.5 w-2 h-2 rounded-full bg-[#ba1a1a] border-2 border-[#f4f3f0] z-10" />
            <Feather name="bell" size={22} color="#00351d" />
          </TouchableOpacity>
        </View>

        {/* Premium Pill Tab Switcher */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="w-full"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity 
                key={tab} 
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <View className={`px-5 py-3 rounded-full flex-row items-center gap-2 border ${isActive ? 'bg-[#00351d] border-[#00351d] shadow-md shadow-[#00351d]/20' : 'bg-[#faf9f6] border-[#efeeeb]'}`}>
                  <Text className={`font-jakarta-bold text-[13px] tracking-wide ${isActive ? 'text-white' : 'text-[#707971]'}`}>
                    {tab}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Area */}
      <View className="flex-1 mt-4">
        {activeTab === 'M Tills' && <MyTillsTab />}
        {activeTab === 'Help & Support' && <SupportTab />}
        {activeTab === 'Settings' && <SettingsTab />}
        {activeTab === 'Security' && <SecurityTab />}
      </View>
    </SafeAreaView>
  );
}
