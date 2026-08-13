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
