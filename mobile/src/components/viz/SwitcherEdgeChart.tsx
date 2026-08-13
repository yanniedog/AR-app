import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { formatAxisDateLabel, historyDatesInWindow, sliceIndexFromPlotX } from '../../data/bankHistoryTransform';
import { spreadGapModel } from '../../data/vizModels';
import type { BankHistoryPoint, HistoryWindow, SectionKey } from '../../types';
import { SECTIONS } from '../../constants';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartSliceControls, useChartScrub } from '../charts/ChartSliceControls';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText, Badge, Row } from '../ui';

/**
 * Advertised spread: how far the best advertised rate sits from the median
 * advertised rate row. Product cohorts are mixed, so this is not a savings claim.
 */
export function SwitcherEdgeChart({
  dates,
  points,
  section,
  window = 'All',
  selectedDate,
  onDateSelect,
  height = 150,
}: {
  dates: string[];
  points: BankHistoryPoint[];
  section: SectionKey;
  window?: HistoryWindow;
  selectedDate?: string | null;
  onDateSelect?: (date: string | null) => void;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const windowDates = useMemo(() => historyDatesInWindow(dates, window), [dates, window]);
  const windowPoints = useMemo(() => {
    const byDate = new Map(points.map((point) => [point.date, point]));
    return windowDates.map((date) => byDate.get(date) ?? {
      date,
      min: null,
      max: null,
      mean: null,
      median: null,
      count: 0,
    });
  }, [points, windowDates]);
  const model = useMemo(
    () => spreadGapModel(windowDates, windowPoints, lowerIsBetter),
    [windowDates, windowPoints, lowerIsBetter],
  );

  const padL = 34;
  const padR = 10;
  const padT = 8;
  const padB = 18;
  const innerW = Math.max(1, width - padL - padR);
  const count = model?.points.length ?? 0;
  const activeDate = selectedDate && model?.points.some((point) => point.date === selectedDate)
    ? selectedDate
    : model?.points.at(-1)?.date ?? '';
  const activeIndex = Math.max(0, model?.points.findIndex((point) => point.date === activeDate) ?? 0);
  const scrub = useChartScrub({
    sliceCount: count,
    plotWidth: innerW,
    plotLeft: padL,
    indexFromPlotX: sliceIndexFromPlotX,
    onSelectIndex: (index) => {
      const date = model?.points[index]?.date;
      if (date) onDateSelect?.(date);
    },
  });
  if (!model) {
    return (
      <AppText variant="small" color="textMuted">
        No spread history available for this window yet.
      </AppText>
    );
  }

  const innerH = height - padT - padB;
  const yMax = Math.max(1, model.maxBps * 1.1);
  const n = model.points.length;
  const xAt = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (bps: number) => padT + innerH - (bps / yMax) * innerH;

  let line = '';
  let area = '';
  let started = false;
  let lastX: number | null = null;
  let firstX: number | null = null;
  model.points.forEach((p, i) => {
    if (p.gapBps == null) return;
    const x = xAt(i);
    const y = yAt(p.gapBps);
    line += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
    if (!started) firstX = x;
    lastX = x;
    started = true;
  });
  if (started && firstX != null && lastX != null) {
    area = `${line} L ${lastX} ${yAt(0)} L ${firstX} ${yAt(0)} Z`;
  }

  const ink = theme.colors.primary;
  const widestIdx = model.widestDate ? model.points.findIndex((p) => p.date === model.widestDate) : -1;
  const widestPoint = widestIdx >= 0 ? model.points[widestIdx] : null;
  const activePoint = model.points[activeIndex];
  const activeGapBps = activePoint?.gapBps ?? null;
  const isHistorical = activeIndex < model.points.length - 1;
  const activeAtWidest = activeGapBps != null && model.maxBps > 0 && activeGapBps >= model.maxBps;

  return (
    <View>
      <View style={{ gap: 3, marginBottom: 8 }}>
        <Row gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <AppText variant="rateHero" style={{ color: ink }}>
            {activeGapBps != null ? `${Math.round(activeGapBps)} bps` : '—'}
          </AppText>
          {activeAtWidest ? <Badge label="widest in window" tone="primary" /> : null}
        </Row>
        <AppText variant="tiny" color="textMuted">
          {isHistorical ? 'Selected-date gap' : 'Latest gap'} between the typical tracked rate and the best advertised rate
        </AppText>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${SECTIONS[section].title} advertised spread on ${formatAxisDateLabel(activeDate)}: ${activeGapBps != null ? `${Math.round(activeGapBps * 10) / 10} basis points` : 'no spread observation'}.`}
        accessibilityHint="Swipe up or down to move between observation dates."
        accessibilityActions={[
          { name: 'increment', label: 'Next date' },
          { name: 'decrement', label: 'Previous date' },
        ]}
        onAccessibilityAction={(event) => {
          const next = event.nativeEvent.actionName === 'increment'
            ? Math.min(model.points.length - 1, activeIndex + 1)
            : Math.max(0, activeIndex - 1);
          onDateSelect?.(model.points[next]?.date ?? null);
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onTouchStart={scrub.onTouchStart}
        onTouchMove={scrub.onTouchMove}
        onTouchEnd={scrub.onTouchEnd}
        onTouchCancel={scrub.onTouchCancel}
        style={{ width: '100%', height }}
      >
        {width > 0 && started ? (
          <Svg
            width={width}
            height={height}
            {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}
          >
            {[0, 0.5, 1].map((frac) => {
              const bps = yMax * frac;
              const y = yAt(bps);
              return (
                <React.Fragment key={frac}>
                  <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={theme.colors.border} strokeWidth={0.6} />
                  <SvgText x={padL - 4} y={y + 3} fontSize={9} fill={theme.colors.textFaint} textAnchor="end">
                    {Math.round(bps)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            <Path d={area} fill={withAlpha(ink, theme.dark ? 0.28 : 0.18)} />
            <Path d={line} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
            {widestPoint?.gapBps != null && !activeAtWidest ? (
              <Circle cx={xAt(widestIdx)} cy={yAt(widestPoint.gapBps)} r={3.5} fill={theme.colors.warning} />
            ) : null}
            {activePoint?.gapBps != null ? (
              <Circle cx={xAt(activeIndex)} cy={yAt(activePoint.gapBps)} r={4.5} fill={ink} />
            ) : null}
            <SvgText x={padL} y={height - 4} fontSize={9} fill={theme.colors.textFaint}>
              {formatAxisDateLabel(model.points[0].date)}
            </SvgText>
            <SvgText x={width - padR} y={height - 4} fontSize={9} fill={theme.colors.textFaint} textAnchor="end">
              {formatAxisDateLabel(model.points[n - 1].date)}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      <ChartSliceControls
        dates={model.points.map((point) => point.date)}
        activeIndex={activeIndex}
        onChangeIndex={(index) => {
          const date = model.points[index]?.date;
          if (date) onDateSelect?.(date);
        }}
        valueLabel={activePoint?.gapBps != null ? `${Math.round(activePoint.gapBps * 10) / 10} bp spread` : '—'}
        detail="best versus typical advertised"
      />
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
        This spread mixes advertised products and tiers. Compare eligibility, fees, conditions, LVRs and terms before acting.
      </AppText>
    </View>
  );
}
