import {
  EMPTY_FILTERS,
  activeFilterCount,
  bestRow,
  distinctProviders,
  distinctValues,
  excludeTokenDepositRates,
  filterRows,
  findByKey,
  compareProviderGroupsByRate,
  groupByProvider,
  normalizeSortKey,
  queryAndSort,
  rankFraction,
  sortRankFraction,
  sortRows,
  type MortgageRateMetric,
  type ProviderGroup,
  type RankMetric,
  type SortKey,
} from '../src/data/selectors';
import { toFraction } from '../src/data/format';
import * as rateQualifierModule from '../src/lib/rateQualifier';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import type { RateRow, SectionKey } from '../src/types';

const mk = (over: Partial<RateRow>): RateRow => ({
  provider: 'Bank A',
  product_key: 'k',
  product_name: 'Product',
  rate: '0.05',
  ...over,
});

const mortgage: RateRow[] = [
  mk({ provider: 'Bank A', product_key: 'A|1', product_name: 'Cheap Loan', rate: '0.0574', rate_type: 'VARIABLE' }),
  mk({ provider: 'Bank B', product_key: 'B|1', product_name: 'Mid Loan', rate: '0.0612', rate_type: 'FIXED' }),
  mk({ provider: 'Bank C', product_key: 'C|1', product_name: 'Green Loan', rate: '0.0489', rate_type: 'VARIABLE', account_class: 'non_standard' }),
];

const savings: RateRow[] = [
  mk({ provider: 'Bank A', product_key: 'A|S', product_name: 'Saver', rate: '0.045' }),
  mk({ provider: 'Bank B', product_key: 'B|S', product_name: 'Bonus', rate: '0.052' }),
];

function referenceSortRows(
  rows: RateRow[],
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric,
  mortgageMetric: MortgageRateMetric,
): RateRow[] {
  const lowerIsBetter = section === 'Mortgage';
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (sortKey !== 'bank') {
        const va = sortRankFraction(a.row, sortKey, section, metric, mortgageMetric);
        const vb = sortRankFraction(b.row, sortKey, section, metric, mortgageMetric);
        if (va === null && vb !== null) return 1;
        if (va !== null && vb === null) return -1;
        if (va !== null && vb !== null) {
          const byRate = lowerIsBetter ? va - vb : vb - va;
          if (byRate !== 0) return byRate;
          if (section === 'Mortgage' && sortKey === 'rate' && mortgageMetric === 'headline') {
            const ca = toFraction(a.row.comparison_rate);
            const cb = toFraction(b.row.comparison_rate);
            if (ca === null && cb !== null) return 1;
            if (ca !== null && cb === null) return -1;
            if (ca !== null && cb !== null && ca !== cb) return ca - cb;
          }
        }
      }
      return (
        a.row.provider.localeCompare(b.row.provider) ||
        a.row.product_name.localeCompare(b.row.product_name) ||
        a.index - b.index
      );
    })
    .map(({ row }) => row);
}

function seededRows(seed: number, section: SectionKey): RateRow[] {
  let value = seed >>> 0;
  const next = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value;
  };
  return Array.from({ length: 80 }, (_, index) => {
    const headline = index % 13 === 0 ? '0' : String(0.025 + (next() % 35) / 10_000);
    const comparison = index % 5 === 0
      ? undefined
      : String(0.025 + (next() % 35) / 10_000);
    const kind = index % 4 === 0 ? 'bonus' : index % 9 === 0 ? 'introductory' : 'base';
    const ongoing = index % 17 === 0
      ? ''
      : index % 19 === 0
        ? '0'
        : String(0.01 + (next() % 30) / 10_000);
    return mk({
      provider: `Bank ${next() % 8}`,
      product_key: `${section}-${seed}-${index}`,
      product_name: `Product ${next() % 12}`,
      rate: headline,
      comparison_rate: comparison,
      ribbon_deposit_kind: section === 'Savings' ? kind : undefined,
      ribbon_rate_structure: section === 'TD' ? kind : undefined,
      ongoing_rate: section === 'Mortgage' ? undefined : ongoing,
      account_class: 'standard',
    });
  });
}

describe('selectors', () => {
  afterEach(() => {
    setSuitabilityAllowed(null);
    jest.restoreAllMocks();
  });

  test('bestRow picks lowest for loans, ignoring non-standard', () => {
    const best = bestRow(mortgage, 'Mortgage');
    expect(best?.product_key).toBe('A|1'); // 5.74% — the green 4.89% is non-standard
    expect(best?.account_class).not.toBe('non_standard');
  });

  test('bestRow returns null when every candidate is non-standard by default', () => {
    expect(bestRow(mortgage.filter((row) => row.account_class === 'non_standard'), 'Mortgage')).toBeNull();
  });

  test('bestRow picks highest for deposits', () => {
    const best = bestRow(savings, 'Savings');
    expect(best?.product_key).toBe('B|S'); // 5.2%
  });

  test('bestRow (savings) ignores token near-zero rates (~0.01%)', () => {
    const rows = [
      mk({ product_key: 'JUNK|S', product_name: 'Access Account', rate: '0.0001' }), // 0.01%
      mk({ product_key: 'LOW|S', product_name: 'GoalSaver', rate: '0.0025' }), // 0.25%
      mk({ product_key: 'OK|S', product_name: 'High Saver', rate: '0.045' }),
    ];
    expect(bestRow(rows, 'Savings')?.product_key).toBe('OK|S');
    // 0.25% clears the 0.10% floor and remains eligible when it is the best.
    expect(bestRow(rows.filter((r) => r.product_key !== 'OK|S'), 'Savings')?.product_key).toBe('LOW|S');
    expect(bestRow(rows.filter((r) => r.product_key === 'JUNK|S'), 'Savings')).toBeNull();
  });

  test('bestRow (TD) ignores token near-zero rates', () => {
    const rows = [
      mk({ product_key: 'FX|TD', product_name: 'EURO Term Deposit', rate: '0.0001' }),
      mk({ product_key: 'AUD|TD', product_name: '12 Month TD', rate: '0.041' }),
    ];
    expect(bestRow(rows, 'TD')?.product_key).toBe('AUD|TD');
  });

  test('bestRow (mortgage) is not gated by the deposit token-rate floor', () => {
    // A pathological 0.01% loan must still win — the floor is deposit-only.
    const rows = [
      mk({ product_key: 'CHEAP|M', rate: '0.0001', comparison_rate: '0.0001' }),
      mk({ product_key: 'NORM|M', rate: '0.057', comparison_rate: '0.058' }),
    ];
    expect(bestRow(rows, 'Mortgage')?.product_key).toBe('CHEAP|M');
  });

  test('queryAndSort / filterRows hide token deposit rates from savings discovery', () => {
    const rows = [
      mk({ product_key: 'JUNK|S', rate: '0.0001' }),
      mk({ product_key: 'OK|S', rate: '0.045' }),
      // Genuine bonus: high headline, near-zero ongoing — keep in lists under both metrics.
      mk({ product_key: 'BONUS|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.0001' }),
    ];
    expect(queryAndSort(rows, EMPTY_FILTERS, 'rate', 'Savings').map((r) => r.product_key)).toEqual([
      'OK|S',
      'BONUS|S',
    ]);
    // Max metric ranks on the headline bonus rate (5.2%).
    expect(
      queryAndSort(rows, EMPTY_FILTERS, 'rate', 'Savings', null, null, 'max').map((r) => r.product_key),
    ).toEqual(['BONUS|S', 'OK|S']);
  });

  test('excludeTokenDepositRates is a no-op for mortgages', () => {
    const rows = [
      mk({ product_key: 'CHEAP|M', rate: '0.0001', comparison_rate: '0.0001' }),
      mk({ product_key: 'NORM|M', rate: '0.057', comparison_rate: '0.058' }),
    ];
    expect(excludeTokenDepositRates(rows, 'Mortgage')).toEqual(rows);
  });


  test('excludeTokenDepositRates / filterRows reject published zero-rate deposits', () => {
    const rows = [
      mk({ product_key: 'ZERO|S', rate: '0' }),
      mk({ product_key: 'OK|S', rate: '0.045' }),
    ];
    expect(excludeTokenDepositRates(rows, 'Savings').map((r) => r.product_key)).toEqual(['OK|S']);
    expect(queryAndSort(rows, EMPTY_FILTERS, 'rate', 'Savings').map((r) => r.product_key)).toEqual(['OK|S']);
    expect(bestRow(rows, 'Savings')?.product_key).toBe('OK|S');
  });

  test('excludeTokenDepositRates keeps unrankable bonus rows but drops 0.01% base', () => {
    const rows = [
      mk({ product_key: 'JUNK|S', rate: '0.0001' }),
      mk({ product_key: 'OK|S', rate: '0.045' }),
      mk({ product_key: 'UR|S', rate: '0.055', ribbon_deposit_kind: 'bonus' }), // no ongoing → unrankable
      // High headline + published 0% ongoing must stay (floor uses effectiveFraction).
      mk({ product_key: 'ZERO|S', rate: '0.055', ribbon_deposit_kind: 'bonus', ongoing_rate: '0' }),
    ];
    expect(excludeTokenDepositRates(rows, 'Savings').map((r) => r.product_key)).toEqual([
      'OK|S',
      'UR|S',
      'ZERO|S',
    ]);
  });

  test('bestRow includes non-standard when requested', () => {
    expect(bestRow(mortgage, 'Mortgage', true)?.product_key).toBe('C|1');
  });

  test('sortRows best-first by section direction', () => {
    const loans = sortRows(mortgage.filter((r) => r.account_class !== 'non_standard'), 'rate', 'Mortgage');
    expect(loans.map((r) => r.product_key)).toEqual(['A|1', 'B|1']);
    const deps = sortRows(savings, 'rate', 'Savings');
    expect(deps.map((r) => r.product_key)).toEqual(['B|S', 'A|S']);
  });

  test('optimized sorting and linear best selection match the reference ordering', () => {
    const cases: {
      section: SectionKey;
      sortKey: SortKey;
      metric: RankMetric;
      mortgageMetric: MortgageRateMetric;
    }[] = [
      { section: 'Mortgage', sortKey: 'rate', metric: 'base', mortgageMetric: 'headline' },
      { section: 'Mortgage', sortKey: 'rate', metric: 'base', mortgageMetric: 'comparison' },
      { section: 'Mortgage', sortKey: 'comparison', metric: 'base', mortgageMetric: 'headline' },
      { section: 'Mortgage', sortKey: 'bank', metric: 'base', mortgageMetric: 'headline' },
      { section: 'Savings', sortKey: 'rate', metric: 'base', mortgageMetric: 'headline' },
      { section: 'Savings', sortKey: 'comparison', metric: 'max', mortgageMetric: 'headline' },
      { section: 'TD', sortKey: 'rate', metric: 'base', mortgageMetric: 'headline' },
    ];

    for (let seed = 1; seed <= 12; seed += 1) {
      for (const testCase of cases) {
        const rows = seededRows(seed, testCase.section);
        const expected = referenceSortRows(
          rows,
          testCase.sortKey,
          testCase.section,
          testCase.metric,
          testCase.mortgageMetric,
        );
        expect(
          sortRows(
            rows,
            testCase.sortKey,
            testCase.section,
            testCase.metric,
            testCase.mortgageMetric,
          ).map((row) => row.product_key),
        ).toEqual(expected.map((row) => row.product_key));

        if (testCase.sortKey === 'rate') {
          const rankable = excludeTokenDepositRates(rows, testCase.section).filter(
            (row) =>
              rankFraction(
                row,
                testCase.section,
                testCase.metric,
                testCase.mortgageMetric,
              ) !== null,
          );
          const expectedBest = referenceSortRows(
            rankable,
            'rate',
            testCase.section,
            testCase.metric,
            testCase.mortgageMetric,
          )[0] ?? null;
          expect(
            bestRow(
              rows,
              testCase.section,
              true,
              testCase.metric,
              null,
              testCase.mortgageMetric,
            )?.product_key ?? null,
          ).toBe(expectedBest?.product_key ?? null);
        }
      }
    }
  });

  test('extracts a deposit rank once per row and never constructs display qualifiers', () => {
    const conditionality = jest.spyOn(rateQualifierModule, 'rateConditionality');
    const displayQualifier = jest.spyOn(rateQualifierModule, 'rateQualifier');
    const rows = Array.from({ length: 600 }, (_, index) => mk({
      provider: `Bank ${index % 20}`,
      product_key: `S-${index}`,
      product_name: `Bonus saver ${index % 50}`,
      rate: String(0.04 + (index % 25) / 10_000),
      ribbon_deposit_kind: index % 3 === 0 ? 'introductory' : 'bonus',
      ongoing_rate: index % 11 === 0 ? '0' : String(0.01 + (index % 30) / 10_000),
    }));

    sortRows(rows, 'rate', 'Savings', 'base');

    expect(conditionality).toHaveBeenCalledTimes(rows.length);
    expect(displayQualifier).not.toHaveBeenCalled();
  });

  test('rankFraction ranks deposit bonus/intro rows by their base ongoing rate', () => {
    const base = mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' });
    const bonus = mk({ product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.010' });
    const bonusNoBase = mk({ product_key: 'C|S', rate: '0.055', ribbon_deposit_kind: 'bonus' });
    expect(rankFraction(base, 'Savings')).toBeCloseTo(0.045);
    expect(rankFraction(bonus, 'Savings')).toBeCloseTo(0.01); // the ongoing rate, not 5.2%
    expect(rankFraction(bonusNoBase, 'Savings')).toBeNull(); // no base published -> unrankable
    expect(rankFraction(bonus, 'Savings', 'max')).toBeCloseTo(0.052); // opt into max
    // Mortgages carry no bonus/intro concept — always the effective rate.
    expect(rankFraction(mk({ rate: '0.06', comparison_rate: '0.061' }), 'Mortgage')).toBeCloseTo(0.06);
    expect(
      rankFraction(mk({ rate: '0.06', comparison_rate: '0.061' }), 'Mortgage', 'base', 'comparison'),
    ).toBeCloseTo(0.061);
    // When comparison is unpublished, mortgage comparison metric falls back to headline.
    expect(
      rankFraction(mk({ rate: '0.06' }), 'Mortgage', 'base', 'comparison'),
    ).toBeCloseTo(0.06);
  });

  test('bestRow (savings) ignores conditional bonus rates by default', () => {
    const rows = [
      mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' }),
      mk({ product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.010' }),
    ];
    // Base 4.5% beats the bonus account's 1.0% ongoing rate.
    expect(bestRow(rows, 'Savings')?.product_key).toBe('A|S');
    // Opting into max ranks by the 5.2% headline bonus rate.
    expect(bestRow(rows, 'Savings', false, 'max')?.product_key).toBe('B|S');
  });

  test('sortRows (savings) orders by base ongoing rate by default', () => {
    const rows = [
      mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' }),
      mk({ product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.010' }),
    ];
    expect(sortRows(rows, 'rate', 'Savings').map((r) => r.product_key)).toEqual(['A|S', 'B|S']);
    expect(sortRows(rows, 'rate', 'Savings', 'max').map((r) => r.product_key)).toEqual(['B|S', 'A|S']);
  });

  test('rankFraction leaves non-deposit sections unchanged under either metric', () => {
    const loan = mk({ rate: '0.06', comparison_rate: '0.061' });
    // Mortgages ignore the deposit RankMetric; headline vs comparison is separate.
    expect(rankFraction(loan, 'Mortgage', 'max')).toBeCloseTo(0.06);
    expect(rankFraction(loan, 'Mortgage', 'base')).toBeCloseTo(0.06);
    expect(rankFraction(loan, 'Mortgage', 'base', 'comparison')).toBeCloseTo(0.061);
    expect(rankFraction(loan, 'Mortgage', 'max', 'headline')).toBeCloseTo(0.06);
  });

  test('rankFraction treats a published 0% ongoing rate as 0, not unranked', () => {
    const zeroBonus = mk({ ribbon_deposit_kind: 'bonus', rate: '0.05', ongoing_rate: '0' });
    expect(rankFraction(zeroBonus, 'Savings')).toBe(0);
    // Genuinely absent base stays unrankable (null), not coerced to 0.
    const noBase = mk({ ribbon_deposit_kind: 'bonus', rate: '0.05', ongoing_rate: '' });
    expect(rankFraction(noBase, 'Savings')).toBeNull();
  });

  test('bestRow (savings) prefers base over an unrankable bonus with no ongoing_rate', () => {
    const rows = [
      mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' }),
      mk({ product_key: 'B|S', rate: '0.055', ribbon_deposit_kind: 'bonus' }), // no ongoing_rate -> unrankable
    ];
    expect(bestRow(rows, 'Savings')?.product_key).toBe('A|S');
    expect(bestRow(rows, 'Savings', false, 'max')?.product_key).toBe('B|S');
  });

  test('bestRow (savings) returns null when every candidate is an unrankable bonus', () => {
    const rows = [
      mk({ product_key: 'B|S', rate: '0.055', ribbon_deposit_kind: 'bonus' }),
      mk({ product_key: 'C|S', rate: '0.050', ribbon_deposit_kind: 'bonus' }),
    ];
    expect(bestRow(rows, 'Savings')).toBeNull();
  });

  test('sortRows & queryAndSort (savings) push unrankable bonus rows last and honour the metric', () => {
    const rows = [
      mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' }),
      mk({ product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.010' }),
      mk({ product_key: 'C|S', rate: '0.055', ribbon_deposit_kind: 'bonus' }), // unrankable (no ongoing_rate)
    ];
    expect(sortRows(rows, 'rate', 'Savings').map((r) => r.product_key)).toEqual(['A|S', 'B|S', 'C|S']);
    expect(queryAndSort(rows, EMPTY_FILTERS, 'rate', 'Savings').map((r) => r.product_key)).toEqual(['A|S', 'B|S', 'C|S']);
    expect(
      queryAndSort(rows, EMPTY_FILTERS, 'rate', 'Savings', null, null, 'max').map((r) => r.product_key),
    ).toEqual(['C|S', 'B|S', 'A|S']);
  });

  test('sortRows comparison key also uses base ranking for deposits', () => {
    const rows = [
      mk({ product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'base' }),
      mk({ product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus', ongoing_rate: '0.010' }),
    ];
    // The legacy "comparison" sort must not reintroduce bonus-first ordering.
    expect(sortRows(rows, 'comparison', 'Savings').map((r) => r.product_key)).toEqual(['A|S', 'B|S']);
    // Loans: "comparison" ranks by comparison rate; "rate" ranks by headline.
    const loans = [
      mk({ product_key: 'L1', rate: '0.061', comparison_rate: '0.059' }),
      mk({ product_key: 'L2', rate: '0.058', comparison_rate: '0.060' }),
    ];
    expect(sortRows(loans, 'comparison', 'Mortgage').map((r) => r.product_key)).toEqual(['L1', 'L2']);
    expect(sortRows(loans, 'rate', 'Mortgage').map((r) => r.product_key)).toEqual(['L2', 'L1']);
    // Opting into comparison ranking for the rate chip mirrors comparison sort.
    expect(sortRows(loans, 'rate', 'Mortgage', 'base', 'comparison').map((r) => r.product_key)).toEqual([
      'L1',
      'L2',
    ]);
  });

  test('sortRows mortgage rate key follows advertised headline rates on cards', () => {
    // Mirrors Browse leaf ordering: big green rate must ascend even when
    // comparison rates would scramble that sequence.
    // Also asserts tie-breaking when rate and comparison_rate are equal:
    // falls back to provider, then product_name (same identity order as bank sort).
    const loans = [
      mk({ product_key: 'GO', product_name: 'Go Basic', rate: '0.0595', comparison_rate: '0.0599' }),
      mk({ product_key: 'ALL', product_name: 'Allium Premium', rate: '0.0599', comparison_rate: '0.0599' }),
      mk({ product_key: 'CLS', product_name: 'Classic', rate: '0.0629', comparison_rate: '0.0600' }),
      mk({ product_key: 'BEN', product_name: 'Bendigo Express', rate: '0.0589', comparison_rate: '0.0602' }),
      mk({ product_key: 'RD', product_name: 'Real Deal', rate: '0.0599', comparison_rate: '0.0603' }),
      mk({
        product_key: 'TIE1',
        product_name: 'Alpha Home Loan',
        provider: 'Bank A',
        rate: '0.0610',
        comparison_rate: '0.0610',
      }),
      mk({
        product_key: 'TIE2',
        product_name: 'Alpha Home Loan',
        provider: 'Bank B',
        rate: '0.0610',
        comparison_rate: '0.0610',
      }),
      mk({
        product_key: 'TIE3',
        product_name: 'Beta Home Loan',
        provider: 'Bank A',
        rate: '0.0610',
        comparison_rate: '0.0610',
      }),
    ];
    expect(sortRows(loans, 'rate', 'Mortgage').map((r) => r.product_key)).toEqual([
      'BEN',
      'GO',
      'ALL',
      'RD',
      'TIE1', // Bank A, Alpha
      'TIE3', // Bank A, Beta
      'TIE2', // Bank B, Alpha
      'CLS',
    ]);
    // Equal comparison rates (GO/ALL at 5.99%) break ties by provider then name.
    expect(sortRows(loans, 'comparison', 'Mortgage').map((r) => r.product_key)).toEqual([
      'ALL',
      'GO',
      'CLS',
      'BEN',
      'RD',
      'TIE1',
      'TIE3',
      'TIE2',
    ]);
  });

  test('sortRows mortgage rate key puts missing comparison rates last among headline ties', () => {
    const loans = [
      mk({ product_key: 'HAS', product_name: 'Has Cmp', rate: '0.060', comparison_rate: '0.061' }),
      mk({ product_key: 'MISS', product_name: 'Missing Cmp', rate: '0.060' }),
      mk({ product_key: 'BETTER', product_name: 'Better Cmp', rate: '0.060', comparison_rate: '0.059' }),
    ];
    expect(sortRows(loans, 'rate', 'Mortgage').map((r) => r.product_key)).toEqual([
      'BETTER',
      'HAS',
      'MISS',
    ]);
    // Comparison metric ranks purely by comparison/effective rate (no headline tie-break).
    // MISS falls back to its headline (6.0%), so it sorts between BETTER (5.9%) and HAS (6.1%).
    expect(sortRows(loans, 'rate', 'Mortgage', 'base', 'comparison').map((r) => r.product_key)).toEqual([
      'BETTER',
      'MISS',
      'HAS',
    ]);
    // Explicit comparison sort key uses the same effective-rate ordering.
    expect(sortRows(loans, 'comparison', 'Mortgage').map((r) => r.product_key)).toEqual([
      'BETTER',
      'MISS',
      'HAS',
    ]);
  });

  test('sortRows mortgage comparison metric ignores headline when rates diverge', () => {
    const loans = [
      mk({ product_key: 'LOW_HEAD', rate: '0.055', comparison_rate: '0.062' }),
      mk({ product_key: 'LOW_CMP', rate: '0.060', comparison_rate: '0.058' }),
    ];
    expect(sortRows(loans, 'rate', 'Mortgage', 'base', 'headline').map((r) => r.product_key)).toEqual([
      'LOW_HEAD',
      'LOW_CMP',
    ]);
    expect(sortRows(loans, 'rate', 'Mortgage', 'base', 'comparison').map((r) => r.product_key)).toEqual([
      'LOW_CMP',
      'LOW_HEAD',
    ]);
  });

  test('bestRow mortgage headline ties prefer lower comparison rate like sortRows', () => {
    const loans = [
      mk({ product_key: 'FIRST', rate: '0.060', comparison_rate: '0.061' }),
      mk({ product_key: 'BETTER_CMP', rate: '0.060', comparison_rate: '0.059' }),
    ];
    expect(bestRow(loans, 'Mortgage', false, 'base', null, 'headline')?.product_key).toBe('BETTER_CMP');
    expect(sortRows(loans, 'rate', 'Mortgage', 'base', 'headline')[0]?.product_key).toBe('BETTER_CMP');
  });

  test('sortRows by bank A-Z', () => {
    const sorted = sortRows(mortgage, 'bank', 'Mortgage');
    expect(sorted.map((r) => r.provider)).toEqual(['Bank A', 'Bank B', 'Bank C']);
  });

  test('normalizeSortKey accepts deep-link presets and defaults invalid values', () => {
    expect(normalizeSortKey('comparison')).toBe('comparison');
    expect(normalizeSortKey('bank')).toBe('bank');
    expect(normalizeSortKey('unexpected')).toBe('rate');
    expect(normalizeSortKey()).toBe('rate');
  });

  test('filterRows excludes non-standard by default and applies facets', () => {
    expect(filterRows(mortgage, EMPTY_FILTERS)).toHaveLength(2);
    expect(filterRows(mortgage, { ...EMPTY_FILTERS, includeNonStandard: true })).toHaveLength(3);
    expect(filterRows(mortgage, { ...EMPTY_FILTERS, rateTypes: ['FIXED'] })).toHaveLength(1);
    expect(filterRows(mortgage, { ...EMPTY_FILTERS, query: 'green', includeNonStandard: true })).toHaveLength(1);
  });

  test('filterRows honors the rebuilt suitability gate for shared search paths', () => {
    setSuitabilityAllowed(new Set(['B|1']));

    expect(filterRows(mortgage, EMPTY_FILTERS).map((row) => row.product_key)).toEqual(['B|1']);
    expect(filterRows(mortgage, { ...EMPTY_FILTERS, includeNonStandard: true })).toHaveLength(3);
  });

  test('filterRows excludes access-restricted products by name unless opted in', () => {
    const rows = [
      mk({ provider: 'Bank A', product_key: 'A|1', product_name: 'Basic Variable Loan', rate: '0.057' }),
      mk({ provider: 'Police Bank', product_key: 'P|1', product_name: 'Staff Home Loan', rate: '0.049' }),
      mk({ provider: 'Bank B', product_key: 'B|1', product_name: 'Business Overdraft', rate: '0.051' }),
    ];
    // Staff-only and business products no longer leak into the default view.
    expect(filterRows(rows, EMPTY_FILTERS).map((r) => r.product_key)).toEqual(['A|1']);
    expect(filterRows(rows, { ...EMPTY_FILTERS, includeNonStandard: true })).toHaveLength(3);
    // And the same rule governs the ranked "best" result.
    expect(bestRow(rows, 'Mortgage')?.product_key).toBe('A|1');
  });

  test('filterRows applies depositKinds for deposit sections', () => {
    const deposits = [
      mk({ provider: 'Bank A', product_key: 'A|S', rate: '0.045', ribbon_deposit_kind: 'at_call' }),
      mk({ provider: 'Bank B', product_key: 'B|S', rate: '0.052', ribbon_deposit_kind: 'bonus' }),
      mk({ provider: 'Bank C', product_key: 'C|S', rate: '0.048', ribbon_deposit_kind: 'bonus' }),
    ];
    expect(filterRows(deposits, EMPTY_FILTERS)).toHaveLength(3);
    const bonus = filterRows(deposits, { ...EMPTY_FILTERS, depositKinds: ['bonus'] });
    expect(bonus.map((r) => r.product_key)).toEqual(['B|S', 'C|S']);
    const byProvider = filterRows(deposits, { ...EMPTY_FILTERS, providers: ['Bank A'] });
    expect(byProvider).toHaveLength(1);
  });

  test('filterRows applies interestPayments (TD facet) against interest_payment', () => {
    const td = [
      mk({ product_key: 'A|TD', rate: '0.05', interest_payment: 'monthly' }),
      mk({ product_key: 'B|TD', rate: '0.051', interest_payment: 'at_maturity' }),
    ];
    const monthly = filterRows(td, { ...EMPTY_FILTERS, interestPayments: ['monthly'] });
    expect(monthly.map((r) => r.product_key)).toEqual(['A|TD']);
  });

  test('filterRows applies accountFeatures from details (AND logic)', () => {
    const rows = [
      mk({ product_key: 'A|1', rate: '0.05' }),
      mk({ product_key: 'B|1', rate: '0.06' }),
      mk({ product_key: 'C|1', rate: '0.07' }),
    ];
    const details = {
      'A|1': { features: [{ label: 'OFFSET' }, { label: 'REDRAW' }] },
      'B|1': { features: [{ label: 'OFFSET' }] },
      'C|1': { features: [{ label: 'REDRAW' }] },
    };
    const offsetOnly = filterRows(rows, { ...EMPTY_FILTERS, accountFeatures: ['OFFSET'] }, details);
    expect(offsetOnly.map((r) => r.product_key)).toEqual(['A|1', 'B|1']);
    const offsetAndRedraw = filterRows(
      rows,
      { ...EMPTY_FILTERS, accountFeatures: ['OFFSET', 'REDRAW'] },
      details,
    );
    expect(offsetAndRedraw.map((r) => r.product_key)).toEqual(['A|1']);
    expect(filterRows(rows, { ...EMPTY_FILTERS, accountFeatures: ['OFFSET'] }, null)).toHaveLength(0);
  });

  test('activeFilterCount includes accountFeatures', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, accountFeatures: ['OFFSET', 'REDRAW'] })).toBe(2);
  });

  test('queryAndSort end-to-end', () => {
    const out = queryAndSort(mortgage, { ...EMPTY_FILTERS, query: 'loan' }, 'rate', 'Mortgage');
    expect(out.map((r) => r.product_key)).toEqual(['A|1', 'B|1']);
  });

  test('activeFilterCount', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, providers: ['Bank A'], includeNonStandard: true })).toBe(1);
  });

  test('distinctValues sorts by frequency then label', () => {
    expect(distinctValues(mortgage, 'rate_type')).toEqual(['VARIABLE', 'FIXED']);
  });

  test('distinctProviders empty input and falsey providers', () => {
    expect(distinctProviders([])).toEqual([]);
    const rows = [
      mk({ provider: 'Bank A', product_key: 'A|1' }),
      mk({ provider: '', product_key: 'E|1' }),
      mk({ provider: undefined as unknown as string, product_key: 'U|1' }),
    ];
    expect(distinctProviders(rows)).toEqual(['Bank A']);
  });

  test('distinctProviders sorted A–Z case-insensitive, not by frequency', () => {
    const rows = [
      mk({ provider: 'Zebra Bank', product_key: 'Z|1' }),
      mk({ provider: 'Zebra Bank', product_key: 'Z|2' }),
      mk({ provider: 'alpha credit', product_key: 'a|1' }),
      mk({ provider: 'Mid Bank', product_key: 'M|1' }),
      mk({ provider: 'Beta', product_key: 'B|1' }),
    ];
    expect(distinctProviders(rows)).toEqual(['alpha credit', 'Beta', 'Mid Bank', 'Zebra Bank']);
  });


  test('distinctProviders handles empty input and missing provider', () => {
    expect(distinctProviders([])).toEqual([]);
    const rows = [
      mk({ provider: '', product_key: 'e|1' }),
      mk({ provider: 'Bank A', product_key: 'A|1' }),
    ];
    expect(distinctProviders(rows)).toEqual(['Bank A']);
  });

  test('findByKey across sections', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: { rates: savings },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(findByKey(sections, 'B|S')?.section).toBe('Savings');
    expect(findByKey(sections, 'nope')).toBeNull();
  });

  test('groupByProvider aggregates best per section', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: { rates: savings },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    const groups = groupByProvider(sections);
    const bankA = groups.find((g) => g.provider === 'Bank A');
    expect(bankA?.bestBySection.Mortgage?.product_key).toBe('A|1');
    expect(bankA?.bestBySection.Savings?.product_key).toBe('A|S');
  });

  test('groupByProvider excludes non-standard by default and includes when opted in', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: {
        rates: [
          mk({
            provider: 'Bank C',
            product_key: 'C|S',
            product_name: 'Business Saver',
            rate: '0.055',
            account_class: 'non_standard',
          }),
          mk({
            provider: 'Bank C',
            product_key: 'C|S2',
            product_name: 'Everyday Saver',
            rate: '0.040',
            account_class: 'standard',
          }),
        ],
      },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    const hidden = groupByProvider(sections, 'base', false).find((g) => g.provider === 'Bank C');
    expect(hidden?.rows.map((r) => r.product_key)).toEqual(['C|S2']);
    expect(hidden?.bestBySection.Savings?.product_key).toBe('C|S2');
    expect(hidden?.bestBySection.Mortgage).toBeUndefined();

    const shown = groupByProvider(sections, 'base', true).find((g) => g.provider === 'Bank C');
    expect(shown?.rows.map((r) => r.product_key).sort()).toEqual(['C|1', 'C|S', 'C|S2']);
    expect(shown?.bestBySection.Savings?.product_key).toBe('C|S');
    expect(shown?.bestBySection.Mortgage?.product_key).toBe('C|1');
  });

  test('groupByProvider omits providers that only have non-standard products when hidden', () => {
    const sections = {
      Mortgage: { rates: [] },
      Savings: {
        rates: [
          mk({
            provider: 'Bank NS',
            product_key: 'NS|S',
            product_name: 'Staff Only Saver',
            rate: '0.060',
            account_class: 'non_standard',
          }),
        ],
      },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base', false).find((g) => g.provider === 'Bank NS')).toBeUndefined();
    const shown = groupByProvider(sections, 'base', true).find((g) => g.provider === 'Bank NS');
    expect(shown?.rows.map((r) => r.product_key)).toEqual(['NS|S']);
    expect(shown?.bestBySection.Savings?.product_key).toBe('NS|S');
  });

  test('groupByProvider honours depositRankMetric for savings best', () => {
    const sections = {
      Mortgage: { rates: [] },
      Savings: {
        rates: [
          mk({
            provider: 'Bank A',
            product_key: 'A|S',
            product_name: 'Base Saver',
            rate: '0.045',
            ribbon_deposit_kind: 'base',
          }),
          mk({
            provider: 'Bank A',
            product_key: 'B|S',
            product_name: 'Bonus Saver',
            rate: '0.052',
            ongoing_rate: '0.01',
            ribbon_deposit_kind: 'bonus',
          }),
        ],
      },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base').find((g) => g.provider === 'Bank A')?.bestBySection.Savings?.product_key).toBe(
      'A|S',
    );
    expect(groupByProvider(sections, 'max').find((g) => g.provider === 'Bank A')?.bestBySection.Savings?.product_key).toBe(
      'B|S',
    );
  });

  test('groupByProvider sorts mortgage banks lowest rate first', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: { rates: savings },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    // Bank C's cheaper loan is non-standard and hidden; A (5.74%) beats B (6.12%).
    expect(groupByProvider(sections, 'base', false, null, 'Mortgage').map((g) => g.provider)).toEqual([
      'Bank A',
      'Bank B',
    ]);
    // With non-standard opted in, Bank C's 4.89% leads.
    expect(groupByProvider(sections, 'base', true, null, 'Mortgage').map((g) => g.provider)).toEqual([
      'Bank C',
      'Bank A',
      'Bank B',
    ]);
  });

  test('groupByProvider excludes mortgage lenders with only non-standard products when filter is off', () => {
    const sections = {
      Mortgage: {
        rates: [
          mk({
            provider: 'Bank Standard',
            product_key: 'STD|BASE',
            product_name: 'Standard Mortgage',
            rate: '0.050',
            account_class: 'standard',
          }),
          mk({
            provider: 'Bank Non-Standard Only',
            product_key: 'NS|MORT',
            product_name: 'Non-Standard Mortgage',
            rate: '0.0489',
            account_class: 'non_standard',
          }),
        ],
      },
      Savings: { rates: [] },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    const providers = groupByProvider(sections, 'base', false, null, 'Mortgage').map((g) => g.provider);
    expect(providers).toEqual(['Bank Standard']);
    expect(providers).not.toContain('Bank Non-Standard Only');
  });

  test('groupByProvider mortgage sort uses standard best when a lender also has a sharper non-standard rate', () => {
    const sections = {
      Mortgage: {
        rates: [
          mk({
            provider: 'Bank Mix',
            product_key: 'MIX|STD',
            product_name: 'Standard Loan',
            rate: '0.060',
            account_class: 'standard',
          }),
          mk({
            provider: 'Bank Mix',
            product_key: 'MIX|NS',
            product_name: 'Staff Loan',
            rate: '0.040',
            account_class: 'non_standard',
          }),
          mk({
            provider: 'Bank Pure',
            product_key: 'PURE|1',
            product_name: 'Everyday Loan',
            rate: '0.055',
            account_class: 'standard',
          }),
        ],
      },
      Savings: { rates: [] },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    // Filter off: Mix ranks on 6.0% (standard), Pure's 5.5% wins.
    expect(groupByProvider(sections, 'base', false, null, 'Mortgage').map((g) => g.provider)).toEqual([
      'Bank Pure',
      'Bank Mix',
    ]);
    expect(
      groupByProvider(sections, 'base', false, null, 'Mortgage').find((g) => g.provider === 'Bank Mix')
        ?.bestBySection.Mortgage?.product_key,
    ).toBe('MIX|STD');
    // Filter on: Mix ranks on 4.0% non-standard and leads.
    expect(groupByProvider(sections, 'base', true, null, 'Mortgage').map((g) => g.provider)).toEqual([
      'Bank Mix',
      'Bank Pure',
    ]);
    expect(
      groupByProvider(sections, 'base', true, null, 'Mortgage').find((g) => g.provider === 'Bank Mix')
        ?.bestBySection.Mortgage?.product_key,
    ).toBe('MIX|NS');
  });

  test('groupByProvider without sortSection falls back to A–Z', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: { rates: savings },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base', true, null, null).map((g) => g.provider)).toEqual([
      'Bank A',
      'Bank B',
      'Bank C',
    ]);
    expect(groupByProvider(sections).map((g) => g.provider)).toEqual(['Bank A', 'Bank B']);
  });

  test('groupByProvider sorts savings by depositRankMetric', () => {
    const sections = {
      Mortgage: { rates: [] },
      Savings: {
        rates: [
          mk({
            provider: 'Bank Base',
            product_key: 'BASE|S',
            product_name: 'Base Saver',
            rate: '0.045',
            ribbon_deposit_kind: 'base',
          }),
          mk({
            provider: 'Bank Bonus',
            product_key: 'BONUS|S',
            product_name: 'Bonus Saver',
            rate: '0.055',
            ongoing_rate: '0.01',
            ribbon_deposit_kind: 'bonus',
          }),
        ],
      },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    // base metric ranks bonus on ongoing (1%) so Bank Base (4.5%) wins.
    expect(groupByProvider(sections, 'base', false, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank Base',
      'Bank Bonus',
    ]);
    // max metric ranks on headline so Bank Bonus (5.5%) wins.
    expect(groupByProvider(sections, 'max', false, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank Bonus',
      'Bank Base',
    ]);
  });

  test('groupByProvider savings sort ignores non-standard highs when filter off', () => {
    const sections = {
      Mortgage: { rates: [] },
      Savings: {
        rates: [
          mk({
            provider: 'Bank Retail',
            product_key: 'R|S',
            product_name: 'Everyday Saver',
            rate: '0.045',
            account_class: 'standard',
          }),
          mk({
            provider: 'Bank Niche',
            product_key: 'N|S',
            product_name: 'Staff Saver',
            rate: '0.080',
            account_class: 'non_standard',
          }),
        ],
      },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base', false, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank Retail',
    ]);
    expect(groupByProvider(sections, 'base', true, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank Niche',
      'Bank Retail',
    ]);
  });

  test('groupByProvider sorts savings banks highest rate first', () => {
    const sections = {
      Mortgage: { rates: mortgage },
      Savings: { rates: savings },
      TD: { rates: [] },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base', false, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank B',
      'Bank A',
    ]);
    // Mortgage-only Bank C (non-standard loan hidden) is omitted entirely; with
    // non-standard included it still has no Savings rate and sorts last.
    expect(groupByProvider(sections, 'base', true, null, 'Savings').map((g) => g.provider)).toEqual([
      'Bank B',
      'Bank A',
      'Bank C',
    ]);
  });

  test('groupByProvider sorts TD banks highest rate first and keeps missing TD rates last', () => {
    const sections = {
      Mortgage: {
        rates: [
          mk({ provider: 'Bank Low', product_key: 'L|Mortgage', product_name: '5Y', rate: '0.030' }),
          mk({ provider: 'Bank High', product_key: 'H|Mortgage', product_name: '5Y', rate: '0.032' }),
          mk({ provider: 'Bank Mid', product_key: 'M|Mortgage', product_name: '5Y', rate: '0.031' }),
          mk({
            provider: 'Bank Mortgage Only',
            product_key: 'O|Mortgage',
            product_name: '5Y',
            rate: '0.029',
          }),
        ],
      },
      Savings: { rates: [] },
      TD: {
        rates: [
          mk({ provider: 'Bank Low', product_key: 'L|TD', product_name: '6M', rate: '0.035' }),
          mk({ provider: 'Bank High', product_key: 'H|TD', product_name: '12M', rate: '0.045' }),
          mk({ provider: 'Bank Mid', product_key: 'M|TD', product_name: '9M', rate: '0.040' }),
        ],
      },
    } as Record<SectionKey, { rates: RateRow[] }>;
    expect(groupByProvider(sections, 'base', false, null, 'TD').map((g) => g.provider)).toEqual([
      'Bank High',
      'Bank Mid',
      'Bank Low',
      'Bank Mortgage Only',
    ]);
  });

  test('compareProviderGroupsByRate puts missing section rates last', () => {
    const withRate: ProviderGroup = {
      provider: 'Has Rate',
      rows: [],
      bestBySection: { Savings: mk({ provider: 'Has Rate', rate: '0.04' }) },
    };
    const missing: ProviderGroup = { provider: 'No Rate', rows: [], bestBySection: {} };
    expect(compareProviderGroupsByRate(withRate, missing, 'Savings')).toBeLessThan(0);
    expect(compareProviderGroupsByRate(missing, withRate, 'Savings')).toBeGreaterThan(0);
  });
});
