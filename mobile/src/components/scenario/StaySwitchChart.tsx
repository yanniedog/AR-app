import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { StaySwitchProjection } from '../../data/staySwitchProjection';
import { projectionCurrency } from '../../data/projections';
import { formatRate } from '../../data/format';
import { useTheme } from '../../theme/ThemeProvider';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText, Button, Card, Disclosure, Row } from '../ui';

function shortDate(value: string | null): string {
  if (!value) return 'Not reached';
  return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function sampled<T>(values: T[], limit = 96): T[] {
  if (values.length <= limit) return values;
  const out: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    out.push(values[Math.round(index * (values.length - 1) / (limit - 1))]);
  }
  return out;
}

export function StaySwitchChart({
  projection,
  currentBank,
  compact = false,
  onOpenFull,
}: {
  projection: StaySwitchProjection;
  currentBank?: string;
  compact?: boolean;
  onOpenFull?: () => void;
}) {
  const theme = useTheme();
  const [methodOpen, setMethodOpen] = useState(false);
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(compact ? 520 : 760, width - 64));
  const chartHeight = compact ? 142 : 190;
  const plot = useMemo(() => {
    const points = sampled(projection.points);
    const max = Math.max(1, ...points.flatMap((point) => [point.stayNetDebt, point.switchNetDebt]));
    const left = 4;
    const right = chartWidth - 4;
    const top = 6;
    const bottom = chartHeight - 8;
    const path = (key: 'stayNetDebt' | 'switchNetDebt') => points.map((point, index) => {
      const x = left + (right - left) * index / Math.max(1, points.length - 1);
      const y = top + (bottom - top) * (1 - point[key] / max);
      return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    return { stay: path('stayNetDebt'), switching: path('switchNetDebt'), bottom };
  }, [chartHeight, chartWidth, projection.points]);
  const currentLabel = currentBank?.trim() ? currentBank : 'Current bank';
  const chartLabel = `${currentLabel} versus ${projection.targetProvider}. `
    + `${currentLabel} total interest ${projectionCurrency(projection.stay?.totalInterest ?? 0)}; `
    + `${projection.targetProvider} total interest ${projectionCurrency(projection.switching?.totalInterest ?? 0)}. `
    + `Break-even ${shortDate(projection.breakEvenDate)}. `
    + `${projection.fees.gaps.length} switch cost amounts need checking.`;

  if (!projection.ready) return null;
  return (
    <Card variant="outlined" style={{ gap: 12 }}>
      <View>
        <AppText variant={compact ? 'h3' : 'h2'}>Stay or switch</AppText>
        <AppText variant="small" color="textMuted">
          Net loan after offset · advertised rates{projection.projectionScope === 'published-fixed-period' ? ' · fixed period only' : ''}
        </AppText>
      </View>
      <View accessibilityRole="image" accessibilityLabel={chartLabel}>
        <Svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}
        >
          <Line x1="4" x2={chartWidth - 4} y1={plot.bottom} y2={plot.bottom} stroke={theme.colors.border} />
          <Path d={plot.stay} fill="none" stroke={theme.colors.textMuted} strokeWidth={3} strokeLinecap="round" />
          <Path d={plot.switching} fill="none" stroke={theme.colors.rateLoan} strokeWidth={3} strokeDasharray="8 4" strokeLinecap="round" />
        </Svg>
      </View>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Row gap={6}>
          <View style={{ width: 18, height: 3, backgroundColor: theme.colors.textMuted }} />
          <AppText variant="tiny" color="textMuted">
            {currentLabel} · {formatRate(projection.stay?.advertisedRate ?? null)}
          </AppText>
        </Row>
        <Row gap={6}>
          <View style={{ width: 18, height: 3, backgroundColor: theme.colors.rateLoan }} />
          <AppText variant="tiny" color="textMuted">
            {projection.targetProvider} · {formatRate(projection.switching?.advertisedRate ?? null)}
          </AppText>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="tiny" color="textMuted">Modelled cost difference</AppText>
          <AppText variant="body" weight="800" color={projection.totalCostSaving >= 0 ? 'success' : 'danger'}>
            {projection.totalCostSaving >= 0 ? 'Save ' : 'Costs '}{projectionCurrency(Math.abs(projection.totalCostSaving))}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="tiny" color="textMuted">Break-even</AppText>
          <AppText variant="body" weight="800">{shortDate(projection.breakEvenDate)}</AppText>
        </View>
      </Row>
      {!compact ? (
        <>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <AppText variant="tiny" color="textMuted">Modelled interest</AppText>
              <AppText variant="small">Stay {projectionCurrency(projection.stay?.totalInterest ?? 0)}</AppText>
              <AppText variant="small">Switch {projectionCurrency(projection.switching?.totalInterest ?? 0)}</AppText>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <AppText variant="tiny" color="textMuted">Modelled cost</AppText>
              <AppText variant="small">Stay {projectionCurrency(projection.stay?.totalCost ?? 0)}</AppText>
              <AppText variant="small">Switch {projectionCurrency(projection.switching?.totalCost ?? 0)}</AppText>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <AppText variant="tiny" color="textMuted">Effective debt-free</AppText>
              <AppText variant="small">Stay {shortDate(projection.stay?.effectiveDebtFreeDate ?? null)}</AppText>
              <AppText variant="small">Switch {shortDate(projection.switching?.effectiveDebtFreeDate ?? null)}</AppText>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <AppText variant="tiny" color="textMuted">Contractual payoff</AppText>
              <AppText variant="small">Stay {shortDate(projection.stay?.contractualPayoffDate ?? null)}</AppText>
              <AppText variant="small">Switch {shortDate(projection.switching?.contractualPayoffDate ?? null)}</AppText>
            </View>
          </Row>
        </>
      ) : null}
      {projection.targetAllocationShortfall > 0 ? (
        <AppText variant="tiny" color="danger">
          Target minimum needs {projectionCurrency(projection.targetAllocationShortfall)} more per month.
        </AppText>
      ) : null}
      {projection.fees.gaps.length ? (
        <AppText variant="tiny" color="textMuted">
          {projection.fees.gaps.length} switch cost amount{projection.fees.gaps.length === 1 ? '' : 's'} need checking.
        </AppText>
      ) : null}
      {!compact && (projection.warnings.length || projection.assumptions.length) ? (
        <Disclosure
          title="Method and limits"
          summary="Rates, allocation, fees and offset"
          open={methodOpen}
          onToggle={() => setMethodOpen((open) => !open)}
        >
          <View style={{ gap: 7 }}>
            {projection.warnings.map((item) => (
              <AppText key={item} variant="small" color="danger">{item}</AppText>
            ))}
            {projection.assumptions.map((item) => (
              <AppText key={item} variant="small" color="textMuted">{item}</AppText>
            ))}
          </View>
        </Disclosure>
      ) : null}
      {onOpenFull ? <Button title="Full projection" variant="secondary" onPress={onOpenFull} /> : null}
    </Card>
  );
}
