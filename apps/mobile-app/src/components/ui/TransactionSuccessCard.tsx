import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/config';
import { formatTxDate, formatTxTime } from '../../utils/formatDate';
import { buildAuditReceiptHtml } from '../../utils/auditReceiptHtml';

function formatKES(n: number | string | null | undefined) {
  if (n == null) return 'KES 0.00';
  return `KES ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = { completed: 'Completed', success: 'Completed', pending: 'Processing' };

export type PayeeDraft = {
  name: string;
  type: 'employee' | 'supplier' | 'utility' | 'contractor';
  paymentMethod: 'Mobile Money' | 'Bank';
  mobileMoneyType?: 'Personal Number' | 'Paybill' | 'Buy Goods';
  mobileNetwork?: 'safaricom' | 'airtel';
  phone?: string;
  paybillNumber?: string;
  businessAccount?: string;
  tillNumber?: string;
  bankName?: string;
  accountNumber?: string;
  bankCode?: string;
};

type Transaction = {
  reference?: string;
  createdAt?: string;
  status?: string;
  type?: string;
  amount?: number;
  kesAmount?: number;
};

// RN mirror of apps/merchant-dashboard/src/components/ui/TransactionSuccessCard.jsx —
// shared bank-grade success card for outbound payments (Send Money, Wallet
// withdrawals). recipientDisplay is passed explicitly by the caller rather
// than read off transaction.recipient.name, since that field holds a UI
// label ("Any M-PESA Number") for mobile payouts, not an actual recipient —
// see backend/controllers/mpesaController.js#initiateB2C.
export default function TransactionSuccessCard({
  amount,
  methodLabel,
  recipientDisplay,
  transaction,
  payeeDraft,
  onViewTransactions,
  onDone,
  doneLabel = 'Back to Dashboard',
}: {
  amount: number | string;
  methodLabel?: string;
  recipientDisplay?: string;
  transaction?: Transaction | null;
  payeeDraft?: PayeeDraft | null;
  onViewTransactions?: () => void;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const [savingFavourite, setSavingFavourite] = useState(false);
  const [savedFavourite, setSavedFavourite] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const reference = transaction?.reference || '—';
  const createdAt = transaction?.createdAt || new Date().toISOString();
  const statusKey = (transaction?.status || 'completed').toLowerCase();
  const statusLabel = STATUS_LABEL[statusKey] || (statusKey.charAt(0).toUpperCase() + statusKey.slice(1));
  const isPending = statusKey === 'pending';

  const handleAddFavourite = async () => {
    if (!payeeDraft || savingFavourite || savedFavourite) return;
    setSavingFavourite(true);
    try {
      await api.post('/api/bulkpay/payees', payeeDraft);
      setSavedFavourite(true);
      Alert.alert('Saved to Favourites', `${payeeDraft.name} added for quick reuse next time.`);
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.response?.data?.message || 'Failed to save this recipient.');
    } finally {
      setSavingFavourite(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      const html = buildAuditReceiptHtml({
        type: transaction?.type || 'outbound',
        status: transaction?.status || 'completed',
        reference,
        amount: Number(amount),
        kesAmount: Number(amount),
        createdAt,
        recipient: { name: recipientDisplay || methodLabel || 'Recipient' },
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'PayChain Receipt', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Receipt Ready', `Saved to: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Unable to Generate Receipt', e?.message || 'Please try again.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#707971] shrink-0">{label}</Text>
      <Text
        numberOfLines={1}
        style={mono ? { fontVariant: ['tabular-nums'] } : undefined}
        className="text-[13px] font-jakarta-bold text-[#00351d] text-right flex-shrink"
      >
        {value}
      </Text>
    </View>
  );

  return (
    <View className="bg-white rounded-[28px] border border-[#00351d]/5 shadow-xl overflow-hidden">
      <View className="px-7 pt-8 pb-6 items-center">
        <View className="w-20 h-20 rounded-full bg-[#e7f8ef] items-center justify-center mb-5 border-4 border-[#d5f3e4]">
          <Feather name="check-circle" size={40} color="#006c4e" />
        </View>
        <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[26px] text-[#00351d] mb-1 text-center">
          Transaction Successful
        </Text>
        <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[32px] text-[#00351d] mt-2 mb-3 text-center">
          {formatKES(amount)}
        </Text>
        <View
          className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${
            isPending ? 'bg-amber-50 border-amber-200' : 'bg-[#e7f8ef] border-[#d5f3e4]'
          }`}
        >
          <View className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-[#006c4e]'}`} />
          <Text className={`text-[10px] font-jakarta-extrabold uppercase tracking-widest ${isPending ? 'text-amber-700' : 'text-[#006c4e]'}`}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View className="mx-7 border-t border-dashed border-[#00351d]/10" />

      <View className="px-7 py-5">
        <DetailRow label="Date & Time" value={`${formatTxDate(createdAt)} · ${formatTxTime(createdAt)}`} />
        <DetailRow label="Transaction ID" value={reference} mono />
        <DetailRow label="Paid To" value={recipientDisplay || '—'} />
        <DetailRow label="Method" value={methodLabel || '—'} />
      </View>

      <View className="mx-7 border-t border-dashed border-[#00351d]/10" />

      <View className="px-7 py-6 gap-3">
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleAddFavourite}
            disabled={!payeeDraft || savingFavourite || savedFavourite}
            activeOpacity={0.8}
            style={{ opacity: !payeeDraft || savedFavourite ? 0.5 : 1 }}
            className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-[#00351d]/10"
          >
            {savingFavourite ? (
              <ActivityIndicator size="small" color="#00351d" />
            ) : (
              <Feather name="heart" size={16} color={savedFavourite ? '#006c4e' : '#00351d'} />
            )}
            <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-wider text-[#00351d]">
              {savedFavourite ? 'Saved' : 'Favourite'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDownloadReceipt}
            disabled={downloadingReceipt}
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-[#00351d]/10"
          >
            {downloadingReceipt ? <ActivityIndicator size="small" color="#00351d" /> : <Feather name="download" size={16} color="#00351d" />}
            <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-wider text-[#00351d]">Receipt</Text>
          </TouchableOpacity>
        </View>

        {onViewTransactions && (
          <TouchableOpacity
            onPress={onViewTransactions}
            activeOpacity={0.9}
            className="w-full bg-[#00351d] py-4 rounded-2xl items-center justify-center shadow-lg shadow-[#00351d]/20"
          >
            <Text className="text-white font-jakarta-extrabold text-[12px] uppercase tracking-widest">View Transactions</Text>
          </TouchableOpacity>
        )}
        {onDone && (
          <TouchableOpacity onPress={onDone} activeOpacity={0.7} className="items-center py-1">
            <Text className="text-[#00351d]/50 font-jakarta-bold text-[12px]">{doneLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
