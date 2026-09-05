import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal, Share, Alert } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { File, Directory, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { formatAccountNumber } from '../../utils/formatAccountNumber';
import SettlementQrCard from '../ui/SettlementQrCard';
import TourTarget from '../TourTarget';
import MyAccountsWalkthrough from '../MyAccountsWalkthrough';
import api from '../../api/config';

export default function MyAccountsTab() {
  const { merchant } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [qrAccount, setQrAccount] = useState<{ name: string; accountNumber: string } | null>(null);
  const [qrCodeDataUri, setQrCodeDataUri] = useState('');
  const [downloadingSticker, setDownloadingSticker] = useState(false);

  // PayChain-branded checkout QR, fetched once on mount rather than
  // re-fetching every time the modal opens — the backend caches this per
  // merchant so it's cheap either way, but there's still no reason for a
  // network round trip on every open when the same image is shown every
  // time (see mpesaController.js#generateAccountQr).
  useEffect(() => {
    if (!merchant?.ncbaMerchantCode) return;
    api.get('/api/callbacks/account-qr')
      .then((res) => setQrCodeDataUri(res.data?.qrCodeDataUri || ''))
      .catch((e) => console.error('Failed to load account QR', e));
  }, [merchant?.ncbaMerchantCode]);

  // Downloads the official branded PayChain/NCBA paybill sticker (PDF),
  // pre-filled server-side with this merchant's own account number and
  // business name — matches merchant-dashboard's MyAccounts.jsx. The
  // endpoint requires the merchant's auth token, so it's a real
  // authenticated download (headers passed to downloadFileAsync), not a
  // plain link.
  const handleDownloadSticker = async () => {
    setDownloadingSticker(true);
    try {
      const token = await SecureStore.getItemAsync('paychain_merchant_token');
      const url = `${api.defaults.baseURL}/api/transactions/sticker`;
      const destination = new Directory(Paths.cache);
      const file = await File.downloadFileAsync(url, destination, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        idempotent: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'PayChain Paybill Sticker' });
      }
    } catch (err) {
      Alert.alert('Download Failed', 'Could not download the sticker — please try again.');
    } finally {
      setDownloadingSticker(false);
    }
  };

  // Saves the QR as an actual PNG image via the native share sheet (which
  // includes "Save Image" among its targets on both iOS/Android) — the
  // Share button below only ever sent a plain text message, never the QR
  // image itself, so there was previously no way to save the standalone
  // scannable image, unlike the dashboard's direct PNG download.
  const handleSaveQr = async () => {
    if (!qrCodeDataUri || !qrAccount) return;
    try {
      const base64 = qrCodeDataUri.replace(/^data:image\/\w+;base64,/, '');
      const fileUri = `${FileSystemLegacy.cacheDirectory}paychain-qr-${qrAccount.accountNumber}.png`;
      await FileSystemLegacy.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save PayChain QR Code' });
      }
    } catch (err) {
      Alert.alert('Save Failed', 'Could not save the QR code — please try again.');
    }
  };

  const accountsData = [
    {
      service: 'PayChain Account',
      // ncbaVirtualAccountNumber is null until NCBA_INSTITUTION_PREFIX is
      // configured on the backend (i.e. until NCBA assigns PayChain's
      // 4-digit institution code) — falls back to the 8-digit merchant
      // code, already safe to use as an interim account number (PayChain's
      // webhook matches it inside NCBA's Narrative field).
      accountNumber: merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending bank assignment',
      type: 'M-Pesa / Bank / PesaLink',
      name: merchant?.businessName || 'Merchant',
      // NCBA's real M-Pesa Paybill business number — how a customer sends
      // money into the account number above via M-Pesa.
      linkedTransferAccount: 'M-Pesa Paybill 880100',
      manager: merchant?.name || 'Owner',
      status: (merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode) ? 'Active' : 'Pending'
    }
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <MyAccountsWalkthrough />
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">

        {/* Page Header */}
        <View className="mb-6">
          <Text className="font-jakarta-extrabold text-[28px] text-[#00351d] tracking-tight leading-tight mb-2">My Accounts</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold leading-relaxed opacity-80">
            Manage your registered PayChain accounts, linked transfer accounts, and assigned managers.
          </Text>
        </View>

        {/* Search */}
        <View className="relative mb-8 shadow-sm">
          <Feather name="search" size={20} color="#b3b9b4" style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }} />
          <TextInput
            placeholder="Search accounts..."
            className="w-full bg-white border border-[#eff4ef] rounded-2xl py-4 pl-12 pr-4 text-[15px] font-jakarta-bold text-[#00351d]"
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#b3b9b4"
          />
        </View>

        <View className="flex-row items-center justify-between mb-4 px-1">
          <Text className="text-[14px] font-jakarta-bold text-[#00351d]">Registered Accounts</Text>
          <Text className="text-[12px] font-jakarta-bold text-[#006c4e] uppercase tracking-widest">{accountsData.length} active</Text>
        </View>

        <View className="gap-5">
          {accountsData.map((account, idx) => (
            <View key={idx} className="bg-white rounded-[28px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 overflow-hidden">
              <LinearGradient colors={['rgba(0,108,78,0.05)', 'rgba(0,108,78,0)']} className="absolute inset-0 h-24" />

              <View className="p-6">
                <View className="flex-row justify-between items-start mb-6">
                  <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
                    <View className="w-12 h-12 rounded-2xl bg-[#006c4e] flex items-center justify-center shadow-md shadow-[#006c4e]/30">
                      <MaterialIcons name="point-of-sale" size={22} color="white" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight" numberOfLines={1} ellipsizeMode="tail">{account.name}</Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-[#006c4e]" />
                        <Text className="text-[11px] font-jakarta-bold text-[#5b645c] uppercase tracking-widest" numberOfLines={1} ellipsizeMode="tail">{account.service}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="bg-[#e6f4ea] px-3 py-1.5 rounded-full border border-[#006c4e]/10 flex-shrink-0 max-w-[42%]">
                    <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest" numberOfLines={1} ellipsizeMode="tail">{account.type}</Text>
                  </View>
                </View>

                <View className="bg-[#f0fdf4] rounded-2xl p-5 border border-[#eff4ef] gap-4">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[12px] text-[#5b645c] font-jakarta-bold uppercase tracking-widest">Account No</Text>
                    <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] tracking-tight">{formatAccountNumber(account.accountNumber)}</Text>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-[12px] text-[#5b645c] font-jakarta-bold uppercase tracking-widest">Manager</Text>
                    <Text className="text-[14px] font-jakarta-bold text-[#00351d]">{account.manager}</Text>
                  </View>

                  <View className="h-[1px] bg-[#eff4ef] w-full" />

                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0 pr-2">
                      <MaterialIcons name="account-balance" size={14} color="#5b645c" />
                      <Text className="text-[12px] text-[#5b645c] font-jakarta-bold flex-1 min-w-0" numberOfLines={1} ellipsizeMode="tail">{account.linkedTransferAccount}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#b3b9b4" style={{ flexShrink: 0 }} />
                  </View>
                </View>

                <TourTarget id="generate-qr-btn">
                  <TouchableOpacity
                    onPress={() => setQrAccount({ name: account.name, accountNumber: account.accountNumber })}
                    disabled={account.status !== 'Active'}
                    activeOpacity={0.85}
                    className="flex-row items-center justify-center gap-2 mt-4 py-3.5 bg-[#00351d] rounded-2xl"
                    style={{ opacity: account.status !== 'Active' ? 0.35 : 1 }}
                  >
                    <MaterialIcons name="qr-code-2" size={16} color="#5efeb3" />
                    <Text className="text-[#5efeb3] text-[11px] font-jakarta-extrabold uppercase tracking-widest">
                      {account.status !== 'Active' ? 'Pending Bank Assignment' : 'Generate QR'}
                    </Text>
                  </TouchableOpacity>
                </TourTarget>

                <TourTarget id="download-sticker-btn">
                  <TouchableOpacity
                    onPress={handleDownloadSticker}
                    disabled={account.status !== 'Active' || downloadingSticker}
                    activeOpacity={0.85}
                    className="flex-row items-center justify-center gap-2 mt-2.5 py-3.5 bg-white border border-[#00351d]/15 rounded-2xl"
                    style={{ opacity: account.status !== 'Active' ? 0.35 : 1 }}
                  >
                    <MaterialIcons name={downloadingSticker ? 'hourglass-empty' : 'download'} size={16} color="#00351d" />
                    <Text className="text-[#00351d] text-[11px] font-jakarta-extrabold uppercase tracking-widest">
                      {downloadingSticker ? 'Preparing…' : 'Download Sticker'}
                    </Text>
                  </TouchableOpacity>
                </TourTarget>
              </View>
            </View>
          ))}
        </View>

      </View>

      {/* Per-account QR modal */}
      <Modal visible={!!qrAccount} transparent animationType="fade" onRequestClose={() => setQrAccount(null)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-8">
          <View className="w-full max-w-xs bg-[#0B0E14] rounded-[32px] p-6">
            <TouchableOpacity
              onPress={() => setQrAccount(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>

            {qrAccount && (
              <SettlementQrCard
                qrCodeDataUri={qrCodeDataUri}
                businessName={qrAccount.name}
                accountNumber={qrAccount.accountNumber}
              />
            )}

            <View className="flex-row gap-2.5 mt-5">
              <TouchableOpacity
                onPress={handleSaveQr}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-2 py-3.5 bg-white/10 border border-white/20 rounded-2xl"
              >
                <Feather name="download" size={16} color="#fff" />
                <Text className="text-white text-[11px] font-jakarta-extrabold uppercase tracking-widest">Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => qrAccount && Share.share({ message: `Pay ${qrAccount.name} via PayChain — Account: ${formatAccountNumber(qrAccount.accountNumber)}` })}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-2 py-3.5 bg-[#5EFEB3] rounded-2xl"
              >
                <Feather name="share-2" size={16} color="#00351D" />
                <Text className="text-[#00351D] text-[11px] font-jakarta-extrabold uppercase tracking-widest">Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
