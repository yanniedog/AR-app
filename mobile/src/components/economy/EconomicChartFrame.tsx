import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import type { EconomicPoint } from '../../data/economicOutlook';
import { economicPointAtOrBefore } from '../../data/economicModels';
import { parseYmd } from '../../data/bankHistoryTransform';
import { formatRunDate } from '../../data/format';
import { buildLinePath } from '../../lib/chartSvgPaths';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartSliceControls, useChartScrub } from '../charts/ChartSliceControls';
import { AppText, Row } from '../ui';

export interface EconomicChartSeries {
  id: string;
  label: string;
  points: EconomicPoint[];
  color: string;
  dashed?: boolean;
  stepped?: boolean;
}

export interface EconomicChartFrameProps {
  series: EconomicChartSeries[];
  accessibilitySummary: string;
  targetBand?: [number, number];
  targetBandLabel?: string;
  height?: number;
  holdDates?: string[];
  holdSeriesId?: string;
}

function validTime(date: string): number {
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? value : 0;
}

function nearestIndex(values: number[], target: number): number {
  if (!values.length) return 0;
  let best = 0;
  let distance = Math.abs(values[0] - target);
  for (let index = 1; index < values.length; index += 1) {
    const nextDistance = Math.abs(values[index] - target);
    if (nextDistance < distance) {
      best = index;
      distance = nextDistance;
    }
  }
  return best;
}

export function holdDatesWithinSeriesWindow(
  points: EconomicPoint[],
  holdDates: string[] | undefined,
): string[] {
  const times = points.map((point) => parseYmd(point.date)).filter((value) => value != null);
  if (!times.length) return [];
  const first = Math.min(...times);
  const last = Math.max(...times);
  return (holdDates ?? [])
    .map((raw) => String(raw || '').slice(0, 10))
    .filter((date) => {
      const time = parseYmd(date);
      return time != null && time >= first && time <= last;
    });
}

function buildStepPath(
  points: EconomicPoint[],
  xForDate: (date: string) => number,
  yForValue: (value: number) => number,
): string | null {
  if (!points.length) return null;
  let path = `M ${xForDate(points[0].date)} ${yForValue(points[0].value)}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const x = xForDate(point.date);
    path += ` L ${x} ${yForValue(previous.value)} L ${x} ${yForValue(point.value)}`;
  }
  return path;
}

export function EconomicChartFrame({
  series,
  accessibilitySummary,
  targetBand,
  targetBandLabel = 'RBA 2–3% reference band',
  height = 208,
  holdDates,
  holdSeriesId,
}: EconomicChartFrameProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const allPoints = useMemo(
    () => series.flatMap((item) => item.points.map((point) => ({ ...point, seriesId: item.id }))),
    [series],
  );
  const dates = useMemo(() => {
    const values = new Set(allPoints.map((point) => point.date));
    const holdSeries = holdSeriesId ? series.find((item) => item.id === holdSeriesId) : null;
    if (holdSeries) {
      for (const date of holdDatesWithinSeriesWindow(holdSeries.points, holdDates)) values.add(date);
    }
    return [...values].sort();
  }, [allPoints, holdDates, holdSeriesId, series]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate && dates.includes(selectedDate)
    ? selectedDate
    : dates.at(-1) ?? '';
  const activeIndex = Math.max(0, dates.indexOf(activeDate));

  const padL = 38;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const times = useMemo(() => dates.map(validTime), [dates]);
  const firstTime = times[0] ?? 0;
  const timeSpan = Math.max(1, (times.at(-1) ?? firstTime) - firstTime);
  const scrub = useChartScrub({
    sliceCount: dates.length,
    plotWidth: innerW,
    onSelectIndex: (index) => {
      if (dates[index]) setSelectedDate(dates[index]);
    },
    indexFromPlotX: (plotX, plotWidth) => {
      const clamped = Math.max(0, Math.min(plotWidth, plotX));
      return nearestIndex(times, firstTime + (clamped / Math.max(1, plotWidth)) * timeSpan);
    },
  });
  const revision = `${series.map((item) => `${item.id}:${item.points.at(-1)?.date ?? ''}:${item.points.length}`).join('|')}:${holdDates?.at(-1) ?? ''}`;
  useEffect(() => setSelectedDate(null), [revision]);

  if (!allPoints.length) {
    return <AppText variant="small" color="textMuted">No observations available for this view.</AppText>;
  }
  const values = allPoints.map((point) => point.value);
  if (targetBand) values.push(...targetBand);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(0.12, (rawMax - rawMin) * 0.12);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = Math.max(0.01, max - min);
  const xForDate = (date: string) => padL + ((validTime(date) - firstTime) / timeSpan) * innerW;
  const yForValue = (value: number) => padT + innerH - ((value - min) / span) * innerH;
  const activeX = xForDate(activeDate);

  const selectedValues = series.map((item) => ({
    ...item,
    point: economicPointAtOrBefore(item.points, activeDate),
  }));
  const selectedText = selectedValues
    .filter((item) => item.point)
    .map((item) => `${item.label} ${item.point!.value.toFixed(2)} percent on ${item.point!.date}`)
    .join('; ');

  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') {
      setSelectedDate(dates[Math.min(dates.length - 1, activeIndex + 1)]);
    } else if (event.nativeEvent.actionName === 'decrement') {
      setSelectedDate(dates[Math.max(0, activeIndex - 1)]);
    }
  };

  return (
    <View>
      <Row gap={12} style={{ flexWrap: 'wrap', marginBottom: 4 }}>
        {series.map((item) => (
          <Row key={item.id} gap={5}>
            <View
              style={{
                width: 18,
                borderTopWidth: 2,
                borderColor: item.color,
                borderStyle: item.dashed ? 'dashed' : 'solid',
              }}
            />
            <AppText variant="tiny" color="textMuted">{item.label}</AppText>
          </Row>
        ))}
        {targetBand ? (
          <Row gap={5}>
            <View style={{ width: 14, height: 8, backgroundColor: withAlpha(theme.colors.rba, 0.16) }} />
            <AppText variant="tiny" color="textMuted">{targetBandLabel}</AppText>
          </Row>
        ) : null}
      </Row>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
            {targetBand ? (
              <Rect
                x={padL}
                y={yForValue(targetBand[1])}
                width={innerW}
                height={Math.max(1, yForValue(targetBand[0]) - yForValue(targetBand[1]))}
                fill={withAlpha(theme.colors.rba, 0.12)}
                rx={3}
              />
            ) : null}
            {[0, 0.5, 1].map((fraction) => {
              const value = min + span * fraction;
              const y = yForValue(value);
              return (
                <React.Fragment key={fraction}>
                  <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={theme.colors.border} strokeWidth={1} />
                  <SvgText x={padL - 4} y={y + 3} fontSize={9} textAnchor="end" fill={theme.colors.textFaint}>
                    {value.toFixed(1)}%
                  </SvgText>
                </React.Fragment>
              );
            })}
            {series.map((item) => {
              const path = item.stepped
                ? buildStepPath(item.points, xForDate, yForValue)
                : buildLinePath(
                    item.points.map((point) => point.value),
                    (index) => xForDate(item.points[index].date),
                    yForValue,
                    true,
                  );
              const latest = item.points.at(-1);
              return (
                <React.Fragment key={item.id}>
                  {path ? (
                    <Path
                      d={path}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={item.dashed ? '6 5' : undefined}
                    />
                  ) : null}
                  {latest ? (
                    <Circle cx={xForDate(latest.date)} cy={yForValue(latest.value)} r={3.5} fill={item.color} />
                  ) : null}
                </React.Fragment>
              );
            })}
            {(holdDates ?? []).map((raw) => {
              const date = String(raw || '').slice(0, 10);
              const holdSeries = holdSeriesId ? series.find((item) => item.id === holdSeriesId) : null;
              const point = holdSeries ? economicPointAtOrBefore(holdSeries.points, date) : null;
              if (!point || !dates.includes(date)) return null;
              const cx = xForDate(date);
              const cy = yForValue(point.value);
              return (
                <Polygon
                  key={`hold-${date}`}
                  points={`${cx},${cy - 6} ${cx + 5},${cy} ${cx},${cy + 6} ${cx - 5},${cy}`}
                  fill={theme.colors.surface}
                  stroke={theme.colors.rba}
                  strokeWidth={1.4}
                />
              );
            })}
            <Line
              x1={activeX}
              y1={padT}
              x2={activeX}
              y2={padT + innerH}
              stroke={withAlpha(theme.colors.primary, 0.65)}
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <SvgText x={padL} y={height - 6} fontSize={9} fill={theme.colors.textFaint}>
              {formatRunDate(dates[0])}
            </SvgText>
            <SvgText x={width - padR} y={height - 6} textAnchor="end" fontSize={9} fill={theme.colors.textFaint}>
              {formatRunDate(dates.at(-1)!)}
            </SvgText>
          </Svg>
        ) : null}
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${accessibilitySummary} Selected ${formatRunDate(activeDate)}. ${selectedText}.`}
          accessibilityHint="Tap the chart to select a date. Swipe up or down to move between observations."
          accessibilityActions={[
            { name: 'increment', label: 'Next observation' },
            { name: 'decrement', label: 'Previous observation' },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          onTouchStart={scrub.onTouchStart}
          onTouchMove={scrub.onTouchMove}
          onTouchEnd={scrub.onTouchEnd}
          onTouchCancel={scrub.onTouchCancel}
          style={{ position: 'absolute', left: padL, right: padR, top: padT, bottom: padB }}
        />
      </View>
      <ChartSliceControls
        dates={dates}
        activeIndex={activeIndex}
        onChangeIndex={(index) => setSelectedDate(dates[index] ?? null)}
        valueLabel={selectedValues.filter((item) => item.point).map((item) => `${item.label} ${item.point!.value.toFixed(2)}%`).join(' · ') || '—'}
        detail={selectedValues.some((item) => item.point?.date !== activeDate) ? 'Latest observations at or before this date' : null}
      />
    </View>
  );
}
