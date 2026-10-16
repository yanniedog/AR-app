/** Parse a rate that may be a normalized fraction ("0.0634") or a raw percent ("6.34"). */
export function toFraction(rate: string | number | null | undefined): number | null {
  if (rate === null || rate === undefined || (typeof rate === 'string' && !rate.trim())) return null;
  const n = typeof rate === 'number' ? rate : Number(rate);
  if (!isFinite(n) || n < 0) return null;
  return n > 1 ? n / 100 : n;
}

/**
 * The metric every ranking/aggregation should use: the comparison rate (which
 * folds in fees and is the honest cost of a loan) when the row publishes a valid
 * one, else the headline rate. Deposits carry no comparison rate, so this is a
 * no-op for them. Keeping this in one place is what makes "comparison rate is the
 * default metric for all calculations" true everywhere rather than per-call.
 */
export function effectiveRate(
  row: { rate: string | number; comparison_rate?: string | number } | null | undefined,
): string | number | undefined {
  if (!row) return undefined;
  return toFraction(row.comparison_rate) !== null ? row.comparison_rate : row.rate;
}

/** {@link effectiveRate} parsed to a fraction (null when neither rate is usable). */
export function effectiveFraction(
  row: { rate: string | number; comparison_rate?: string | number } | null | undefined,
): number | null {
  return toFraction(effectiveRate(row));
}

export function ratePercentValue(rate: string | number | null | undefined): number | null {
  const f = toFraction(rate);
  return f === null ? null : f * 100;
}

/** Difference between two fractions expressed in basis points. */
export function bpsBetween(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.round((a - b) * 10000);
}

/** Parse an ISO-8601 duration like "P3Y", "P36M", "P1Y6M" to a month count. */
export function isoDurationMonths(term: string | undefined): number | null {
  if (typeof term !== 'string') return null;
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(term.trim());
  if (!m || (!m[1] && !m[2])) return null;
  const months = Number(m[1] ?? 0) * 12 + Number(m[2] ?? 0);
  return months > 0 ? months : null;
}
