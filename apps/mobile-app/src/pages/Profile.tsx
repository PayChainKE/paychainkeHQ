import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';

import MyTillsTab from '../components/tabs/MyTillsTab';
import SupportTab from '../components/tabs/SupportTab';
import SettingsTab from '../components/tabs/SettingsTab';
import SecurityTab from '../components/tabs/SecurityTab';

type SectionKey = 'my-tills' | 'support' | 'settings' | 'security' | 'swap' | 'payment-link' | 'statement' | 'business-profile';

const MENU_ITEMS: Array<{
  key: SectionKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { key: 'my-tills', label: 'My Tills', icon: 'point-of-sale' },
  { key: 'support', label: 'Help & Support', icon: 'help-outline' },
  { key: 'settings', label: 'Settings', icon: 'tune' },
  { key: 'security', label: 'Security', icon: 'security' },
  { key: 'swap', label: 'Swap', icon: 'swap-horiz' },
  { key: 'payment-link', label: 'Payment Link', icon: 'link' },
  { key: 'statement', label: 'Account Statement', icon: 'description' },
  { key: 'business-profile', label: 'Business Profile', icon: 'business' },
];

function MenuButton({
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="mb-1.5 items-center">
      <View className={`w-10 h-10 rounded-xl items-center justify-center ${active ? 'bg-[#00351d] shadow-md shadow-[#00351d]/25' : 'bg-[#f0fdf4]'}`}>
        <MaterialIcons name={icon} size={18} color={active ? '#ffffff' : '#00351d'} />
      </View>
    </TouchableOpacity>
  );
}

function PaymentLinkPanel() {
  const [amount, setAmount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/transactions/payment-link');
      if (res.data?.success) {
        setHistory(res.data.links || []);
      }
    } catch (err) {
      console.error('Failed to load payment link history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const generateLink = async () => {
    const value = Number(amount);
    if (!amount || isNaN(value) || value <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to generate a link.');
      return;
    }

    setIsGenerating(true);
    setCopied(false);
    try {
      const res = await api.post('/api/transactions/payment-link', { amount: value });
      if (res.data?.success) {
        setGeneratedLink(`https://paychain.co.ke/pay/${res.data.linkId}`);
        fetchHistory();
      }
    } catch (err: any) {
      Alert.alert('Generation Failed', err.response?.data?.error || 'Failed to generate secure payment link.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    setCopied(true);
  };

  const shareLink = async () => {
    if (!generatedLink) return;
    try {
      await Share.share({ message: `Please pay me KES ${amount} via PayChain: ${generatedLink}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  const copyHistoryLink = async (item: any) => {
    await Clipboard.setStringAsync(`https://paychain.co.ke/pay/${item.linkId}`);
    setCopiedLinkId(item.linkId);
    setTimeout(() => setCopiedLinkId((current) => (current === item.linkId ? null : current)), 1500);
  };

  const shareHistoryLink = async (item: any) => {
    try {
      await Share.share({
        message: `Please pay me KES ${item.amount.toLocaleString()} via PayChain: https://paychain.co.ke/pay/${item.linkId}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Active', color: '#006c4e', bg: '#e7f8ef' },
    paid: { label: 'Paid', color: '#1d4ed8', bg: '#eef2ff' },
    expired: { label: 'Expired', color: '#707971', bg: '#f7faf7' },
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Payment Link</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">Generate a secure, one-time link for a specific amount and share it with your customer.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-3">Amount to request</Text>
          <View className="flex-row items-center bg-[#f0fdf4] rounded-2xl border border-[#eff4ef] px-4">
            <Text className="text-[#707971] text-[13px] font-jakarta-bold mr-2">KES</Text>
            <ValidatedTextInput
              kind="amount"
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setGeneratedLink(null);
              }}
              placeholder="0.00"
              placeholderTextColor="#b3b9b4"
              containerClassName="flex-1"
              className="py-4 text-[18px] font-jakarta-extrabold text-[#00351d] tracking-tight"
              errorClassName="text-red-600 text-[11px] font-jakarta-medium mb-2"
            />
          </View>

          <TouchableOpacity
            onPress={generateLink}
            disabled={isGenerating || !amount}
            activeOpacity={0.85}
            className={`mt-4 py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20 ${isGenerating || !amount ? 'bg-[#bfc9bf]' : 'bg-[#00351d]'}`}
          >
            {isGenerating ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Generate Link</Text>
            )}
          </TouchableOpacity>
        </View>

        {generatedLink && (
          <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <MaterialIcons name="check-circle" size={16} color="#006c4e" />
              <Text className="text-[10px] text-[#006c4e] font-jakarta-bold uppercase tracking-[0.2em]">Link ready · expires in 24h</Text>
            </View>
            <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight" numberOfLines={1}>
              {generatedLink}
            </Text>

            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                onPress={copyLink}
                activeOpacity={0.85}
                className="flex-1 bg-[#f0fdf4] py-4 rounded-2xl items-center justify-center border border-[#eff4ef] flex-row gap-2"
              >
                <Feather name={copied ? 'check' : 'copy'} size={15} color="#00351d" />
                <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareLink}
                activeOpacity={0.85}
                className="flex-1 bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25 flex-row gap-2"
              >
                <Feather name="share-2" size={15} color="#ffffff" />
                <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-3">Link History</Text>

          {isLoadingHistory ? (
            <View className="bg-white rounded-[32px] border border-[#eff4ef] py-10 items-center justify-center">
              <ActivityIndicator color="#00351d" />
            </View>
          ) : history.length === 0 ? (
            <View className="bg-white rounded-[32px] border border-[#eff4ef] p-6 items-center">
              <Text className="text-[13px] text-[#707971] font-jakarta-medium text-center">No payment links yet. Generate one above to see it here.</Text>
            </View>
          ) : (
            <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 overflow-hidden">
              {history.map((item, index) => {
                const meta = statusMeta[item.status] || statusMeta.active;
                const created = new Date(item.createdAt);
                return (
                  <View
                    key={item.linkId}
                    className={`p-5 ${index !== history.length - 1 ? 'border-b border-[#eff4ef]' : ''}`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-[17px] font-jakarta-extrabold text-[#00351d] tracking-tight">
                        {item.currency} {item.amount.toLocaleString()}
                      </Text>
                      <View style={{ backgroundColor: meta.bg }} className="px-2.5 py-1 rounded-full">
                        <Text style={{ color: meta.color }} className="text-[9px] font-jakarta-bold uppercase tracking-widest">{meta.label}</Text>
                      </View>
                    </View>
                    <Text className="text-[11px] text-[#707971] font-jakarta-medium mb-3">
                      {created.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} · {created.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => copyHistoryLink(item)}
                        activeOpacity={0.85}
                        className="flex-1 bg-[#f0fdf4] py-2.5 rounded-xl items-center justify-center border border-[#eff4ef] flex-row gap-1.5"
                      >
                        <Feather name={copiedLinkId === item.linkId ? 'check' : 'copy'} size={13} color="#00351d" />
                        <Text className="text-[#00351d] font-jakarta-bold text-[11px] uppercase tracking-wider">{copiedLinkId === item.linkId ? 'Copied' : 'Copy'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => shareHistoryLink(item)}
                        activeOpacity={0.85}
                        className="flex-1 bg-[#f0fdf4] py-2.5 rounded-xl items-center justify-center border border-[#eff4ef] flex-row gap-1.5"
                      >
                        <Feather name="share-2" size={13} color="#00351d" />
                        <Text className="text-[#00351d] font-jakarta-bold text-[11px] uppercase tracking-wider">Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className="bg-[#f7faf7] rounded-[28px] border border-[#bfc9bf]/20 p-5 flex-row items-start gap-3">
          <MaterialIcons name="info-outline" size={18} color="#707971" />
          <Text className="flex-1 text-[12px] text-[#707971] font-jakarta-medium leading-relaxed">
            Each link is tied to the amount you enter and can only be paid once. Share it in invoices, WhatsApp, or on your website.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function SwapPanel({ navigation }: { navigation: any }) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Move Money</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">Send, add, or request funds from a premium money hub.</Text>
        </View>

        <View className="rounded-[36px] overflow-hidden bg-[#00351d] shadow-xl shadow-[#00351d]/20 mb-6">
          <LinearGradient colors={['#0b4d2e', '#00351d']} className="p-7">
            <Text className="text-white/70 text-[10px] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Premium transfer center</Text>
            <Text className="text-white text-[28px] font-jakarta-extrabold tracking-tight leading-tight mb-3">One place to move value</Text>
            <Text className="text-white/70 text-[13px] font-jakarta-medium leading-relaxed">Choose how you want to move money. Each path is designed for a faster merchant workflow.</Text>
          </LinearGradient>
        </View>

        <View className="gap-4">
          <ActionCard
            title="Send Money"
            subtitle="Pay suppliers, staff, or wallet recipients."
            icon="north-east"
            accent="#006c4e"
            onPress={() => navigation?.navigate('Pay')}
          />
          <ActionCard
            title="Add Money"
            subtitle="Top up your balance and keep funds ready."
            icon="add-circle-outline"
            accent="#1d4ed8"
            onPress={() => navigation?.navigate('Collections')}
          />
          <ActionCard
            title="Request Money"
            subtitle="Ask a customer or partner to pay you now."
            icon="request-page"
            accent="#b45309"
            onPress={() => navigation?.navigate('Collections')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="rounded-[30px] overflow-hidden bg-white border border-[#eff4ef] shadow-sm shadow-[#00351d]/5">
      <View className="p-5 flex-row items-center gap-4">
        <View style={{ backgroundColor: accent + '18' }} className="w-14 h-14 rounded-[22px] items-center justify-center">
          <MaterialIcons name={icon} size={26} color={accent} />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-[17px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-1">{title}</Text>
          <Text className="text-[12px] font-jakarta-medium text-[#707971] leading-relaxed">{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#b3b9b4" />
      </View>
    </TouchableOpacity>
  );
}

function AccountStatementPanel({ navigation, merchant }: { navigation: any; merchant: any }) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Account Statement</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">Review recent activity and open the statement export screen.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Statement summary</Text>
          <Text className="text-[18px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-2">{merchant?.businessName || 'Merchant'} account</Text>
          <Text className="text-[13px] text-[#707971] font-jakarta-medium leading-relaxed">Open Collections to download a PDF statement for today, the last 7 days, this month, or any custom range.</Text>
        </View>

        <View className="gap-3">
          <TouchableOpacity onPress={() => navigation?.navigate('Collections')} className="bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25">
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Open Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.navigate('Transactions')} className="bg-white py-4 rounded-2xl items-center justify-center border border-[#eff4ef] shadow-sm">
            <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">View Transactions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function BusinessProfilePanel({ merchant }: { merchant: any }) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Business Profile</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">Your registered business identity and key merchant details.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 gap-5">
          <ProfileRow label="Business Name" value={merchant?.businessName || 'N/A'} />
          <ProfileRow label="Email" value={merchant?.email || 'N/A'} />
          <ProfileRow label="Phone" value={merchant?.phone || 'N/A'} />
          <ProfileRow label="Till / Paybill" value={merchant?.paybillAccount || 'Pending'} />
          <ProfileRow label="KRA PIN" value={merchant?.kraPin || 'Not set'} />
          <ProfileRow label="Business Reg Number" value={merchant?.businessNumber || 'Not set'} />
        </View>
      </View>
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-1">{label}</Text>
        <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight leading-snug">{value}</Text>
      </View>
    </View>
  );
}

export default function Profile({ navigation }: any) {
  const { merchant, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>('my-tills');

  const digitalWalletEnabled = merchant?.features?.digitalWallet !== false;
  const visibleMenuItems = useMemo(
    () => MENU_ITEMS.filter((item) => digitalWalletEnabled || (item.key !== 'swap' && item.key !== 'payment-link')),
    [digitalWalletEnabled]
  );

  const activeItem = useMemo(
    () => visibleMenuItems.find((item) => item.key === activeSection) || visibleMenuItems[0],
    [activeSection, visibleMenuItems]
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'my-tills':
        return <MyTillsTab />;
      case 'support':
        return <SupportTab />;
      case 'settings':
        return <SettingsTab />;
      case 'security':
        return <SecurityTab />;
      case 'swap':
        return <SwapPanel navigation={navigation} />;
      case 'payment-link':
        return <PaymentLinkPanel />;
      case 'statement':
        return <AccountStatementPanel navigation={navigation} merchant={merchant} />;
      case 'business-profile':
        return <BusinessProfilePanel merchant={merchant} />;
      default:
        return <MyTillsTab />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Profile" showBack={false} />
      <View className="flex-1 flex-row bg-[#f0fdf4]">
        <View className="w-[80px] bg-white border-r border-[#eff4ef] shadow-sm shadow-[#00351d]/5">
          <View className="items-center pt-6 pb-5 border-b border-[#eff4ef]">
            <LinearGradient colors={['#006c4e', '#00351d']} className="w-10 h-10 rounded-2xl items-center justify-center shadow-lg shadow-[#006c4e]/20">
              <Text className="text-white font-jakarta-bold text-[11px]">
                {merchant?.businessName ? merchant.businessName.substring(0, 2).toUpperCase() : 'PC'}
              </Text>
            </LinearGradient>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 10, paddingTop: 12, paddingBottom: 24 }}>
            {visibleMenuItems.map((item) => (
              <MenuButton
                key={item.key}
                label={item.label}
                icon={item.icon}
                active={activeSection === item.key}
                onPress={() => setActiveSection(item.key)}
              />
            ))}

            <View className="h-px bg-[#eff4ef] my-2" />

            <TouchableOpacity onPress={logout} activeOpacity={0.8} className="items-center">
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-[#fff5f5]">
                <Feather name="log-out" size={16} color="#ba1a1a" />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View className="flex-1">
          <View className="px-5 pt-5 pb-3 border-b border-[#eff4ef] bg-[#f0fdf4]">
            <Text className="text-[#707971] text-[10px] font-jakarta-bold uppercase tracking-[0.2em] mb-1">Selected</Text>
            <Text className="font-jakarta-extrabold text-[22px] text-[#00351d] tracking-tight">{activeItem.label}</Text>
          </View>
          <View className="flex-1">
            {renderContent()}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
