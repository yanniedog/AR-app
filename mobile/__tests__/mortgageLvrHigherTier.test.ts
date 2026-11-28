import { higherLvrTierFallbacks, mortgageComparisonRows, mortgageComparisonValues } from '../src/data/mortgageComparison';
import type { RateRow } from '../src/types';

const row = (product_key: string, lvr_tier: string, rate: string, extra: Partial<RateRow> = {}) => ({
  provider: 'Lender', product_key, product_name: product_key, rate, lvr_tier, rate_type: 'VARIABLE',
  repayment_type: 'PRINCIPAL_AND_INTEREST', loan_purpose: 'OWNER_OCCUPIED', ...extra,
}) as RateRow;
const at = (lvr: string) => ({ loanAmount: '', lvr, lvrMode: 'lvr' as const });

test('a variant whose lowest tier starts above the LVR stays in scope at that tier only', () => {
  const rows = [row('high-only', 'lvr_80-90%', '0.065'), row('high-only', 'lvr_90-95%', '0.07'),
    row('spans', 'lvr_0-60%', '0.055'), row('spans', 'lvr_60-80%', '0.06'), row('spans', 'lvr_80-90%', '0.065'),
    row('low-only', 'lvr_0-60%', '0.05')];
  const fallbacks = higherLvrTierFallbacks(rows, mortgageComparisonValues(at('70')));
  expect([...fallbacks.keys()].map(r => `${r.product_key} ${r.lvr_tier}`)).toEqual(['high-only lvr_80-90%']);
  const scope = mortgageComparisonRows(rows, at('70'));
  expect(scope.rows.map(r => `${r.product_key} ${r.lvr_tier}`)).toEqual(['high-only lvr_80-90%', 'spans lvr_60-80%']);
  // The tier above is the most a 70% borrower pays, never a confirmed price.
  expect(scope.unverifiedRows.has(rows[0])).toBe(true);
});

test('separate repayment variants fall back independently; tiers ending below the LVR are never offered', () => {
  const rows = [row('p', 'lvr_80-90%', '0.065'), row('p', 'lvr_80-90%', '0.07', { repayment_type: 'INTEREST_ONLY' }),
    row('q', 'lvr_0-80%', '0.06')];
  expect(mortgageComparisonRows(rows, at('50')).rows).toHaveLength(3);
  expect(mortgageComparisonRows(rows, at('85')).rows.map(r => r.product_key)).toEqual(['p', 'p']);
});
