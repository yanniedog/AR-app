import type { BankRateChartModel } from './bankRateOverview';

function chartValueRange(lines: BankRateChartModel['lines']): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const line of lines) for (const point of line.points) { min = Math.min(min, point.value); max = Math.max(max, point.value); }
  const padding = Math.max(0.05, (max - min) * 0.08);
  return { min: lines.length ? min - padding : 0, max: lines.length ? max + padding : 1 };
}

/** Keep only the plotted banks; the value axis fits the kept lines. */
export function focusBankRateChart(model: BankRateChartModel, keep: (provider: string) => boolean): BankRateChartModel {
  const lines = model.lines.filter(line => keep(line.provider));
  return { ...model, lines, ...chartValueRange(lines) };
}

export type BankRateRange = '1Y' | 'All';

/** Trailing year ending at, and including the anniversary of, the newest snapshot. */
export function bankRateSnapshotsInRange<T>(snapshots: Record<string, T>, range: BankRateRange): Record<string, T> {
  if (range === 'All') return snapshots;
  const dates = Object.keys(snapshots).sort();
  const latest = dates.at(-1);
  if (!latest) return snapshots;
  const end = new Date(`${latest}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() - 1);
  const cutoff = end.toISOString().slice(0, 10);
  const kept: Record<string, T> = {};
  for (const date of dates) if (date >= cutoff) kept[date] = snapshots[date];
  return kept;
}
