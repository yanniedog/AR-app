/**
 * Runtime evidence for menu-nav lag: measure suitability filter + hierarchy
 * rebuild cost at production-like scale (~3.7k rows with details loaded).
 */
import { visibleAccountRows, isBroadlyAvailable } from '../src/data/format';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { childrenFromScoped, rowsUnder, statsFor } from '../src/data/taxonomy';
import { sortRows, excludeTokenDepositRates } from '../src/data/selectors';
import { resolveSectionRibbonStats } from '../src/data/ribbonStats';
import type { ProductDetail, RateRow, SectionKey } from '../src/types';

function makeRows(n: number, section: SectionKey = 'Mortgage'): RateRow[] {
  const rows: RateRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      product_key: `bank${i % 110}|prod${i}`,
      product_name:
        i % 17 === 0
          ? 'Staff Home Loan'
          : i % 19 === 0
            ? 'Police Bank Variable'
            : i % 23 === 0
              ? 'Youth Saver'
              : `Standard Variable ${i}`,
      provider: i % 19 === 0 ? 'Australian Military Bank' : `Lender ${i % 110}`,
      rate: 0.05 + (i % 100) / 10000,
      rate_index: 0,
      account_class: i % 11 === 0 ? 'non_standard' : 'standard',
      hierarchy: ['Variable', i % 2 === 0 ? 'Owner Occupier' : 'Investor'],
      section,
    } as RateRow);
  }
  return rows;
}

function makeDetails(rows: RateRow[]): Record<string, ProductDetail> {
  const products: Record<string, ProductDetail> = {};
  for (const row of rows) {
    products[row.product_key] = {
      product_key: row.product_key,
      description: row.product_name.includes('Staff')
        ? 'Available to staff of the bank only'
        : 'Open to Australian residents',
      eligibility: row.product_name.includes('Youth')
        ? [{ label: 'MAX_AGE', name: 'Maximum age', value: '18', info: '' }]
        : [{ label: 'RESIDENCY_STATUS', name: 'Residency', value: 'AU', info: '' }],
      constraints: [],
    } as ProductDetail;
  }
  return products;
}

function computeHierarchyView(
  all: RateRow[],
  sectionData: { rates: RateRow[]; ribbon?: unknown },
  section: SectionKey,
  path: string[],
  includeNonStandard: boolean,
  depositRankMetric: 'base' | 'comparison' = 'base',
  detailsProducts?: Record<string, ProductDetail> | null,
) {
  const under = rowsUnder(all, section, path);
  const nodeRows = excludeTokenDepositRates(
    visibleAccountRows(under, includeNonStandard, detailsProducts),
    section,
  );
  const kids = childrenFromScoped(nodeRows, section, path);
  const stats =
    path.length === 0
      ? resolveSectionRibbonStats(sectionData as never, under, includeNonStandard, section, detailsProducts)
      : statsFor(nodeRows, true, section);
  let data;
  if (kids.length) {
    data = kids.map((node) => ({ kind: 'node' as const, node }));
  } else {
    const seen = new Set<string>();
    data = sortRows(nodeRows, 'rate', section, depositRankMetric)
      .filter((r) => (seen.has(r.product_key) ? false : seen.add(r.product_key)))
      .map((row) => ({ kind: 'product' as const, row }));
  }
  return { stats, children: kids, items: data };
}

describe('menu nav perf bench (hypothesis B/D)', () => {
  const N = 3700;
  const rows = makeRows(N);
  const details = makeDetails(rows);
  const sectionData = { rates: rows };

  afterEach(() => {
    setSuitabilityAllowed(null);
  });

  it('visibleAccountRows with details is expensive at production scale', () => {
    const t0 = Date.now();
    const filtered = visibleAccountRows(rows, false, details);
    const ms = Date.now() - t0;
    expect(filtered.length).toBeGreaterThan(100);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('hierarchy recompute with details (no cache) costs multi-ms per nav', () => {
    const paths = [[], ['Variable'], ['Variable', 'Owner Occupier']];
    const timings: number[] = [];
    for (const path of paths) {
      const t0 = Date.now();
      for (let i = 0; i < 5; i++) {
        computeHierarchyView(rows, sectionData, 'Mortgage', path, false, 'base', details);
      }
      timings.push((Date.now() - t0) / 5);
    }
    expect(timings.length).toBe(3);
  });

  it('precomputed broadly-available set makes filter near-instant', () => {
    const tBuild0 = Date.now();
    const allowed = new Set<string>();
    for (const row of rows) {
      if (isBroadlyAvailable(row, details[row.product_key])) allowed.add(row.product_key);
    }
    const buildMs = Date.now() - tBuild0;

    setSuitabilityAllowed(allowed);
    const tFilter0 = Date.now();
    const filtered = visibleAccountRows(rows, false, details);
    const filterMs = Date.now() - tFilter0;

    expect(filtered.length).toBe(allowed.size);
    expect(filterMs).toBeLessThan(buildMs + 50);
  });
});
