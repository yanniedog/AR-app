import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { BankRateChartModel, BankRatePoint } from '../../data/bankRateOverview';
import { formatRunDate } from '../../data/format';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartText } from '../charts/ChartText';
import { BankAvatar } from '../BankAvatar';
import Ionicons from '../icons/AppIcon';
import { AppText, Card, Row } from '../ui';

const W = 340, H = 225, L = 44, R = 12, T = 12, B = 40;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
export function BankRateChart({ model, provider, onProviderChange, label, gap }: {
  model: BankRateChartModel; provider: string; onProviderChange: (provider: string) => void; label: string; gap: boolean;
}) {
  const theme = useTheme();
  const index = Math.max(0, model.lines.findIndex(line => line.provider === provider));
  const selected = model.lines[index];
  const latest = selected?.points.at(-1);
  const start = timestamp(model.dates[0]), end = timestamp(model.dates.at(-1)!);
  const x = (date: string) => model.dates.length === 1 ? (L + W - R) / 2 : L + (timestamp(date) - start) / Math.max(1, end - start) * (W - L - R);
  const y = (value: number) => T + (model.max - value) / (model.max - model.min) * (H - T - B);
  const paths = useMemo(() => {
    const positions = new Map(model.dates.map((date, i) => [date, i]));
    return model.lines.map(line => line.points.map((point, i) => {
      const previous = line.points[i - 1];
      const continuous = previous && positions.get(point.date)! === positions.get(previous.date)! + 1;
      const px = model.dates.length === 1 ? (L + W - R) / 2 : L + (timestamp(point.date) - start) / Math.max(1, end - start) * (W - L - R);
      const py = T + (model.max - point.value) / (model.max - model.min) * (H - T - B);
      return `${continuous ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' '));
  }, [end, model, start]);
  if (!selected || !latest) return null;
  const unit = gap ? 'pp' : '%';
  const summary = `${selected.provider}. ${label} ${latest.value.toFixed(2)} ${gap ? 'percentage points' : 'percent'} on ${formatRunDate(latest.date)}. ${latest.count} matching rate tiers. ${model.lines.length} banks shown.`;
  const move = (offset: number) => onProviderChange(model.lines[(index + offset + model.lines.length) % model.lines.length].provider);
  const dots = (points: BankRatePoint[], active: boolean) => points.map(point => <Circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={active ? 2 : 1.2} fill={active ? theme.colors.primary : theme.colors.textFaint} opacity={active ? 1 : 0.35} />);
  return <Card style={{ gap: 10 }}>
    <Row gap={4} style={{ alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous bank alphabetically" onPress={() => move(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={20} color={theme.colors.text} /></Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <BankAvatar provider={selected.provider} size={22} />
          <AppText variant="small" weight="700" numberOfLines={1} style={{ flex: 1 }}>{selected.provider}</AppText>
        </Row>
        <AppText variant="tiny" color="textMuted">{formatRunDate(latest.date)} · {label} {latest.value.toFixed(2)}{unit}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next bank alphabetically" onPress={() => move(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={20} color={theme.colors.text} /></Pressable>
    </Row>
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[model.min, (model.min + model.max) / 2, model.max].map(value => <React.Fragment key={value}>
          <Line x1={L} x2={W - R} y1={y(value)} y2={y(value)} stroke={theme.colors.border} />
          <ChartText x={L - 5} y={y(value) + 3} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{value.toFixed(2)}</ChartText>
        </React.Fragment>)}
        {model.decisions.map(decision => <React.Fragment key={decision.date}>
          <Line x1={x(decision.date)} x2={x(decision.date)} y1={T} y2={H - B} stroke={theme.colors.textFaint} strokeDasharray="3 4" />
          <ChartText x={x(decision.date)} y={H - B + 12} textAnchor="middle" fontSize={9} fill={theme.colors.textMuted}>{decision.outcome === 'hike' ? '▲' : decision.outcome === 'cut' ? '▼' : '●'}</ChartText>
        </React.Fragment>)}
        {model.lines.map((line, i) => i === index ? null : <React.Fragment key={line.provider}>
          <Path d={paths[i]} fill="none" stroke={theme.colors.textFaint} strokeOpacity={0.28} strokeWidth={0.8} />
          {dots(line.points, false)}
        </React.Fragment>)}
        <Path d={paths[index]} fill="none" stroke={theme.colors.primary} strokeWidth={2.6} />
        {dots(selected.points, true)}
        <ChartText x={L} y={H - 5} fontSize={10} fill={theme.colors.textMuted}>{model.dates[0]}</ChartText>
        {model.dates.length > 1 ? <ChartText x={W - R} y={H - 5} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{model.dates.at(-1)}</ChartText> : null}
      </Svg>
    </View>
    <AppText variant="tiny" color="textMuted">{model.lines.length} matching banks · {gap ? 'Gap (pp)' : 'Rate (% p.a.)'} · ▲ hike · ● hold · ▼ cut</AppText>
  </Card>;
}
