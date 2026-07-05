import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View className={`rounded-[32px] overflow-hidden ${expanded ? 'bg-white border border-[#c0c9c0]/20 shadow-sm shadow-[#00351d]/5' : 'bg-[#f4f3f0] border border-transparent'}`}>
      <TouchableOpacity 
        className="flex-row items-center justify-between p-6" 
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text className="font-jakarta-bold text-[15px] text-[#1b1c1a] flex-1 pr-4 leading-relaxed">{question}</Text>
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
    <SafeAreaView className="flex-1 bg-[#faf9f6]" edges={['top', 'left', 'right']}>
      {/* App Header */}
      <View className="w-full z-50 bg-[#f4f3f0] pt-2 pb-4">
        <View className="w-full max-w-lg mx-auto flex-row justify-between items-center px-6">
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-full bg-[#00351d] flex items-center justify-center shadow-sm">
              <Text className="text-white text-[12px] font-jakarta-bold tracking-widest">JK</Text>
            </View>
            <Text className="font-jakarta-bold tracking-tight text-[#00351d] text-[18px]">Merchant Store</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} className="w-10 h-10 items-center justify-center">
            <MaterialIcons name="notifications" size={26} color="#00351d" />
          </TouchableOpacity>
        </View>
      </View>

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
            <TouchableOpacity activeOpacity={0.9} className="bg-[#ebfbf3] p-8 rounded-[40px] shadow-sm shadow-[#25D366]/10 border border-[#25D366]/10">
              <View className="flex-row justify-between items-start mb-8">
                <View className="w-14 h-14 bg-white rounded-full items-center justify-center shadow-sm shadow-black/5">
                  <MaterialIcons name="chat-bubble" size={28} color="#25D366" />
                </View>
                <View className="bg-[#25D366] px-3.5 py-1.5 rounded-full shadow-sm shadow-[#25D366]/20">
                  <Text className="text-white text-[10px] font-jakarta-bold uppercase tracking-[0.1em]">Fastest</Text>
                </View>
              </View>
              <Text className="font-jakarta-extrabold text-[24px] tracking-tight text-[#00351d] mb-2">Chat on WhatsApp</Text>
              <Text className="font-jakarta-medium text-[#404942] text-[15px] mb-8">Mon–Fri 9am–5pm EAT.</Text>
              <View className="bg-[#25D366] py-4 rounded-full items-center justify-center shadow-md shadow-[#25D366]/20">
                <Text className="font-jakarta-bold text-white text-[16px]">Chat Now</Text>
              </View>
            </TouchableOpacity>

            {/* Email Card */}
            <TouchableOpacity activeOpacity={0.9} className="bg-white p-8 rounded-[40px] shadow-sm shadow-[#00351d]/5 border border-[#c0c9c0]/10">
              <View className="flex-row justify-between items-start mb-8">
                <View className="w-14 h-14 bg-[#f4f3f0] rounded-full items-center justify-center border border-[#efeeeb]">
                  <MaterialIcons name="mail" size={24} color="#00351d" />
                </View>
              </View>
              <Text className="font-jakarta-extrabold text-[24px] tracking-tight text-[#00351d] mb-2">Email Support</Text>
              <Text className="font-jakarta-medium text-[#404942] text-[15px] mb-8">hello@paychainke.co</Text>
              <View className="border-[2px] border-[#1b1c1a] py-4 rounded-full items-center justify-center">
                <Text className="font-jakarta-bold text-[#1b1c1a] text-[16px]">Send Email</Text>
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
                answer="Yes. PayChain utilizes bank-grade 256-bit encryption and is fully licensed by the Central Bank. Your funds are held in secure escrow accounts." 
              />
              <FAQItem 
                question="How to increase my Trust Score?" 
                answer="Consistent transaction volume, timely repayments of advances, and positive customer feedback are the fastest ways to improve your score." 
              />
              <FAQItem 
                question="What are the transaction fees?" 
                answer="We offer a flat rate of 1.5% for all inward payments. Outward transfers to mobile money start from KES 25 depending on the amount." 
              />
              <FAQItem 
                question="Can I use PayChain offline?" 
                answer="You can receive payments via your merchant USSD code even without an internet connection. App features require data access." 
              />
              <FAQItem 
                question="How do I link a second store?" 
                answer="Go to Profile > Manage Business > Add New Branch. You can toggle between different business entities seamlessly within the same app." 
              />
            </View>
          </View>

          {/* Growth Ribbon */}
          <View className="mb-4 p-8 bg-[#b1f1c6] rounded-[40px] overflow-hidden flex-row items-center justify-between shadow-sm">
            <View className="z-10 flex-1 pr-8">
              <Text style={{ fontFamily: 'DMSerifDisplay_400Regular_Italic' }} className="text-[26px] text-[#00351d] mb-2 leading-tight">Expert help, just a tap away.</Text>
              <Text className="font-jakarta-bold text-[10px] uppercase tracking-[0.15em] text-[#006c4e] mt-1">Available 24/7 for urgent issues</Text>
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
