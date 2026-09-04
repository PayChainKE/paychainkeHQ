import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager, Linking, ActivityIndicator, Alert } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Same real contact details as the merchant dashboard's Support page
// (apps/merchant-dashboard/src/pages/Support.jsx) — single source of truth
// so mobile and web never drift apart again.
const SUPPORT_WHATSAPP_URL = 'https://wa.me/254743283782';
const SUPPORT_EMAIL = 'support@paychain.co.ke';
const SUPPORT_PHONE_DISPLAY = '+254 743 283 782';
const SUPPORT_PHONE_TEL = 'tel:+254743283782';
const SUPPORT_HOURS = 'Mon–Sat 7am–9pm EAT';

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View className={`rounded-[32px] overflow-hidden ${expanded ? 'bg-white border border-[#bfc9bf]/20 shadow-sm shadow-[#00351d]/5' : 'bg-[#f7faf7] border border-transparent'}`}>
      <TouchableOpacity 
        className="flex-row items-center justify-between p-6" 
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text className="font-jakarta-bold text-[15px] text-[#0c2010] flex-1 pr-4 leading-relaxed">{question}</Text>
        <Feather 
          name="chevron-down" 
          size={20} 
          color="#707971" 
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {expanded && (
        <View className="px-6 pb-6 pt-2">
          <Text className="text-[14px] text-[#404942] font-jakarta-bold leading-relaxed">
            {answer}
          </Text>
        </View>
      )}
    </View>
  );
};

// Mirrors the merchant-dashboard's "Send us a message" form (Support.jsx)
// — same /api/contact endpoint, same payload shape — so a message sent
// from either app lands in the same team inbox.
const SupportMessageForm = () => {
  const { merchant } = useAuth();
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submitMessage = async () => {
    if (!subject.trim() || !messageBody.trim()) {
      Alert.alert('Missing info', 'Please fill in a subject and your message.');
      return;
    }
    setSending(true);
    try {
      await api.post('/api/contact', {
        name: merchant?.businessName || 'Merchant',
        email: merchant?.email || '',
        phone: merchant?.phone || '',
        contactType: 'merchant',
        subject: subject.trim(),
        message: messageBody.trim(),
      });
      setSent(true);
      setSubject('');
      setMessageBody('');
    } catch (err: any) {
      Alert.alert('Failed to send', err?.response?.data?.error || 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="mb-12 bg-white p-8 rounded-[40px] shadow-sm shadow-[#00351d]/5 border border-[#bfc9bf]/10">
      <Text className="font-jakarta-extrabold text-[22px] tracking-tight text-[#00351d] mb-1.5">Send us a message</Text>
      {sent ? (
        <View className="items-center py-6">
          <View className="w-16 h-16 rounded-full bg-[#ebfbf3] items-center justify-center mb-4">
            <Feather name="check-circle" size={28} color="#059669" />
          </View>
          <Text className="font-jakarta-extrabold text-[16px] text-[#00351d] mb-1.5">Message sent!</Text>
          <Text className="font-jakarta-bold text-[#404942] text-[13px] text-center mb-4">
            Our team has received it and will get back to you at {merchant?.email || 'your email'} shortly.
          </Text>
          <TouchableOpacity onPress={() => setSent(false)}>
            <Text className="text-[11px] font-jakarta-extrabold uppercase tracking-widest text-[#00351d] underline">Send another message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text className="font-jakarta-bold text-[#707971] text-[13px] mb-6">Prefer to write it down? We'll reply straight to your email.</Text>
          <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="What's this about?"
            placeholderTextColor="#a1a1aa"
            editable={!sending}
            className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-4"
          />
          <Text className="text-[10px] font-jakarta-bold text-[#707971] uppercase tracking-[0.12em] mb-2">Message</Text>
          <TextInput
            value={messageBody}
            onChangeText={setMessageBody}
            placeholder="Tell us what's going on…"
            placeholderTextColor="#a1a1aa"
            editable={!sending}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3.5 text-[#0c2010] font-jakarta-bold text-[14px] mb-5 min-h-[120px]"
          />
          <TouchableOpacity
            onPress={submitMessage}
            disabled={sending}
            className="bg-[#0c2010] py-4 rounded-full flex-row items-center justify-center gap-2"
            style={sending ? { opacity: 0.6 } : undefined}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="send" size={15} color="#fff" />
                <Text className="font-jakarta-bold text-white text-[15px]">Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function SupportPage({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-[#f0fdf4]" edges={['top', 'left', 'right']}>
      <TopBar title="Help & Support" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="w-full max-w-lg mx-auto px-6 pt-10 pb-12">
          {/* Hero Section */}
          <View className="mb-12">
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[22px] text-[#00351d] mb-4 tracking-wide">Collect. Pay. Grow.</Text>
            <Text className="font-jakarta-extrabold text-4xl text-[#00351d] leading-tight tracking-tight mb-4">Help &{'\n'}Support</Text>
            <Text className="font-jakarta-bold text-[#404942] text-[16px] leading-relaxed max-w-[280px]">
              How can we assist your business growth today?
            </Text>
          </View>

          {/* Contact Options Bento Grid */}
          <View className="gap-6 mb-14">
            {/* WhatsApp Card */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)} className="bg-[#ebfbf3] p-8 rounded-[40px] shadow-sm shadow-[#25D366]/10 border border-[#25D366]/10">
              <View className="flex-row justify-between items-start mb-8">
                <View className="w-14 h-14 bg-white rounded-full items-center justify-center shadow-sm shadow-black/5">
                  <MaterialIcons name="chat-bubble" size={28} color="#25D366" />
                </View>
                <View className="bg-[#25D366] px-3.5 py-1.5 rounded-full shadow-sm shadow-[#25D366]/20">
                  <Text className="text-white text-[10px] font-jakarta-bold uppercase tracking-[0.1em]">Fastest</Text>
                </View>
              </View>
              <Text className="font-jakarta-extrabold text-[24px] tracking-tight text-[#00351d] mb-2">Chat on WhatsApp</Text>
              <Text className="font-jakarta-bold text-[#404942] text-[15px] mb-8">{SUPPORT_HOURS}.</Text>
              <View className="bg-[#25D366] py-4 rounded-full items-center justify-center shadow-md shadow-[#25D366]/20">
                <Text className="font-jakarta-bold text-white text-[16px]">Chat Now</Text>
              </View>
            </TouchableOpacity>

            {/* Email Card */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} className="bg-white p-8 rounded-[40px] shadow-sm shadow-[#00351d]/5 border border-[#bfc9bf]/10">
              <View className="flex-row justify-between items-start mb-8">
                <View className="w-14 h-14 bg-[#f7faf7] rounded-full items-center justify-center border border-[#eff4ef]">
                  <MaterialIcons name="mail" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="font-jakarta-extrabold text-[24px] tracking-tight text-[#00351d] mb-2">Email Support</Text>
              <Text className="font-jakarta-bold text-[#404942] text-[15px] mb-8">{SUPPORT_EMAIL}</Text>
              <View className="border-[2px] border-[#0c2010] py-4 rounded-full items-center justify-center">
                <Text className="font-jakarta-bold text-[#0c2010] text-[16px]">Send Email</Text>
              </View>
            </TouchableOpacity>

            {/* Call Card */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)} className="bg-white p-8 rounded-[40px] shadow-sm shadow-[#00351d]/5 border border-[#bfc9bf]/10">
              <View className="flex-row justify-between items-start mb-8">
                <View className="w-14 h-14 bg-[#f7faf7] rounded-full items-center justify-center border border-[#eff4ef]">
                  <MaterialIcons name="call" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="font-jakarta-extrabold text-[24px] tracking-tight text-[#00351d] mb-2">Call Us</Text>
              <Text className="font-jakarta-bold text-[#404942] text-[15px] mb-8">{SUPPORT_PHONE_DISPLAY}</Text>
              <View className="border-[2px] border-[#0c2010] py-4 rounded-full items-center justify-center">
                <Text className="font-jakarta-bold text-[#0c2010] text-[16px]">Call Now</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Send a message */}
          <SupportMessageForm />

          {/* Quick Answers Section (FAQ) */}
          <View className="mb-12">
            <View className="flex-row items-center justify-between mb-8">
              <Text className="font-jakarta-bold text-[22px] tracking-tight text-[#00351d]">Quick Answers</Text>
              <Text className="font-jakarta-bold text-[12px] uppercase tracking-[0.2em] text-[#707971]">FAQ</Text>
            </View>
            
            <View className="gap-4">
              <FAQItem
                question="How do I collect a payment from a customer?"
                answer="From Request Money, send an Instant M-PESA Prompt straight to their phone, share a Payment Link, or show a Scan-to-Pay QR code. All three settle straight into your PayChain balance the moment they're paid."
              />
              <FAQItem
                question="How do I send money to someone?"
                answer="Go to Send Money and choose a destination — any M-PESA number, a bank account, or a business Till or Paybill. Every transfer is authorised with your Payment PIN before it goes out."
              />
              <FAQItem
                question="How do I pay multiple people at once?"
                answer="Bulk Pay lets you save Employees, Suppliers, Contractors and Utility billers (KPLC, Nairobi Water) as recipients, then run a single batch payout across all of them with one authorisation."
              />
              <FAQItem
                question="What are the transaction fees?"
                answer="Collections carry PayChain's standard tiered fee. Send Money and Bulk Pay payouts — bank, M-PESA, Paybill/Till, KPLC, and Water — each carry their own tiered PayChain fee plus the relevant third-party cost, shown before you confirm."
              />
              <FAQItem
                question="What is my PayChain Virtual Account?"
                answer="It's the dedicated NCBA account number tied to your business, shown on your home screen. Anyone can pay into it directly by bank transfer or M-PESA, and it settles straight into your PayChain balance."
              />
              <FAQItem
                question="How do I increase my Eligibility Score?"
                answer="Your Eligibility Score is built purely from your completed collection volume on PayChain — the more payments you process through your Virtual Account, the higher it climbs. Once it reaches 60, you're eligible to apply for a Cash Advance."
              />
              <FAQItem
                question="Is my money safe?"
                answer="Your funds move through PayChain's own secured virtual account rails, and your password and PIN are hashed — never stored or logged in plain text, not even our own team can read them."
              />
              <FAQItem
                question="What happens if I enter my Payment PIN wrong?"
                answer="You get 5 attempts before your account is temporarily locked for 15 minutes, to protect it from unauthorised access. You can change your PIN any time from Profile → Security, and if you're ever locked out, our support team can help you back in."
              />
            </View>
          </View>

          {/* Growth Ribbon */}
          <View className="mb-4 p-8 bg-[#5efeb3] rounded-[40px] overflow-hidden flex-row items-center justify-between shadow-sm">
            <View className="z-10 flex-1 pr-8">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[26px] text-[#00351d] mb-2 leading-tight">Expert help, just a tap away.</Text>
              <Text className="font-jakarta-bold text-[10px] uppercase tracking-[0.15em] text-[#006c4e] mt-1">{SUPPORT_HOURS}</Text>
            </View>
            <View className="absolute -right-8 -bottom-6 opacity-20">
              <MaterialIcons name="support-agent" size={140} color="#006c4e" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
