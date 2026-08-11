import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Linking } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TopBar from '../components/layout/TopBar';

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
          <Text className="text-[14px] text-[#404942] font-jakarta-medium leading-relaxed">
            {answer}
          </Text>
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
            <Text className="font-jakarta-medium text-[#404942] text-[16px] leading-relaxed max-w-[280px]">
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
              <Text className="font-jakarta-medium text-[#404942] text-[15px] mb-8">{SUPPORT_HOURS}.</Text>
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
              <Text className="font-jakarta-medium text-[#404942] text-[15px] mb-8">{SUPPORT_EMAIL}</Text>
              <View className="border-[2px] border-[#0c2010] py-4 rounded-full items-center justify-center">
                <Text className="font-jakarta-bold text-[#0c2010] text-[16px]">Send Email</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick Answers Section (FAQ) */}
          <View className="mb-12">
            <View className="flex-row items-center justify-between mb-8">
              <Text className="font-jakarta-bold text-[22px] tracking-tight text-[#00351d]">Quick Answers</Text>
              <Text className="font-jakarta-bold text-[12px] uppercase tracking-[0.2em] text-[#707971]">FAQ</Text>
            </View>
            
            <View className="gap-4">
              <FAQItem 
                question="How do I withdraw funds?" 
                answer="Navigate to your balance card, tap 'Withdraw', and select your linked bank or mobile money account. Transfers are processed instantly." 
              />
              <FAQItem
                question="Is my money safe?"
                answer="Your funds move through PayChain's own secured virtual account rails, and your password and PIN are hashed — never stored or logged in plain text, not even our own team can read them."
              />
              <FAQItem
                question="How to increase my Trust Score?"
                answer="Consistent transaction volume, timely repayments of advances, and positive customer feedback are the fastest ways to improve your score."
              />
              <FAQItem
                question="What are the transaction fees?"
                answer="PayChain adds a 0.5% margin on top of Safaricom's standard tariff for inbound payments. FX conversions (KES to USDC) carry a 2% spread. There's no flat rate — see your Revenue page for the exact breakdown."
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
