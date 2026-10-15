import React from 'react';
import { View, type ViewProps } from 'react-native';

import type { LedgerPalette } from '../../theme/colors';
import { LedgerText } from './LedgerText';
import { uiJoin, type UiCopy, type UiNativeProps } from '../../lib/uiCopy';

export type ChangeDirection = 'up' | 'down' | 'unchanged' | 'mixed' | 'unknown';

const PRESENTATION: Record<ChangeDirection, { symbol: UiCopy; word: UiCopy; tone: keyof LedgerPalette }> = {
  up: { symbol: '↑', word: 'Higher', tone: 'warning' },
  down: { symbol: '↓', word: 'Lower', tone: 'success' },
  unchanged: { symbol: '—', word: 'Unchanged', tone: 'mutedInk' },
  mixed: { symbol: '↕', word: 'Mixed', tone: 'info' },
  unknown: { symbol: '—', word: 'Unknown', tone: 'mutedInk' },
};

export function ChangeIndicator({
  direction,
  value,
  date,
  context,
  style,
  ...rest
}: UiNativeProps<ViewProps> & {
  direction: ChangeDirection;
  value?: UiCopy;
  date?: UiCopy;
  context?: UiCopy;
}) {
  const presentation = PRESENTATION[direction];
  const label = uiJoin(presentation.word, value ? uiJoin(' · ', value) : null, context ? uiJoin(' · ', context) : null, date ? uiJoin(' · ', date) : null);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }, style]}
      {...rest}
    >
      <LedgerText variant="label" tone={presentation.tone} accessibilityElementsHidden>
        {uiJoin(presentation.symbol, ' ', presentation.word)}
      </LedgerText>
      {value ? <LedgerText variant="label">{value}</LedgerText> : null}
      {context ? <LedgerText variant="caption" tone="mutedInk">{context}</LedgerText> : null}
      {date ? <LedgerText variant="caption" tone="mutedInk">{date}</LedgerText> : null}
    </View>
  );
}
