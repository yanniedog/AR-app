import { mortgageComparisonMatch, mortgageComparisonRows, prepareMortgageComparisonRow, indexedMortgageComparisonRows } from '../src/data/mortgageComparison';
import { catalogue, product, programme } from '../testUtils/publicRateJourney';
import { publicRecommendationRows, resolvedPublicRankingRows, sourceRowForPublicRow } from '../src/data/publicRateIntegration';
import { scopedRateConditions } from '../src/data/rateConditions';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';
const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate_index: 4,
  rate: '0.05', lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 };

test('verified source LVR overrides a conflicting normalized tier with exact inclusive/exclusive edges', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' }]);
  expect(scopedRateConditions(f.rows[0], 'Mortgage', f).status).toBe('available');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '75' }, f)).toBe('outside');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '70' }, f)).toBe('listed');
  expect(mortgageComparisonRows(f.rows, { loanAmount: '', lvr: '75' }, f).rows).toEqual([]);
  const exclusive = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR below 70%.' }]);
  expect(mortgageComparisonMatch(exclusive.rows[0], { loanAmount: '', lvr: '70' }, exclusive)).toBe('outside');
});
test('admitted loan amount limits override normalized bounds and preserve open upper edges', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'Loan amount below $500000.' }]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '500000', lvr: '' }, f)).toBe('outside');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '499999.99', lvr: '' }, f)).toBe('listed');
  const wider = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'Borrowing amount up to $1000000.' }]);
  expect(mortgageComparisonMatch(wider.rows[0], { loanAmount: '950000', lvr: '' }, wider)).toBe('listed');
});
test('published LVR exclusion is conclusive even when unrelated conditions stay unresolved', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' },
    { rateIndex: 4, text: 'LVR up to 90% for eligible staff.', sourcePointer: '/data/lendingRates/3/applicabilityConditions/0/additionalInfo' }]);
  const original = JSON.stringify(f.rows);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '65' }, f)).toBe('unverified');
  expect(mortgageComparisonRows(f.rows, { loanAmount: '', lvr: '65' }, f).rows).toEqual(f.rows);
  // 75% is outside the admitted ≤70% band; unresolved staff wording cannot keep it listed.
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '75' }, f)).toBe('outside');
  expect(mortgageComparisonRows(f.rows, { loanAmount: '', lvr: '75' }, f).rows).toEqual([]);
  expect(JSON.stringify(f.rows)).toBe(original);
});
test('independent exact ranges are alternatives and stale or cloned source context cannot supply exact bounds', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' },
    { rateIndex: 4, text: 'LVR 75% to 80%.', sourcePointer: '/data/lendingRates/3/applicabilityConditions/0/additionalInfo' }]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '78' }, f)).toBe('listed');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '73' }, f)).toBe('outside');
  expect(mortgageComparisonMatch({ ...f.rows[0] }, { loanAmount: '', lvr: '73' }, f)).toBe('listed');
  f.details.run_date = '2026-10-13';
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '73' }, f)).toBe('listed');
});

test('real recommendation and resolved-price transformations retain only their admitted source occurrence', () => {
  const source = { ...row, product_key: product.productKey, provider: product.providerName, rate_index: 4 };
  const f = selectedConstraintFixture('Mortgage', [source], [{ rateIndex: 4, text: 'LVR up to 70%.' }]);
  const view = catalogue([programme({ sourceBindings: [{ rateIndex: 4, pointer: '/lendingRates/3' }],
    freshness: { state: 'current', checkedAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), reasonCodes: [] } })]);
  const recommendations = publicRecommendationRows(f.rows, view, 'Mortgage', {});
  const resolved = resolvedPublicRankingRows(recommendations, view).rows;
  expect(resolved).toHaveLength(1);
  expect(resolved[0]).not.toBe(f.rows[0]);
  expect(sourceRowForPublicRow(resolved[0])).toBe(f.rows[0]);
  expect(scopedRateConditions(sourceRowForPublicRow(resolved[0]), 'Mortgage', f).status).toBe('available');
  expect(mortgageComparisonMatch(resolved[0], { loanAmount: '', lvr: '75' }, f)).toBe('outside');
  expect(mortgageComparisonMatch(resolved[0], { loanAmount: '', lvr: '70' }, f)).toBe('listed');
  const forged = { ...resolved[0] };
  expect(sourceRowForPublicRow(forged)).toBe(forged);
  expect(scopedRateConditions(sourceRowForPublicRow(forged), 'Mortgage', f).status).toBe('unavailable');
  const synthetic = resolvedPublicRankingRows(publicRecommendationRows([], view, 'Mortgage', {}), view).rows[0];
  expect(scopedRateConditions(sourceRowForPublicRow(synthetic), 'Mortgage', f).status).toBe('unavailable');
  resolved[0].rate_index = 5;
  expect(sourceRowForPublicRow(resolved[0])).toBe(resolved[0]);
});


test('prepared source matching preserves admitted alternatives, unknown wording and stale-context fallbacks exactly', () => {
  for (const text of ['LVR up to 70%.', 'LVR below 70%.', 'Loan amount below $500000.', 'LVR up to 90% for eligible staff.']) {
    const fixture = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text }]);
    for (const stale of [false, true]) {
      if (stale) fixture.details.run_date = '2026-10-13';
      const prepared = new WeakMap(fixture.rows.map(value => [value, prepareMortgageComparisonRow(value, fixture)] as const));
      for (const loanAmount of ['', '499999.99', '500000', '950000']) for (const lvr of ['', '65', '70', '75', '101']) {
        const inputs = { loanAmount, lvr }, canonical = mortgageComparisonRows(fixture.rows, inputs, fixture);
        const indexed = indexedMortgageComparisonRows(fixture.rows, inputs, prepared);
        expect(indexed.rows).toEqual(canonical.rows); expect(indexed.unverified).toBe(canonical.unverified); expect(indexed.invalid).toBe(canonical.invalid);
        for (const value of fixture.rows) expect(indexed.unverifiedRows.has(value)).toBe(canonical.unverifiedRows.has(value));
      }
    }
  }
});
