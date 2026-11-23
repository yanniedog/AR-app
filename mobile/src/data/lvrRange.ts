/** Existing canonical facets are (lo, hi]; >= preserves inclusive CDR minima. */
export interface LvrRange { lo: number; hi: number; inclusive: boolean; hiInclusive?: boolean }

/** A few lenders publish LVR as a ratio (0.7 for 70%); no LVR band is 1% or lower. */
export const lvrRatioToPercent = (n: number): number => (n > 0 && n <= 1 ? Number((n * 100).toPrecision(12)) : n);

export function parseLvrRange(value: string | undefined): LvrRange | null {
  // A "%" in the published tier marks it as already a percentage.
  const asRatio = !(value ?? '').includes('%');
  const scale = (n: number): number => (asRatio ? lvrRatioToPercent(n) : n);
  const text = (value ?? '').trim().toLowerCase().replace(/^lvr_/, '').replace(/%/g, '')
    .replace(/^le/, '<=').replace(/^lt/, '<').replace(/^ge/, '>=').replace(/^gt/, '>')
    .replace(/^≤/, '<=').replace(/^≥/, '>=').replace(/(\d)p(?=\d)/g, '$1.');
  let match = /^(=|<=|<)?(\d+(?:\.\d+)?)$/.exec(text);
  if (match) {
    const hi = scale(Number(match[2]));
    return hi > 0 && hi <= 100 ? { lo: 0, hi, inclusive: false,
      ...(match[1] === '<' ? { hiInclusive: false } : {}) } : null;
  }
  match = /^(>=|>)?(\d+(?:\.\d+)?)\s*[-–_]\s*(<=|<)?(\d+(?:\.\d+)?)$/.exec(text);
  if (match) {
    const ratio = asRatio && Number(match[4]) <= 1;
    const lo = ratio ? lvrRatioToPercent(Number(match[2])) : Number(match[2]), hi = ratio ? lvrRatioToPercent(Number(match[4])) : Number(match[4]), inclusive = match[1] === '>=';
    return lo >= 0 && hi <= 100 && (lo < hi || (inclusive && match[3] !== '<' && lo === hi))
      ? { lo, hi, inclusive, ...(match[3] === '<' ? { hiInclusive: false } : {}) } : null;
  }
  match = /^(>=|>)(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)\+$/.exec(text);
  if (!match) return null;
  const lo = scale(Number(match[2] ?? match[3]));
  return lo >= 0 && lo <= 100 ? { lo, hi: Infinity, inclusive: match[1] === '>=' } : null;
}

export function lvrRangeContains(range: LvrRange, value: number): boolean {
  return Number.isFinite(value) && value > 0 &&
    (range.hiInclusive === false ? value < range.hi : value <= range.hi) &&
    (range.inclusive ? value >= range.lo : value > range.lo);
}

/** Require the whole selected band at the CDR's 0.01% steps. Unknown LVR rows
 * match only an explicitly selected identical facet, never a numeric band. */
export function matchesLvrTier(value: string | undefined | null, selected: readonly string[] | undefined): boolean {
  if (!selected?.length) return true;
  if (value != null && selected.includes(value)) return true;
  const available = parseLvrRange(value ?? undefined);
  if (!available) return false;
  return selected.some(tier => {
    if (tier === '>90') return available.hi > 90;
    const required = parseLvrRange(tier);
    if (!required) return false;
    const first = required.inclusive ? required.lo : Math.round((required.lo + 0.01) * 100) / 100;
    const coversUpper = required.hi < available.hi
      || (required.hi === available.hi && (required.hiInclusive === false || available.hiInclusive !== false))
      || (tier === '<60' && available.hi >= 59.99 && available.hiInclusive !== false);
    return lvrRangeContains(available, first) && coversUpper;
  });
}
