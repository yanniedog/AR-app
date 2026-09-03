import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import {
  LifecycleChart,
  type LifecycleChartController,
} from '../src/components/projections/LifecycleChart';
import type { ProjectionPoint, ProjectionSeries } from '../src/data/projections';

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const point: ProjectionPoint = {
  date: '2026-09-03',
  balance: 500_000,
  periodInterest: 2_000,
  cumulativeInterest: 2_000,
  periodPrincipal: 1_000,
  cumulativePrincipal: 1_000,
  periodRatio: 2,
  cumulativeRatio: 2,
  offsetBalance: 0,
};

const series: ProjectionSeries = {
  id: 'current',
  label: 'Current rate',
  detail: 'Illustrative test series',
  annualRate: 0.06,
  points: [point],
  payoffDate: null,
  totalInterest: 2_000,
  totalPrincipal: 1_000,
  projectedInterest: 2_000,
  projectedPrincipal: 1_000,
  endBalance: 500_000,
  totalValue: 500_000,
};

describe('LifecycleChart render evidence', () => {
  it('does not loop when a parent recreates its render-ready callback', () => {
    let observedReadyCount = 0;

    function Harness() {
      const [readyCount, setReadyCount] = useState(0);
      observedReadyCount = readyCount;
      return (
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[series]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="test-revision-1"
          onRenderReady={() => setReadyCount((current) => current + 1)}
        />
      );
    }

    let tree: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness />) as InspectableRenderer;
    });
    const adjustableChart = tree!.root.findByProps({ accessibilityRole: 'adjustable' });
    act(() => {
      (adjustableChart.props.onLayout as (event: {
        nativeEvent: { layout: { width: number } };
      }) => void)({ nativeEvent: { layout: { width: 320 } } });
    });

    expect(observedReadyCount).toBe(1);
    act(() => tree!.unmount());
  });

  it('emits once for each explicit render revision without layout feedback churn', () => {
    const onRenderReady = jest.fn();
    let tree!: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[series]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="revision-1"
          onRenderReady={onRenderReady}
        />,
      ) as InspectableRenderer;
    });
    const layout = (width: number) => {
      const chart = tree.root.findByProps({ accessibilityRole: 'adjustable' });
      (chart.props.onLayout as (event: {
        nativeEvent: { layout: { width: number } };
      }) => void)({ nativeEvent: { layout: { width } } });
    };
    act(() => layout(320));
    expect(onRenderReady).toHaveBeenCalledTimes(1);
    expect(onRenderReady).toHaveBeenLastCalledWith({
      renderRevision: 'revision-1',
      selectionIndex: 0,
      accessibleSummary: true,
    });

    act(() => layout(320.2));
    expect(onRenderReady).toHaveBeenCalledTimes(1);

    act(() => {
      tree.update(
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[series]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="revision-2"
          onRenderReady={onRenderReady}
        />,
      );
    });
    expect(onRenderReady).toHaveBeenCalledTimes(2);
    expect(onRenderReady).toHaveBeenLastCalledWith({
      renderRevision: 'revision-2',
      selectionIndex: 0,
      accessibleSummary: true,
    });
    act(() => tree.unmount());
  });

  it('emits a new render-state token when the adjustable chart changes month', () => {
    const controllerRef: { current: LifecycleChartController | null } = { current: null };
    const onRenderReady = jest.fn();
    const secondPoint = { ...point, date: '2026-10-03', balance: 499_000 };
    let tree!: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[{ ...series, points: [point, secondPoint] }]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="interactive-revision"
          controllerRef={controllerRef}
          onRenderReady={onRenderReady}
        />,
      ) as InspectableRenderer;
    });
    act(() => {
      const chart = tree.root.findByProps({ accessibilityRole: 'adjustable' });
      (chart.props.onLayout as (event: {
        nativeEvent: { layout: { width: number } };
      }) => void)({ nativeEvent: { layout: { width: 320 } } });
    });
    expect(onRenderReady).toHaveBeenLastCalledWith(expect.objectContaining({ selectionIndex: 0 }));

    act(() => controllerRef.current?.next());

    expect(onRenderReady).toHaveBeenLastCalledWith(expect.objectContaining({ selectionIndex: 1 }));
    act(() => tree.unmount());
  });

  it('clamps the selected month when a revised scenario shortens the series', () => {
    const controllerRef: { current: LifecycleChartController | null } = { current: null };
    const withDates = (dates: string[]): ProjectionSeries => ({
      ...series,
      points: dates.map((date, index) => ({
        ...point,
        date,
        balance: point.balance - index * 1_000,
      })),
    });
    let tree!: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[withDates(['2026-09-03', '2026-10-03', '2026-11-03'])]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="long-series"
          controllerRef={controllerRef}
        />,
      ) as InspectableRenderer;
    });
    act(() => {
      controllerRef.current?.next();
      controllerRef.current?.next();
    });
    expect(tree.root.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue)
      .toMatchObject({ min: 1, max: 3, now: 3 });

    act(() => {
      tree.update(
        <LifecycleChart
          section="Mortgage"
          history={[]}
          series={[withDates(['2026-09-03'])]}
          metric="balance"
          asAt="2026-09-03"
          renderRevision="short-series"
          controllerRef={controllerRef}
        />,
      );
    });
    expect(tree.root.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue)
      .toMatchObject({ min: 1, max: 1, now: 1 });
    act(() => tree.unmount());
  });
});
