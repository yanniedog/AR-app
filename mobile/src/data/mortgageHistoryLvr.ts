import { uiDecimal, uiJoin } from '../lib/uiCopy';
import { lvrRatioToPercent, parseLvrRange } from './lvrRange';

export const DEFAULT_BENCHMARK_LVR = 80;

/** The user's LVR as a percentage from a scenario value (ratio or percent). */
export function userLvrPercent(value: string | number | null | undefined): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = lvrRatioToPercent(n);
  return pct > 0 && pct <= 100 ? Math.round(pct * 100) / 100 : null;
}

/** The market benchmark for a mortgage is every published rate whose LVR band
 * reaches the user's LVR, so the borrower could take it up. The point is the user's
 * LVR (profile band upper limit, then 80%), moved just inside the product's own band
 * when that band cannot hold it. Using the product's top band instead (98% for a
 * first-home loan) leaves only the few lenders that lend that high. */
export function mortgageHistoryLvr(tier: string | undefined, userLvr?: number | null): string | null {
  const range = parseLvrRange(tier);
  if (!range) return null;
  const want = userLvr && userLvr > 0 ? userLvr : DEFAULT_BENCHMARK_LVR;
  const top = range.hi !== Infinity
    ? range.hiInclusive === false ? Math.round((range.hi - 0.01) * 100) / 100 : range.hi : 100;
  const bottom = range.inclusive ? range.lo : Math.round((range.lo + 0.01) * 100) / 100;
  const point = Math.round(Math.min(Math.max(want, bottom), top) * 100) / 100;
  return point > 0 && point <= 100 ? `lvr_>=${point}-${point}%` : null;
}

/** Upper limit of the saved profile LVR band, used when no exact LVR is known. */
export function profileLvrPercent(tiers: readonly string[] | undefined): number | null {
  let best: number | null = null;
  for (const tier of tiers ?? []) {
    const r = parseLvrRange(tier);
    if (r && r.hi !== Infinity && (best === null || r.hi > best)) best = r.hi;
  }
  return best;
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
