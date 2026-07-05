import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import api from '../api/config';

type NotificationKind = 'payment' | 'advance' | 'security' | 'wallet' | 'system';

type NotificationItem = {
  _id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const KIND_META: Record<NotificationKind, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
  payment: { icon: 'payments', color: '#006c4e', bg: '#e7f8ef' },
  advance: { icon: 'trending-up', color: '#3f51b5', bg: '#e8eaf6' },
  security: { icon: 'shield', color: '#ba1a1a', bg: '#fff1f1' },
  wallet: { icon: 'account-balance-wallet', color: '#1d4ed8', bg: '#eef2ff' },
  system: { icon: 'info-outline', color: '#707971', bg: '#f4f3f0' },
};

const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  if (isToday(date)) return time;
  return `${date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} · ${time}`;
};

export default function Notifications({ navigation }: any) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.patch('/api/notifications/read-all');
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  };

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const groups: Array<{ label: 'Today' | 'Earlier'; items: NotificationItem[] }> = [
    { label: 'Today', items: notifications.filter((n) => isToday(new Date(n.createdAt))) },
    { label: 'Earlier', items: notifications.filter((n) => !isToday(new Date(n.createdAt))) },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View
        className="w-full pt-[16px] pb-[20px] px-6 rounded-b-[24px] shadow-sm shadow-[#0b4d2e]/10"
        style={{ backgroundColor: '#0B4D2E' }}
      >
        <View className="w-full max-w-lg mx-auto flex-row items-center justify-between mb-1">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/25"
            >
              <Feather name="arrow-left" size={18} color="#ffffff" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-[20px] font-jakarta-bold tracking-tight leading-tight">Notifications</Text>
              <Text className="text-white/70 text-[12px] font-jakarta-medium tracking-wide">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </Text>
            </View>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.8}>
              <Text className="text-[#83f5c6] text-[11px] font-jakarta-bold uppercase tracking-widest">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#006c4e" colors={['#006c4e']} />}
      >
        <View className="w-full max-w-lg mx-auto px-6 pt-6">
          {isLoading ? (
            <View className="py-24 items-center justify-center">
              <ActivityIndicator color="#00351d" />
            </View>
          ) : notifications.length === 0 ? (
            <View className="items-center justify-center py-24">
              <View className="w-16 h-16 rounded-full bg-white border border-[#efeeeb] items-center justify-center mb-4">
                <Feather name="bell-off" size={24} color="#b3b9b4" />
              </View>
              <Text className="text-[14px] text-[#707971] font-jakarta-medium">No notifications yet</Text>
            </View>
          ) : (
            groups.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <View key={group.label} className="mb-8">
                  <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.2em] mb-3">{group.label}</Text>
                  <View className="bg-white rounded-[28px] border border-[#efeeeb] shadow-sm shadow-[#00351d]/5 overflow-hidden">
                    {group.items.map((item, index) => {
                      const meta = KIND_META[item.kind] || KIND_META.system;
                      return (
                        <TouchableOpacity
                          key={item._id}
                          activeOpacity={0.8}
                          onPress={() => !item.read && markRead(item._id)}
                          className={`flex-row items-start gap-3 p-5 ${index !== group.items.length - 1 ? 'border-b border-[#efeeeb]' : ''}`}
                        >
                          <View style={{ backgroundColor: meta.bg }} className="w-11 h-11 rounded-2xl items-center justify-center">
                            <MaterialIcons name={meta.icon} size={20} color={meta.color} />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                              <Text className="text-[14px] font-jakarta-extrabold text-[#00351d] tracking-tight flex-1 pr-2" numberOfLines={1}>
                                {item.title}
                              </Text>
                              {!item.read && <View className="w-2 h-2 rounded-full bg-[#006c4e]" />}
                            </View>
                            <Text className="text-[12.5px] text-[#707971] font-jakarta-medium leading-relaxed mb-1.5">
                              {item.message}
                            </Text>
                            <Text className="text-[10.5px] text-[#b3b9b4] font-jakarta-bold uppercase tracking-wider">
                              {formatTimestamp(item.createdAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
