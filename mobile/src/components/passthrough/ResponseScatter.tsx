import React, { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { SECTIONS } from '../../constants';
import type { MultiSectionPassThroughModel } from '../../data/bankInsights';
import {
  buildResponseScatterPoints,
  resolveResponseScatterPress,
  sectionRows,
} from '../../data/passThroughModels';
import { hapticSelection } from '../../lib/haptics';
import { moveTone } from '../../lib/moveSemantics';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../ui';

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
}: {
  cx: number;
  cy: number;
  selected: boolean;
  fill: string;
  surface: string;
  text: string;
  primary: string;
}) {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={selected ? 7 : 4.5}
      fill={selected ? primary : fill}
      opacity={selected ? 1 : 0.68}
      stroke={selected ? text : surface}
      strokeWidth={selected ? 2 : 1}
      pointerEvents="none"
    />
  );
});

/**
 * Response map with an explicit untimed rail. Every eligible lender is plotted:
 * same-direction responses with a matching event use the time axis, while
 * untimed, opposite, and unchanged observations sit on the labelled rail.
 *
 * Selection paints locally first so taps stay responsive even when the parent
 * list still has to update row highlights.
 */
export const ResponseScatter = memo(function ResponseScatter({
  model,
  section,
  selectedProvider,
  onProviderSelect,
}: {
  model: MultiSectionPassThroughModel;
  section: SectionKey;
  selectedProvider: string | null;
  onProviderSelect: (provider: string | null) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  /** Instant paint target — synced from parent when list/chips change selection. */
  const [paintedProvider, setPaintedProvider] = useState(selectedProvider);
  useEffect(() => {
    setPaintedProvider(selectedProvider);
  }, [selectedProvider]);

  const rows = useMemo(() => sectionRows(model, section), [model, section]);
  const plot = useMemo(
    () =>
      width > 0
        ? buildResponseScatterPoints(rows, {
            width,
            height: CHART_HEIGHT,
            padL: PAD_L,
            padR: PAD_R,
            padT: PAD_T,
            padB: PAD_B,
            windowDays: model.windowDays,
            decisionBps: model.decision.bps,
          })
        : null,
    [rows, width, model.windowDays, model.decision.bps],
  );

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
  const summary = `${SECTIONS[section].title} response map. All ${rows.length} eligible lenders are shown: ${rowStats.timed} have a linked response time, ${rowStats.withRba - rowStats.timed} moved with the RBA without a linked event, ${rowStats.opposite} moved in the opposite direction, and ${rowStats.unchanged} were unchanged.${upperBound}`;

  return (
    <View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ width: '100%', height: CHART_HEIGHT }}
      >
        {plot ? (
          <Svg
            width={width}
            height={CHART_HEIGHT}
            importantForAccessibility="no-hide-descendants"
            onPress={(event) => {
              const { locationX, locationY } = event.nativeEvent;
              const result = resolveResponseScatterPress(
                plot.points,
                locationX,
                locationY,
                paintedProvider,
              );
              if (!result.hit) return;
              setPaintedProvider(result.provider);
              hapticSelection();
              onProviderSelect(result.provider);
            }}
          >
            <Line x1={PAD_L} y1={plot.zeroY} x2={width - PAD_R} y2={plot.zeroY} stroke={theme.colors.border} />
            <Line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plot.innerH} stroke={theme.colors.border} />
            <Line
              x1={PAD_L + plot.timedW + 8}
              y1={PAD_T}
              x2={PAD_L + plot.timedW + 8}
              y2={PAD_T + plot.innerH}
              stroke={theme.colors.border}
              strokeDasharray="3 4"
            />
            <Line
              x1={PAD_L}
              y1={plot.referenceY}
              x2={PAD_L + plot.timedW}
              y2={plot.referenceY}
              stroke={theme.colors.rba}
              strokeDasharray="5 4"
              opacity={0.75}
            />
            <SvgText x={PAD_L + 4} y={Math.max(12, plot.referenceY - 5)} fontSize={10} fill={theme.colors.rba}>
              RBA {model.decision.bps > 0 ? '+' : '−'}{Math.abs(model.decision.bps)} bp
            </SvgText>
            <SvgText x={PAD_L} y={CHART_HEIGHT - 10} fontSize={10} fill={theme.colors.textFaint}>
              {model.decision.partialObservation ? '≤ days from decision' : 'days from decision'}
            </SvgText>
            <SvgText x={PAD_L + plot.timedW} y={CHART_HEIGHT - 28} fontSize={10} fill={theme.colors.textFaint} textAnchor="end">
              {model.windowDays}d
            </SvgText>
            <SvgText x={plot.untimedX} y={CHART_HEIGHT - 28} fontSize={10} fill={theme.colors.textFaint} textAnchor="middle">
              untimed
            </SvgText>
            <SvgText x={4} y={PAD_T + 4} fontSize={10} fill={theme.colors.textFaint}>+{Math.round(plot.maxBps)}</SvgText>
            <SvgText x={18} y={plot.zeroY + 4} fontSize={10} fill={theme.colors.textFaint}>0</SvgText>
            <SvgText x={4} y={PAD_T + plot.innerH + 4} fontSize={10} fill={theme.colors.textFaint}>−{Math.round(plot.maxBps)}</SvgText>
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
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      {paintedProvider ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            alignSelf: 'flex-start',
            maxWidth: '100%',
            marginBottom: 10,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primaryMuted,
          }}
        >
          <AppText variant="small" weight="700" color="primary">
            {paintedProvider}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});
