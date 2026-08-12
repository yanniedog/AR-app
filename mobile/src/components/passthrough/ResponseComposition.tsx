import React from 'react';
import { View } from 'react-native';

import type { SectionResponseSummary } from '../../data/passThroughModels';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Row } from '../ui';

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Row gap={5} style={{ alignItems: 'center' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="tiny" color="textMuted">{label} {value}</AppText>
    </Row>
  );
}

export function ResponseComposition({ summary }: { summary: SectionResponseSummary }) {
  const theme = useTheme();
  const total = Math.max(1, summary.eligible);
  const parts = [
    { key: 'with', count: summary.movedWithRba, color: theme.colors.success },
    { key: 'opposite', count: summary.movedOpposite, color: theme.colors.danger },
    { key: 'still', count: summary.unchanged, color: theme.colors.border },
  ];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${summary.movedWithRba} lenders moved with the RBA, ${summary.movedOpposite} moved in the opposite direction, and ${summary.unchanged} were unchanged out of ${summary.eligible} observed lenders.`}
    >
      <View
        style={{
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        {parts.map((part) => part.count ? (
          <View
            key={part.key}
            style={{ flex: part.count / total, backgroundColor: part.color }}
          />
        ) : null)}
      </View>
      <Row gap={12} style={{ marginTop: 9, flexWrap: 'wrap' }}>
        <Legend color={theme.colors.success} label="With RBA" value={summary.movedWithRba} />
        <Legend color={theme.colors.danger} label="Opposite" value={summary.movedOpposite} />
        <Legend color={theme.colors.border} label="Unchanged" value={summary.unchanged} />
      </Row>
    </View>
  );
}
