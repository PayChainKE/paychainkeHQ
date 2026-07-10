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
      <Text className={className} style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>
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
