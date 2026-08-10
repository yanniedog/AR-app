import Ionicons from '@expo/vector-icons/Ionicons';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { SECTIONS } from '../../constants';
import type {
  MultiSectionPassThroughModel,
  PassThroughSourceDecision,
} from '../../data/bankInsights';
import {
  buildResponseScatterPoints,
  clampScatterZoom,
  nextScatterZoom,
  resolveResponseScatterPress,
  sectionRows,
  type ResponseScatterDecisionMarker,
} from '../../data/passThroughModels';
import { hapticSelection } from '../../lib/haptics';
import { moveTone } from '../../lib/moveSemantics';
import type { SectionKey } from '../../types';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Row } from '../ui';

const CHART_HEIGHT = 260;
const PAD_L = 42;
const PAD_R = 10;
const PAD_T = 24;
const PAD_B = 46;

const ScatterDot = memo(function ScatterDot({
  cx,
  cy,
  selected,
  fill,
  surface,
  text,
  primary,
  zoom = 1,
}: {
  cx: number;
  cy: number;
  selected: boolean;
  fill: string;
  surface: string;
  text: string;
  primary: string;
  zoom?: number;
}) {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={(selected ? 7 : 4.5) * zoom}
      fill={selected ? primary : fill}
      opacity={selected ? 1 : 0.68}
      stroke={selected ? text : surface}
      strokeWidth={(selected ? 2 : 1) * zoom}
      pointerEvents="none"
    />
  );
});

function ZoomButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        minWidth: 48,
        minHeight: 48,
        paddingHorizontal: 10,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: disabled ? theme.colors.surfaceAlt : theme.colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <AppText variant="small" weight="700" color={disabled ? 'textFaint' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Response map with an explicit untimed rail. Every eligible lender is plotted:
 * same-direction responses with a matching event use the time axis, while
 * untimed, opposite, and unchanged observations sit on the labelled rail.
 *
 * Selection paints locally first so taps stay responsive even when the parent
 * list still has to update row highlights / filters.
 */
export const ResponseScatter = memo(function ResponseScatter({
  model,
  section,
  decisions,
  selectedProvider,
  onProviderSelect,
  zoom: controlledZoom,
  onZoomChange,
  onGraphicReady,
}: {
  model: MultiSectionPassThroughModel;
  section: SectionKey;
  decisions: PassThroughSourceDecision[];
  selectedProvider: string | null;
  onProviderSelect: (provider: string | null) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onGraphicReady?: (result: { revision: string; pointCount: number }) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [localZoom, setLocalZoom] = useState(1);
  const zoom = clampScatterZoom(controlledZoom ?? localZoom);
  const updateZoom = useCallback((next: number | ((current: number) => number)) => {
    const value = clampScatterZoom(typeof next === 'function' ? next(zoom) : next);
    if (controlledZoom == null) setLocalZoom(value);
    onZoomChange?.(value);
  }, [controlledZoom, onZoomChange, zoom]);
  /** Instant paint target — synced from parent when list/chips change selection. */
  const [paintedProvider, setPaintedProvider] = useState(selectedProvider);
  useEffect(() => {
    setPaintedProvider(selectedProvider);
  }, [selectedProvider]);
  useEffect(() => {
    setLocalZoom(1);
    onZoomChange?.(1);
  }, [model.decision.date, onZoomChange, section]);

  const decisionMarkers = useMemo<ResponseScatterDecisionMarker[]>(() => {
    const markers = decisions.map((decision) => ({
      date: decision.date,
      bps: decision.bps,
      active: decision.date === model.decision.date,
    }));
    if (!markers.some((marker) => marker.active)) {
      markers.unshift({
        date: model.decision.date,
        bps: model.decision.bps,
        active: true,
      });
    }
    return markers;
  }, [decisions, model.decision.date, model.decision.bps]);

  const rows = useMemo(() => sectionRows(model, section), [model, section]);
  const plotSize = useMemo(
    () => ({
      width: Math.max(1, width * zoom),
      height: CHART_HEIGHT * zoom,
      padL: PAD_L * zoom,
      padR: PAD_R * zoom,
      padT: PAD_T * zoom,
      padB: PAD_B * zoom,
    }),
    [width, zoom],
  );
  const plot = useMemo(
    () =>
      width > 0
        ? buildResponseScatterPoints(rows, {
            ...plotSize,
            windowDays: model.windowDays,
            decisionBps: model.decision.bps,
            decisions: decisionMarkers,
          })
        : null,
    [rows, width, plotSize, model.windowDays, model.decision.bps, decisionMarkers],
  );
  const graphicRevision = `${model.decision.date}:${section}:${zoom}:${width}`;
  useEffect(() => {
    if (!plot || width <= 0) return;
    onGraphicReady?.({ revision: graphicRevision, pointCount: plot.points.length });
  }, [graphicRevision, onGraphicReady, plot, width]);

  const rowStats = useMemo(() => {
    let timed = 0;
    let withRba = 0;
    let opposite = 0;
    for (const item of rows) {
      const passed = item.response.passedBps !== 0;
      if (passed) {
        withRba += 1;
        if (item.response.daysToFirstMove != null) timed += 1;
      } else if ((item.response.netChangeBps ?? 0) !== 0) {
        opposite += 1;
      }
    }
    return {
      timed,
      withRba,
      opposite,
      unchanged: rows.length - withRba - opposite,
    };
  }, [rows]);
  const upperBound = model.decision.partialObservation ? ' Timing values are upper bounds.' : '';
  const decisionSummary = decisionMarkers.length
    ? ` ${decisionMarkers.length} RBA decision guide${decisionMarkers.length === 1 ? '' : 's'} shown.`
    : '';
  const summary = `${SECTIONS[section].title} response map. All ${rows.length} eligible lenders are shown: ${rowStats.timed} have a linked response time, ${rowStats.withRba - rowStats.timed} moved with the RBA without a linked event, ${rowStats.opposite} moved in the opposite direction, and ${rowStats.unchanged} were unchanged.${upperBound}${decisionSummary}`;

  const fontScale = zoom;
  const canZoomOut = zoom > 1;
  const canZoomIn = zoom < 3;

  const clearSelection = () => {
    setPaintedProvider(null);
    hapticSelection();
    onProviderSelect(null);
  };

  const chart = plot ? (
    <Svg
      width={plotSize.width}
      height={plotSize.height}
      aria-hidden
      onPress={(event) => {
        const { locationX, locationY } = event.nativeEvent;
        const result = resolveResponseScatterPress(
          plot.points,
          locationX,
          locationY,
          paintedProvider,
          22 * zoom,
        );
        if (!result.hit) return;
        setPaintedProvider(result.provider);
        hapticSelection();
        onProviderSelect(result.provider);
      }}
    >
      <Line
        x1={plotSize.padL}
        y1={plot.zeroY}
        x2={plotSize.width - plotSize.padR}
        y2={plot.zeroY}
        stroke={theme.colors.border}
      />
      <Line
        x1={plotSize.padL}
        y1={plotSize.padT}
        x2={plotSize.padL}
        y2={plotSize.padT + plot.innerH}
        stroke={theme.colors.border}
      />
      <Line
        x1={plotSize.padL + plot.timedW + 8 * zoom}
        y1={plotSize.padT}
        x2={plotSize.padL + plot.timedW + 8 * zoom}
        y2={plotSize.padT + plot.innerH}
        stroke={theme.colors.border}
        strokeDasharray={`${3 * zoom} ${4 * zoom}`}
      />
      {plot.decisionLines.map((line) => {
        const active = line.active;
        return (
          <React.Fragment key={`${line.date}:${line.bps}`}>
            <Line
              x1={plotSize.padL}
              y1={line.y}
              x2={plotSize.padL + plot.timedW}
              y2={line.y}
              stroke={theme.colors.rba}
              strokeDasharray={active ? undefined : `${5 * zoom} ${4 * zoom}`}
              strokeWidth={active ? 2 * zoom : 1.2 * zoom}
              opacity={active ? 0.95 : 0.45}
            />
            <SvgText
              x={plotSize.padL + 4 * zoom}
              y={Math.max(12 * zoom, line.y - 5 * zoom - line.labelDy)}
              fontSize={10 * fontScale}
              fill={active ? theme.colors.rba : withAlpha(theme.colors.rba, 0.75)}
              fontWeight={active ? '700' : '500'}
            >
              {active ? `Active · ${line.label}` : line.label}
            </SvgText>
          </React.Fragment>
        );
      })}
      <SvgText
        x={plotSize.padL}
        y={plotSize.height - 10 * zoom}
        fontSize={10 * fontScale}
        fill={theme.colors.textFaint}
      >
        {model.decision.partialObservation ? '≤ days from decision' : 'days from decision'}
      </SvgText>
      <SvgText
        x={plotSize.padL + plot.timedW}
        y={plotSize.height - 28 * zoom}
        fontSize={10 * fontScale}
        fill={theme.colors.textFaint}
        textAnchor="end"
      >
        {model.windowDays}d
      </SvgText>
      <SvgText
        x={plot.untimedX}
        y={plotSize.height - 28 * zoom}
        fontSize={10 * fontScale}
        fill={theme.colors.textFaint}
        textAnchor="middle"
      >
        untimed
      </SvgText>
      <SvgText x={4 * zoom} y={plotSize.padT + 4 * zoom} fontSize={10 * fontScale} fill={theme.colors.textFaint}>
        +{Math.round(plot.maxBps)}
      </SvgText>
      <SvgText x={18 * zoom} y={plot.zeroY + 4 * zoom} fontSize={10 * fontScale} fill={theme.colors.textFaint}>
        0
      </SvgText>
      <SvgText
        x={4 * zoom}
        y={plotSize.padT + plot.innerH + 4 * zoom}
        fontSize={10 * fontScale}
        fill={theme.colors.textFaint}
      >
        −{Math.round(plot.maxBps)}
      </SvgText>
      {plot.points.map((point) => {
        const selected = point.provider === paintedProvider;
        const tone = point.net === 0 ? 'muted' : moveTone(section, point.net);
        const fill =
          tone === 'success'
            ? theme.colors.success
            : tone === 'danger'
              ? theme.colors.danger
              : theme.colors.textFaint;
        return (
          <ScatterDot
            key={point.provider}
            cx={point.cx}
            cy={point.cy}
            selected={selected}
            fill={fill}
            surface={theme.colors.surface}
            text={theme.colors.text}
            primary={theme.colors.primary}
            zoom={zoom}
          />
        );
      })}
    </Svg>
  ) : null;

  return (
    <View>
      <Row gap={8} style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ZoomButton
          label="−"
          accessibilityLabel="Zoom out response chart"
          disabled={!canZoomOut}
          onPress={() => updateZoom((current) => nextScatterZoom(current, -1))}
        />
        <AppText variant="tiny" color="textMuted" weight="700">
          {Math.round(clampScatterZoom(zoom) * 100)}%
        </AppText>
        <ZoomButton
          label="+"
          accessibilityLabel="Zoom in response chart"
          disabled={!canZoomIn}
          onPress={() => updateZoom((current) => nextScatterZoom(current, 1))}
        />
        <ZoomButton
          label="Reset"
          accessibilityLabel="Reset response chart zoom"
          disabled={!canZoomOut}
          onPress={() => updateZoom(1)}
        />
        <AppText variant="tiny" color="textFaint" style={{ flex: 1, minWidth: 120 }}>
          {zoom > 1 ? 'Scroll the chart to pan while zoomed' : 'Zoom to inspect dense clusters'}
        </AppText>
      </Row>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ width: '100%', height: CHART_HEIGHT }}
      >
        {width > 0 ? (
          zoom > 1 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator
              style={{ flex: 1 }}
              contentContainerStyle={{ minHeight: CHART_HEIGHT }}
            >
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={{ maxHeight: CHART_HEIGHT }}
                contentContainerStyle={{ width: plotSize.width }}
              >
                {chart}
              </ScrollView>
            </ScrollView>
          ) : (
            chart
          )
        ) : null}
      </View>
      {paintedProvider ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            marginTop: 10,
            marginBottom: 4,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primaryMuted,
            gap: 8,
          }}
        >
          <AppText variant="small" weight="700" color="primary">
            Filtered to {paintedProvider}
          </AppText>
          <AppText variant="tiny" color="textMuted">
            Lender list below shows only this bank.
          </AppText>
          <Pressable
            onPress={clearSelection}
            accessibilityRole="button"
            accessibilityLabel="Clear chart selection and show all lenders"
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="close-circle-outline" size={16} color={theme.colors.primary} />
            <AppText variant="tiny" weight="700" color="primary">
              CLEAR SELECTION · SHOW ALL
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});
