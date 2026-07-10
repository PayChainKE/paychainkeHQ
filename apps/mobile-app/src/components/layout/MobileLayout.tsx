import React from 'react';
import { View } from 'react-native';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 bg-[#f0fdf4]">
      {children}
    </View>
  );
}
