import React from 'react';
import { View, type ViewProps } from 'react-native';

import { LedgerText } from './LedgerText';

export function RateFigure({
  label,
  value,
  secondaryLabel,
  secondaryValue,
  missingLabel = 'Not published',
  large = false,
  style,
  ...rest
}: ViewProps & {
  label: string;
  value: string | null | undefined;
  secondaryLabel?: string;
  secondaryValue?: string | null;
  missingLabel?: string;
  large?: boolean;
}) {
  const shownValue = value || missingLabel;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${shownValue}${secondaryLabel ? `. ${secondaryLabel}: ${secondaryValue || missingLabel}` : ''}`}
      style={[{ gap: 3 }, style]}
      {...rest}
    >
      <LedgerText variant="caption" tone="mutedInk">{label}</LedgerText>
      <LedgerText variant={large ? 'rateLarge' : 'rate'} tone={value ? 'ink' : 'mutedInk'}>
        {shownValue}
      </LedgerText>
      {secondaryLabel ? (
        <LedgerText variant="caption" tone="mutedInk">
          {secondaryLabel} · {secondaryValue || missingLabel}
        </LedgerText>
      ) : null}
    </View>
  );
}
