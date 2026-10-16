import React from 'react';
import { View } from 'react-native';
import { mortgageOffsetImpact, type LifecycleProjection } from '../../data/projections';
import type { SectionKey } from '../../types';
import { uiDate, uiDuration, uiJoin, uiLabel, uiMoney, uiRate } from '../../lib/uiCopy';
import type { FinancialFactRow } from '../../lib/financialUiCopy';
import { FinancialFactRows } from '../product/FinancialFactRows';
import { AppText } from '../ui';
export function ProjectionSummary({ section, result }: { section: SectionKey; result: LifecycleProjection }) {
  const base = result.rateSeries[1]; if (!base) return null;
  const lower = result.rateSeries[0], higher = result.rateSeries[2], boost = result.offsetSeries.find(s => s.id === 'offset-boost');
  const rows: FinancialFactRow[] = section === 'Mortgage' ? [
    { label: result.projectionScope === 'fixed-period' ? 'Balance at term end' : 'Payoff', value: result.projectionScope === 'fixed-period' ? uiMoney(base.endBalance) : base.payoffDate ? uiDate(base.payoffDate) : uiLabel('Balance remains') },
    { label: 'Total interest', value: uiMoney(base.projectedInterest) },
    { label: 'Higher-rate cost', value: higher ? uiMoney(Math.max(0, higher.totalInterest - base.totalInterest)) : uiLabel('Unknown') },
    ...(boost ? [{ label: 'Boosted offset' as const, value: uiMoney(Math.max(0, base.totalInterest - boost.totalInterest)) }] : []),
  ] : [
    { label: section === 'TD' ? 'Total maturity value' : 'Projected balance', value: uiMoney(section === 'TD' ? base.totalValue : base.endBalance) },
    { label: 'Total interest', value: uiMoney(base.projectedInterest) },
    { label: 'Lower-rate outcome', value: lower ? uiJoin(uiMoney(section === 'TD' ? lower.totalValue : lower.endBalance), ' · ', uiRate(lower.annualRate)) : uiLabel('Unknown') },
    { label: 'Higher-rate outcome', value: higher ? uiJoin(uiMoney(section === 'TD' ? higher.totalValue : higher.endBalance), ' · ', uiRate(higher.annualRate)) : uiLabel('Unknown') },
  ];
  const offset = mortgageOffsetImpact(result);
  return <View style={{ gap: 12 }}><FinancialFactRows rows={rows} />{offset ? <View style={{ gap: 6 }}>
    <AppText variant="small" weight="600">{uiLabel("Offset impact")}</AppText>
    <FinancialFactRows rows={[
      { label: 'Interest difference', value: uiMoney(offset.interestDifference) },
      { label: 'Interest-bearing balance', value: uiMoney(offset.effectiveInterestBearingBalance) },
      { label: 'Projection horizon', value: uiJoin(uiDuration(offset.comparisonMonths, 'months'), ' · ', offset.comparisonScope === 'fixed-period' ? 'Fixed-rate scope' : offset.comparisonScope === 'comparison-period' ? 'Comparison period' : 'Remaining-term scope') },
      ...(offset.payoffMonthsEarlier && offset.payoffMonthsEarlier > 0 ? [{ label: 'Payoff difference' as const, value: uiDuration(offset.payoffMonthsEarlier, 'months') }] : []),
      { label: 'Net offset difference', value: uiLabel('Unavailable') }, { label: 'Fees', value: uiLabel('Unverified') },
    ]} />
    <AppText variant="tiny" color="textMuted">{uiLabel("Interest only model")}</AppText>
  </View> : null}</View>;
}
