import type { LayoutChangeEvent } from 'react-native';

/** Evidence emitted by the graph or its visible empty state after native layout. */
export interface ChartRenderEvidence {
  revision: string;
  expectedCount: number;
  pointCount: number;
  accessibleSummary: boolean;
  layoutMeasured: boolean;
  emptyStateRendered: boolean;
}

export function hasPositiveChartLayout(event: LayoutChangeEvent): boolean {
  const { width, height } = event.nativeEvent.layout;
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

export function hasFiniteChartPath(path: string | null | undefined): boolean {
  return !!path?.trim() && !/(?:NaN|Infinity|undefined)/.test(path);
}

export function hasFiniteChartDate(date: string): boolean {
  return Number.isFinite(Date.parse(date));
}
