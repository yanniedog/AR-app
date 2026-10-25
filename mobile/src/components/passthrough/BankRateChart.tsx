import React, { useEffect, useMemo, useState } from 'react';
import { yieldToUi } from '../../lib/yieldToUi';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { BankRateChartModel } from '../../data/bankRateOverview';
import { hasFiniteChartPath, hasPositiveChartLayout, type ChartRenderEvidence } from '../../lib/chartRenderEvidence';
import { uiLabel, uiCount, uiDate, uiJoin, uiNumber, uiProviderName, type UiCopy } from '../../lib/uiCopy';
import { uiChartDate, uiChartPercent, uiChartPp } from '../../lib/chartUiCopy';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartText } from '../charts/ChartText';
import { BankAvatar } from '../BankAvatar';
import Ionicons from '../icons/AppIcon';
import { AppText, Row } from '../ui';

const W = 340, H = 225, L = 44, R = 12, T = 12, B = 40;
/** Small fixtures stay on the render path. A full bank-day book does not. */
const SYNCHRONOUS_CHART_POINTS = 256;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);

type ChartPaths = { path: string; coordinates: { x: number; y: number }[]; background: string; pointCount: number }[];

function buildChartPaths(model: BankRateChartModel): ChartPaths {
  const start = timestamp(model.dates[0]);
  const end = timestamp(model.dates.at(-1)!);
  const positions = new Map(model.dates.map((date, i) => [date, i]));
  const timestamps = new Map(model.dates.map(date => [date, timestamp(date)]));
  const xCoordinates = new Map(model.dates.map(date => [date, model.dates.length === 1 ? (L + W - R) / 2
    : L + (timestamps.get(date)! - start) / Math.max(1, end - start) * (W - L - R)]));
  return model.lines.map(line => {
    const isolatedMarkers: string[] = [];
    const coordinates: { x: number; y: number }[] = [];
    const path = line.points.map((point, i) => {
      const previous = line.points[i - 1];
      const continuous = previous && positions.get(point.date)! === positions.get(previous.date)! + 1 &&
        timestamps.get(point.date)! - timestamps.get(previous.date)! === 86_400_000;
      const next = line.points[i + 1];
      const continues = next && positions.get(next.date)! === positions.get(point.date)! + 1 &&
        timestamps.get(next.date)! - timestamps.get(point.date)! === 86_400_000;
      const px = xCoordinates.get(point.date)!;
      const py = T + (model.max - point.value) / (model.max - model.min) * (H - T - B);
      coordinates.push({ x: px, y: py });
      // One SVG path retains every selected observation, including isolated
      // days, without allocating a native Circle for each bank and date.
      if (!continuous && !continues) isolatedMarkers.push(`M${(px - 2).toFixed(1)},${py.toFixed(1)}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z`);
      return `${continuous ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
    return { path, coordinates, background: `${path} ${isolatedMarkers.join(' ')}`, pointCount: line.points.length };
  });
}
export function BankRateChart({ model, provider, onProviderChange, label, gap, auditRevision, onGraphicReady }: {
  model: BankRateChartModel; provider: string; onProviderChange: (provider: string) => void; label: UiCopy; gap: boolean;
  auditRevision?: string;
  onGraphicReady?: (evidence: ChartRenderEvidence) => void;
}) {
  const theme = useTheme();
  const index = Math.max(0, model.lines.findIndex(line => line.provider === provider));
  const selected = model.lines[index];
  const latest = selected?.points.at(-1);
  const start = timestamp(model.dates[0]), end = timestamp(model.dates.at(-1)!);
  const x = (date: string) => model.dates.length === 1 ? (L + W - R) / 2 : L + (timestamp(date) - start) / Math.max(1, end - start) * (W - L - R);
  const y = (value: number) => T + (model.max - value) / (model.max - model.min) * (H - T - B);
  const pointCount = model.lines.reduce((count, line) => count + line.points.length, 0);
  const synchronousPaths = useMemo(
    () => pointCount <= SYNCHRONOUS_CHART_POINTS ? buildChartPaths(model) : null,
    [model, pointCount],
  );
  const [deferredPaths, setDeferredPaths] = useState<{ model: BankRateChartModel; paths: ChartPaths } | null>(null);
  useEffect(() => {
    if (pointCount <= SYNCHRONOUS_CHART_POINTS) {
      setDeferredPaths(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const built: ChartPaths = [];
      const banksPerSlice = 8;
      for (let offset = 0; offset < model.lines.length; offset += banksPerSlice) {
        await yieldToUi(0);
        if (cancelled) return;
        built.push(...buildChartPaths({
          ...model,
          lines: model.lines.slice(offset, offset + banksPerSlice),
        }));
      }
      if (!cancelled) setDeferredPaths({ model, paths: built });
    })();
    return () => { cancelled = true; };
  }, [model, pointCount]);
  const paths = synchronousPaths ?? (deferredPaths?.model === model ? deferredPaths.paths : null);
  const selectedPath = paths?.[index];
  // Only the selected bank draws all observation markers. Keep coordinates for
  // other banks so selection never rescans history, without formatting and
  // retaining a large unused marker string for every bank during navigation.
  const selectedMarkers = useMemo(() => paths?.[index]?.coordinates.map(point =>
    `M${(point.x - 2).toFixed(1)},${point.y.toFixed(1)}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z`).join(' ') ?? '', [index, paths]);
  // The context stays mounted unchanged when selecting another bank. The
  // selected bank is drawn over it with just two paths.
  const background = useMemo(() => paths ? <Path testID="bank-rate-background" d={paths.map(item => item.background).join(' ')}
    fill="none" stroke={theme.colors.textFaint} strokeOpacity={0.28} strokeWidth={0.8} /> : null,
  [paths, theme.colors.textFaint]);
  if (!selected || !latest) return null;
  const coverage = uiJoin('Observed', ' · ', uiCount(selected.points.length), ' ', 'days', ' · ', uiDate(selected.points[0].date), ' ', '–', ' ', uiDate(latest.date), selected.points.length === 1 ? uiJoin(' · ', 'Partial') : null);
  const selectedValue = gap ? uiChartPp(latest.value) : uiChartPercent(latest.value);
  const basis = gap ? uiJoin('Home loans', ' ', '−', ' ', 'Savings', ' · ', 'Mean') : uiJoin(label, ' · ', 'Advertised rate');
  const summary = uiJoin(uiProviderName(selected), ' · ', basis, ' · ', selectedValue, ' · ', uiDate(latest.date), ' · ', uiCount(latest.count), ' ', 'rates', ' · ', uiCount(model.lines.length), ' ', 'banks', ' · ', coverage);
  const graphicRevision = `${auditRevision ?? ''}:${selected.provider}`;
  const move = (offset: number) => onProviderChange(model.lines[(index + offset + model.lines.length) % model.lines.length].provider);
  return <View style={{ gap: 16 }}>
    <Row gap={8} style={{ alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous bank" onPress={() => move(-1)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={20} color={theme.colors.text} /></Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <BankAvatar provider={selected.provider} size={28} />
          <AppText variant="body" weight="600" style={{ flex: 1 }}>{uiProviderName(selected)}</AppText>
        </Row>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next bank" onPress={() => move(1)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={20} color={theme.colors.text} /></Pressable>
    </Row>
    <View style={{ gap: 4 }}>
      <AppText variant="rateHero">{selectedValue}</AppText>
      <AppText variant="small" color="textMuted">{uiJoin(basis, ' · ', uiDate(latest.date))}</AppText>
    </View>
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      {paths ? <Svg key={graphicRevision} width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
        onLayout={(event) => onGraphicReady?.({
          revision: auditRevision ?? graphicRevision,
          expectedCount: paths.reduce((count, item) => count + item.pointCount, 0),
          pointCount: paths.reduce((count, item) => count + (hasFiniteChartPath(item.background) ? item.pointCount : 0), 0),
          layoutMeasured: hasPositiveChartLayout(event),
          accessibleSummary: summary.trim().length > 0 && hasFiniteChartPath(selectedMarkers),
          emptyStateRendered: false,
        })}>
        {[model.min, (model.min + model.max) / 2, model.max].map(value => <React.Fragment key={value}>
          <Line x1={L} x2={W - R} y1={y(value)} y2={y(value)} stroke={theme.colors.border} />
          <ChartText x={L - 5} y={y(value) + 3} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{uiNumber(value, 2)}</ChartText>
        </React.Fragment>)}
        {model.decisions.map(decision => <React.Fragment key={decision.date}>
          <Line x1={x(decision.date)} x2={x(decision.date)} y1={T} y2={H - B} stroke={theme.colors.textFaint} strokeDasharray="3 4" />
          <ChartText x={x(decision.date)} y={H - B + 12} textAnchor="middle" fontSize={9} fill={theme.colors.textMuted}>{uiLabel(decision.outcome === 'hike' ? '↑' : decision.outcome === 'cut' ? '↓' : '·')}</ChartText>
        </React.Fragment>)}
        {background}
        {selectedPath ? <Path testID="bank-rate-selected-line" d={selectedPath.path} fill="none" stroke={theme.colors.primary} strokeWidth={2.6} /> : null}
        <Path testID="bank-rate-selected-observations" d={selectedMarkers} fill={theme.colors.primary} />
        <ChartText x={L} y={H - 5} fontSize={10} fill={theme.colors.textMuted}>{uiChartDate(model.dates[0])}</ChartText>
        {model.dates.length > 1 ? <ChartText x={W - R} y={H - 5} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{uiChartDate(model.dates.at(-1))}</ChartText> : null}
      </Svg> : <View style={{ height: H }} />}
    </View>
    <View style={{ gap: 4 }}>
      <AppText variant="tiny" color="textMuted">{coverage}</AppText>
      <AppText variant="tiny" color="textMuted">{uiJoin(uiCount(model.lines.length), ' ', 'banks', ' · ', gap ? 'Gap' : 'Advertised rate', ' · ', '↑', ' ', 'Hike', ' · ', '·', ' ', 'Held', ' · ', '↓', ' ', 'Cut')}</AppText>
    </View>
  </View>;
}
