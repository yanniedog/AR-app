import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import type { EconomicMomentumModel } from '../../data/economicModels';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText } from '../ui';

export function MomentumChart({ model }: { model: EconomicMomentumModel }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const labelWidth = Math.min(116, width * 0.34);
  const valueWidth = 48;
  const plotWidth = Math.max(1, width - labelWidth - valueWidth);
  const zeroX = labelWidth + plotWidth / 2;
  const rowHeight = 46;
  const height = model.rows.length * rowHeight + 12;
  const halfPlot = plotWidth / 2;

  const colorFor = (pressure: 'higher' | 'lower' | 'balanced') =>
    pressure === 'higher'
      ? theme.colors.warning
      : pressure === 'lower'
        ? theme.colors.primary
        : theme.colors.textMuted;

  return (
    <View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={model.summary}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height} {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}>
            <Line
              x1={zeroX}
              y1={4}
              x2={zeroX}
              y2={height - 8}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
            {model.rows.map((row, index) => {
              const y = 8 + index * rowHeight;
              const magnitude = Math.max(2, (Math.abs(row.change) / model.maxAbsChange) * halfPlot);
              const positive = row.change >= 0;
              const x = positive ? zeroX : zeroX - magnitude;
              const color = colorFor(row.policyPressure);
              return (
                <React.Fragment key={row.id}>
                  <SvgText x={0} y={y + 14} fontSize={10} fontWeight="600" fill={theme.colors.text}>
                    {row.label}
                  </SvgText>
                  <SvgText x={0} y={y + 29} fontSize={8.5} fill={theme.colors.textFaint}>
                    {row.periodLabel}
                  </SvgText>
                  <Rect
                    x={x}
                    y={y + 7}
                    width={magnitude}
                    height={16}
                    rx={3}
                    fill={withAlpha(color, 0.8)}
                  />
                  <SvgText
                    x={width}
                    y={y + 19}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight="700"
                    fill={color}
                  >
                    {row.change > 0 ? '+' : ''}{row.change.toFixed(2)} pp
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
        Bars show raw percentage-point change. Colour indicates the broad rate-pressure direction; this is not a forecast.
      </AppText>
    </View>
  );
}
