import React from 'react';
import { View } from 'react-native';
import type { FinancialFactRow } from '../../lib/financialUiCopy';
import { AppText, Row } from '../ui';

import { uiJoin } from '../../lib/uiCopy';
import { ProductPageLink } from './ProductPageLink';

export function FinancialFactRows({ rows, linkToProduct = false }: { rows: readonly FinancialFactRow[]; linkToProduct?: boolean }) {
  return <View style={{ gap: 6 }}>{rows.map((row, index) => {
    const content = <Row style={{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <AppText variant="small" color="textMuted" style={{ flex: 1 }}>{row.label}</AppText>
      <AppText variant="small" style={{ flexShrink: 1, textAlign: 'right' }}>{row.value}</AppText>
    </Row>;
    return linkToProduct ? <ProductPageLink key={index} label={uiJoin(row.label, ', ', row.value)}>{content}</ProductPageLink>
      : <React.Fragment key={index}>{content}</React.Fragment>;
  })}</View>;
}
