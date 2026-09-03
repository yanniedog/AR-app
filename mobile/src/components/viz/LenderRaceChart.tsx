import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { BankInsightsPayload } from '../../data/bankInsights';
import { formatRate } from '../../data/format';
import { lenderRaceModel } from '../../data/vizModels';
import { formatAxisDateLabel, sliceIndexFromPlotX } from '../../data/bankHistoryTransform';
import { openBank } from '../../lib/nav';
import type { Brand, HistoryWindow, SectionKey } from '../../types';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartSliceControls, useChartScrub } from '../charts/ChartSliceControls';
import { BankAvatar } from '../BankAvatar';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText, Row } from '../ui';

const FALLBACK_PALETTE = ['#3b82f6', '#14b8a6', '#d97706', '#a855f7', '#ef4444', '#0ea5e9', '#84cc16', '#ec4899'];

/**
 * Leaderboard race: today's top lenders traced back through their daily
 * best-rate rankings. Crossing lines = lenders overtaking each other.
 */
export function LenderRaceChart({
  payload,
  section,
  lowerIsBetter,
  window,
  brands,
  selectedDate,
  onDateSelect,
  auditRevision,
  onGraphicReadiness,
  onLogoReadiness,
  height = 170,
  topN = 6,
}: {
  payload: BankInsightsPayload | null;
  section: SectionKey;
  lowerIsBetter: boolean;
  window: HistoryWindow;
  brands?: Record<string, Brand>;
  selectedDate?: string | null;
  onDateSelect?: (date: string | null) => void;
  auditRevision?: string;
  onGraphicReadiness?: (state: { revision: string; accessibleSummary: boolean }) => void;
  onLogoReadiness?: (state: { revision: string; expectedCount: number; terminalCount: number }) => void;
  height?: number;
  topN?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const model = useMemo(
    () => lenderRaceModel(payload, section, lowerIsBetter, window, topN),
    [payload, section, lowerIsBetter, window, topN],
  );
  const padL = 24;
  const padR = 10;
  const padT = 8;
  const padB = 18;
  const innerW = Math.max(1, width - padL - padR);
  const scrub = useChartScrub({
    sliceCount: model?.dates.length ?? 0,
    plotWidth: innerW,
    plotLeft: padL,
    indexFromPlotX: sliceIndexFromPlotX,
    onSelectIndex: (index) => {
      const date = model?.dates[index];
      if (date) onDateSelect?.(date);
    },
  });
  const selectedIndex = selectedDate && model ? model.dates.indexOf(selectedDate) : -1;
  const activeIndex = model ? (selectedIndex >= 0 ? selectedIndex : model.dates.length - 1) : -1;
  const ranked = useMemo(() => {
    if (!model || activeIndex < 0) return [];
    return model.series
      .map((series, seriesIndex) => {
        const rank = series.ranks[activeIndex];
        const previousRank = series.ranks[Math.max(0, activeIndex - 1)];
        return {
          provider: series.provider,
          rank,
          rate: series.values[activeIndex],
          moved: rank != null && previousRank != null ? previousRank - rank : 0,
          seriesIndex,
        };
      })
      .filter((entry) => entry.rank != null)
      .sort((left, right) => left.rank! - right.rank! || left.provider.localeCompare(right.provider));
  }, [activeIndex, model]);
  const [terminalLogoProviders, setTerminalLogoProviders] = useState<ReadonlySet<string>>(() => new Set());
  const markLogoPending = useCallback((provider: string) => {
    setTerminalLogoProviders((current) => {
      if (!current.has(provider)) return current;
      const next = new Set(current);
      next.delete(provider);
      return next;
    });
  }, []);
  const markLogoTerminal = useCallback(({ provider }: { provider: string }) => {
    setTerminalLogoProviders((current) => {
      if (current.has(provider)) return current;
      const next = new Set(current);
      next.add(provider);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!auditRevision) return;
    onLogoReadiness?.({
      revision: auditRevision,
      expectedCount: ranked.length,
      terminalCount: ranked.reduce(
        (count, entry) => count + (terminalLogoProviders.has(entry.provider) ? 1 : 0),
        0,
      ),
    });
  }, [auditRevision, onLogoReadiness, ranked, terminalLogoProviders]);
  if (!model) {
    return (
      <AppText variant="small" color="textMuted">
        Not enough ranking history in this window yet. Leaders need at least two lenders with observations.
      </AppText>
    );
  }

  const innerH = height - padT - padB;
  const lanes = model.topN;
  const xAt = (i: number) =>
    padL + (model.dates.length === 1 ? innerW / 2 : (i / (model.dates.length - 1)) * innerW);
  // Ranks beyond the visible lanes park just below the last lane.
  const yAt = (rank: number) =>
    padT + ((Math.min(rank, lanes + 1) - 1) / lanes) * innerH;

  const colorFor = (provider: string, i: number) =>
    brands?.[provider]?.color || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
  return (
    <View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Lender ranking on ${formatAxisDateLabel(model.dates[activeIndex])}. ${ranked.length ? ranked.slice(0, 3).map((entry) => `Rank ${entry.rank}, ${entry.provider}, ${formatRate(entry.rate)}`).join('. ') : 'No ranked lenders.'}`}
        accessibilityHint="Swipe up or down to move between observation dates."
        accessibilityActions={[
          { name: 'increment', label: 'Next date' },
          { name: 'decrement', label: 'Previous date' },
        ]}
        onAccessibilityAction={(event) => {
          const next = event.nativeEvent.actionName === 'increment'
            ? Math.min(model.dates.length - 1, activeIndex + 1)
            : Math.max(0, activeIndex - 1);
          onDateSelect?.(model.dates[next] ?? null);
        }}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          setWidth(nextWidth);
          if (nextWidth > 0 && auditRevision) {
            onGraphicReadiness?.({ revision: auditRevision, accessibleSummary: true });
          }
        }}
        onTouchStart={scrub.onTouchStart}
        onTouchMove={scrub.onTouchMove}
        onTouchEnd={scrub.onTouchEnd}
        onTouchCancel={scrub.onTouchCancel}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg
            width={width}
            height={height}
            {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}
          >
            {Array.from({ length: lanes }, (_, lane) => (
              <React.Fragment key={`lane-${lane}`}>
                <Line
                  x1={padL}
                  y1={yAt(lane + 1)}
                  x2={width - padR}
                  y2={yAt(lane + 1)}
                  stroke={theme.colors.border}
                  strokeWidth={0.6}
                />
                <SvgText
                  x={padL - 6}
                  y={yAt(lane + 1) + 3}
                  fontSize={9}
                  fill={theme.colors.textFaint}
                  textAnchor="end"
                >
                  {`#${lane + 1}`}
                </SvgText>
              </React.Fragment>
            ))}
            {model.series.map((s, si) => {
              const color = colorFor(s.provider, si);
              let d = '';
              let started = false;
              s.ranks.forEach((rank, i) => {
                if (rank == null) return;
                const seg = `${xAt(i)} ${yAt(rank)}`;
                d += started ? ` L ${seg}` : `M ${seg}`;
                started = true;
              });
              const lastRank = s.ranks[s.ranks.length - 1];
              return (
                <React.Fragment key={s.provider}>
                  {d ? (
                    <Path d={d} stroke={withAlpha(color, 0.85)} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
                  ) : null}
                  {lastRank != null ? (
                    <Circle cx={xAt(s.ranks.length - 1)} cy={yAt(lastRank)} r={4} fill={color} />
                  ) : null}
                </React.Fragment>
              );
            })}
            <Line
              x1={xAt(activeIndex)}
              y1={padT}
              x2={xAt(activeIndex)}
              y2={padT + innerH}
              stroke={withAlpha(theme.colors.primary, 0.45)}
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <SvgText x={padL} y={height - 4} fontSize={9} fill={theme.colors.textFaint}>
              {formatAxisDateLabel(model.dates[0])}
            </SvgText>
            <SvgText x={width - padR} y={height - 4} fontSize={9} fill={theme.colors.textFaint} textAnchor="end">
              {formatAxisDateLabel(model.dates[model.dates.length - 1])}
            </SvgText>
          </Svg>
        ) : null}
      </View>

      <ChartSliceControls
        dates={model.dates}
        activeIndex={activeIndex}
        onChangeIndex={(index) => onDateSelect?.(model.dates[index] ?? null)}
        valueLabel={ranked.length ? ranked.slice(0, 3).map((entry) => `#${entry.rank} ${entry.provider}`).join(' · ') : 'No ranks'}
        detail={`Leaders on ${formatAxisDateLabel(model.dates[activeIndex])}`}
      />

      {ranked.map((entry) => (
        <Pressable
          key={entry.provider}
          onPress={() => openBank(entry.provider, { date: model.dates[activeIndex], section })}
          accessibilityRole="button"
          accessibilityLabel={`Rank ${entry.rank}, ${entry.provider}, ${formatRate(entry.rate)}, observed ${formatAxisDateLabel(model.dates[activeIndex])}${
            entry.moved ? `, ${entry.moved > 0 ? 'up' : 'down'} ${Math.abs(entry.moved)} places since the previous observation` : ''
          }`}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Row gap={8} style={{ paddingVertical: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorFor(entry.provider, entry.seriesIndex) }} />
            <AppText variant="tiny" weight="700" color="textFaint" style={{ width: 22 }}>
              #{entry.rank}
            </AppText>
            <BankAvatar
              provider={entry.provider}
              size={22}
              onAssetPending={markLogoPending}
              onAssetTerminal={markLogoTerminal}
            />
            <AppText variant="small" weight="600" numberOfLines={1} style={{ flex: 1 }}>
              {entry.provider}
            </AppText>
            {entry.moved !== 0 ? (
              <AppText
                variant="tiny"
                weight="700"
                style={{ color: entry.moved > 0 ? theme.colors.success : theme.colors.danger }}
              >
                {entry.moved > 0 ? '▲' : '▼'} {Math.abs(entry.moved)}
              </AppText>
            ) : null}
            <AppText variant="small" weight="800">
              {formatRate(entry.rate)}
            </AppText>
          </Row>
        </Pressable>
      ))}
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
        Observed {formatAxisDateLabel(model.dates[activeIndex])} ranking across {model.fieldSizes[activeIndex]} lenders · tap a lender for their dated profile
      </AppText>
    </View>
  );
}
