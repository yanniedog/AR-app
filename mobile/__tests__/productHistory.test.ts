import {
  buildProductHistoryFromCores,
  countFiniteSeriesPoints,
  extractProductSeries,
  forwardFillSeriesRecord,
  hasProductSeries,
  normalizeProductHistoryPayload,
  productMovesForBankEvent,
  productMovesForCatalog,
  productSeriesRecord,
  productSeriesRecordForChart,
  productSeriesRecordWithCurrent,
  summarizeProductBestRateSeries,
  type ProductHistoryPayload,
} from '../src/data/productHistory';
import type { CorePayload, RateRow, SectionKey } from '../src/types';

const EMPTY_RIBBON = {
  counts: { rates: 0, products: 0, providers: 0 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};

function rateRow(productKey: string, rate: string, provider = 'Bank'): RateRow {
  return { provider, product_key: productKey, product_name: productKey, rate };
}

function core(runDate: string, rowsBySection: Partial<Record<SectionKey, RateRow[]>>): CorePayload {
  return {
    schema_version: 1,
    run_date: runDate,
    sections: {
      Mortgage: { rates: rowsBySection.Mortgage ?? [], ribbon: EMPTY_RIBBON },
      Savings: { rates: rowsBySection.Savings ?? [], ribbon: EMPTY_RIBBON },
      TD: { rates: rowsBySection.TD ?? [], ribbon: EMPTY_RIBBON },
    },
    brands: {},
    rba: [],
  };
}

describe('buildProductHistoryFromCores', () => {
  it('tracks the section-best (min for loans) rate per product per day, aligned to run_dates', () => {
    const cores = new Map<string, CorePayload>([
      ['2026-05-13', core('2026-05-13', { Mortgage: [rateRow('P|1', '0.0610'), rateRow('P|1', '0.0590')] })],
      ['2026-06-10', core('2026-06-10', { Mortgage: [rateRow('P|1', '0.0555'), rateRow('P|1', '0.0570')] })],
    ]);
    const built = buildProductHistoryFromCores(cores, ['2026-05-13', '2026-06-10'], '2026-06-10');
    expect(built.run_dates).toEqual(['2026-05-13', '2026-06-10']);
    // Mortgage lowerIsBetter → min of the product's tiers each day.
    expect(built.products['P|1']).toEqual([0.059, 0.0555]);
  });

  it('uses max for deposit sections (higher is better)', () => {
    const cores = new Map<string, CorePayload>([
      ['2026-05-13', core('2026-05-13', { Savings: [rateRow('S|1', '0.045'), rateRow('S|1', '0.050')] })],
    ]);
    const built = buildProductHistoryFromCores(cores, ['2026-05-13'], '2026-05-13');
    expect(built.products['S|1']).toEqual([0.05]);
  });

  it('restricts to the current catalog and leaves missing days null', () => {
    const cores = new Map<string, CorePayload>([
      // Old day has a delisted product Q plus current product P.
      ['2026-05-13', core('2026-05-13', { Mortgage: [rateRow('P|1', '0.061'), rateRow('Q|9', '0.07')] })],
      // Latest day (current catalog) has only P.
      ['2026-06-10', core('2026-06-10', { Mortgage: [rateRow('P|1', '0.055')] })],
    ]);
    const built = buildProductHistoryFromCores(cores, ['2026-05-13', '2026-06-10'], '2026-06-10');
    expect(built.products['P|1']).toEqual([0.061, 0.055]);
    expect(built.products['Q|9']).toBeUndefined(); // delisted → not in current catalog
  });

  it('fills days without a downloaded core from the existing payload (incremental sync)', () => {
    const existing: ProductHistoryPayload = {
      schema_version: 1,
      run_date: '2026-05-13',
      run_dates: ['2026-05-13'],
      products: { 'P|1': [0.061] },
    };
    // Only the new day's core is provided; the old day must come from `existing`.
    const cores = new Map<string, CorePayload>([
      ['2026-06-10', core('2026-06-10', { Mortgage: [rateRow('P|1', '0.055')] })],
    ]);
    const built = buildProductHistoryFromCores(cores, ['2026-05-13', '2026-06-10'], '2026-06-10', existing);
    expect(built.products['P|1']).toEqual([0.061, 0.055]);
  });
});

describe('extractProductSeries / productSeriesRecord / hasProductSeries', () => {
  const payload: ProductHistoryPayload = {
    schema_version: 1,
    run_date: '2026-06-10',
    run_dates: ['2026-05-13', '2026-05-19', '2026-06-10'],
    products: { 'P|1': [0.061, null, 0.055] },
  };

  it('aligns a product series onto an arbitrary date axis', () => {
    expect(extractProductSeries(payload, 'P|1', ['2026-05-13', '2026-06-10'])).toEqual([0.061, 0.055]);
    // Unknown date → null; unknown product → all nulls.
    expect(extractProductSeries(payload, 'P|1', ['2026-01-01'])).toEqual([null]);
    expect(extractProductSeries(payload, 'X|9', ['2026-05-13'])).toEqual([null]);
  });

  it('builds a date→value record for the chart highlight series', () => {
    expect(productSeriesRecord(payload, 'P|1')).toEqual({
      '2026-05-13': 0.061,
      '2026-05-19': null,
      '2026-06-10': 0.055,
    });
    expect(productSeriesRecord(payload, 'X|9')).toEqual({});
  });

  it('seeds today when daily history has not yet landed a point', () => {
    expect(productSeriesRecordWithCurrent(null, 'P|1', '2026-06-10', 0.054)).toEqual({
      '2026-06-10': 0.054,
    });
    // Existing finite point wins over the seed.
    expect(productSeriesRecordWithCurrent(payload, 'P|1', '2026-06-10', 0.099)['2026-06-10']).toBe(0.055);
    // Null gap on an existing timeline is filled.
    expect(productSeriesRecordWithCurrent(payload, 'P|1', '2026-05-19', 0.058)['2026-05-19']).toBe(0.058);
    expect(productSeriesRecordWithCurrent(payload, 'P|1', '2026-06-10', null)).toEqual(
      productSeriesRecord(payload, 'P|1'),
    );
  });

  it('hasProductSeries reflects whether any finite value exists', () => {
    expect(hasProductSeries(payload, 'P|1')).toBe(true);
    expect(hasProductSeries(payload, 'X|9')).toBe(false);
    expect(hasProductSeries(null, 'P|1')).toBe(false);
  });
});

describe('summarizeProductBestRateSeries', () => {
  it('reports the most recent observed direction across null gaps', () => {
    expect(
      summarizeProductBestRateSeries(
        ['2026-07-20', '2026-07-22', '2026-07-25', '2026-07-29'],
        [0.06, null, 0.0575, 0.058],
      ),
    ).toEqual({
      kind: 'changed',
      trackedSince: '2026-07-20',
      observations: 3,
      observedOn: '2026-07-29',
      fromRate: 0.0575,
      toRate: 0.058,
      bps: 5,
    });
  });

  it('distinguishes one tracked observation from an observed unchanged series', () => {
    expect(
      summarizeProductBestRateSeries(['2026-07-20'], [0.06]),
    ).toEqual({
      kind: 'tracking',
      trackedSince: '2026-07-20',
      observations: 1,
    });
    expect(
      summarizeProductBestRateSeries(
        ['2026-07-20', '2026-07-29'],
        [0.06, 0.06],
      ),
    ).toEqual({
      kind: 'unchanged',
      trackedSince: '2026-07-20',
      observations: 2,
    });
  });

  it('seeds a missing current best rate without replacing a ledger observation', () => {
    expect(
      summarizeProductBestRateSeries(
        ['2026-07-20', '2026-07-29'],
        [0.06, null],
        { date: '2026-07-29', rate: 0.055 },
      ),
    ).toMatchObject({
      kind: 'changed',
      observedOn: '2026-07-29',
      bps: -50,
    });
    expect(
      summarizeProductBestRateSeries(
        ['2026-07-20', '2026-07-29'],
        [0.06, 0.0575],
        { date: '2026-07-29', rate: 0.055 },
      ),
    ).toMatchObject({
      kind: 'changed',
      toRate: 0.0575,
      bps: -25,
    });
  });

  it('does not invent a direction from sparse or invalid history', () => {
    expect(summarizeProductBestRateSeries([], [])).toBeNull();
    expect(
      summarizeProductBestRateSeries(
        ['2026-07-20', '2026-07-29'],
        [0, Number.NaN],
      ),
    ).toBeNull();
  });
});

describe('forwardFillSeriesRecord / productSeriesRecordForChart / productMovesForBankEvent', () => {
  it('forward-fills after the first observation without inventing earlier history', () => {
    expect(
      forwardFillSeriesRecord(
        { '2026-05-13': null, '2026-05-19': 0.06, '2026-06-10': null },
        ['2026-05-13', '2026-05-19', '2026-06-10'],
      ),
    ).toEqual({
      '2026-05-13': null,
      '2026-05-19': 0.06,
      '2026-06-10': 0.06,
    });
  });

  it('builds a chart series that seeds today and fills gaps across the axis', () => {
    const history: ProductHistoryPayload = {
      schema_version: 1,
      run_date: '2026-06-10',
      run_dates: ['2026-05-13', '2026-05-19', '2026-06-10'],
      products: { 'P|1': [0.061, null, null] },
    };
    expect(
      productSeriesRecordForChart(
        history,
        'P|1',
        ['2026-05-13', '2026-05-19', '2026-06-10'],
        '2026-06-10',
        0.055,
      ),
    ).toEqual({
      '2026-05-13': 0.061,
      '2026-05-19': 0.061,
      '2026-06-10': 0.055,
    });
    expect(countFiniteSeriesPoints({ a: 1, b: null, c: 2 })).toBe(2);
  });

  it('lists products whose best rate moved >= 5 bps on the event date', () => {
    const history: ProductHistoryPayload = {
      schema_version: 1,
      run_date: '2026-06-10',
      run_dates: ['2026-05-13', '2026-06-10'],
      products: {
        'P|cut': [0.06, 0.055], // -50 bps
        'P|flat': [0.06, 0.0598], // -2 bps — below threshold
        'P|hike': [0.05, 0.055], // +50 bps
      },
    };
    const catalog = core('2026-06-10', {
      Mortgage: [
        { ...rateRow('P|cut', '0.055', 'AlphaBank'), product_name: 'Cut loan' },
        { ...rateRow('P|flat', '0.0598', 'AlphaBank'), product_name: 'Flat loan' },
        { ...rateRow('P|hike', '0.055', 'AlphaBank'), product_name: 'Hike loan' },
        { ...rateRow('P|other', '0.07', 'OtherBank'), product_name: 'Other' },
      ],
    });
    const moves = productMovesForBankEvent(catalog, history, {
      provider: 'AlphaBank',
      section: 'Mortgage',
      date: '2026-06-10',
    });
    expect(moves.map((m) => m.productKey)).toEqual(['P|cut', 'P|hike']);
    expect(moves[0]).toMatchObject({
      productName: 'Cut loan',
      fromRate: 0.06,
      toRate: 0.055,
      bps: -50,
    });
    expect(moves[1].bps).toBe(50);
  });

  it('productMovesForCatalog skips the full-section scan when a catalog is provided', () => {
    const history: ProductHistoryPayload = {
      schema_version: 1,
      run_date: '2026-06-10',
      run_dates: ['2026-05-13', '2026-06-10'],
      products: { 'P|cut': [0.06, 0.055] },
    };
    const moves = productMovesForCatalog(
      history,
      [{ productKey: 'P|cut', productName: 'Cut loan', rateIndex: null }],
      { date: '2026-06-10' },
    );
    expect(moves).toHaveLength(1);
    expect(moves[0].bps).toBe(-50);
  });

  it('counts exact 5 bps moves despite floating-point fraction noise', () => {
    const history: ProductHistoryPayload = {
      schema_version: 1,
      run_date: '2026-06-10',
      run_dates: ['2026-05-13', '2026-06-10'],
      // 0.0600 - 0.0595 is the classic IEEE case that undershoots 0.0005.
      products: { 'P|edge': [0.0595, 0.06] },
    };
    const catalog = core('2026-06-10', {
      Mortgage: [{ ...rateRow('P|edge', '0.06', 'AlphaBank'), product_name: 'Edge loan' }],
    });
    const moves = productMovesForBankEvent(catalog, history, {
      provider: 'AlphaBank',
      section: 'Mortgage',
      date: '2026-06-10',
    });
    expect(moves).toHaveLength(1);
    expect(moves[0].bps).toBe(5);
  });
});

describe('normalizeProductHistoryPayload', () => {
  it('accepts a well-formed payload and coerces non-positive/non-finite to null', () => {
    const out = normalizeProductHistoryPayload({
      schema_version: 1,
      run_date: '2026-06-10',
      core_sha: 'sha-current',
      run_dates: ['2026-05-13', '2026-06-10'],
      products: { 'P|1': [0.06, 0], 'Z|0': ['x', null] },
    });
    expect(out?.run_dates).toEqual(['2026-05-13', '2026-06-10']);
    expect(out?.core_sha).toBe('sha-current');
    expect(out?.products['P|1']).toEqual([0.06, null]); // 0 → null
    expect(out?.products['Z|0']).toBeUndefined(); // no finite values → dropped
  });

  it('rejects payloads with no run_date, invalid dates, or no products', () => {
    expect(normalizeProductHistoryPayload(null)).toBeNull();
    expect(normalizeProductHistoryPayload({ run_dates: ['2026-05-13'], products: {} })).toBeNull();
    expect(
      normalizeProductHistoryPayload({ run_date: '2026-06-10', run_dates: ['not-a-date'], products: { a: [1] } }),
    ).toBeNull();
    expect(
      normalizeProductHistoryPayload({ run_date: '2026-06-10', run_dates: ['2026-06-10'], products: {} }),
    ).toBeNull();
  });
});
