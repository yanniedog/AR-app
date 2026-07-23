import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { SECTIONS } from '../../constants';
import type { MultiSectionPassThroughModel } from '../../data/bankInsights';
import {
  sectionRows,
  selectResponseScatterProvider,
} from '../../data/passThroughModels';
import { moveTone } from '../../lib/moveSemantics';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Response map with an explicit untimed rail. Every eligible lender is plotted:
 * same-direction responses with a matching event use the time axis, while
 * untimed, opposite, and unchanged observations sit on the labelled rail.
 */
export function ResponseScatter({
  model,
  section,
  selectedProvider,
  onProviderSelect,
}: {
  model: MultiSectionPassThroughModel;
  section: SectionKey;
  selectedProvider: string | null;
  onProviderSelect: (provider: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const rows = useMemo(() => sectionRows(model, section), [model, section]);
  const timed = rows.filter(
    (item) => item.response.passedBps !== 0 && item.response.daysToFirstMove != null,
  );
  const withRba = rows.filter((item) => item.response.passedBps !== 0);
  const opposite = rows.filter(
    (item) => (item.response.netChangeBps ?? 0) !== 0 && item.response.passedBps === 0,
  );
  const unchanged = rows.length - withRba.length - opposite.length;
  const height = 260;
  const padL = 42;
  const padR = 10;
  const padT = 24;
  const padB = 46;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const timedW = innerW * 0.76;
  const untimedX = padL + innerW * 0.9;
  const maxBps = Math.max(
    Math.abs(model.decision.bps),
    ...rows.map((item) => Math.abs(item.response.netChangeBps ?? item.response.passedBps)),
    1,
  );
  const x = (days: number) =>
    padL + (Math.min(model.windowDays, Math.max(0, days)) / model.windowDays) * timedW;
  const y = (bps: number) => padT + innerH / 2 - (bps / maxBps) * (innerH / 2);
  const points = rows.map((item, index) => {
    const net = item.response.netChangeBps ?? item.response.passedBps;
    const hasTiming = item.response.passedBps !== 0 && item.response.daysToFirstMove != null;
    const jitterX = ((index % 5) - 2) * (hasTiming ? 2.2 : 3.5);
    const jitterY = ((Math.floor(index / 5) % 5) - 2) * 2;
    return {
      item,
      net,
      cx: (hasTiming ? x(item.response.daysToFirstMove!) : untimedX) + jitterX,
      cy: y(net) + jitterY,
    };
  });
  const referenceY = y(model.decision.bps);
  const zeroY = y(0);
  const upperBound = model.decision.partialObservation ? ' Timing values are upper bounds.' : '';
  const summary = `${SECTIONS[section].title} response map. All ${rows.length} eligible lenders are shown: ${timed.length} have a linked response time, ${withRba.length - timed.length} moved with the RBA without a linked event, ${opposite.length} moved in the opposite direction, and ${unchanged} were unchanged.${upperBound}`;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={{ width: '100%', height }}
    >
      {width > 0 ? (
        <Svg
          width={width}
          height={height}
          importantForAccessibility="no-hide-descendants"
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            const provider = selectResponseScatterProvider(
              points.map(({ item, cx, cy }) => ({ provider: item.provider, cx, cy })),
              locationX,
              locationY,
              selectedProvider,
            );
            if (provider) onProviderSelect(provider);
          }}
        >
          <Line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke={theme.colors.border} />
          <Line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke={theme.colors.border} />
          <Line
            x1={padL + timedW + 8}
            y1={padT}
            x2={padL + timedW + 8}
            y2={padT + innerH}
            stroke={theme.colors.border}
            strokeDasharray="3 4"
          />
          <Line
            x1={padL}
            y1={referenceY}
            x2={padL + timedW}
            y2={referenceY}
            stroke={theme.colors.rba}
            strokeDasharray="5 4"
            opacity={0.75}
          />
          <SvgText x={padL + 4} y={Math.max(12, referenceY - 5)} fontSize={10} fill={theme.colors.rba}>
            RBA {model.decision.bps > 0 ? '+' : '−'}{Math.abs(model.decision.bps)} bp
          </SvgText>
          <SvgText x={padL} y={height - 10} fontSize={10} fill={theme.colors.textFaint}>
            {model.decision.partialObservation ? '≤ days from decision' : 'days from decision'}
          </SvgText>
          <SvgText x={padL + timedW} y={height - 28} fontSize={10} fill={theme.colors.textFaint} textAnchor="end">
            {model.windowDays}d
          </SvgText>
          <SvgText x={untimedX} y={height - 28} fontSize={10} fill={theme.colors.textFaint} textAnchor="middle">
            untimed
          </SvgText>
          <SvgText x={4} y={padT + 4} fontSize={10} fill={theme.colors.textFaint}>+{Math.round(maxBps)}</SvgText>
          <SvgText x={18} y={zeroY + 4} fontSize={10} fill={theme.colors.textFaint}>0</SvgText>
          <SvgText x={4} y={padT + innerH + 4} fontSize={10} fill={theme.colors.textFaint}>−{Math.round(maxBps)}</SvgText>
          {points.map(({ item, net, cx, cy }) => {
            const selected = item.provider === selectedProvider;
            const tone = net === 0 ? 'muted' : moveTone(section, net);
            const fill = tone === 'success'
              ? theme.colors.success
              : tone === 'danger'
                ? theme.colors.danger
                : theme.colors.textFaint;
            return (
              <React.Fragment key={item.provider}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={selected ? 7 : 4.5}
                  fill={selected ? theme.colors.primary : fill}
                  opacity={selected ? 1 : 0.68}
                  stroke={selected ? theme.colors.text : theme.colors.surface}
                  strokeWidth={selected ? 2 : 1}
                  pointerEvents="none"
                />
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
