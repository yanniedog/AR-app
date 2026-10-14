import React from 'react';
import { View } from 'react-native';
import type { FinancialFactRow } from '../../lib/financialUiCopy';
import { AppText, Row } from '../ui';

export function FinancialFactRows({ rows }: { rows: readonly FinancialFactRow[] }) {
  return <View style={{ gap: 6 }}>{rows.map((row, index) => <Row key={index} style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
    <AppText variant="small" color="textMuted" style={{ flex: 1 }}>{row.label}</AppText>
    <AppText variant="small" style={{ flexShrink: 1, textAlign: 'right' }}>{row.value}</AppText>
  </Row>)}</View>;
}
