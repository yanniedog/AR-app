import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { ChartText as SvgText } from '../charts/ChartText';

import type { EconomicMomentumModel } from '../../data/economicModels';
import { hasPositiveChartLayout, type ChartRenderEvidence } from '../../lib/chartRenderEvidence';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { DECORATIVE_SVG_ACCESSIBILITY_PROPS } from '../decorativeSvgAccessibility';
import { AppText } from '../ui';
import { uiJoin } from '../../lib/uiCopy';
import { uiChartPp, uiMomentumWindow, uiEconomicIndicator, uiEconomicPressure } from '../../lib/chartUiCopy';

export function MomentumChart({ model, auditRevision = '', onGraphicReady }: {
  model: EconomicMomentumModel; auditRevision?: string; onGraphicReady?: (evidence: ChartRenderEvidence) => void;
}) {
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

  const summary = uiJoin('Momentum', ' · ', ...model.rows.map(row => uiJoin(uiEconomicIndicator(row.id), ' · ', uiChartPp(row.change), ' · ', uiEconomicPressure(row.policyPressure), ' · ')));
  return (
    <View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg key={auditRevision} width={width} height={height} {...DECORATIVE_SVG_ACCESSIBILITY_PROPS}
            onLayout={(event) => onGraphicReady?.({ revision: auditRevision, expectedCount: model.rows.length,
              pointCount: Number.isFinite(model.maxAbsChange) && model.maxAbsChange > 0
                ? model.rows.filter((row) => Number.isFinite(row.change)).length : 0,
              accessibleSummary: summary.trim().length > 0,
              layoutMeasured: hasPositiveChartLayout(event), emptyStateRendered: false })}>
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
                    {uiEconomicIndicator(row.id)}
                  </SvgText>
                  <SvgText x={0} y={y + 29} fontSize={8.5} fill={theme.colors.textFaint}>
                    {uiMomentumWindow(row)}
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
                    {uiChartPp(row.change)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
        {uiJoin('Basis', ' · ', 'pp', ' · ', 'Forecast', ' · ', 'Excluded')}
      </AppText>
    </View>
  );
}
