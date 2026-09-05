import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { formatAccountNumber } from '../utils/formatAccountNumber';
import { ValidatedTextInput } from '../components/ValidatedTextInput';
import api from '../api/config';
import TopBar from '../components/layout/TopBar';
import { getAppUrl } from '../utils/appUrl';

import MyAccountsTab from '../components/tabs/MyAccountsTab';
import SupportTab from '../components/tabs/SupportTab';
import SettingsTab from '../components/tabs/SettingsTab';
import SecurityTab from '../components/tabs/SecurityTab';
import TourTarget from '../components/TourTarget';
import ProfileWalkthrough from '../components/ProfileWalkthrough';

type SectionKey = 'my-accounts' | 'support' | 'settings' | 'security' | 'payment-link' | 'statement' | 'business-profile';

const MENU_ITEMS: Array<{
  key: SectionKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { key: 'payment-link', label: 'Payment Link', icon: 'link' },
  { key: 'statement', label: 'Account Statement', icon: 'description' },
  { key: 'my-accounts', label: 'My Accounts', icon: 'point-of-sale' },
  { key: 'business-profile', label: 'Business Profile', icon: 'business' },
  { key: 'security', label: 'Security', icon: 'security' },
  { key: 'settings', label: 'Settings', icon: 'tune' },
  { key: 'support', label: 'Help & Support', icon: 'help-outline' },
];

function MenuButton({
  label,
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="mb-3 items-center">
      <View className={`w-10 h-10 rounded-xl items-center justify-center mb-1 ${active ? 'bg-[#00351d] shadow-md shadow-[#00351d]/25' : 'bg-[#f0fdf4]'}`}>
        <MaterialIcons name={icon} size={18} color={active ? '#ffffff' : '#00351d'} />
      </View>
      <Text
        numberOfLines={2}
        className={`text-center text-[10px] font-jakarta-bold leading-[12px] ${active ? 'text-[#00351d]' : 'text-[#5b645c]'}`}
      >
        {label}
      </Text>
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
        setGeneratedLink(`${getAppUrl()}/pay/${res.data.linkId}`);
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
      await Share.share({ message: `Please pay me Ksh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via PayChain: ${generatedLink}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  const copyHistoryLink = async (item: any) => {
    await Clipboard.setStringAsync(`${getAppUrl()}/pay/${item.linkId}`);
    setCopiedLinkId(item.linkId);
    setTimeout(() => setCopiedLinkId((current) => (current === item.linkId ? null : current)), 1500);
  };

  const shareHistoryLink = async (item: any) => {
    try {
      await Share.share({
        message: `Please pay me Ksh ${Number(item.amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via PayChain: ${getAppUrl()}/pay/${item.linkId}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Active', color: '#006c4e', bg: '#e7f8ef' },
    paid: { label: 'Paid', color: '#1d4ed8', bg: '#eef2ff' },
    expired: { label: 'Expired', color: '#5b645c', bg: '#f7faf7' },
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Payment Link</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold leading-relaxed opacity-80">Generate a secure, one-time link for a specific amount and share it with your customer.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-3">Amount to request</Text>
          <View className="flex-row items-center bg-[#f0fdf4] rounded-2xl border border-[#eff4ef] px-4">
            <Text className="text-[#5b645c] text-[13px] font-jakarta-bold mr-2">KES</Text>
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
              errorClassName="text-red-600 text-[11px] font-jakarta-bold mb-2"
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
          <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-3">Link History</Text>

          {isLoadingHistory ? (
            <View className="bg-white rounded-[32px] border border-[#eff4ef] py-10 items-center justify-center">
              <ActivityIndicator color="#00351d" />
            </View>
          ) : history.length === 0 ? (
            <View className="bg-white rounded-[32px] border border-[#eff4ef] p-6 items-center">
              <Text className="text-[13px] text-[#5b645c] font-jakarta-bold text-center">No payment links yet. Generate one above to see it here.</Text>
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
                      <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight flex-1 min-w-0 pr-2" numberOfLines={1} ellipsizeMode="tail">
                        {item.currency === 'KES'
                          ? `Ksh ${Number(item.amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${item.currency} ${item.amount.toLocaleString()}`}
                      </Text>
                      <View style={{ backgroundColor: meta.bg }} className="px-2.5 py-1 rounded-full flex-shrink-0">
                        <Text style={{ color: meta.color }} className="text-[10px] font-jakarta-bold uppercase tracking-widest">{meta.label}</Text>
                      </View>
                    </View>
                    <Text className="text-[11px] text-[#5b645c] font-jakarta-bold mb-3">
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
          <MaterialIcons name="info-outline" size={18} color="#5b645c" />
          <Text className="flex-1 text-[12px] text-[#5b645c] font-jakarta-bold leading-relaxed">
            Each link is tied to the amount you enter and can only be paid once. Share it in invoices, WhatsApp, or on your website.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function AccountStatementPanel({ navigation, merchant }: { navigation: any; merchant: any }) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Account Statement</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold leading-relaxed opacity-80">Review recent activity and open the statement export screen.</Text>
        </View>

        <View className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 mb-6">
          <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Statement summary</Text>
          <Text className="text-[18px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-2">{merchant?.businessName || 'Merchant'} account</Text>
          <Text className="text-[13px] text-[#5b645c] font-jakarta-bold leading-relaxed">Open Transaction Summary to download a PDF statement for today, the last 7 days, this month, or any custom range.</Text>
        </View>

        <View className="gap-3">
          <TouchableOpacity onPress={() => navigation?.navigate('Collections')} className="bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/25">
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">Open Transaction Summary</Text>
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
  const { refreshSession } = useAuth();
  const [kraPin, setKraPin] = useState(merchant?.kraPin || '');
  const [businessNumber, setBusinessNumber] = useState(merchant?.businessNumber || '');
  const [isSavingKraPin, setIsSavingKraPin] = useState(false);
  const [isSavingBusinessNumber, setIsSavingBusinessNumber] = useState(false);
  // Locked by default once a value exists — Edit re-opens it for a
  // correction (e.g. a typo'd KRA PIN), it's not a one-time-only field.
  const [kraPinEditing, setKraPinEditing] = useState(!merchant?.kraPin);
  const [businessNumberEditing, setBusinessNumberEditing] = useState(!merchant?.businessNumber);

  const kraPinSet = !!merchant?.kraPin;
  const businessNumberSet = !!merchant?.businessNumber;

  const saveField = async (
    field: 'kraPin' | 'businessNumber',
    value: string,
    setSaving: (v: boolean) => void,
    setEditing: (v: boolean) => void
  ) => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await api.put('/api/auth/merchant/profile', { [field]: value.trim() });
      if (res.data.success) {
        await refreshSession();
        setEditing(false);
      }
    } catch (err: any) {
      Alert.alert('Failed to save', err.response?.data?.error || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <ProfileWalkthrough />
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">Business Profile</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold leading-relaxed opacity-80">Your registered business identity and key merchant details.</Text>
        </View>

        <TourTarget id="profile-identity-card" className="bg-white rounded-[32px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-6 gap-5">
          <ProfileRow label="Business Name" value={merchant?.businessName || 'N/A'} />
          <ProfileRow label="Email" value={merchant?.email || 'N/A'} />
          <ProfileRow label="Phone" value={merchant?.phone || 'N/A'} />
          <ProfileRow label="PayChain Account" value={formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')} />

          {/* KRA PIN — locked by default once set (feeds KRA eTIMS invoice
              filing, so it shouldn't change casually), but Edit re-opens it
              in case a merchant typed it wrong the first time. */}
          <TourTarget id="kra-pin-field">
            {kraPinSet && !kraPinEditing ? (
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-1">KRA PIN</Text>
                  <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight leading-snug">{merchant.kraPin}</Text>
                </View>
                <TouchableOpacity onPress={() => { setKraPin(merchant.kraPin); setKraPinEditing(true); }} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full flex-shrink-0">
                  <Feather name="edit-2" size={12} color="#006c4e" />
                  <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2">KRA PIN</Text>
                <View className="flex-row gap-2">
                  <ValidatedTextInput
                    kind="kraPin"
                    value={kraPin}
                    onChangeText={setKraPin}
                    placeholder="e.g. P051892647A"
                    placeholderTextColor="#b3b9b4"
                    className="flex-1 bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-extrabold text-[14px]"
                  />
                  <TouchableOpacity
                    onPress={() => saveField('kraPin', kraPin, setIsSavingKraPin, setKraPinEditing)}
                    disabled={isSavingKraPin || !kraPin.trim()}
                    className="bg-[#00351d] px-5 rounded-2xl items-center justify-center"
                    style={{ opacity: isSavingKraPin || !kraPin.trim() ? 0.5 : 1 }}
                  >
                    {isSavingKraPin ? <ActivityIndicator size="small" color="white" /> : (
                      <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TourTarget>

          {/* Business Reg Number — same edit-to-correct pattern as KRA PIN. */}
          {businessNumberSet && !businessNumberEditing ? (
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-1">Business Reg Number</Text>
                <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight leading-snug">{merchant.businessNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => { setBusinessNumber(merchant.businessNumber); setBusinessNumberEditing(true); }} className="flex-row items-center gap-1 bg-[#006c4e]/5 px-3 py-1 rounded-full flex-shrink-0">
                <Feather name="edit-2" size={12} color="#006c4e" />
                <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-2">Business Reg Number</Text>
              <View className="flex-row gap-2">
                <ValidatedTextInput
                  kind="businessReg"
                  optional
                  value={businessNumber}
                  onChangeText={setBusinessNumber}
                  placeholder="e.g. PVT-XXXXXX"
                  placeholderTextColor="#b3b9b4"
                  className="flex-1 bg-[#f0fdf4] border border-[#e7ece7] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-extrabold text-[14px]"
                />
                <TouchableOpacity
                  onPress={() => saveField('businessNumber', businessNumber, setIsSavingBusinessNumber, setBusinessNumberEditing)}
                  disabled={isSavingBusinessNumber || !businessNumber.trim()}
                  className="bg-[#00351d] px-5 rounded-2xl items-center justify-center"
                  style={{ opacity: isSavingBusinessNumber || !businessNumber.trim() ? 0.5 : 1 }}
                >
                  {isSavingBusinessNumber ? <ActivityIndicator size="small" color="white" /> : (
                    <Text className="text-white font-jakarta-extrabold text-[11px] uppercase tracking-widest">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TourTarget>
      </View>
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-[10px] text-[#5b645c] font-jakarta-bold uppercase tracking-[0.2em] mb-1">{label}</Text>
        <Text className="text-[15px] font-jakarta-extrabold text-[#00351d] tracking-tight leading-snug">{value}</Text>
      </View>
    </View>
  );
}

export default function Profile({ navigation }: any) {
  const { merchant, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>('my-accounts');

  const renderContent = () => {
    switch (activeSection) {
      case 'my-accounts':
        return <MyAccountsTab />;
      case 'support':
        return <SupportTab />;
      case 'settings':
        return <SettingsTab />;
      case 'security':
        return <SecurityTab />;
      case 'payment-link':
        return <PaymentLinkPanel />;
      case 'statement':
        return <AccountStatementPanel navigation={navigation} merchant={merchant} />;
      case 'business-profile':
        return <BusinessProfilePanel merchant={merchant} />;
      default:
        return <MyAccountsTab />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Profile" showBack={false} titleAvatar />
      <View className="flex-1 flex-row bg-[#f0fdf4]">
        <View className="w-[88px] bg-white border-r border-[#eff4ef] shadow-sm shadow-[#00351d]/5">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 10, paddingTop: 16, paddingBottom: 24 }}>
            {MENU_ITEMS.map((item) => (
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
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-[#fff5f5] mb-1">
                <Feather name="log-out" size={16} color="#ba1a1a" />
              </View>
              <Text className="text-center text-[10px] font-jakarta-bold leading-[12px] text-[#ba1a1a]">Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View className="flex-1">
          {renderContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}
