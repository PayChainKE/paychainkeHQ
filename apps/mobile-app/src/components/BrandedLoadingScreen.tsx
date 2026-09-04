import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Animated, Easing, ActivityIndicator } from 'react-native';

// Bank-style branded loading screen — shown both while fonts are still
// loading (App.tsx, before Text.defaultProps' custom fontFamily exists,
// hence the explicit fontWeight below instead of a font-family class) and
// while AuthContext is resolving stored session/PIN state (AppNavigator.tsx),
// so there's one continuous branded moment instead of a blank flash
// followed by a generic spinner.
export default function BrandedLoadingScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(indicatorOpacity, {
      toValue: 1,
      duration: 400,
      delay: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#06201b', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 88, height: 88, resizeMode: 'contain' }}
        />
        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700', letterSpacing: 0.4, marginTop: 18 }}>
          PayChain
        </Text>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', bottom: 72, opacity: indicatorOpacity }}>
        <ActivityIndicator size="small" color="#5efeb3" />
      </Animated.View>
    </View>
  );
}
