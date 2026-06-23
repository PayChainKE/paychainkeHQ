import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
    <View className={`rounded-xl border ${expanded ? 'bg-surface-container-lowest border-outline-variant/20' : 'bg-surface-container-low border-transparent'}`}>
      <TouchableOpacity 
        className="flex-row items-center justify-between p-5" 
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text className="font-headline text-sm text-primary flex-1 mr-4">{question}</Text>
        <MaterialIcons 
          name="expand-more" 
          size={24} 
          color="#707971" 
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {expanded && (
        <View className="px-5 pb-5">
          <Text className="text-sm text-on-surface-variant leading-5">
            {answer}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function SupportPage() {
  return (
    <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View className="mb-10">
        <Text className="font-serif text-xl text-primary mb-2">Collect. Pay. Grow.</Text>
        <Text className="font-headline text-4xl text-primary leading-[44px] mb-3">Help &{'\n'}Support</Text>
        <Text className="font-body text-on-surface-variant text-sm pr-10 leading-5">
          How can we assist your business growth today?
        </Text>
      </View>

      {/* Contact Options Bento Grid */}
      <View className="gap-4 mb-12">
        {/* WhatsApp Card */}
        <TouchableOpacity activeOpacity={0.9} className="bg-[#ECFDF5] p-6 rounded-[24px] border border-[#25D366]/10">
          <View className="flex-row justify-between items-start mb-6">
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm shadow-black/5">
              <MaterialIcons name="chat-bubble" size={24} color="#25D366" />
            </View>
            <View className="bg-[#25D366] px-2 py-1 rounded-full">
              <Text className="text-white text-[10px] font-headline uppercase tracking-wider">Fastest</Text>
            </View>
          </View>
          <Text className="font-headline text-xl text-primary mb-1">Chat on WhatsApp</Text>
          <Text className="font-body text-on-surface-variant text-sm mb-6">Mon–Fri 9am–5pm EAT.</Text>
          <View className="bg-[#25D366] py-4 rounded-full items-center justify-center">
            <Text className="font-headline text-white text-sm">Chat Now</Text>
          </View>
        </TouchableOpacity>

        {/* Email Card */}
        <TouchableOpacity activeOpacity={0.9} className="bg-surface-container-lowest p-6 rounded-[24px] border border-outline-variant/10 shadow-sm shadow-black/5">
          <View className="flex-row justify-between items-start mb-6">
            <View className="w-12 h-12 bg-surface-container-low rounded-full items-center justify-center">
              <MaterialIcons name="mail" size={24} color="#00351d" />
            </View>
          </View>
          <Text className="font-headline text-xl text-primary mb-1">Email Support</Text>
          <Text className="font-body text-on-surface-variant text-sm mb-6">hello@paychainke.co</Text>
          <View className="border-2 border-primary py-4 rounded-full items-center justify-center">
            <Text className="font-headline text-primary text-sm">Send Email</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Answers Section (FAQ) */}
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="font-headline text-lg text-primary">Quick Answers</Text>
          <Text className="font-headline text-[11px] uppercase tracking-[2px] text-outline">FAQ</Text>
        </View>
        
        <View className="gap-3">
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
      <View className="mt-4 mb-10 p-6 bg-primary-fixed rounded-[24px] overflow-hidden flex-row items-center justify-between">
        <View className="z-10 flex-1">
          <Text className="font-serif text-lg text-on-primary-fixed-variant">Expert help, just a tap away.</Text>
          <Text className="font-headline text-[10px] uppercase tracking-widest text-on-primary-fixed-variant/60 mt-1">Available 24/7 for urgent issues</Text>
        </View>
        <View className="absolute -right-4 -bottom-2 opacity-10">
          <MaterialIcons name="support-agent" size={80} color="#00351d" />
        </View>
      </View>
    </ScrollView>
  );
}
