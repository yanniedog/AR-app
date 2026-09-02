import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { LEDGER_LAYOUT } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from './LedgerText';

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
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: LEDGER_LAYOUT.touchTarget,
              paddingVertical: 12,
              justifyContent: 'center',
              opacity: pressed ? 0.62 : 1,
            })}
          >
            <LedgerText variant="label" tone={selected ? 'ink' : 'mutedInk'}>
              {option.label}
            </LedgerText>
            <View
              style={{
                position: 'absolute',
                height: selected ? 3 : 1,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: selected ? theme.ledger.wattle : theme.ledger.rule,
              }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
