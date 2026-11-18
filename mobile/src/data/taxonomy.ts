import { mandatoryEligibleRows } from './eligibilityGate';
import { uiDuration, uiJoin, uiLabel, uiNumber, uiOpaqueEnum, uiPercentageDigits, uiSectionName, type UiCopy, type UiText } from '../lib/uiCopy';
import { isMeaningfulDepositRate } from '../config';
import type { RateRow, SectionKey } from '../types';
import { effectiveFraction, isBroadlyAvailable, visibleAccountRows } from './format';
import { collectRowBatches, rowWork, sortValuesCooperatively, type RowWorkControl } from './cooperativeRows';

// The Pi packages a dot-delimited `taxonomy_path` per rate row, e.g.
//   HOME_LOAN.OO.PI.VARIABLE.LVR_70_80
//   SAVINGS.SAVINGS_ACCT.BONUS.TIERED
//   TERM_DEPOSIT.12M.AT_MATURITY.TIERED
// This module turns those into the AR-local dashboard's drill-down hierarchy.

export const ROOT: Record<SectionKey, string> = {
  Mortgage: 'HOME_LOAN',
  Savings: 'SAVINGS',
  TD: 'TERM_DEPOSIT',
};

export function rowsForSearchScope(
  rows: RateRow[],
  section: SectionKey,
  path: string[],
  hierarchyScoped: boolean,
): RateRow[] {
  return path.length || hierarchyScoped ? rowsUnder(rows, section, path) : mandatoryEligibleRows(rows);
}

const LABELS: Readonly<Record<string, UiCopy>> = {
  HOME_LOAN: 'Home loans',
  OO: 'Owner-occupied',
  INV: 'Investor',
  PI: 'Principal & interest',
  IO: 'Interest only',
  VARIABLE: 'Variable rate',
  FIXED: 'Fixed rate',
  SAVINGS: 'Savings',
  SAVINGS_ACCT: 'Savings account',
  AT_CALL: 'At-call',
  BASE: 'Base rate',
  BONUS: 'Bonus rate',
  INTRO: 'Introductory',
  FLAT: 'Flat rate',
  TIERED: 'Tiered balance',
  TERM_DEPOSIT: 'Term deposit',
  AT_MATURITY: 'Paid at maturity',
  MONTHLY: 'Paid monthly',
  QUARTERLY: 'Paid quarterly',
  SEMI_ANNUALLY: 'Paid semi-annually',
  ANNUALLY: 'Paid annually',
  WEEKLY: 'Paid weekly',
  DAILY: 'Paid daily',
  OTHER: 'Other',
};

// Canonical ordering per segment family (mirrors the dashboard ribbon's tier order).
const ORDER: Record<string, number> = {
  OO: 0, INV: 1,
  PI: 0, IO: 1,
  VARIABLE: 0, FIXED: 1,
  AT_CALL: 0, SAVINGS_ACCT: 1,
  BASE: 0, BONUS: 1, INTRO: 2,
  FLAT: 0, TIERED: 1,
  AT_MATURITY: 0, MONTHLY: 1, QUARTERLY: 2, SEMI_ANNUALLY: 3, ANNUALLY: 4,
};

function months(seg: string): number | null {
  const m = /^(\d+)M$/.exec(seg);
  return m ? Number(m[1]) : null;
}

function lvrLabel(seg: string): UiText {
  const v = seg.replace(/^LVR_/, '');
  if (v === 'LE60') return uiJoin('≤', uiPercentageDigits(60), '%', ' ', 'LVR');
  if (v === 'UNSP' || v === 'UNSPECIFIED' || v === 'NA') return uiJoin('LVR', ' · ', 'Unknown');
  let m = /^GT?(\d+)$/.exec(v);
  if (m) return uiJoin(uiPercentageDigits(Number(m[1])), '%', '+', ' ', 'LVR');
  const exact = /^(GE|GT|LE)(\d+(?:p\d+)?)(?:_(\d+(?:p\d+)?))?$/.exec(v);
  if (exact) {
    const operator = exact[1] === 'GE' ? '≥' : exact[1] === 'GT' ? '>' : '≤';
    const roundLvr = (raw: string) => uiPercentageDigits(Number(raw.replace('p', '.')));
    return uiJoin(operator, roundLvr(exact[2]),
      exact[3] ? uiJoin('–', roundLvr(exact[3])) : '', '%', ' ', 'LVR');
  }
  m = /^(\d+)_(\d+)$/.exec(v);
  if (m) return uiJoin(uiPercentageDigits(Number(m[1])), '–', uiPercentageDigits(Number(m[2])), '%', ' ', 'LVR');
  m = /^(\d+)$/.exec(v);
  if (m) return uiJoin('≤', uiPercentageDigits(Number(m[1])), '%', ' ', 'LVR');
  return uiJoin('LVR', ' · ', 'Unknown');
}

/** Closed headings and represented numeric scope facts; segment keys stay intact. */
export function segLabel(seg: string): UiText {
  if (!seg) return uiLabel('Other');
  const label = Object.hasOwn(LABELS, seg) ? LABELS[seg] : null;
  if (label) return uiJoin(label);
  if (seg.startsWith('LVR_')) return lvrLabel(seg);
  const mo = months(seg);
  if (mo !== null) {
    if (mo % 12 === 0) {
      const y = mo / 12;
      return y === 1 ? uiJoin(uiNumber(y), ' ', 'year') : uiDuration(y, 'years');
    }
    return mo === 1 ? uiJoin(uiNumber(mo), ' ', 'month') : uiDuration(mo, 'months');
  }
  return uiJoin('Source category', ' · ', uiOpaqueEnum(seg));
}

// A daily core contains thousands of rows but only a small taxonomy vocabulary.
// Browse used to split the same dot path again in rowsUnder, child grouping and
// leaf checks, which made the first root render a visible JS-thread burst.
const PATH_SEGMENTS_CACHE_LIMIT = 4_096;
const pathSegmentsCache = new Map<string, string[]>();

function pathSegs(tp: string | undefined): string[] {
  const key = tp ?? '';
  const cached = pathSegmentsCache.get(key);
  if (cached) return cached;
  const parsed = key.split('.').filter(Boolean);
  if (pathSegmentsCache.size >= PATH_SEGMENTS_CACHE_LIMIT) pathSegmentsCache.clear();
  pathSegmentsCache.set(key, parsed);
  return parsed;
}

export interface RateStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  count: number; // number of rate rows
  products: number; // distinct product_key count
  providers: number; // distinct lender count
}

export function statsFor(
  rows: RateRow[],
  includeNonStandard = false,
  /** When set for Savings/TD, drop token near-zero rates from ribbon aggregates. */
  section?: SectionKey | null,
  /** Fraction used for min/max/mean/median. Defaults to comparison-or-headline. */
  fractionOf: (row: RateRow) => number | null = effectiveFraction,
): RateStats {
  const fractions: number[] = [];
  const providers = new Set<string>();
  const products = new Set<string>();
  for (const r of mandatoryEligibleRows(rows)) {
    if (!r) continue;
    if (!includeNonStandard && !isBroadlyAvailable(r)) continue;
    // Token floor always uses headline/effective rate so membership matches
    // excludeTokenDepositRates regardless of the aggregate metric.
    const membership = effectiveFraction(r);
    if (membership === null || (section && !isMeaningfulDepositRate(membership, section))) continue;
    const f = fractionOf(r);
    if (f === null) continue;
    fractions.push(f);
    providers.add(r.provider);
    products.add(r.product_key);
  }
  if (!fractions.length) {
    return { min: null, max: null, mean: null, median: null, count: 0, products: 0, providers: 0 };
  }
  fractions.sort((a, b) => a - b);
  const n = fractions.length;
  const mid = n >> 1;
  return {
    min: fractions[0],
    max: fractions[n - 1],
    mean: fractions.reduce((s, x) => s + x, 0) / n,
    median: n % 2 ? fractions[mid] : (fractions[mid - 1] + fractions[mid]) / 2,
    count: n,
    products: products.size,
    providers: providers.size,
  };
}

/** Rows whose taxonomy_path sits at or below `path` (segments under the section root).
 *  Rows with a different root (e.g. an OVERDRAFT row in the Mortgage dataset) or no
 *  taxonomy are excluded from the hierarchy entirely — so the ribbon, counts and
 *  category cards always agree. Those rows remain findable via the flat Search. */
export function rowsUnder(rows: RateRow[], section: SectionKey, path: string[]): RateRow[] {
  const root = ROOT[section];
  return mandatoryEligibleRows(rows).filter((r) => {
    const segs = pathSegs(r.taxonomy_path);
    if (segs[0] !== root) return false;
    for (let i = 0; i < path.length; i++) {
      if (segs[i + 1] !== path[i]) return false;
    }
    return true;
  });
}

export function rowsUnderCooperatively(rows: RateRow[], section: SectionKey, path: string[], control: RowWorkControl = {}) {
  return collectRowBatches(rows, batch => rowsUnder(batch, section, path), control);
}

/** Exact aggregate semantics, including ascending-order summation, with bounded
 * collection and median sorting for whole-day catalogues. */
export async function statsForCooperatively(rows: RateRow[], includeNonStandard = false,
  section?: SectionKey | null, fractionOf: (row: RateRow) => number | null = effectiveFraction,
  control: RowWorkControl = {}): Promise<RateStats | null> {
  const work = rowWork(control);
  const providers = new Set<string>(), products = new Set<string>();
  const fractions = await collectRowBatches(rows, batch => {
    const values: number[] = [];
    for (const row of mandatoryEligibleRows(batch)) {
      if (!row || !includeNonStandard && !isBroadlyAvailable(row)) continue;
      const membership = effectiveFraction(row);
      if (membership === null || section && !isMeaningfulDepositRate(membership, section)) continue;
      const value = fractionOf(row);
      if (value === null) continue;
      values.push(value); providers.add(row.provider); products.add(row.product_key);
    }
    return values;
  }, { ...control, cancelled: work.cancelled });
  if (!fractions) return null;
  const sorted = await sortValuesCooperatively(fractions, (a, b) => a - b, { ...control, cancelled: work.cancelled });
  if (!sorted) return null;
  let sum = 0;
  await work.pause();
  for (let index = 0; index < sorted.length; index++) {
    sum += sorted[index];
    if (index % 32 === 0) {
      if (work.cancelled()) return null;
      if (work.expired()) await work.pause();
    }
  }
  if (work.cancelled()) return null;
  const n = sorted.length, mid = n >> 1;
  return { min: n ? sorted[0] : null, max: n ? sorted[n - 1] : null, mean: n ? sum / n : null,
    median: n ? n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : null,
    count: n, products: products.size, providers: providers.size };
}

export interface TaxoNode {
  seg: string;
  label: UiCopy;
  rows: RateRow[];
  stats: RateStats;
  hasChildren: boolean;
}

function compareSeg(a: string, b: string, section: SectionKey): number {
  const ma = months(a);
  const mb = months(b);
  if (ma !== null && mb !== null) return ma - mb;
  if (a.startsWith('LVR_') && b.startsWith('LVR_')) {
    // Sort by the first digit run, so LE60 / 70_80 / GT95 order correctly; digitless
    // tiers (LVR_UNSP / UNSPECIFIED / NA) sort last.
    const da = /(\d+)/.exec(a);
    const db = /(\d+)/.exec(b);
    const la = da ? parseInt(da[1], 10) : Number.POSITIVE_INFINITY;
    const lb = db ? parseInt(db[1], 10) : Number.POSITIVE_INFINITY;
    return la - lb;
  }
  const oa = ORDER[a];
  const ob = ORDER[b];
  if (oa !== undefined && ob !== undefined) return oa - ob;
  if (oa !== undefined) return -1;
  if (ob !== undefined) return 1;
  // Display admission cannot change ordering of unrecognized source segments.
  const sortLabel = (seg: string) => Object.hasOwn(LABELS, seg) ? LABELS[seg] : seg.charAt(0) + seg.slice(1).toLowerCase().replace(/_/g, ' ');
  return sortLabel(a).localeCompare(sortLabel(b));
}

/** Child nodes one level below `path` (grouped by the next taxonomy segment). */
export function childrenOf(
  rows: RateRow[],
  section: SectionKey,
  path: string[],
  includeNonStandard = false,
  fractionOf?: (row: RateRow) => number | null,
): TaxoNode[] {
  return childrenFromScoped(
    visibleAccountRows(rowsUnder(rows, section, path), includeNonStandard),
    section,
    path,
    fractionOf,
  );
}

/** Like {@link childrenOf} but for rows already scoped to `path` and filtered for
 *  account standardness (i.e. `visibleAccountRows(rowsUnder(...))`). Lets a caller
 *  that already computed that set reuse it instead of re-scanning every section
 *  row again. */
export function childrenFromScoped(
  scopedRows: RateRow[],
  section: SectionKey,
  path: string[],
  fractionOf?: (row: RateRow) => number | null,
): TaxoNode[] {
  const root = ROOT[section];
  const depth = path.length + 1; // index of the "next" segment in the full path
  const buckets = new Map<string, RateRow[]>();
  for (const r of mandatoryEligibleRows(scopedRows)) {
    const segs = pathSegs(r.taxonomy_path);
    if (segs[0] !== root) continue;
    const next = segs[depth];
    if (next === undefined) continue; // row terminates at this node (a leaf product)
    if (!buckets.has(next)) buckets.set(next, []);
    buckets.get(next)!.push(r);
  }
  const nodes: TaxoNode[] = [];
  for (const [seg, segRows] of buckets) {
    nodes.push({
      seg,
      label: segLabel(seg),
      rows: segRows,
      stats: statsFor(segRows, true, section, fractionOf),
      hasChildren: childHasDeeper(segRows, root, depth),
    });
  }
  nodes.sort((a, b) => compareSeg(a.seg, b.seg, section));
  return nodes;
}

export async function childrenFromScopedCooperatively(scopedRows: RateRow[], section: SectionKey, path: string[],
  fractionOf?: (row: RateRow) => number | null, control: RowWorkControl = {}): Promise<TaxoNode[] | null> {
  const work = rowWork(control), root = ROOT[section], depth = path.length + 1;
  const buckets = new Map<string, RateRow[]>(), deeper = new Set<string>();
  const scanned = await collectRowBatches(scopedRows, batch => {
    for (const row of mandatoryEligibleRows(batch)) {
      const segments = pathSegs(row.taxonomy_path), next = segments[depth];
      if (segments[0] !== root || next === undefined) continue;
      const bucket = buckets.get(next);
      if (bucket) bucket.push(row); else buckets.set(next, [row]);
      if (segments[depth + 1] !== undefined) deeper.add(next);
    }
    return [];
  }, { ...control, cancelled: work.cancelled });
  if (!scanned) return null;
  const nodes: TaxoNode[] = [];
  for (const [seg, rows] of buckets) {
    const stats = await statsForCooperatively(rows, true, section, fractionOf, { ...control, cancelled: work.cancelled });
    if (!stats) return null;
    nodes.push({ seg, label: segLabel(seg), rows, stats, hasChildren: deeper.has(seg) });
  }
  return sortValuesCooperatively(nodes, (a, b) => compareSeg(a.seg, b.seg, section), { ...control, cancelled: work.cancelled });
}

function childHasDeeper(rows: RateRow[], root: string, depth: number): boolean {
  for (const r of mandatoryEligibleRows(rows)) {
    const segs = pathSegs(r.taxonomy_path);
    if (segs[0] === root && segs[depth + 1] !== undefined) return true;
  }
  return false;
}

/** Products that terminate exactly at `path` (no deeper taxonomy). */
export function leafProducts(rows: RateRow[], section: SectionKey, path: string[]): RateRow[] {
  const root = ROOT[section];
  const full = path.length + 1;
  return rowsUnder(rows, section, path).filter((r) => {
    const segs = pathSegs(r.taxonomy_path);
    return segs[0] === root && segs.length <= full;
  });
}

/** Breadcrumb labels for a path under a section. */
export function breadcrumb(section: SectionKey, path: string[]): UiCopy[] {
  return [uiSectionName(section), ...path.map(segLabel)];
}
