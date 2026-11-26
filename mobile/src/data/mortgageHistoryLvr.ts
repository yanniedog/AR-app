import { uiDecimal, uiJoin } from '../lib/uiCopy';
import { parseLvrRange } from './lvrRange';

/** The market benchmark for a mortgage tier is every published rate available
 * at one LVR inside the product's band: its upper limit, or just above the lower
 * limit for an open-ended band. Requiring each market row to span the whole band
 * would drop every lender that publishes narrower bands, which is all of the
 * pre-November history, so the ribbon would only cover recent days. */
export function mortgageHistoryLvr(tier: string | undefined): string | null {
  const range = parseLvrRange(tier);
  if (!range) return null;
  const point = range.hi !== Infinity
    ? range.hiInclusive === false ? Math.round((range.hi - 0.01) * 100) / 100 : range.hi
    : range.inclusive ? range.lo : Math.round((range.lo + 0.01) * 100) / 100;
  return point > 0 && point <= 100 ? `lvr_>=${point}-${point}%` : null;
}

export function mortgageHistoryLvrLabel(tier: string | null) {
  const range = parseLvrRange(tier ?? undefined);
  if (!range) return uiJoin('LVR', ' · ', 'Unknown');
  const lo = uiDecimal(String(range.lo), 'percent');
  if (range.inclusive && range.lo === range.hi) return uiJoin('LVR', ' ', lo);
  if (range.hi === Infinity) return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo);
  const hi = uiDecimal(String(range.hi), 'percent');
  if (range.lo === 0) return uiJoin('LVR', ' ', range.hiInclusive === false ? '<' : '≤', hi);
  return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo, '–', range.hiInclusive === false ? '<' : null, hi);
}
