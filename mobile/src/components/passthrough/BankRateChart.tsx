import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { BankRateChartModel } from '../../data/bankRateOverview';
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
    const timestamps = new Map(model.dates.map(date => [date, timestamp(date)]));
    const xCoordinates = new Map(model.dates.map(date => [date, model.dates.length === 1 ? (L + W - R) / 2
      : L + (timestamps.get(date)! - start) / Math.max(1, end - start) * (W - L - R)]));
    return model.lines.map(line => {
      const markers: string[] = [];
      const isolatedMarkers: string[] = [];
      const path = line.points.map((point, i) => {
        const previous = line.points[i - 1];
        const continuous = previous && positions.get(point.date)! === positions.get(previous.date)! + 1 &&
          timestamps.get(point.date)! - timestamps.get(previous.date)! === 86_400_000;
        const next = line.points[i + 1];
        const continues = next && positions.get(next.date)! === positions.get(point.date)! + 1 &&
          timestamps.get(next.date)! - timestamps.get(point.date)! === 86_400_000;
        const px = xCoordinates.get(point.date)!;
        const py = T + (model.max - point.value) / (model.max - model.min) * (H - T - B);
        // One SVG path retains every selected observation, including isolated
        // days, without allocating a native Circle for each bank and date.
        const marker = `M${(px - 2).toFixed(1)},${py.toFixed(1)}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z`;
        markers.push(marker);
        if (!continuous && !continues) isolatedMarkers.push(marker);
        return `${continuous ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
      }).join(' ');
      return { path, markers: markers.join(' '), background: `${path} ${isolatedMarkers.join(' ')}` };
    });
  }, [end, model, start]);
  // The context stays mounted unchanged when selecting another bank. The
  // selected bank is drawn over it with just two already prepared paths.
  const background = useMemo(() => <Path testID="bank-rate-background" d={paths.map(item => item.background).join(' ')}
    fill="none" stroke={theme.colors.textFaint} strokeOpacity={0.28} strokeWidth={0.8} />,
  [paths, theme.colors.textFaint]);
  if (!selected || !latest) return null;
  const unit = gap ? 'pp' : '%';
  const coverage = selected.points.length === 1
    ? `1 observed day · ${formatRunDate(latest.date)}. Earlier matching observations unavailable.`
    : `${selected.points.length} observed days · ${formatRunDate(selected.points[0].date)} – ${formatRunDate(latest.date)}`;
  const summary = `${selected.provider}. ${label} ${latest.value.toFixed(2)} ${gap ? 'percentage points' : 'percent'} on ${formatRunDate(latest.date)}. ${latest.count} matching rate tiers. ${model.lines.length} banks shown. ${coverage}`;
  const move = (offset: number) => onProviderChange(model.lines[(index + offset + model.lines.length) % model.lines.length].provider);
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
        {background}
        <Path testID="bank-rate-selected-line" d={paths[index].path} fill="none" stroke={theme.colors.primary} strokeWidth={2.6} />
        <Path testID="bank-rate-selected-observations" d={paths[index].markers} fill={theme.colors.primary} />
        <ChartText x={L} y={H - 5} fontSize={10} fill={theme.colors.textMuted}>{model.dates[0]}</ChartText>
        {model.dates.length > 1 ? <ChartText x={W - R} y={H - 5} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{model.dates.at(-1)}</ChartText> : null}
      </Svg>
    </View>
    <AppText variant="tiny" color="textMuted">{coverage}</AppText>
    <AppText variant="tiny" color="textMuted">{model.lines.length} matching banks · {gap ? 'Gap (pp)' : 'Rate (% p.a.)'} · ▲ hike · ● hold · ▼ cut</AppText>
  </Card>;
}
