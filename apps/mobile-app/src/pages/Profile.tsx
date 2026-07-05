import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

import MyTillsTab from '../components/tabs/MyTillsTab';
import SupportTab from '../components/tabs/SupportTab';
import SettingsTab from '../components/tabs/SettingsTab';
import SecurityTab from '../components/tabs/SecurityTab';

type SectionKey = 'my-tills' | 'support' | 'settings' | 'security' | 'swap' | 'payment-link' | 'statement' | 'business-profile';

const MENU_ITEMS: Array<{
  key: SectionKey;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { key: 'my-tills', label: 'My Tills', subtitle: 'Tills & linked accounts', icon: 'point-of-sale' },
  { key: 'support', label: 'Help & Support', subtitle: 'FAQ and concierge help', icon: 'help-outline' },
  { key: 'settings', label: 'Settings', subtitle: 'Profile and preferences', icon: 'tune' },
  { key: 'security', label: 'Security', subtitle: 'Passwords and PINs', icon: 'security' },
  { key: 'swap', label: 'Swap', subtitle: 'Move money and FX', icon: 'swap-horiz' },
  { key: 'payment-link', label: 'Payment Link', subtitle: 'Shareable payment link', icon: 'link' },
  { key: 'statement', label: 'Account Statement', subtitle: 'Transactions and exports', icon: 'description' },
  { key: 'business-profile', label: 'Business Profile', subtitle: 'Registered business details', icon: 'business' },
];

function MenuButton({
  label,
  subtitle,
  icon,
  active,
  onPress,
}: {
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="mb-3">
      <View className={`rounded-[22px] p-4 border ${active ? 'bg-[#00351d] border-[#00351d] shadow-md shadow-[#00351d]/20' : 'bg-white border-[#efeeeb] shadow-sm shadow-[#00351d]/5'}`}>
        <View className="flex-row items-center gap-3">
          <View className={`w-10 h-10 rounded-2xl items-center justify-center ${active ? 'bg-white/10' : 'bg-[#faf9f6]'}`}>
            <MaterialIcons name={icon} size={20} color={active ? '#ffffff' : '#00351d'} />
          </View>
          <View className="flex-1">
            <Text className={`font-jakarta-extrabold text-[13px] tracking-tight ${active ? 'text-white' : 'text-[#00351d]'}`}>{label}</Text>
            <Text className={`text-[10px] font-jakarta-medium mt-0.5 ${active ? 'text-white/65' : 'text-[#707971]'}`}>{subtitle}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PaymentLinkPanel({ merchant }: { merchant: any }) {
  const baseLink = merchant?.paybillAccount ? `https://paychain.co.ke/pay/${merchant.paybillAccount}` : 'https://paychain.co.ke/pay/your-link';

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Payment Link</Text>
          <Text className="text-[#707971] text-[14px] font-jakarta-medium leading-relaxed opacity-80">Share a simple link so customers can pay you faster.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#efeeeb] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Current link</Text>
          <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight break-all">{baseLink}</Text>
          <Text className="text-[13px] text-[#707971] font-jakarta-medium mt-3 leading-relaxed">Use this link in invoices, WhatsApp, or your website. The live activation flow can be connected later if needed.</Text>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => Alert.alert('Payment Link', 'Use the link shown above to share payment instructions.')}
            className="flex-1 bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25"
          >
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Payment Link', 'Share this link through your preferred channel.')}
            className="flex-1 bg-white py-4 rounded-2xl items-center justify-center border border-[#efeeeb] shadow-sm"
          >
            <Text className="text-[#00351d] font-jakarta-extrabold text-[12px] uppercase tracking-widest">Share</Text>
          </TouchableOpacity>
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="rounded-[30px] overflow-hidden bg-white border border-[#efeeeb] shadow-sm shadow-[#00351d]/5">
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

        <View className="bg-white rounded-[32px] border border-[#efeeeb] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#707971] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Statement summary</Text>
          <Text className="text-[18px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-2">{merchant?.businessName || 'Merchant'} account</Text>
          <Text className="text-[13px] text-[#707971] font-jakarta-medium leading-relaxed">Open Collections to download a PDF statement for today, the last 7 days, this month, or any custom range.</Text>
        </View>

        <View className="gap-3">
          <TouchableOpacity onPress={() => navigation?.navigate('Collections')} className="bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25">
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Open Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.navigate('Transactions')} className="bg-white py-4 rounded-2xl items-center justify-center border border-[#efeeeb] shadow-sm">
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

        <View className="bg-white rounded-[32px] border border-[#efeeeb] shadow-sm shadow-[#00351d]/5 p-6 gap-5">
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

  const activeItem = useMemo(() => MENU_ITEMS.find((item) => item.key === activeSection) || MENU_ITEMS[0], [activeSection]);

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
        return <PaymentLinkPanel merchant={merchant} />;
      case 'statement':
        return <AccountStatementPanel navigation={navigation} merchant={merchant} />;
      case 'business-profile':
        return <BusinessProfilePanel merchant={merchant} />;
      default:
        return <MyTillsTab />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      <View className="flex-1 flex-row bg-[#faf9f6]">
        <View className="w-[148px] bg-white border-r border-[#efeeeb] shadow-sm shadow-[#00351d]/5">
          <View className="px-4 pt-5 pb-4 border-b border-[#efeeeb]">
            <LinearGradient colors={['#006c4e', '#00351d']} className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-[#006c4e]/20 mb-3">
              <Text className="text-white text-[13px] font-jakarta-extrabold tracking-widest">More</Text>
            </LinearGradient>
            <Text className="text-[#707971] text-[10px] font-jakarta-bold uppercase tracking-[0.2em]">Workspace Menu</Text>
            <Text className="font-jakarta-extrabold tracking-tight text-[#00351d] text-[18px] mt-0.5">{merchant?.businessName || 'Merchant'}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
            {MENU_ITEMS.map((item) => (
              <MenuButton
                key={item.key}
                label={item.label}
                subtitle={item.subtitle}
                icon={item.icon}
                active={activeSection === item.key}
                onPress={() => setActiveSection(item.key)}
              />
            ))}

            <TouchableOpacity
              onPress={logout}
              activeOpacity={0.85}
              className="mt-2 rounded-[22px] p-4 border border-[#ba1a1a]/20 bg-[#fff5f5]"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-2xl items-center justify-center bg-white">
                  <Feather name="log-out" size={19} color="#ba1a1a" />
                </View>
                <View className="flex-1">
                  <Text className="font-jakarta-extrabold text-[13px] tracking-tight text-[#ba1a1a]">Sign Out</Text>
                  <Text className="text-[10px] font-jakarta-medium mt-0.5 text-[#ba1a1a]/70">Exit safely</Text>
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View className="flex-1">
          <View className="px-5 pt-5 pb-3 border-b border-[#efeeeb] bg-[#faf9f6]">
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
