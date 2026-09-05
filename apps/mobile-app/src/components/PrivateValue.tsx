import React from 'react';
import { Text, View, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  hidden: boolean;
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<TextStyle>;
  tint?: 'light' | 'dark' | 'default';
  numberOfLines?: number;
};

// Renders the real value underneath (invisible, so layout/sizing stays correct)
// and frosts it with a native blur when `hidden` — used for the balance
// privacy toggle so figures are obscured rather than swapped for dots.
export default function PrivateValue({ hidden, children, className, style, tint = 'dark', numberOfLines }: Props) {
  if (!hidden) {
    return (
      <Text className={className} style={style} numberOfLines={numberOfLines}>
        {children}
      </Text>
    );
  }
  return (
    <View style={{ alignSelf: 'flex-start', position: 'relative' }}>
      {/* Rendered at full opacity — the BlurView on top blurs this real text
          (its native/backdrop blur needs actual content behind it to frost;
          an invisible layer left it with nothing to blur, showing a flat
          tinted box instead of the number appearing blurry). */}
      <Text className={className} style={style} numberOfLines={numberOfLines}>
        {children}
      </Text>
      <BlurView
        intensity={65}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView"
        style={[StyleSheet.absoluteFill, { borderRadius: 6, overflow: 'hidden' }]}
      />
    </View>
  );
}
