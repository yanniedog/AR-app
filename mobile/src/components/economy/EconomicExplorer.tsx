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
import { uiCount, uiDate, uiJoin, uiLabel, type UiCopy, type UiChild } from '../../lib/uiCopy';
import { uiChartPercent, uiChartWindow, uiEconomicIndicator, uiEconomicPressure } from '../../lib/chartUiCopy';
import { hasPositiveChartLayout, type ChartRenderEvidence } from '../../lib/chartRenderEvidence';
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
  lens?: EconomicExplorerLens;
  onLensChange?: (lens: EconomicExplorerLens) => void;
  window?: EconomicWindow;
  onWindowChange?: (window: EconomicWindow) => void;
  selectionStep?: number;
  onGraphicReady?: (result: ChartRenderEvidence) => void;
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
  signal,
  valueLabel,
  selected,
  onPress,
  color,
  points,
  targetBand,
  accessibilityLabel,
}: {
  title: UiCopy;
  signal: UiCopy;
  valueLabel: UiCopy;
  selected: boolean;
  onPress: () => void;
  color: string;
  points: EconomicPoint[];
  targetBand?: [number, number];
  accessibilityLabel: UiCopy;
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
        {signal}
      </AppText>
    </Pressable>
  );
}

function EmptyLens({ auditRevision = '', onGraphicReady }: {
  auditRevision?: string; onGraphicReady?: (evidence: ChartRenderEvidence) => void;
}) {
  return (
    <AppText key={auditRevision} variant="small" color="textMuted" onLayout={(event) => {
      onGraphicReady?.({ revision: auditRevision, expectedCount: 0, pointCount: 0,
        accessibleSummary: false, layoutMeasured: hasPositiveChartLayout(event), emptyStateRendered: true });
    }}>
      {uiLabel("No observations")}</AppText>
  );
}

function ExpandedDetail({
  title,
  facts,
  children,
}: {
  title: UiCopy;
  facts?: readonly { label: UiCopy; value: UiCopy }[];
  children: UiChild;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <AppText variant="small" weight="700">
        {title}
      </AppText>
      <View style={{ gap: 4, marginTop: 2, marginBottom: 8 }}>
        {facts?.map((fact, i) => <AppText key={i} variant="tiny" color="textMuted">{uiJoin(fact.label, ' · ', fact.value)}</AppText>)}
      </View>
      {children}
    </View>
  );
}

export function EconomicExplorer({
  data,
  rba,
  rbaHolds,
  initialLens,
  lens: controlledLens,
  onLensChange,
  window: controlledWindow,
  onWindowChange,
  selectionStep,
  onGraphicReady,
}: EconomicExplorerProps) {
  const theme = useTheme();
  const [localWindow, setLocalWindow] = useState<EconomicWindow>('5Y');
  const window = controlledWindow ?? localWindow;
  const changeWindow = (next: EconomicWindow) => {
    if (controlledWindow == null) setLocalWindow(next);
    onWindowChange?.(next);
  };

  const comparison = useMemo(
    () => inflationExpectationsModel(data, window),
    [data, window],
  );
  const momentum = useMemo(() => economicMomentumModel(data), [data]);
  const policy = useMemo(() => policyPathModel(data, rba, window), [data, rba, window]);
  const [localExpanded, setLocalExpanded] = useState<EconomicExplorerLens>(
    initialLens ?? (policy ? 'policy' : data.indicators[0]?.id ?? 'momentum'),
  );
  const expanded = controlledLens ?? localExpanded;

  const toggle = (id: EconomicExplorerLens) => {
    if (controlledLens == null) setLocalExpanded(id);
    onLensChange?.(id);
  };
  const graphicRevision = `${data.checkedAt || data.fetchedAt}:${expanded}:${window}:${selectionStep ?? 0}`;

  const indicatorTiles = data.indicators.map((indicator) => {
    const latest = indicator.points[indicator.points.length - 1];
    const color = signalColor(indicator.signal.direction, theme);
    const selected = expanded === indicator.id;
    return (
      <MiniTile
        key={indicator.id}
        title={uiEconomicIndicator(indicator.id)}
        signal={uiEconomicPressure(indicator.signal.direction)}
        valueLabel={uiChartPercent(latest.value, 1)}
        selected={selected}
        onPress={() => toggle(indicator.id)}
        color={color}
        points={indicator.points.slice(-18)}
        targetBand={indicator.targetBand}
        accessibilityLabel={uiJoin(uiEconomicIndicator(indicator.id), ' · ', uiChartPercent(latest.value), ' · ', uiEconomicPressure(indicator.signal.direction))}
      />
    );
  });

  const policyPoints = policy
    ? [...policy.actual.slice(-24), ...policy.forecast.slice(1)]
    : [];
  const policyLatest = policyPoints.at(-1);

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {indicatorTiles}

        {comparison ? (
          <MiniTile
            title="Inflation expectations"
            signal={uiLabel('Comparison')}
            valueLabel={uiChartPercent(comparison.inflation.at(-1)!.value, 1)}
            selected={expanded === 'compare'}
            onPress={() => toggle('compare')}
            color={theme.colors.warning}
            points={comparison.inflation.slice(-18)}
            targetBand={comparison.targetBand}
            accessibilityLabel="Inflation expectations"
          />
        ) : null}

        {momentum ? (
          <MiniTile
            title="Momentum"
            signal={uiJoin(uiCount(momentum.rows.length), ' ', 'Signals')}
            valueLabel="Changes"
            selected={expanded === 'momentum'}
            onPress={() => toggle('momentum')}
            color={theme.colors.rba}
            points={momentum.rows.map((row, index) => ({
              date: `p${index}`,
              value: row.change,
            }))}
            accessibilityLabel={uiJoin('Momentum', ' · ', uiCount(momentum.rows.length), ' ', 'Signals')}
          />
        ) : null}

        {policy && policyLatest ? (
          <MiniTile
            title="Policy path"
            signal={uiJoin('Survey', ' · ', uiDate(policy.surveyDate))}
            valueLabel={uiChartPercent(policyLatest.value)}
            selected={expanded === 'policy'}
            onPress={() => toggle('policy')}
            color={theme.colors.rba}
            points={policyPoints}
            accessibilityLabel={uiJoin('Policy path', ' · ', uiChartPercent(policyLatest.value))}
          />
        ) : null}
      </View>

      {expanded && expanded !== 'momentum' ? (
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 12 }}>
          {WINDOWS.map((item) => (
            <Chip key={item} label={uiChartWindow(item)} selected={window === item} onPress={() => changeWindow(item)} />
          ))}
        </Row>
      ) : null}

      {expanded && data.indicators.some((item) => item.id === expanded) ? (
        <IndicatorExpanded data={data} id={expanded as EconomicIndicatorId} window={window} selectionStep={selectionStep}
          auditRevision={graphicRevision} onGraphicReady={onGraphicReady} />
      ) : null}

      {expanded === 'compare' ? (
        comparison ? (
          <ExpandedDetail title="Inflation expectations">
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
              selectionStep={selectionStep}
              auditRevision={graphicRevision} onGraphicReady={onGraphicReady}
            />
          </ExpandedDetail>
        ) : (
          <EmptyLens auditRevision={graphicRevision} onGraphicReady={onGraphicReady} />
        )
      ) : null}

      {expanded === 'momentum' ? (
        momentum ? (
          <ExpandedDetail title="Momentum">
            <MomentumChart model={momentum} auditRevision={graphicRevision} onGraphicReady={onGraphicReady} />
          </ExpandedDetail>
        ) : (
          <EmptyLens auditRevision={graphicRevision} onGraphicReady={onGraphicReady} />
        )
      ) : null}

      {expanded === 'policy' ? (
        policy ? (
          <ExpandedDetail
            title="Policy path"
            facts={[{ label: 'Survey', value: uiDate(policy.surveyDate) }]}
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
              selectionStep={selectionStep}
              auditRevision={graphicRevision} onGraphicReady={onGraphicReady}
            />
            <AppText variant="tiny" color="textFaint" style={{ marginTop: 5 }}>
              {uiJoin('Basis', ' · ', 'Survey', ' · ', 'Probability', ' · ', 'Excluded')}
            </AppText>
          </ExpandedDetail>
        ) : (
          <EmptyLens auditRevision={graphicRevision} onGraphicReady={onGraphicReady} />
        )
      ) : null}
    </View>
  );
}

function IndicatorExpanded({
  data,
  id,
  window,
  selectionStep,
  auditRevision,
  onGraphicReady,
}: {
  data: EconomicOutlookPayload;
  id: EconomicIndicatorId;
  window: EconomicWindow;
  selectionStep?: number;
  auditRevision?: string;
  onGraphicReady?: (evidence: ChartRenderEvidence) => void;
}) {
  const theme = useTheme();
  const indicator = useMemo(() => indicatorHistoryModel(data, id, window), [data, id, window]);
  const live = data.indicators.find((item) => item.id === id);
  if (!indicator || !live) return <EmptyLens auditRevision={auditRevision} onGraphicReady={onGraphicReady} />;
  const color = signalColor(live.signal.direction, theme);
  return (
    <ExpandedDetail
      title={uiEconomicIndicator(indicator.id)}
      facts={[{ label: 'Signal', value: uiEconomicPressure(live.signal.direction) }, { label: 'Observed', value: uiDate(indicator.latest.date) }]}
    >
      <EconomicChartFrame
        series={[{
          id: indicator.id,
          label: uiEconomicIndicator(indicator.id),
          points: indicator.points,
          color,
        }]}
        targetBand={indicator.targetBand}
        selectionStep={selectionStep}
        auditRevision={auditRevision} onGraphicReady={onGraphicReady}
      />
      {live.status === 'stale' ? (
        <AppText variant="tiny" color="warning" weight="700" style={{ marginTop: 4 }}>
          {uiJoin('Release overdue', ' · ', 'Observed', ' · ', uiDate(indicator.latest.date))}
        </AppText>
      ) : null}
    </ExpandedDetail>
  );
}
