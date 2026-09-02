import React from 'react';
import { View, type ViewProps } from 'react-native';

import type { LedgerPalette } from '../../theme/colors';
import { LedgerText } from './LedgerText';

export type ChangeDirection = 'up' | 'down' | 'unchanged' | 'mixed' | 'unknown';

const PRESENTATION: Record<ChangeDirection, { symbol: string; word: string; tone: keyof LedgerPalette }> = {
  up: { symbol: '↑', word: 'Up', tone: 'clay' },
  down: { symbol: '↓', word: 'Down', tone: 'eucalyptus' },
  unchanged: { symbol: '—', word: 'Unchanged', tone: 'mutedInk' },
  mixed: { symbol: '↕', word: 'Mixed', tone: 'info' },
  unknown: { symbol: '?', word: 'Not known', tone: 'mutedInk' },
};

export function ChangeIndicator({
  direction,
  value,
  date,
  context,
  style,
  ...rest
}: ViewProps & {
  direction: ChangeDirection;
  value?: string;
  date?: string;
  context?: string;
}) {
  const presentation = PRESENTATION[direction];
  const label = [presentation.word, value, context, date].filter(Boolean).join(' · ');
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }, style]}
      {...rest}
    >
      <LedgerText variant="label" tone={presentation.tone} accessibilityElementsHidden>
        {presentation.symbol} {presentation.word}
      </LedgerText>
      {value ? <LedgerText variant="label">{value}</LedgerText> : null}
      {context ? <LedgerText variant="caption" tone="mutedInk">{context}</LedgerText> : null}
      {date ? <LedgerText variant="caption" tone="mutedInk">{date}</LedgerText> : null}
    </View>
  );
}
