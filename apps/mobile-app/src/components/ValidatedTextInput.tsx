import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { FieldKind, formatters, validators, inputHints } from '../utils/validators';

type Props = Omit<TextInputProps, 'onChangeText' | 'value' | 'keyboardType' | 'autoCapitalize'> & {
  kind: FieldKind;
  value: string;
  onChangeText: (v: string) => void;
  // Treat empty value as valid even when validator marks it required (use for optional fields).
  optional?: boolean;
  // Container className (NativeWind).
  containerClassName?: string;
  // Override the rendered error message wrapper.
  errorClassName?: string;
  // Show this field's error immediately regardless of local blur state — for
  // a parent step that just tried to advance and wants to point at every
  // invalid field at once, not only the ones the user happened to already
  // blur (e.g. a field they never touched at all, or filled in then Continue
  // was pressed before tabbing away from it).
  forceTouched?: boolean;
};

export function ValidatedTextInput({
  kind,
  value,
  onChangeText,
  optional = false,
  containerClassName,
  errorClassName,
  forceTouched = false,
  onBlur,
  className,
  ...rest
}: Props) {
  const [touched, setTouched] = useState(false);
  const isTouched = touched || forceTouched;

  const format = formatters[kind];
  const validate = validators[kind];
  const hints = inputHints[kind];

  const handleChange = (raw: string) => {
    onChangeText(format ? format(raw) : raw);
  };

  const handleBlur = (e: any) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  };

  const isEmpty = !value;
  const result = isTouched && (!isEmpty || !optional) ? validate(value) : { valid: true };
  const showError = isTouched && !result.valid;

  return (
    <View className={containerClassName}>
      <TextInput
        {...rest}
        value={value}
        onChangeText={handleChange}
        onBlur={handleBlur}
        keyboardType={hints.keyboardType}
        autoCapitalize={hints.autoCapitalize}
        className={`${className || ''} ${showError ? 'border-red-400' : ''}`}
      />
      {showError && (
        <Text className={errorClassName || 'text-red-600 text-[11px] font-jakarta-medium mt-1 ml-1'}>
          {result.error}
        </Text>
      )}
    </View>
  );
}
