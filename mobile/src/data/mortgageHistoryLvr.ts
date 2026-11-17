import { uiDecimal, uiJoin } from '../lib/uiCopy';
import { parseLvrRange } from './lvrRange';

/** Use the published bounds, bypassing broad search facets such as ">90". */
export function mortgageHistoryLvr(tier: string | undefined): string | null {
  const range = parseLvrRange(tier);
  if (!range) return null;
  const lower = range.inclusive ? '>=' : '>';
  if (range.hi === Infinity) return `lvr_${lower}${range.lo}%`;
  const upper = range.hiInclusive === false ? '<' : '';
  return `lvr_${lower}${range.lo}-${upper}${range.hi}%`;
}

export function mortgageHistoryLvrLabel(tier: string | null) {
  const range = parseLvrRange(tier ?? undefined);
  if (!range) return uiJoin('LVR', ' · ', 'Unknown');
  const lo = uiDecimal(String(range.lo), 'percent');
  if (range.hi === Infinity) return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo);
  const hi = uiDecimal(String(range.hi), 'percent');
  if (range.lo === 0) return uiJoin('LVR', ' ', range.hiInclusive === false ? '<' : '≤', hi);
  return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo, '–', range.hiInclusive === false ? '<' : null, hi);
}
