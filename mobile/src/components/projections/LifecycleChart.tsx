import React, { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import {
  metricValue,
  projectionMetricLabel,
  projectionCurrency,
  type ProjectionMetric,
  type ProjectionPoint,
  type ProjectionSeries,
} from '../../data/projections';
import type { SectionKey } from '../../types';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Row } from '../ui';
import { useChartScrub } from '../charts/ChartSliceControls';

const SERIES_STYLES = [
  { color: 'primary', dash: undefined, description: 'solid line' },
  { color: 'success', dash: '8 4', description: 'long-dashed line' },
  { color: 'warning', dash: '2 4', description: 'dotted line' },
] as const;

function dateMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function formatValue(value: number | null, metric: ProjectionMetric): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return metric === 'periodRatio' || metric === 'cumulativeRatio'
    ? `${value.toFixed(value >= 10 ? 1 : 2)}×`
    : projectionCurrency(value);
}

function pathFor(
  points: ProjectionPoint[],
  metric: ProjectionMetric,
  xAt: (date: string) => number,
  yAt: (value: number) => number,
): string {
  let path = '';
  let started = false;
  for (const item of points) {
    const value = metricValue(item, metric);
    if (value == null || !Number.isFinite(value)) {
      started = false;
      continue;
    }
    path += `${started ? ' L' : 'M'} ${xAt(item.date)} ${yAt(value)}`;
    started = true;
  }
  return path;
}

function nearestPoint(points: ProjectionPoint[], target: number): ProjectionPoint | null {
  if (!points.length) return null;
  if (target < dateMs(points[0].date) || target > dateMs(points.at(-1)!.date)) return null;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dateMs(points[middle].date) < target) low = middle + 1;
    else high = middle;
  }
  const after = points[low];
  const before = points[Math.max(0, low - 1)];
  return Math.abs(dateMs(before.date) - target) <= Math.abs(dateMs(after.date) - target) ? before : after;
}

export interface LifecycleChartController {
  previous(): void;
  next(): void;
}

export function LifecycleChart({
  section,
  history,
  series,
  metric,
  asAt,
  controllerRef,
  onRenderReady,
}: {
  section: SectionKey;
  history: ProjectionPoint[];
  series: ProjectionSeries[];
  metric: ProjectionMetric;
  asAt: string;
  controllerRef?: MutableRefObject<LifecycleChartController | null>;
  onRenderReady?: () => void;
}) {
  const theme = useTheme();
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const dates = useMemo(
    () => Array.from(new Set([
      ...history.map((item) => item.date),
      ...series.flatMap((item) => item.points.map((point) => point.date)),
    ])).sort(),
    [history, series],
  );
  const todayIndex = Math.max(0, dates.indexOf(asAt));
  const [activeIndex, setActiveIndex] = useState(todayIndex);
  useEffect(() => setActiveIndex(todayIndex), [todayIndex, metric, series]);
  const selectPrevious = useCallback(() => {
    setActiveIndex((current) => Math.max(0, current - 1));
  }, []);
  const selectNext = useCallback(() => {
    setActiveIndex((current) => Math.min(Math.max(0, dates.length - 1), current + 1));
  }, [dates.length]);
  useEffect(() => {
    if (!controllerRef) return;
    const controller = { previous: selectPrevious, next: selectNext };
    controllerRef.current = controller;
    return () => {
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [controllerRef, selectNext, selectPrevious]);

  const values = useMemo(
    () => [
      ...history.map((item) => metricValue(item, metric)),
      ...series.flatMap((item) => item.points.map((point) => metricValue(point, metric))),
    ].filter((value): value is number => value != null && Number.isFinite(value)),
    [history, metric, series],
  );
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
  const range = Math.max(1, rawMax - rawMin);
  const yMin = rawMin < 0 ? rawMin - range * 0.08 : 0;
  const yMax = rawMax + range * 0.08;
  const labelScale = Math.min(1.55, Math.max(1, fontScale));
  const labelSize = 9 * labelScale;
  const height = (viewportWidth >= 768 ? 350 : 280) + (labelScale - 1) * 48;
  const padL = (viewportWidth >= 430 ? 58 : 48) + (labelScale - 1) * 18;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const dateTimes = useMemo(() => dates.map(dateMs), [dates]);
  const firstMs = dateTimes[0] ?? dateMs(asAt);
  const lastMs = dateTimes.at(-1) ?? dateMs(asAt);
  const timeSpan = Math.max(1, lastMs - firstMs);
  const xAt = useCallback((date: string) => padL + ((dateMs(date) - firstMs) / timeSpan) * innerW,
    [firstMs, innerW, padL, timeSpan]);
  const yAt = useCallback((value: number) => padT + innerH - ((value - yMin) / (yMax - yMin)) * innerH,
    [innerH, yMax, yMin]);
  const activeDate = dates[Math.min(activeIndex, dates.length - 1)] ?? asAt;
  const scrub = useChartScrub({
    sliceCount: dates.length,
    plotWidth: innerW,
    plotLeft: padL,
    onSelectIndex: setActiveIndex,
  });

  const paths = useMemo(() => ({
    history: pathFor(history, metric, xAt, yAt),
    series: series.map((item) => ({ id: item.id, path: pathFor(item.points, metric, xAt, yAt) })),
  }), [history, metric, series, xAt, yAt]);

  const activeMs = dateTimes[Math.min(activeIndex, dateTimes.length - 1)] ?? dateMs(asAt);
  const activeValues = series.map((item) => ({
    series: item,
    point: nearestPoint(item.points, activeMs),
  }));
  const activeHistory = activeDate < asAt ? nearestPoint(history, activeMs) : null;
  const metricLabel = projectionMetricLabel(section, metric);
  const accessibilitySummary = [
    ...(activeHistory ? [`Approximate history ${formatValue(metricValue(activeHistory, metric), metric)}`] : []),
    ...activeValues
    .map(({ series: item, point: selected }) => `${item.label} ${formatValue(selected ? metricValue(selected, metric) : null, metric)}`)
  ].join(', ');
  useEffect(() => {
    if (width > 0 && dates.length > 0) onRenderReady?.();
  }, [dates.length, onRenderReady, width]);

  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <View>
          <AppText variant="tiny" color="textFaint" weight="700">
            {metricLabel.toUpperCase()}
          </AppText>
          <AppText variant="h3">{shortDate(activeDate)}</AppText>
        </View>
        <AppText variant="tiny" color="textMuted">
          Drag horizontally, then release, to inspect a month
        </AppText>
      </Row>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${metricLabel} projection for ${shortDate(activeDate)}. ${accessibilitySummary}`}
        accessibilityHint="Swipe up or down to inspect the next or previous month."
        accessibilityValue={{ min: 1, max: Math.max(1, dates.length), now: activeIndex + 1, text: shortDate(activeDate) }}
        accessibilityActions={[
          { name: 'increment', label: 'Next month' },
          { name: 'decrement', label: 'Previous month' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') {
            selectNext();
          } else if (event.nativeEvent.actionName === 'decrement') {
            selectPrevious();
          }
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onTouchStart={scrub.onTouchStart}
        onTouchMove={scrub.onTouchMove}
        onTouchEnd={scrub.onTouchEnd}
        onTouchCancel={scrub.onTouchCancel}
        style={{ height, width: '100%' }}
      >
        {width > 0 && dates.length ? (
          <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
            {[0, 0.5, 1].map((fraction) => {
              const value = yMin + (yMax - yMin) * fraction;
              const y = yAt(value);
              return (
                <React.Fragment key={fraction}>
                  <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={theme.colors.border} strokeWidth={0.75} />
                  <SvgText x={padL - 5} y={y + labelSize * 0.35} textAnchor="end" fontSize={labelSize} fill={theme.colors.textFaint}>
                    {formatValue(value, metric)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {history.length > 1 ? (
              <Path
                d={paths.history}
                fill="none"
                stroke={theme.colors.textMuted}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            ) : null}
            {series.map((item, index) => {
              const seriesStyle = SERIES_STYLES[index % SERIES_STYLES.length];
              const color = theme.colors[seriesStyle.color];
              return (
                <Path
                  key={item.id}
                  d={paths.series[index]?.path ?? ''}
                  fill="none"
                  stroke={color}
                  strokeWidth={index === 1 ? 2.8 : 2.1}
                  strokeDasharray={seriesStyle.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
            <Line
              x1={xAt(asAt)}
              y1={padT}
              x2={xAt(asAt)}
              y2={height - padB}
              stroke={withAlpha(theme.colors.text, 0.45)}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <Line
              x1={xAt(activeDate)}
              y1={padT}
              x2={xAt(activeDate)}
              y2={height - padB}
              stroke={withAlpha(theme.colors.primary, 0.55)}
              strokeWidth={1}
            />
            {activeValues.map(({ series: item, point: selected }, index) => {
              const value = selected ? metricValue(selected, metric) : null;
              if (value == null) return null;
              return (
                <Circle
                  key={item.id}
                  cx={xAt(selected!.date)}
                  cy={yAt(value)}
                  r={4}
                  fill={theme.colors[SERIES_STYLES[index % SERIES_STYLES.length].color]}
                  stroke={theme.colors.card}
                  strokeWidth={1.5}
                />
              );
            })}
            {activeHistory && metricValue(activeHistory, metric) != null ? (
              <Circle
                cx={xAt(activeHistory.date)}
                cy={yAt(metricValue(activeHistory, metric)!)}
                r={4}
                fill={theme.colors.textMuted}
                stroke={theme.colors.card}
                strokeWidth={1.5}
              />
            ) : null}
            <SvgText x={padL} y={height - 7} fontSize={labelSize} fill={theme.colors.textFaint}>
              {shortDate(dates[0])}
            </SvgText>
            <SvgText x={xAt(asAt)} y={height - 7} fontSize={labelSize} fill={theme.colors.textMuted} textAnchor="middle">
              Today
            </SvgText>
            <SvgText x={width - padR} y={height - 7} fontSize={labelSize} fill={theme.colors.textFaint} textAnchor="end">
              {shortDate(dates.at(-1)!)}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      <View style={{ gap: 6 }}>
        {activeHistory ? (
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Row style={{ flex: 1 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.textMuted }} />
              <View style={{ flex: 1 }}>
                <AppText variant="small" weight="700">Approximate history</AppText>
                <AppText variant="tiny" color="textFaint">Repeated from your optional starting assumptions</AppText>
              </View>
            </Row>
            <AppText variant="body" weight="800">
              {formatValue(metricValue(activeHistory, metric), metric)}
            </AppText>
          </Row>
        ) : null}
        {activeValues.map(({ series: item, point: selected }, index) => (
          <Row key={item.id} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Row style={{ flex: 1 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: theme.colors[SERIES_STYLES[index % SERIES_STYLES.length].color],
                }}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="small" weight="700">{item.label}</AppText>
                <AppText variant="tiny" color="textFaint">
                  {SERIES_STYLES[index % SERIES_STYLES.length].description} · {item.detail}
                </AppText>
              </View>
            </Row>
            <AppText variant="body" weight="800">
              {formatValue(selected ? metricValue(selected, metric) : null, metric)}
            </AppText>
          </Row>
        ))}
        {history.length > 1 ? (
          <AppText variant="tiny" color="textMuted">Dashed line = approximate history · vertical marker = today</AppText>
        ) : null}
      </View>
    </View>
  );
}
