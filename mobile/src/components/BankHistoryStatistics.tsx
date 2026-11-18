import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { BankHistoryPoint, SectionKey } from '../types';
import { SECTIONS } from '../constants';
import { uiDate, uiLabel, uiRate } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

/** Selected-date facts remain outside the independently scrollable graphic. */
export function BankHistoryStatistics({ point, section, onLayout }: {
  point: BankHistoryPoint | null; section: SectionKey; onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const rateColor = SECTIONS[section].lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  return <View testID="provider-statistics" onLayout={onLayout} style={{ paddingHorizontal: 16, paddingVertical: 4, flexShrink: 0 }}>
    <AppText variant="tiny" color="textMuted">{point ? uiDate(point.date) : uiLabel('Unknown')}</AppText>
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {([
        ['Min', point?.min, rateColor], ['Max', point?.max, rateColor],
        ['Mean', point?.mean, rateColor], ['Median', point?.median, theme.colors.primary],
      ] as const).map(([label, value, color]) => <View key={label} style={{ flex: 1, minWidth: 62 }}>
        <AppText variant="tiny" style={{ color }}>{uiLabel(label)}</AppText>
        <AppText variant="small" weight="700">{uiRate(value)}</AppText>
      </View>)}
    </Row>
  </View>;
}
