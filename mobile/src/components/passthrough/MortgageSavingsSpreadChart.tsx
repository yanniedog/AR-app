import Ionicons from '../icons/AppIcon';
import React, { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { BankSpreadChartModel, BankSpreadPlotLine } from '../../data/bankSpreadHistory';
import { resolveBrandShort } from '../../data/bankBrand';
import { formatRunDate } from '../../data/format';
import { useStore } from '../../data/store';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { AppText, Card, Row } from '../ui';

const WIDTH = 340;
const HEIGHT = 220;
const LEFT = 42;
const RIGHT = 10;
const TOP = 14;
const BOTTOM = 34;

function linePath(line: BankSpreadPlotLine, model: BankSpreadChartModel): string {
  const dateIndex = new Map(model.dates.map((date, index) => [date, index]));
  const span = Math.max(0.0001, model.maxGapPp - model.minGapPp);
  return line.points.map((point, index) => {
    const x = LEFT + ((dateIndex.get(point.date) ?? 0) / Math.max(1, model.dates.length - 1)) * (WIDTH - LEFT - RIGHT);
    const y = TOP + ((model.maxGapPp - point.gapPp) / span) * (HEIGHT - TOP - BOTTOM);
    const previous = line.points[index - 1];
    const continuous = previous && point.runIndex === previous.runIndex + 1;
    return `${continuous ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function Arrow({ direction, onPress }: { direction: 'back' | 'forward'; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Previous bank alphabetically' : 'Next bank alphabetically'}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={20} color={theme.colors.text} />
    </Pressable>
  );
}

export const MortgageSavingsSpreadChart = memo(function MortgageSavingsSpreadChart({
  model, selectedProvider, onSelectedProviderChange,
}: {
  model: BankSpreadChartModel;
  selectedProvider: string;
  onSelectedProviderChange: (provider: string) => void;
}) {
  const theme = useTheme();
  const brand = useStore((state) => state.core?.brands?.[selectedProvider]);
  const selectedIndex = Math.max(0, model.lines.findIndex((line) => line.provider === selectedProvider));
  const selected = model.lines[selectedIndex] ?? model.lines[0];
  const latest = selected?.points.at(-1);
  const paths = useMemo(() => model.lines.map((line) => ({ line, path: linePath(line, model) })), [model]);
  if (!selected || !latest) return null;
  const move = (offset: number) => {
    const next = (selectedIndex + offset + model.lines.length) % model.lines.length;
    onSelectedProviderChange(model.lines[next].provider);
  };
  const short = resolveBrandShort(selected.provider, brand?.short).toUpperCase().slice(0, 5);
  const summary = `${selected.provider}. On ${formatRunDate(latest.date)}, mortgage minus savings gap ${latest.gapPp.toFixed(2)} percentage points. Variable mortgage mean ${latest.mortgagePct.toFixed(2)} percent. Base savings mean ${latest.savingsPct.toFixed(2)} percent. ${model.lines.length} banks and ${model.decisions.length} RBA decision markers shown.`;
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Arrow direction="back" onPress={() => move(-1)} />
        <Row gap={8} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <BankAvatar provider={selected.provider} size={22} />
          <View style={{ minWidth: 0 }}>
            <AppText variant="small" weight="700" numberOfLines={1}>{short} · {selected.provider}</AppText>
            <AppText variant="tiny" color="textMuted">{formatRunDate(latest.date)} · gap {latest.gapPp.toFixed(2)} pp</AppText>
          </View>
        </Row>
        <Arrow direction="forward" onPress={() => move(1)} />
      </Row>
      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {[model.minGapPp, (model.minGapPp + model.maxGapPp) / 2, model.maxGapPp].map((value) => {
            const y = TOP + ((model.maxGapPp - value) / (model.maxGapPp - model.minGapPp)) * (HEIGHT - TOP - BOTTOM);
            return <React.Fragment key={value}>
              <Line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} stroke={theme.colors.border} strokeWidth={0.7} />
              <SvgText x={LEFT - 5} y={y + 3} textAnchor="end" fontSize="9" fill={theme.colors.textFaint}>{value.toFixed(2)}</SvgText>
            </React.Fragment>;
          })}
          {model.decisions.map((decision) => {
            const index = model.dates.findIndex((date) => date >= decision.date);
            if (index < 0) return null;
            const x = LEFT + (index / Math.max(1, model.dates.length - 1)) * (WIDTH - LEFT - RIGHT);
            const label = decision.outcome === 'hike' ? '▲' : decision.outcome === 'cut' ? '▼' : '●';
            return <React.Fragment key={decision.date}>
              <Line x1={x} x2={x} y1={TOP} y2={HEIGHT - BOTTOM} stroke={theme.colors.textFaint} strokeDasharray="3 4" strokeWidth={0.8} />
              <SvgText x={x} y={HEIGHT - 12} textAnchor="middle" fontSize="10" fill={theme.colors.textMuted}>{label}</SvgText>
            </React.Fragment>;
          })}
          {paths.filter(({ line }) => line.provider !== selected.provider).map(({ line, path }) => (
            <Path key={line.provider} d={path} fill="none" stroke={theme.colors.textFaint} strokeOpacity={0.28} strokeWidth={0.8} />
          ))}
          <Path d={linePath(selected, model)} fill="none" stroke={theme.colors.primary} strokeWidth={2.6} />
          {selected.points.map((point) => {
            const dateIndex = model.dates.indexOf(point.date);
            const x = LEFT + (dateIndex / Math.max(1, model.dates.length - 1)) * (WIDTH - LEFT - RIGHT);
            const y = TOP + ((model.maxGapPp - point.gapPp) / (model.maxGapPp - model.minGapPp)) * (HEIGHT - TOP - BOTTOM);
            return <Circle key={point.date} cx={x} cy={y} r={point.membershipChanged ? 2.5 : 1.4} fill={theme.colors.primary} />;
          })}
          <SvgText x={LEFT} y={HEIGHT - 2} fontSize="9" fill={theme.colors.textFaint}>Mortgage − savings gap (pp)</SvgText>
        </Svg>
      </View>
      <Row gap={12} style={{ flexWrap: 'wrap' }}>
        <AppText variant="tiny" color="textMuted">▲ hike</AppText>
        <AppText variant="tiny" color="textMuted">● hold</AppText>
        <AppText variant="tiny" color="textMuted">▼ cut</AppText>
        <AppText variant="tiny" color="textMuted">All {model.lines.length} eligible banks shown</AppText>
      </Row>
    </Card>
  );
});
