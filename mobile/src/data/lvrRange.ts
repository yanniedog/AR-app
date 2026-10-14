/** Existing canonical facets are (lo, hi]; >= preserves inclusive CDR minima. */
export interface LvrRange { lo: number; hi: number; inclusive: boolean }

export function parseLvrRange(value: string | undefined): LvrRange | null {
  const text = (value ?? '').trim().toLowerCase().replace(/^lvr_/, '').replace(/%/g, '');
  let match = /^(?:=|<=|≤)?(\d+(?:\.\d+)?)$/.exec(text);
  if (match) {
    const hi = Number(match[1]);
    return hi > 0 && hi <= 100 ? { lo: 0, hi, inclusive: false } : null;
  }
  match = /^(>=|>)?(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (match) {
    const lo = Number(match[2]), hi = Number(match[3]), inclusive = match[1] === '>=';
    return lo >= 0 && hi <= 100 && (lo < hi || (inclusive && lo === hi))
      ? { lo, hi, inclusive } : null;
  }
  match = /^(>=|>)(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)\+$/.exec(text);
  if (!match) return null;
  const lo = Number(match[2] ?? match[3]);
  return lo >= 0 && lo <= 100 ? { lo, hi: Infinity, inclusive: match[1] === '>=' } : null;
}

export function lvrRangeContains(range: LvrRange, value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= range.hi &&
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
    const required = parseLvrRange(tier);
    if (!required) return false;
    const first = required.inclusive ? required.lo : Math.round((required.lo + 0.01) * 100) / 100;
    return lvrRangeContains(available, first) && required.hi <= available.hi;
  });
}
