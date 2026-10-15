import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { fontStyle } from '../../theme/fonts';
import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';
import type { UiCopy, UiNativeProps, UiInputText } from '../../lib/uiCopy';

export function LedgerField({
  label,
  error,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  multiline,
  ...rest
}: Omit<UiNativeProps<TextInputProps>, 'value' | 'defaultValue' | 'placeholder'> & {
  label: UiCopy;
  value?: UiCopy | UiInputText;
  defaultValue?: UiCopy | UiInputText;
  placeholder?: UiCopy;
  error?: UiCopy;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error
    ? theme.ledger.danger
    : focused
      ? theme.ledger.eucalyptus
      : theme.ledger.controlRule;

  return (
    <View style={{ gap: 6 }}>
      <LedgerText variant="label">{label}</LedgerText>
      <TextInput
        allowFontScaling
        accessibilityLabel={accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={theme.ledger.faintInk}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: multiline ? 104 : LEDGER_LAYOUT.touchTarget,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 12 : 8,
            borderWidth: 1,
            borderColor: border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            color: theme.ledger.ink,
            ...fontStyle('400'),
            fontSize: theme.font.body,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <LedgerText variant="caption" tone="danger">{error}</LedgerText>
      ) : null}
    </View>
  );
}
