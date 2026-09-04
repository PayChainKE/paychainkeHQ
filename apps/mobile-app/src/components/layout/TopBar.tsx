import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

type TopBarProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  // Shows the merchant's avatar chip in place of the text title — used on
  // the Profile/More screen itself, where the TopBar's own avatar button
  // (bottom right) is already suppressed since you're already there, so a
  // plain "Profile" label was the only thing left in that slot.
  titleAvatar?: boolean;
};

export default function TopBar({ title, subtitle, showBack = true, onBack, titleAvatar = false }: TopBarProps) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { merchant } = useAuth();

  const initials = merchant?.businessName
    ? merchant.businessName.substring(0, 2).toUpperCase()
    : '??';

  const isNotifications = route.name === 'Notifications';
  const isMore = route.name === 'More';

  return (
    <View className="w-full bg-white/95 pt-4 pb-4 px-6 border-b border-[#eff4ef] shadow-sm shadow-[#00351d]/5 z-50">
      <View className="w-full max-w-lg mx-auto flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 pr-3">
          {showBack && (
            <TouchableOpacity
              onPress={onBack || (() => navigation.goBack())}
              className="w-9 h-9 rounded-full bg-[#f7faf7] items-center justify-center border border-[#eff4ef]"
            >
              <Feather name="arrow-left" size={18} color="#00351d" />
            </TouchableOpacity>
          )}
          <View className="flex-1 flex-row items-center gap-3">
            {titleAvatar && (
              <View className="w-9 h-9 rounded-full bg-[#00351d] items-center justify-center">
                <Text className="text-white text-[12px] font-jakarta-bold">{initials}</Text>
              </View>
            )}
            <View className="flex-1">
              {!titleAvatar && (
                <Text numberOfLines={1} className="font-jakarta-bold text-[17px] text-[#0c2010] tracking-tight">
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text numberOfLines={1} className="text-[11px] font-jakarta-medium text-[#707971] mt-0.5">
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {!isNotifications && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              className="w-9 h-9 rounded-full bg-[#f7faf7] items-center justify-center border border-[#eff4ef]"
            >
              <Feather name="bell" size={16} color="#00351d" />
            </TouchableOpacity>
          )}
          {!isMore && (
            <TouchableOpacity
              onPress={() => navigation.navigate('More')}
              className="w-9 h-9 rounded-full bg-[#00351d] items-center justify-center"
            >
              <Text className="text-white text-[11px] font-jakarta-bold">{initials}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
