import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

// Shown in place of a screen's normal empty state when its most recent
// fetch actually failed (network down, request timeout, server
// unreachable) — previously every screen just silently fell through to
// its "No transactions yet"-style empty state on a failed fetch, which
// looked identical to a genuinely empty account and gave no indication
// anything had gone wrong. `onRetry`, when provided, re-runs the fetch
// that failed (each screen's TransactionsContext.refresh() or its own
// equivalent) rather than leaving the merchant stuck.
type Props = {
  onRetry?: () => void;
  message?: string;
};

export default function NoConnectionState({ onRetry, message }: Props) {
  return (
    <View className="py-14 items-center justify-center px-8">
      <Image
        source={require('../../../assets/vectors/no connection.png')}
        style={{ width: 200, height: 167 }}
        resizeMode="contain"
      />
      <Text className="text-[#5b645c] font-jakarta-bold text-[13px] text-center leading-relaxed mt-2 mb-5">
        {message || 'Check your internet connection and try again.'}
      </Text>
      {!!onRetry && (
        <TouchableOpacity onPress={onRetry} className="bg-[#00351d] px-6 py-3 rounded-full">
          <Text className="text-white font-jakarta-bold text-[13px]">Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
