import React, { useRef, useState } from 'react';
import { View, Text, TextInput } from 'react-native';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
};

// One-time-code entry: boxes to look at, ONE real TextInput on top.
//
// Separate inputs per digit can't take a paste or a phone's SMS suggestion
// ("From Messages: 123456"): both deliver the whole code to a single field.
// So the boxes are display only, and a transparent input stretched over them
// takes the typing, the paste (long-press) and the autofill. The code is a
// plain string, e.g. '123456'.
export function OtpInput({ value, onChange, length = 6, autoFocus, editable = true }: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  // Keeps only digits, so a pasted "123 456" or "Your code is 123456" works.
  // No maxLength on the input: it would cut a pasted "123 456" short before
  // this runs.
  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= length) return onChange(digits);
    // More than fits. One extra typed digit on a full code is ignored. A
    // paste or autofill landing after old digits added several at once, and
    // the code is the last digits.
    onChange(digits.length - value.length >= 2 ? digits.slice(-length) : digits.slice(0, length));
  };

  return (
    <View>
      <View className="flex-row justify-between" pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const digit = value[i] || '';
          const isActive = focused && editable && i === active;
          return (
            <View
              key={i}
              className={`w-[45px] h-[55px] rounded-xl items-center justify-center border ${
                isActive ? 'border-[#047857] bg-white' : digit ? 'border-[#a7f3d0] bg-[#ecfdf5]' : 'border-[#e5e7eb] bg-[#f9fafb]'
              }`}
            >
              <Text className="text-[20px] font-jakarta-bold text-[#0c2010]">{digit}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        autoCorrect={false}
        spellCheck={false}
        caretHidden
        selectionColor="transparent"
        accessibilityLabel="Verification code"
        testID="otp-input"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', backgroundColor: 'transparent' }}
      />
    </View>
  );
}
