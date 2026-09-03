import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';

import { HistoryExplorer } from '../src/components/viz/HistoryExplorer';
import type { BankHistoryChartModel } from '../src/types';

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Badge: 'Badge',
  Chip: 'Chip',
  Row: 'Row',
}));
jest.mock('../src/components/viz/LenderRaceChart', () => ({ LenderRaceChart: 'LenderRaceChart' }));
jest.mock('../src/components/viz/MarketSeismograph', () => ({ MarketSeismograph: 'MarketSeismograph' }));
jest.mock('../src/components/viz/RateHeatCalendar', () => ({ RateHeatCalendar: 'RateHeatCalendar' }));
jest.mock('../src/components/charts/ChartSliceControls', () => ({
  ChartSliceControls: 'ChartSliceControls',
  useChartScrub: () => ({
    onTouchStart: jest.fn(),
    onTouchMove: jest.fn(),
    onTouchEnd: jest.fn(),
    onTouchCancel: jest.fn(),
  }),
}));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    dark: false,
    colors: {
      border: '#cccccc',
      primary: '#005ea8',
      skeleton: '#eeeeee',
      textFaint: '#777777',
    },
  }),
}));

type InspectableRenderer = ReactTestRenderer & {
  root: {
    findAllByType: (type: typeof View) => {
      props: { onLayout?: (event: {
        nativeEvent: { layout: { width: number; height: number } };
      }) => void };
    }[];
  };
};

const historyModel: BankHistoryChartModel = {
  section: 'Mortgage',
  dates: ['2026-09-03'],
  points: [{
    date: '2026-09-03',
    min: 5.4,
    max: 6.2,
    mean: 5.8,
    median: 5.75,
    count: 4,
  }],
};

const baseProps = {
  section: 'Mortgage' as const,
  insights: null,
  insightsAvailable: false,
  rba: [],
  mode: 'edge' as const,
  showModePicker: false,
};

describe('HistoryExplorer graphic evidence', () => {
  it('emits evidence from a chart-specific layout, not from loading copy', () => {
    const onGraphicReadiness = jest.fn();
    let tree!: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(
        <HistoryExplorer
          {...baseProps}
          historyModel={null}
          auditRevision="history:loading"
          onGraphicReadiness={onGraphicReadiness}
        />,
      ) as InspectableRenderer;
    });

    expect(tree.root.findAllByType(View).filter((node) => node.props.onLayout)).toHaveLength(0);
    expect(onGraphicReadiness).not.toHaveBeenCalled();

    act(() => {
      tree.update(
        <HistoryExplorer
          {...baseProps}
          historyModel={historyModel}
          auditRevision="history:ready"
          onGraphicReadiness={onGraphicReadiness}
        />,
      );
    });
    const chartLayout = tree.root.findAllByType(View).find((node) => node.props.onLayout);
    expect(chartLayout).toBeDefined();
    act(() => chartLayout?.props.onLayout?.({
      nativeEvent: { layout: { width: 320, height: 150 } },
    }));

    expect(onGraphicReadiness).toHaveBeenCalledTimes(1);
    expect(onGraphicReadiness).toHaveBeenCalledWith({
      revision: 'history:ready',
      accessibleSummary: true,
    });
    act(() => tree.unmount());
  });
});
