import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { commissionerFamily } from '../../theme/fonts';
import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';

export function LedgerField({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  multiline,
  ...rest
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
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
            borderWidth: focused ? 2 : 1,
            borderColor: border,
            borderRadius: 4,
            backgroundColor: theme.ledger.raised,
            color: theme.ledger.ink,
            fontFamily: commissionerFamily('400'),
            fontSize: 16,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <LedgerText variant="caption" tone="danger">{error}</LedgerText>
      ) : hint ? (
        <LedgerText variant="caption" tone="mutedInk">{hint}</LedgerText>
      ) : null}
    </View>
  );
}
