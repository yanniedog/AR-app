import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type {
  EconomicIndicatorId,
  EconomicOutlookPayload,
  EconomicPoint,
  EconomicPressure,
} from '../../data/economicOutlook';
import {
  economicMomentumModel,
  indicatorHistoryModel,
  inflationExpectationsModel,
  policyPathModel,
  type EconomicWindow,
} from '../../data/economicModels';
import { formatRunDate } from '../../data/format';
import type { RbaEntry } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Chip, Row } from '../ui';
import { EconomicChartFrame } from './EconomicChartFrame';
import { MomentumChart } from './MomentumChart';

export type EconomicExplorerLens =
  | EconomicIndicatorId
  | 'compare'
  | 'momentum'
  | 'policy';

const WINDOWS: EconomicWindow[] = ['1Y', '3Y', '5Y', 'All'];

export interface EconomicExplorerProps {
  data: EconomicOutlookPayload;
  rba: RbaEntry[];
  rbaHolds?: string[];
  /** @deprecated Prefer tapping a mini chart; kept for callers that pin a view. */
  initialLens?: EconomicExplorerLens;
}

function signalColor(
  direction: EconomicPressure,
  theme: ReturnType<typeof useTheme>,
): string {
  if (direction === 'higher') return theme.colors.warning;
  if (direction === 'lower') return theme.colors.primary;
  return theme.colors.textMuted;
}

function MiniSparkline({
  points,
  color,
  targetBand,
}: {
  points: EconomicPoint[];
  color: string;
  targetBand?: [number, number];
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const height = 44;
  const padX = 2;
  const padY = 4;
  if (points.length < 2) {
    return <View style={{ height, width: '100%' }} />;
  }
  const values = points.map((point) => point.value);
  if (targetBand) values.push(...targetBand);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(0.05, (rawMax - rawMin) * 0.15);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = height - padY * 2;
  const x = (index: number) => padX + (index / (points.length - 1)) * innerW;
  const y = (value: number) => padY + innerH - ((value - min) / span) * innerH;
  const path = points
    .map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`)
    .join(' ');
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height, width: '100%' }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {targetBand ? (
            <Rect
              x={padX}
              y={y(targetBand[1])}
              width={innerW}
              height={Math.max(1, y(targetBand[0]) - y(targetBand[1]))}
              fill={theme.colors.rba}
              opacity={0.12}
              rx={2}
            />
          ) : null}
          <Path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={2.5} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

function MiniTile({
  title,
  subtitle,
  valueLabel,
  selected,
  onPress,
  color,
  points,
  targetBand,
  accessibilityLabel,
}: {
  title: string;
  subtitle: string;
  valueLabel: string;
  selected: boolean;
  onPress: () => void;
  color: string;
  points: EconomicPoint[];
  targetBand?: [number, number];
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        minWidth: 148,
        minHeight: 48,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: theme.radius.md,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? color : theme.colors.border,
        backgroundColor: selected ? `${color}12` : theme.colors.surfaceAlt,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <AppText variant="tiny" weight="700" style={{ flex: 1, paddingRight: 6 }}>
          {title}
        </AppText>
        <AppText variant="tiny" weight="800" style={{ color }}>
          {valueLabel}
        </AppText>
      </Row>
      <MiniSparkline points={points} color={color} targetBand={targetBand} />
      <AppText variant="tiny" color="textFaint">
        {subtitle}
      </AppText>
    </Pressable>
  );
}

function EmptyLens() {
  return (
    <AppText variant="small" color="textMuted">
      This view needs more official observations.
    </AppText>
  );
}

function ExpandedDetail({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <AppText variant="small" weight="700">
        {title}
      </AppText>
      {detail ? (
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 2, marginBottom: 8 }}>
          {detail}
        </AppText>
      ) : (
        <View style={{ height: 8 }} />
      )}
      {children}
    </View>
  );
}

export function EconomicExplorer({
  data,
  rba,
  rbaHolds,
  initialLens,
}: EconomicExplorerProps) {
  const theme = useTheme();
  const [window, setWindow] = useState<EconomicWindow>('5Y');

  const comparison = useMemo(
    () => inflationExpectationsModel(data, window),
    [data, window],
  );
  const momentum = useMemo(() => economicMomentumModel(data), [data]);
  const policy = useMemo(() => policyPathModel(data, rba, window), [data, rba, window]);
  const [expanded, setExpanded] = useState<EconomicExplorerLens>(
    initialLens ?? (policy ? 'policy' : data.indicators[0]?.id ?? 'momentum'),
  );

  const toggle = (id: EconomicExplorerLens) => {
    setExpanded(id);
  };

  const indicatorTiles = data.indicators.map((indicator) => {
    const latest = indicator.points[indicator.points.length - 1];
    const color = signalColor(indicator.signal.direction, theme);
    const selected = expanded === indicator.id;
    return (
      <MiniTile
        key={indicator.id}
        title={indicator.label}
        subtitle={indicator.signal.label}
        valueLabel={`${latest.value.toFixed(1)}%`}
        selected={selected}
        onPress={() => toggle(indicator.id)}
        color={color}
        points={indicator.points.slice(-18)}
        targetBand={indicator.targetBand}
        accessibilityLabel={`${indicator.label}, ${latest.value.toFixed(2)} percent, ${indicator.signal.label}. ${selected ? 'Showing full chart' : 'Double tap to reveal chart'}`}
      />
    );
  });

  const policyPoints = policy
    ? [...policy.actual.slice(-24), ...policy.forecast.slice(1)]
    : [];
  const policyLatest = policyPoints.at(-1);

  return (
    <View>
      <AppText variant="tiny" color="textMuted" style={{ marginBottom: 10 }}>
        Choose one evidence lens to focus below.
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {indicatorTiles}

        {comparison ? (
          <MiniTile
            title="Inflation vs expectations"
            subtitle="Underlying · market 1Y"
            valueLabel={`${comparison.inflation.at(-1)!.value.toFixed(1)}%`}
            selected={expanded === 'compare'}
            onPress={() => toggle('compare')}
            color={theme.colors.warning}
            points={comparison.inflation.slice(-18)}
            targetBand={comparison.targetBand}
            accessibilityLabel={`Inflation versus expectations. ${expanded === 'compare' ? 'Showing full chart' : 'Double tap to reveal chart'}`}
          />
        ) : null}

        {momentum ? (
          <MiniTile
            title="Momentum"
            subtitle={`${momentum.rows.length} series · recent Δ`}
            valueLabel="Δ"
            selected={expanded === 'momentum'}
            onPress={() => toggle('momentum')}
            color={theme.colors.rba}
            points={momentum.rows.map((row, index) => ({
              date: `p${index}`,
              value: row.change,
            }))}
            accessibilityLabel={`Momentum across ${momentum.rows.length} series. ${expanded === 'momentum' ? 'Showing full chart' : 'Double tap to reveal chart'}`}
          />
        ) : null}

        {policy && policyLatest ? (
          <MiniTile
            title="Policy path"
            subtitle={
              policy.surveyDate
                ? `Survey ${formatRunDate(policy.surveyDate)}`
                : 'Cash rate · forecast'
            }
            valueLabel={`${policyLatest.value.toFixed(2)}%`}
            selected={expanded === 'policy'}
            onPress={() => toggle('policy')}
            color={theme.colors.rba}
            points={policyPoints}
            accessibilityLabel={`Policy path, ${policyLatest.value.toFixed(2)} percent. ${expanded === 'policy' ? 'Showing full chart' : 'Double tap to reveal chart'}`}
          />
        ) : null}
      </View>

      {expanded && expanded !== 'momentum' ? (
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 12 }}>
          {WINDOWS.map((item) => (
            <Chip key={item} label={item} selected={window === item} onPress={() => setWindow(item)} />
          ))}
        </Row>
      ) : null}

      {expanded && data.indicators.some((item) => item.id === expanded) ? (
        <IndicatorExpanded data={data} id={expanded as EconomicIndicatorId} window={window} />
      ) : null}

      {expanded === 'compare' ? (
        comparison ? (
          <ExpandedDetail title="Inflation vs expectations" detail="Same percent scale · scrub for exact readings">
            <EconomicChartFrame
              series={[
                {
                  id: 'underlying_inflation',
                  label: 'Underlying inflation',
                  points: comparison.inflation,
                  color: theme.colors.warning,
                },
                {
                  id: 'inflation_expectations',
                  label: 'Market 1Y expectations',
                  points: comparison.expectations,
                  color: theme.colors.primary,
                  dashed: true,
                },
              ]}
              targetBand={comparison.targetBand}
              accessibilitySummary={comparison.summary}
            />
          </ExpandedDetail>
        ) : (
          <EmptyLens />
        )
      ) : null}

      {expanded === 'momentum' ? (
        momentum ? (
          <ExpandedDetail title="Momentum" detail="Percentage-point change across recent observations">
            <MomentumChart model={momentum} />
          </ExpandedDetail>
        ) : (
          <EmptyLens />
        )
      ) : null}

      {expanded === 'policy' ? (
        policy ? (
          <ExpandedDetail
            title="Policy path"
            detail={
              policy.surveyDate
                ? `Actual cash rate joined to economists' median · survey ${formatRunDate(policy.surveyDate)}`
                : 'Actual cash rate joined to economists\' median forecast'
            }
          >
            <EconomicChartFrame
              series={[
                {
                  id: 'actual',
                  label: 'Actual cash rate',
                  points: policy.actual,
                  color: theme.colors.rba,
                  stepped: true,
                },
                {
                  id: 'forecast',
                  label: "Economists' median",
                  points: policy.forecast,
                  color: theme.colors.primary,
                  dashed: true,
                },
              ]}
              holdDates={rbaHolds}
              holdSeriesId="actual"
              accessibilitySummary={policy.summary}
            />
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 5 }}>
              Solid = official cash-rate history · dashed = survey median, not a probability · hollow diamonds = held
            </AppText>
          </ExpandedDetail>
        ) : (
          <EmptyLens />
        )
      ) : null}
    </View>
  );
}

function IndicatorExpanded({
  data,
  id,
  window,
}: {
  data: EconomicOutlookPayload;
  id: EconomicIndicatorId;
  window: EconomicWindow;
}) {
  const theme = useTheme();
  const indicator = useMemo(() => indicatorHistoryModel(data, id, window), [data, id, window]);
  const live = data.indicators.find((item) => item.id === id);
  if (!indicator || !live) return <EmptyLens />;
  const color = signalColor(live.signal.direction, theme);
  return (
    <ExpandedDetail
      title={indicator.label}
      detail={`${indicator.shortLabel} · ${live.signal.label} · obs ${formatRunDate(indicator.latest.date)}`}
    >
      <EconomicChartFrame
        series={[{
          id: indicator.id,
          label: indicator.label,
          points: indicator.points,
          color,
        }]}
        targetBand={indicator.targetBand}
        accessibilitySummary={indicator.summary}
      />
      <AppText variant="tiny" color="textMuted" style={{ marginTop: 6 }}>
        {live.signal.explanation}
      </AppText>
      {live.status === 'stale' ? (
        <AppText variant="tiny" color="warning" weight="700" style={{ marginTop: 4 }}>
          Release overdue — showing the latest verified observation
        </AppText>
      ) : null}
    </ExpandedDetail>
  );
}
