import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { StaySwitchProjection } from '../../data/staySwitchProjection';
import { formatRate } from '../../data/format';
import { uiDate, uiJoin, uiLabel, uiMoney, uiProviderName } from '../../lib/uiCopy';
import { uiStaySwitchFact } from '../../lib/staySwitchUiFacts';
import { useTheme } from '../../theme/ThemeProvider';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText, Button, Card, Row } from '../ui';
import { FinancialFactRows } from '../product/FinancialFactRows';
function sampled<T>(values: T[], limit = 96): T[] { return values.length <= limit ? values : Array.from({ length: limit }, (_, i) => values[Math.round(i * (values.length - 1) / (limit - 1))]); }
export function StaySwitchChart({ projection, currentBank, compact = false, onOpenFull }: { projection: StaySwitchProjection; currentBank?: string; compact?: boolean; onOpenFull?: () => void }) {
  const theme = useTheme(), { width } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(compact ? 520 : 760, width - 64)), chartHeight = compact ? 142 : 190;
  const plot = useMemo(() => {
    const points = sampled(projection.points), max = Math.max(1, ...points.flatMap(p => [p.stayNetDebt, p.switchNetDebt]));
    const left = 4, right = chartWidth - 4, top = 6, bottom = chartHeight - 8;
    const path = (key: 'stayNetDebt' | 'switchNetDebt') => points.map((p, i) => `${i ? 'L' : 'M'} ${(left + (right - left) * i / Math.max(1, points.length - 1)).toFixed(2)} ${(top + (bottom - top) * (1 - p[key] / max)).toFixed(2)}`).join(' ');
    return { stay: path('stayNetDebt'), switching: path('switchNetDebt'), bottom };
  }, [chartHeight, chartWidth, projection.points]);
  if (!projection.ready) return null;
  const current = currentBank?.trim() ? uiProviderName({ provider: currentBank }) : uiLabel('Current bank');
  const target = uiProviderName({ provider: projection.targetProvider });
  const date = (value: string | null | undefined) => value ? uiDate(value) : uiLabel('Not reached');
  const horizon = projection.facts.filter(fact => fact.kind === 'switch-horizon').flatMap(uiStaySwitchFact);
  const horizonSummary = uiJoin(...horizon.flatMap((fact, index) => [index ? uiLabel(' · ') : null, fact.label, uiLabel(': '), fact.value]));
  const summary = uiJoin(current, ' · ', 'Total interest', ' ', uiMoney(projection.stay?.totalInterest), ' / ', target, ' · ', 'Total interest', ' ', uiMoney(projection.switching?.totalInterest),
    ' · ', 'Total-cost difference', ' ', projection.totalCostSaving == null ? uiLabel('Unavailable') : uiMoney(projection.totalCostSaving), horizon.length ? uiJoin(' · ', horizonSummary) : null);
  return <Card variant="outlined" style={{ gap: 12 }}>
    <AppText variant={compact ? 'h3' : 'h2'}>{uiLabel("Stay or switch")}</AppText>
    <AppText variant="small" color="textMuted">{uiJoin('Monthly illustration', ' · ', 'Net loan after offset')}</AppText>
    {compact ? <FinancialFactRows rows={horizon} /> : null}
    <View accessibilityRole="image" accessibilityLabel={summary}><Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}>
      <Line x1="4" x2={chartWidth - 4} y1={plot.bottom} y2={plot.bottom} stroke={theme.colors.border} />
      <Path d={plot.stay} fill="none" stroke={theme.colors.textMuted} strokeWidth={3} strokeLinecap="round" />
      <Path d={plot.switching} fill="none" stroke={theme.colors.rateLoan} strokeWidth={3} strokeDasharray="8 4" strokeLinecap="round" />
    </Svg></View>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="tiny">{uiJoin(current, ' · ', formatRate(projection.stay?.advertisedRate), ' · ', 'Solid')}</AppText>
      <AppText variant="tiny">{uiJoin(target, ' · ', formatRate(projection.switching?.advertisedRate), ' · ', 'Long-dashed')}</AppText>
    </Row>
    <FinancialFactRows rows={[{ label: 'Total-cost difference', value: projection.totalCostSaving == null ? uiLabel('Unavailable') : uiJoin(projection.totalCostSaving >= 0 ? 'Lower' : 'Higher', ' ', uiMoney(Math.abs(projection.totalCostSaving))) },
      { label: 'Break-even', value: projection.fees.costClaimsAvailable ? date(projection.breakEvenDate) : uiLabel('Unavailable') }]} />
    {!compact ? <View style={{ gap: 10 }}>
      <FinancialFactRows rows={[{ label: 'Total interest', value: uiJoin('Stay', ' ', uiMoney(projection.stay?.totalInterest), ' / ', 'Switch', ' ', uiMoney(projection.switching?.totalInterest)) },
        { label: 'Known costs', value: uiJoin('Stay', ' ', uiMoney(projection.stay?.knownCostSubtotal), ' / ', 'Switch', ' ', uiMoney(projection.switching?.knownCostSubtotal)) },
        { label: 'Effective debt-free', value: uiJoin('Stay', ' ', date(projection.stay?.effectiveDebtFreeDate), ' / ', 'Switch', ' ', date(projection.switching?.effectiveDebtFreeDate)) },
        { label: 'Contractual payoff', value: uiJoin('Stay', ' ', date(projection.stay?.contractualPayoffDate), ' / ', 'Switch', ' ', date(projection.switching?.contractualPayoffDate)) }]} />
      <AppText variant="small" weight="600">{uiLabel("Model facts")}</AppText><FinancialFactRows rows={projection.facts.flatMap(uiStaySwitchFact)} />
    </View> : <AppText variant="tiny" color="textMuted">{uiJoin('Fees unverified', ' · ', 'Eligibility unverified', ' · ', 'Rate held', ' · ', 'No forecast')}</AppText>}
    {onOpenFull ? <Button title="Projection" variant="secondary" onPress={onOpenFull} /> : null}
  </Card>;
}
