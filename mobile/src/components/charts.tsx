import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { parseYmd, rbaHoldsInWindow, rbaRateAsOf, rbaTimelineDates } from '../data/bankHistoryTransform';
import { formatRate, formatRateDigits, formatRunDate } from '../data/format';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { rbaChartA11ySummary } from '../lib/a11ySummaries';
import type { RbaEntry } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { ChartSliceControls, useChartScrub } from './charts/ChartSliceControls';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DRAW_MS = 800;

function useFirstMountDrawIn(reducedMotion: boolean, duration = DRAW_MS) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const started = useRef(false);
  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      started.current = true;
      return;
    }
    if (started.current) return;
    started.current = true;
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [duration, progress, reducedMotion]);
  return progress;
}

function estimateStepPathLength(data: RbaEntry[], x: (i: number) => number, y: (rate: number) => number): number {
  if (data.length <= 1) return 1;
  let len = 0;
  for (let i = 1; i < data.length; i += 1) {
    len += Math.abs(x(i) - x(i - 1));
    len += Math.abs(y(data[i].rate) - y(data[i - 1].rate));
  }
  return Math.max(1, len);
}

/** Cash-rate step chart with hold meetings and keyboard/screen-reader slice navigation. */
export function RbaChart({
  data,
  holds,
  height = 160,
}: {
  data: RbaEntry[];
  holds?: string[];
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const drawProgress = useFirstMountDrawIn(reducedMotion);
  const timeline = useMemo(() => rbaTimelineDates(data, holds), [data, holds]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(null);
  }, [data, holds]);

  const padL = 8;
  const padR = 40;
  const padT = 16;
  const padB = 18;

  const rates = data.map((d) => d.rate);
  const minR = data.length ? Math.min(...rates) : 0;
  const maxR = data.length ? Math.max(...rates) : 1;
  const span = maxR - minR || 1;

  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;

  const firstTs = data.length ? parseYmd(data[0].date) : null;
  const chartEndDate = timeline.at(-1) ?? data.at(-1)?.date ?? '';
  const lastTs = parseYmd(chartEndDate);
  const timeSpan = firstTs != null && lastTs != null ? Math.max(1, lastTs - firstTs) : 1;
  const xAtDate = (date: string) => {
    const ts = parseYmd(date);
    if (ts == null || firstTs == null) return padL;
    return padL + ((ts - firstTs) / timeSpan) * innerW;
  };
  const x = (i: number) => xAtDate(data[i].date);
  const y = (rate: number) => padT + innerH - ((rate - minR) / span) * innerH;

  const holdMarks = useMemo(
    () => (data.length ? rbaHoldsInWindow(timeline, holds, data) : []),
    [data, holds, timeline],
  );

  const pathModel = useMemo(() => {
    if (!data.length) return { pathD: '', pathLength: 1 };
    const xForDate = (date: string) => {
      const ts = parseYmd(date);
      if (ts == null || firstTs == null) return padL;
      return padL + ((ts - firstTs) / timeSpan) * innerW;
    };
    const xForIndex = (index: number) => xForDate(data[index].date);
    const yForRate = (rate: number) => padT + innerH - ((rate - minR) / span) * innerH;
    let d = `M ${xForIndex(0)} ${yForRate(data[0].rate)}`;
    for (let i = 1; i < data.length; i += 1) {
      d += ` L ${xForIndex(i)} ${yForRate(data[i - 1].rate)} L ${xForIndex(i)} ${yForRate(data[i].rate)}`;
    }
    return {
      pathD: d,
      pathLength: width <= 0 ? 1 : estimateStepPathLength(data, xForIndex, yForRate),
    };
  }, [data, firstTs, innerH, innerW, minR, span, timeSpan, width]);
  const { pathD, pathLength } = pathModel;

  const pathAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - drawProgress.value),
  }));

  const activeDate =
    selectedDate && timeline.includes(selectedDate)
      ? selectedDate
      : timeline.at(-1) ?? data.at(-1)?.date ?? '';
  const activeIndex = Math.max(0, timeline.indexOf(activeDate));
  const activeRate = rbaRateAsOf(data, activeDate);
  const isHold = (holds ?? []).some((value) => String(value).slice(0, 10) === activeDate);
  const changeIndex = data.findIndex((entry) => entry.date === activeDate);
  const priorRate = changeIndex > 0 ? data[changeIndex - 1].rate : null;
  const scrub = useChartScrub({
    sliceCount: timeline.length,
    plotWidth: innerW,
    plotLeft: padL,
    onSelectIndex: (index) => {
      const date = timeline[index];
      if (date) setSelectedDate(date);
    },
    indexFromPlotX: (plotX, plotWidth) => {
      if (timeline.length <= 1 || firstTs == null) return 0;
      const target = firstTs + (Math.max(0, Math.min(plotWidth, plotX)) / Math.max(1, plotWidth)) * timeSpan;
      let best = 0;
      let distance = Infinity;
      timeline.forEach((date, index) => {
        const ts = parseYmd(date);
        if (ts == null) return;
        const next = Math.abs(ts - target);
        if (next < distance) {
          best = index;
          distance = next;
        }
      });
      return best;
    },
  });

  if (!data.length) return null;

  const last = data[data.length - 1];
  const a11ySummary = rbaChartA11ySummary(data, holdMarks.length);

  return (
    <View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${a11ySummary}. Selected ${formatRunDate(activeDate)}, ${activeRate != null ? formatRate(activeRate) : 'no rate'}${isHold ? ', held' : ''}.`}
        accessibilityActions={[{ name: 'increment', label: 'Next date' }, { name: 'decrement', label: 'Previous date' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') setSelectedDate(timeline[Math.min(timeline.length - 1, activeIndex + 1)]);
          if (event.nativeEvent.actionName === 'decrement') setSelectedDate(timeline[Math.max(0, activeIndex - 1)]);
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onTouchStart={scrub.onTouchStart}
        onTouchMove={scrub.onTouchMove}
        onTouchEnd={scrub.onTouchEnd}
        onTouchCancel={scrub.onTouchCancel}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
          <Line x1={padL} y1={y(maxR)} x2={width - padR} y2={y(maxR)} stroke={theme.colors.border} strokeWidth={1} />
          <Line x1={padL} y1={y(minR)} x2={width - padR} y2={y(minR)} stroke={theme.colors.border} strokeWidth={1} />
          <SvgText x={width - padR + 4} y={y(maxR) + 4} fontSize={10} fill={theme.colors.textFaint}>
            {formatRateDigits(maxR)}
          </SvgText>
          <SvgText x={width - padR + 4} y={y(minR) + 4} fontSize={10} fill={theme.colors.textFaint}>
            {formatRateDigits(minR)}
          </SvgText>
          <AnimatedPath
            animatedProps={pathAnimatedProps}
            d={pathD}
            stroke={theme.colors.rba}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={pathLength}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {holdMarks.map((mark) => {
            const cx = xAtDate(mark.date);
            const rate = rbaRateAsOf(data, mark.date);
            if (rate == null) return null;
            const cy = y(rate);
            return (
              <Polygon
                key={`hold-${mark.date}`}
                points={`${cx},${cy - 6} ${cx + 5},${cy} ${cx},${cy + 6} ${cx - 5},${cy}`}
                fill={theme.colors.surface}
                stroke={theme.colors.rba}
                strokeWidth={1.4}
              />
            );
          })}
          <Circle cx={x(data.length - 1)} cy={y(last.rate)} r={4} fill={theme.colors.rba} />
          <SvgText
            x={x(data.length - 1)}
            y={y(last.rate) - 8}
            fontSize={11}
            fontWeight="bold"
            fill={theme.colors.text}
            textAnchor="end"
          >
            {formatRate(last.rate)}
          </SvgText>
          </Svg>
        ) : null}
      </View>
      <ChartSliceControls
        dates={timeline}
        activeIndex={activeIndex}
        onChangeIndex={(index) => setSelectedDate(timeline[index] ?? null)}
        valueLabel={activeRate != null ? formatRate(activeRate) : '—'}
        detail={isHold ? 'On hold — no change' : priorRate != null && activeRate != null ? `${formatRate(priorRate)} → ${formatRate(activeRate)}` : null}
      />
    </View>
  );
}
