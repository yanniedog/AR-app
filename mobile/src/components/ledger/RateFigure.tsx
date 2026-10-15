import React from 'react';
import { View, type ViewProps } from 'react-native';

import { LedgerText } from './LedgerText';
import { uiJoin, type UiCopy, type UiNativeProps } from '../../lib/uiCopy';

export function RateFigure({
  label,
  value,
  secondaryLabel,
  secondaryValue,
  missingLabel = 'Unavailable',
  large = false,
  style,
  ...rest
}: UiNativeProps<ViewProps> & {
  label: UiCopy;
  value: UiCopy | null | undefined;
  secondaryLabel?: UiCopy;
  secondaryValue?: UiCopy | null;
  missingLabel?: UiCopy;
  large?: boolean;
}) {
  const shownValue = value || missingLabel;
  return (
    <View
      accessible
      accessibilityLabel={uiJoin(label, ': ', shownValue, secondaryLabel ? uiJoin(' · ', secondaryLabel, ': ', secondaryValue || missingLabel) : null)}
      style={[{ gap: 3 }, style]}
      {...rest}
    >
      <LedgerText variant="caption" tone="mutedInk">{label}</LedgerText>
      <LedgerText variant={large ? 'rateLarge' : 'rate'} tone={value ? 'ink' : 'mutedInk'}>
        {shownValue}
      </LedgerText>
      {secondaryLabel ? (
        <LedgerText variant="caption" tone="mutedInk">
          {uiJoin(secondaryLabel, ' · ', secondaryValue || missingLabel)}
        </LedgerText>
      ) : null}
    </View>
  );
}
