import React from 'react';
import { View } from 'react-native';

import {
  mortgageOffsetImpact,
  projectionCurrency,
  type LifecycleProjection,
} from '../../data/projections';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../ui';

interface SummaryCard {
  label: string;
  value: string;
  detail: string;
}

function monthDifferenceLabel(months: number): string {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (years && remainder) return `${years}y ${remainder}m sooner`;
  if (years) return `${years} year${years === 1 ? '' : 's'} sooner`;
  return `${months} month${months === 1 ? '' : 's'} sooner`;
}

function SummaryCards({ items }: { items: SummaryCard[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}. ${item.value}. ${item.detail}`}
          style={{
            flexGrow: 1,
            flexBasis: 150,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            padding: 12,
            gap: 3,
          }}
        >
          <AppText variant="tiny" color="textFaint" weight="700">{item.label.toUpperCase()}</AppText>
          <AppText variant="body" weight="800">{item.value}</AppText>
          <AppText variant="tiny" color="textMuted">{item.detail}</AppText>
        </View>
      ))}
    </View>
  );
}

export function ProjectionSummary({
  section,
  result,
}: {
  section: SectionKey;
  result: LifecycleProjection;
}) {
  const base = result.rateSeries[1];
  if (!base) return null;
  const optimistic = result.rateSeries[0];
  const higher = result.rateSeries[2];
  const offsetBoost = result.offsetSeries.find((item) => item.id === 'offset-boost');
  const cards: SummaryCard[] = section === 'Mortgage'
    ? [
      {
        label: result.projectionScope === 'fixed-period' ? 'Balance at fixed-period end' : 'Projected payoff',
        value: result.projectionScope === 'fixed-period'
          ? projectionCurrency(base.endBalance)
          : base.payoffDate ?? 'Balance remains',
        detail: `${projectionCurrency(base.projectedInterest)} forward modelled interest`,
      },
      {
        label: 'Higher-rate cost',
        value: projectionCurrency(Math.max(0, (higher?.totalInterest ?? 0) - base.totalInterest)),
        detail: 'extra interest versus current-rate scenario',
      },
      ...(offsetBoost ? [{
        label: 'Boosted offset',
        value: projectionCurrency(Math.max(0, base.totalInterest - offsetBoost.totalInterest)),
        detail: 'modelled interest avoided versus your offset plan',
      }] : []),
    ]
    : [
      {
        label: section === 'TD' ? 'Total maturity value' : 'Projected balance',
        value: projectionCurrency(section === 'TD' ? base.totalValue : base.endBalance),
        detail: `${projectionCurrency(base.projectedInterest)} forward modelled interest`,
      },
      {
        label: 'Lower-rate outcome',
        value: projectionCurrency(section === 'TD' ? optimistic?.totalValue ?? 0 : optimistic?.endBalance ?? 0),
        detail: `${((optimistic?.annualRate ?? 0) * 100).toFixed(2)}% scenario`,
      },
      {
        label: 'Higher-rate outcome',
        value: projectionCurrency(section === 'TD' ? higher?.totalValue ?? 0 : higher?.endBalance ?? 0),
        detail: `${((higher?.annualRate ?? 0) * 100).toFixed(2)}% scenario`,
      },
    ];
  const offsetImpact = mortgageOffsetImpact(result);
  const offsetCards: SummaryCard[] = offsetImpact ? [
    {
      label: 'Illustrative interest difference',
      value: `${projectionCurrency(offsetImpact.interestDifference)} less interest`,
      detail: `versus the same loan with no offset ${offsetImpact.comparisonWindow}`,
    },
    {
      label: 'Interest-bearing balance',
      value: projectionCurrency(offsetImpact.effectiveInterestBearingBalance),
      detail: 'opening loan balance minus the entered offset balance',
    },
    ...(offsetImpact.payoffMonthsEarlier && offsetImpact.payoffMonthsEarlier > 0 ? [{
      label: 'Projected payoff difference',
      value: monthDifferenceLabel(offsetImpact.payoffMonthsEarlier),
      detail: 'same rate and repayments; offset plan compared with no offset',
    }] : []),
  ] : [];

  return (
    <View style={{ gap: 12 }}>
      <SummaryCards items={cards} />
      {offsetImpact ? (
        <View style={{ gap: 8 }}>
          <AppText variant="small" weight="700">Offset impact</AppText>
          <SummaryCards items={offsetCards} />
          <AppText variant="tiny" color="textMuted">
            Net difference unavailable. {offsetImpact.netDifferenceUnavailableReason} The amount above is an
            interest-only model, not a saving or recommendation.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
