import { isValidCalendarDate } from '../calendarDate';
import type { AppHealthMetricValue } from './types';

const REASONS = new Set([
  'historical-source-not-loaded', 'historical-source-unavailable', 'processed-day-missing',
  'date-axis-unverifiable', 'source-to-model-count-mismatch',
  'historical-detail-evidence-unknown', 'historical-quarantined-tiers',
  'current-payload-stale',
  'product-history-not-loaded', 'product-history-date-unavailable', 'product-source-to-model-mismatch',
  'product-model-to-chart-mismatch', 'current-product-rate-mismatch', 'current-product-observation-missing', 'product-source-reconciliation-unavailable',
  ...['min', 'mean', 'median', 'max'].flatMap(statistic => [
    `source-to-model-${statistic}-mismatch`, `model-to-chart-${statistic}-mismatch`,
    `unexpected-chart-${statistic}-point`,
  ]),
]);
const SECTIONS = new Set(['Mortgage', 'Savings', 'TD']);

/** Public JSON-string metrics need a nested schema boundary, not just a key
 * allowlist. Keep every record, replacing malformed evidence with a correlated
 * marker rather than dropping it or publishing arbitrary source text. */
export function publicHistoryCoverageSanitizer() {
  const aliases = new Map<string, string>();
  const alias = (value: unknown, domain: string) => {
    const key = `${domain}:${JSON.stringify(value)}`;
    let result = aliases.get(key);
    if (!result) { result = `~private-${domain}-${aliases.size + 1}`; aliases.set(key, result); }
    return result;
  };
  return (metrics: Record<string, AppHealthMetricValue>): Record<string, AppHealthMetricValue> => {
    const output: Record<string, AppHealthMetricValue> = {};
    let invalid = false;
    for (const key of ['historyGaps', 'historySourceGapDays'] as const) {
      const countKey = key === 'historyGaps' ? 'historyInvalidGapRecords' : 'historyInvalidSourceGapDates';
      if (!Object.hasOwn(metrics, key)) {
        output[key] = JSON.stringify({ invalidEvidence: true, missingEvidence: true });
        output[countKey] = null;
        invalid = true;
        continue;
      }
      let values: unknown;
      try { values = typeof metrics[key] === 'string' ? JSON.parse(metrics[key]) : null; }
      catch { values = null; }
      if (!Array.isArray(values)) {
        output[key] = JSON.stringify({ invalidEvidence: true, opaqueEvidence: alias(metrics[key], 'history-evidence') });
        output[countKey] = null;
        invalid = true;
        continue;
      }
      let invalidRecords = 0;
      output[key] = JSON.stringify(values.map(value => {
        if (key === 'historySourceGapDays') {
          if (isValidCalendarDate(value)) return value;
          invalidRecords++;
          return alias(value, 'history-date');
        }
        if (!Array.isArray(value) || (value.length !== 4 && value.length !== 5) ||
          !isValidCalendarDate(value[0]) || !REASONS.has(value[1]) ||
          !(value[2] === null || SECTIONS.has(value[2])) || typeof value[3] !== 'number' ||
          !Number.isFinite(value[3]) || (value.length === 5 && typeof value[4] !== 'string')) {
          invalidRecords++;
          return [null, 'invalid-gap-evidence', null, null, alias(value, 'history-gap')];
        }
        return value.length === 5 ? [...value.slice(0, 4), alias(value[4], 'source-identity')] : value;
      }));
      if (invalidRecords) { invalid = true; output[countKey] = invalidRecords; }
    }
    if (invalid) output.historyGapEvidenceInvalid = true;
    return output;
  };
}
