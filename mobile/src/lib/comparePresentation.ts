const RATE_DETAIL_LABELS = new Set([
  'Advertised rate',
  'Ongoing rate',
  'Comparison rate',
]);

export function isRateDetailLabel(label: string): boolean {
  return RATE_DETAIL_LABELS.has(label);
}

export function isRateLabelRankedForEveryEntry(
  label: string,
  rankedLabels: readonly string[],
): boolean {
  return rankedLabels.length > 0 && rankedLabels.every((ranked) => ranked === label);
}

export function showCompactDetailRow(
  label: string,
  rankedLabel: string,
  differs: boolean,
): boolean {
  return label !== rankedLabel && (isRateDetailLabel(label) || differs);
}

/**
 * Fixed-height comparison tables are only safe at the default text scale.
 * Accessibility text uses the naturally-sized card layout even on tablets.
 */
export function usesCompactCompareLayout(width: number, fontScale: number): boolean {
  return width < 600 || fontScale >= 1.3;
}
