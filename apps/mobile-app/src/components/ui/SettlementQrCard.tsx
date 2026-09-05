import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Image, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { formatAccountNumber } from '../../utils/formatAccountNumber';

// Premium settlement-QR card — dark bezel frame, corner brackets, an
// animated "scan me" badge + curved arrow pointing at the code, a soft
// pulsing halo. RN port of
// apps/merchant-dashboard/src/components/ui/SettlementQrCard.jsx — kept
// visually equivalent so the two apps' settlement QR reads the same way.
//
// qrCodeDataUri is a PayChain-branded QR (PayChain mark composited into the
// center) fetched from GET /api/callbacks/account-qr by the caller —
// encodes a link to this merchant's own /pay/account/:code checkout page
// (see mpesaController.js#generateAccountQr for why this is generated and
// hosted by PayChain rather than using NCBA's own Dynamic QR product).
interface SettlementQrCardProps {
  qrCodeDataUri: string;
  businessName?: string | null;
  accountNumber?: string | null;
  size?: number;
}

export default function SettlementQrCard({ qrCodeDataUri, businessName, accountNumber, size = 144 }: SettlementQrCardProps) {
  const wiggle = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    wiggleLoop.start();
    bounceLoop.start();
    pulseLoop.start();
    return () => {
      wiggleLoop.stop();
      bounceLoop.stop();
      pulseLoop.stop();
    };
  }, [bounce, pulse, wiggle]);

  const wiggleRotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] });
  const bounceTranslate = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <LinearGradient
      colors={['rgba(94,254,179,0.5)', '#1E2532', 'rgba(39,117,202,0.4)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 26, padding: 1.5 }}
    >
      <View className="bg-[#131722] rounded-[24px] items-center p-5 overflow-hidden">
        {/* Corner brackets — viewfinder accent */}
        <View style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(94,254,179,0.6)', borderTopLeftRadius: 6 }} />
        <View style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, borderTopWidth: 2, borderRightWidth: 2, borderColor: 'rgba(94,254,179,0.6)', borderTopRightRadius: 6 }} />
        <View style={{ position: 'absolute', bottom: 12, left: 12, width: 16, height: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(94,254,179,0.6)', borderBottomLeftRadius: 6 }} />
        <View style={{ position: 'absolute', bottom: 12, right: 12, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: 'rgba(94,254,179,0.6)', borderBottomRightRadius: 6 }} />

        {/* "Scan me" sticker + curved arrow — points the eye down at the QR */}
        <View className="items-center mb-1">
          <Animated.View style={{ transform: [{ rotate: wiggleRotate }] }}>
            <View className="bg-[#5EFEB3] px-3 py-1.5 rounded-full rounded-bl-sm" style={{ maxWidth: size + 8, shadowColor: '#5EFEB3', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }}>
              <Text className="text-[#00351D] text-[10px] font-jakarta-extrabold uppercase tracking-wide" numberOfLines={1} ellipsizeMode="tail">
                Scan me to pay {businessName || formatAccountNumber(accountNumber || undefined) || 'this account'}
              </Text>
            </View>
          </Animated.View>
          <Animated.View style={{ marginBottom: -4, transform: [{ translateY: bounceTranslate }] }}>
            <Svg width={52} height={32} viewBox="0 0 52 32" fill="none">
              <Path d="M8 2 C 40 2, 40 16, 22 22" stroke="#5EFEB3" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 6" />
              <Path d="M14 18 L22 24 L29 16" stroke="#5EFEB3" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Animated.View>
        </View>

        {/* QR chip */}
        <View className="bg-white rounded-[16px] mb-5 items-center justify-center" style={{ width: size + 24, height: size + 24, padding: 12 }}>
          {/* Soft pulsing halo — signals "live/scannable" without being distracting */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 16, backgroundColor: '#5EFEB3',
              opacity: pulseOpacity, transform: [{ scale: pulseScale }],
            }}
          />
          {qrCodeDataUri ? (
            <Image
              source={{ uri: qrCodeDataUri }}
              style={{ width: size, height: size }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#00351D" size="small" />
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="items-center">
          <View className="bg-[#2775CA]/10 border border-[#2775CA]/20 rounded-md px-2.5 py-1 mb-2.5">
            <Text className="text-[#2775CA] text-[10px] font-jakarta-extrabold uppercase tracking-[0.2em]">Settlement QR</Text>
          </View>
          <Text className="text-white text-[15px] font-jakarta-bold tracking-widest">ACC: {formatAccountNumber(accountNumber || undefined) || 'Pending'}</Text>
          <Text className="text-[#8B98A9] text-[10px] font-jakarta-bold uppercase tracking-widest mt-1.5 text-center" numberOfLines={1}>
            MERCHANT: {businessName || 'Merchant'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
