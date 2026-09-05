import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Same real contact details as the merchant dashboard's Support page
// (apps/merchant-dashboard/src/pages/Support.jsx) — single source of truth
// so mobile and web never drift apart again.
const SUPPORT_WHATSAPP_URL = 'https://wa.me/254743283782';
const SUPPORT_EMAIL = 'support@paychain.co.ke';

export default function SupportTab() {
  const [search, setSearch] = useState('');

  const solutions = [
    { title: 'Payments failing', icon: 'error-outline', desc: 'Common issues with M-Pesa', color: '#e6f4ea', iconColor: '#006c4e' },
    { title: 'Cash Advance', icon: 'payments', desc: 'Eligibility and repayment', color: '#f0fdf4', iconColor: '#1d9e75' },
    { title: 'KYC Verification', icon: 'verified-user', desc: 'Status and requirements', color: '#dcf5da', iconColor: '#00351d' },
    { title: 'Settlement delay', icon: 'schedule', desc: 'Bank processing times', color: '#e7f8ef', iconColor: '#0b4d2e' },
  ];

  const faqs = [
    { q: 'How do I collect a payment from a customer?', a: 'From Request Money, send an Instant M-PESA Prompt straight to their phone, share a Payment Link, or show a Scan-to-Pay QR code. All three settle straight into your PayChain balance the moment they\'re paid.' },
    { q: 'How do I send money to someone?', a: 'Go to Send Money and choose a destination — any M-PESA number, a bank account, or a business Till or Paybill. Every transfer is authorised with your Payment PIN before it goes out.' },
    { q: 'How do I pay multiple people at once?', a: 'Bulk Pay lets you save Employees, Suppliers, Contractors and Utility billers (KPLC, Nairobi Water) as recipients, then run a single batch payout across all of them with one authorisation.' },
    { q: 'What are the transaction fees?', a: 'Collections carry PayChain\'s standard tiered fee. Send Money and Bulk Pay payouts — bank, M-PESA, Paybill/Till, KPLC, and Water — each carry their own tiered PayChain fee plus the relevant third-party cost, shown before you confirm.' },
    { q: 'What is my PayChain Virtual Account?', a: 'It\'s the dedicated NCBA account number tied to your business, shown on your home screen. Anyone can pay into it directly by bank transfer or M-PESA, and it settles straight into your PayChain balance.' },
    { q: 'What is Eligibility Score, and how do I qualify for a Cash Advance?', a: 'Your Eligibility Score reflects your transaction history and account activity on PayChain — the more you process, the higher it climbs. Once it reaches 60, you become eligible to apply for a Cash Advance against your future revenue.' },
    { q: 'Is my data secure?', a: 'Yes. We use bank-level encryption, and your password and PIN are hashed and never stored in plain text.' },
    { q: 'How long does settlement take?', a: 'Most settlements land in your bank account within a few hours. If it takes longer than a business day, reach out and we\'ll look into it right away.' },
    { q: 'What happens if I enter my Payment PIN wrong?', a: 'You get 5 attempts before your account is temporarily locked for 15 minutes, to protect it from unauthorised access. You can change your PIN any time from Profile → Security, and if you\'re ever locked out, our support team can help you back in.' },
  ];

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="w-full max-w-lg mx-auto px-6 pt-2 pb-12">
        
        {/* Hero Section */}
        <View className="items-center py-6 mb-2">
          <View className="flex-row items-center gap-2 bg-[#006c4e]/10 px-4 py-1.5 rounded-full border border-[#006c4e]/20 mb-6 shadow-sm">
            <MaterialIcons name="verified-user" size={14} color="#006c4e" />
            <Text className="text-[#006c4e] text-[10px] font-jakarta-extrabold uppercase tracking-widest">Concierge Support</Text>
          </View>
          <Text className="font-jakarta-extrabold text-[32px] text-[#00351d] tracking-tight mb-4 text-center leading-[42px]">How can we help?</Text>
          <Text className="text-[#5b645c] text-[14px] font-jakarta-bold mb-8 text-center leading-relaxed opacity-90 px-4">
            Search our automated knowledge base or navigate the solution grid for instant resolution.
          </Text>
          
          <View className="relative w-full shadow-lg shadow-[#00351d]/5">
            <Feather name="search" size={22} color="#b3b9b4" style={{ position: 'absolute', left: 20, top: 18, zIndex: 1 }} />
            <TextInput 
              className="w-full bg-white border border-[#eff4ef] rounded-3xl py-4 pl-[56px] pr-6 text-[16px] font-jakarta-bold text-[#00351d]"
              placeholder="Describe your issue..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#b3b9b4"
            />
          </View>
        </View>

        {/* Quick Solutions */}
        <View className="mb-10">
          <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] mb-4">Quick Solutions</Text>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {solutions.map((s, i) => (
              <TouchableOpacity 
                key={i} 
                className="w-[48%] rounded-[28px] overflow-hidden"
                activeOpacity={0.8}
              >
                <View className="p-5 border border-black/5" style={{ backgroundColor: s.color, height: 160 }}>
                  <View className="w-12 h-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center mb-auto">
                    <MaterialIcons name={s.icon as any} size={24} color={s.iconColor} />
                  </View>
                  <Text className="text-[14px] font-jakarta-extrabold text-[#00351d] tracking-tight mb-1">{s.title}</Text>
                  <Text className="text-[11px] text-[#00351d]/60 font-jakarta-bold leading-tight">{s.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View className="mb-10">
          <Text className="text-[16px] font-jakarta-extrabold text-[#00351d] mb-4">Frequently Asked</Text>
          <View className="gap-3">
            {faqs.map((f, i) => (
              <TouchableOpacity 
                key={i} 
                className={`bg-white rounded-[24px] border ${expandedFaq === i ? 'border-[#006c4e]/30 shadow-md shadow-[#006c4e]/10' : 'border-[#eff4ef] shadow-sm shadow-[#00351d]/5'} overflow-hidden transition-all`}
                onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
                activeOpacity={0.7}
              >
                <View className="p-5 flex-row items-center justify-between">
                  <Text className={`text-[14px] font-jakarta-bold flex-1 pr-4 ${expandedFaq === i ? 'text-[#006c4e]' : 'text-[#00351d]'}`}>{f.q}</Text>
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${expandedFaq === i ? 'bg-[#006c4e]/10' : 'bg-[#f0fdf4]'}`}>
                    <Feather name={expandedFaq === i ? "minus" : "plus"} size={16} color={expandedFaq === i ? "#006c4e" : "#00351d"} />
                  </View>
                </View>
                {expandedFaq === i && (
                  <View className="px-5 pb-5 pt-0">
                    <Text className="text-[13px] text-[#5b645c] leading-relaxed font-jakarta-bold">{f.a}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Premium Contact Block */}
        <View className="rounded-[32px] overflow-hidden shadow-xl shadow-[#00351d]/20">
          <LinearGradient colors={['#00351d', '#001a0e']} className="p-8 relative">
            <View className="absolute bottom-0 right-0 w-48 h-48 bg-[#006c4e]/20 rounded-full -mr-16 -mb-16 blur-xl" />
            <Text className="font-jakarta-extrabold text-[28px] text-white mb-2 relative z-10 tracking-tight">Talk to us</Text>
            <Text className="text-[13px] text-white/60 mb-8 relative z-10 leading-relaxed font-jakarta-bold">Our support team is here Mon–Sat, 7am–9pm, to help you scale your business.</Text>

            <View className="gap-4 relative z-10">
              <TouchableOpacity onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)} className="w-full bg-white/10 p-4 rounded-2xl flex-row items-center justify-between border border-white/5 active:bg-white/20">
                <View className="flex-row items-center gap-4 flex-1 min-w-0 pr-3">
                  <View className="w-12 h-12 rounded-xl bg-[#006c4e] flex items-center justify-center shadow-lg shadow-[#006c4e]/50 flex-shrink-0">
                    <MaterialIcons name="chat" size={24} color="white" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[15px] font-jakarta-extrabold text-white tracking-tight mb-0.5" numberOfLines={1} ellipsizeMode="tail">WhatsApp Support</Text>
                    <Text className="text-[11px] text-[#5efeb3] font-jakarta-bold" numberOfLines={1} ellipsizeMode="tail">Instant response (2 mins)</Text>
                  </View>
                </View>
                <Feather name="arrow-right" size={20} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} className="w-full bg-white/10 p-4 rounded-2xl flex-row items-center justify-between border border-white/5 active:bg-white/20">
                <View className="flex-row items-center gap-4 flex-1 min-w-0 pr-3">
                  <View className="w-12 h-12 rounded-xl bg-[#006c4e] flex items-center justify-center shadow-lg shadow-[#006c4e]/50 flex-shrink-0">
                    <MaterialIcons name="mail" size={24} color="white" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[15px] font-jakarta-extrabold text-white tracking-tight mb-0.5" numberOfLines={1} ellipsizeMode="tail">Email Support</Text>
                    <Text className="text-[11px] text-white/50 font-jakarta-bold" numberOfLines={1} ellipsizeMode="tail">{SUPPORT_EMAIL}</Text>
                  </View>
                </View>
                <Feather name="arrow-right" size={20} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

      </View>
    </ScrollView>
  );
}
