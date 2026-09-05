import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';

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
  advance: { icon: 'trending-up', color: '#1d9e75', bg: '#dcf5da' },
  security: { icon: 'shield', color: '#ba1a1a', bg: '#fff1f1' },
  wallet: { icon: 'account-balance-wallet', color: '#00351d', bg: '#f0fdf4' },
  system: { icon: 'info-outline', color: '#5b645c', bg: '#f7faf7' },
};

const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  if (isToday(date)) return time;
  return `${date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} · ${time}`;
};

type FilterTab = 'all' | 'unread';

export default function Notifications({ navigation }: any) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
      setLoadError(true);
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

  const deleteNotificationItem = (id: string) => {
    Alert.alert('Delete Notification', 'Remove this notification? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = notifications;
          setNotifications((cur) => cur.filter((n) => n._id !== id));
          try {
            await api.delete(`/api/notifications/${id}`);
          } catch (err) {
            console.error('Failed to delete notification', err);
            setNotifications(prev);
            Alert.alert('Failed', 'Could not delete this notification. Please try again.');
          }
        },
      },
    ]);
  };

  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const groups: Array<{ label: 'Today' | 'Earlier'; items: NotificationItem[] }> = [
    { label: 'Today', items: visible.filter((n) => isToday(new Date(n.createdAt))) },
    { label: 'Earlier', items: visible.filter((n) => !isToday(new Date(n.createdAt))) },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
      />
      <View className="w-full max-w-lg mx-auto px-6 pt-3 flex-row items-center justify-between">
        <View className="flex-row gap-2">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'unread' as const, label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full border ${filter === tab.key ? 'bg-[#00351d] border-[#00351d]' : 'bg-white border-[#eff4ef]'}`}
            >
              <Text className={`text-[10px] font-jakarta-extrabold uppercase tracking-wider ${filter === tab.key ? 'text-white' : 'text-[#5b645c]'}`}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.8}>
            <Text className="text-[#006c4e] text-[11px] font-jakarta-bold uppercase tracking-widest">Mark all read</Text>
          </TouchableOpacity>
        )}
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
          ) : loadError ? (
            <View className="items-center justify-center py-24">
              <View className="w-16 h-16 rounded-full bg-white border border-[#eff4ef] items-center justify-center mb-4">
                <Feather name="wifi-off" size={24} color="#ba1a1a" />
              </View>
              <Text className="text-[14px] text-[#0c2010] font-jakarta-extrabold mb-1">Couldn't load notifications</Text>
              <Text className="text-[12px] text-[#5b645c] font-jakarta-bold mb-4 text-center max-w-[240px]">Check your connection and try again.</Text>
              <TouchableOpacity onPress={fetchNotifications} className="bg-[#00351d] px-5 py-2.5 rounded-full">
                <Text className="text-white text-[11px] font-jakarta-extrabold uppercase tracking-widest">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View className="items-center justify-center py-24">
              <View className="w-16 h-16 rounded-full bg-white border border-[#eff4ef] items-center justify-center mb-4">
                <Feather name="bell-off" size={24} color="#b3b9b4" />
              </View>
              <Text className="text-[14px] text-[#5b645c] font-jakarta-bold">
                {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </Text>
            </View>
          ) : (
            groups.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <View key={group.label} className="mb-8">
                  <Text className="text-[10px] font-jakarta-bold text-[#5b645c] uppercase tracking-[0.2em] mb-3">{group.label}</Text>
                  <View className="bg-white rounded-[28px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 overflow-hidden">
                    {group.items.map((item, index) => {
                      const meta = KIND_META[item.kind] || KIND_META.system;
                      return (
                        <TouchableOpacity
                          key={item._id}
                          activeOpacity={0.8}
                          onPress={() => !item.read && markRead(item._id)}
                          className={`flex-row items-start gap-3 p-5 ${index !== group.items.length - 1 ? 'border-b border-[#eff4ef]' : ''}`}
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
                            <Text className="text-[12.5px] text-[#5b645c] font-jakarta-bold leading-relaxed mb-1.5">
                              {item.message}
                            </Text>
                            <View className="flex-row items-center justify-between">
                              <Text className="text-[10.5px] text-[#b3b9b4] font-jakarta-bold uppercase tracking-wider">
                                {formatTimestamp(item.createdAt)}
                              </Text>
                              <TouchableOpacity onPress={() => deleteNotificationItem(item._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Feather name="trash-2" size={13} color="#b3b9b4" />
                              </TouchableOpacity>
                            </View>
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
