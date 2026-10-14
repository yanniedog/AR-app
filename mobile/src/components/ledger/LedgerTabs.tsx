import React from 'react';
import { ScrollView, View } from 'react-native';

import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';
import { PressFeedback } from '../PressFeedback';

export interface LedgerTabOption<T extends string> {
  value: T;
  label: string;
}

export function LedgerTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly LedgerTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: 20 }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressFeedback
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: LEDGER_LAYOUT.touchTarget,
              minWidth: LEDGER_LAYOUT.touchTarget,
              paddingVertical: 12,
              justifyContent: 'center',
            }}
          >
            <LedgerText variant="label" tone={selected ? 'ink' : 'mutedInk'}>
              {option.label}
            </LedgerText>
            <View
              style={{
                position: 'absolute',
                height: 3,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: selected ? theme.ledger.primary : 'transparent',
              }}
            />
          </PressFeedback>
        );
      })}
    </ScrollView>
  );
}
