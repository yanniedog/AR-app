import { uiDecimal, uiJoin } from '../lib/uiCopy';
import { benchmarkLvrFloor, parseLvrRange } from './lvrRange';

export const DEFAULT_BENCHMARK_LVR = 80;

/** The user's LVR as a percentage from a scenario ratio (0.8 is 80%). Scenario
 * LVRs are always ratios, so a refinance above 100% is read as such, not as a
 * small percentage, and gives no benchmark point. */
export function userLvrPercent(value: string | number | null | undefined): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = Math.round(n * 10000) / 100;
  return pct > 0 && pct <= 100 ? pct : null;
}

/** The market benchmark for a mortgage is every published rate whose LVR band
 * reaches the user's exact LVR or goes above it. `userLvr` is the caller's
 * resolved LVR percentage (the product screen uses the scenario LVR, then the
 * saved profile, then this default of 80%); it does not depend on the product's
 * own band. */
export function mortgageHistoryLvr(userLvr?: number | null): string | null {
  const point = Math.round((userLvr && userLvr > 0 ? userLvr : DEFAULT_BENCHMARK_LVR) * 100) / 100;
  return point > 0 && point <= 100 ? `lvr_atleast_${point}` : null;
}

/** Highest LVR the saved profile bands reach; an open-ended band such as >90
 * counts from just above its lower limit, so it stays inside the selection. */
export function profileLvrPercent(tiers: readonly string[] | undefined): number | null {
  let best: number | null = null;
  for (const tier of tiers ?? []) {
    const r = parseLvrRange(tier);
    if (!r) continue;
    const point = r.hi !== Infinity ? (r.hiInclusive === false ? Math.round((r.hi - 0.01) * 100) / 100 : r.hi) : r.inclusive ? r.lo : Math.round((r.lo + 0.01) * 100) / 100;
    if (point > 0 && point <= 100 && (best === null || point > best)) best = point;
  }
  return best;
}

export function mortgageHistoryLvrLabel(tier: string | null) {
  const floor = benchmarkLvrFloor(tier);
  if (floor !== null) return uiJoin('LVR', ' ', '≥', uiDecimal(String(floor), 'percent'));
  const range = parseLvrRange(tier ?? undefined);
  if (!range) return uiJoin('LVR', ' · ', 'Unknown');
  const lo = uiDecimal(String(range.lo), 'percent');
  if (range.inclusive && range.lo === range.hi) return uiJoin('LVR', ' ', lo);
  if (range.hi === Infinity) return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo);
  const hi = uiDecimal(String(range.hi), 'percent');
  if (range.lo === 0) return uiJoin('LVR', ' ', range.hiInclusive === false ? '<' : '≤', hi);
  return uiJoin('LVR', ' ', range.inclusive ? '≥' : '>', lo, '–', range.hiInclusive === false ? '<' : null, hi);
}
