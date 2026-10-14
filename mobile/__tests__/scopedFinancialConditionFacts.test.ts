import { scopedRateConditions } from '../src/data/rateConditions';
import { scopedFinancialConditionFacts } from '../src/data/scopedFinancialConditionFacts';
import type { RateRow } from '../src/types';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';

const row: RateRow = { provider: 'Bank', product_key: 'source', product_name: 'Source product', rate_index: 1, rate: '0.05' };
function admitted(text: string) {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 1, text }]);
  return scopedFinancialConditionFacts(scopedRateConditions(f.rows[0], 'Mortgage', f));
}

test('atomic LVR clauses keep numeric bounds and exact source references', () => {
  const first = admitted('LVR up to 59.99%.').facts[0];
  const next = admitted('For LVR 60% to 79.99%.').facts[0];
  expect(first.lower).toEqual({ state: 'unspecified' });
  expect(first.upper).toEqual({ state: 'known', value: 59.99, inclusive: true });
  expect(next.lower).toEqual({ state: 'known', value: 60, inclusive: true });
  expect(next.upper).toEqual({ state: 'known', value: 79.99, inclusive: true });
  expect(first.source.sourcePointer).toBe('/data/lendingRates/0/additionalInfo');
});

test('exclusive comparisons do not become inclusive limits', () => {
  expect(admitted('LVR < 80%.').facts[0].upper).toEqual({ state: 'known', value: 80, inclusive: false });
  expect(admitted('LVR over 80%.').facts[0].lower).toEqual({ state: 'known', value: 80, inclusive: false });
});

test('explicit AUD grouped values retain balance and borrowing subjects', () => {
  expect(admitted('Deposit balance from $5,000 to $250,000.').facts[0]).toMatchObject({
    kind: 'published-balance-range', subject: 'deposit-balance', unit: 'AUD', lower: { value: 5000 }, upper: { value: 250000 },
  });
  expect(admitted('Loan amount up to $1000000.').facts[0]).toMatchObject({ kind: 'published-balance-range', subject: 'loan-amount', upper: { value: 1000000 } });
});

test('recognized year terms become whole month facts without guessing mixed units', () => {
  expect(admitted('Fixed term from 1 to 3 years.').facts[0]).toMatchObject({ kind: 'published-term-range',
    unit: 'months', subject: 'fixed-term', lower: { value: 12 }, upper: { value: 36 } });
  expect(admitted('Deposit term 6 months.').facts[0]).toMatchObject({ lower: { value: 6 }, upper: { value: 6 } });
});

test.each(['LVR 80% to 60%.', 'LVR up to 120%.', 'LVR below 0%.', 'Balance up to 100000.',
  'Balance up to $5,00.', 'Term from 6 months to 2 years.', 'Term 3.5 months.',
  'LVR up to 80%. Available only to eligible existing customers.'])('unsupported %s stays source-backed unresolved', text => {
  const result = admitted(text);
  expect(result.facts).toHaveLength(0); expect(result.unresolved).toHaveLength(1);
  expect(result.unresolved[0]).toMatchObject({ state: 'source-review-required', source: { rateIndex: 1, rateFamily: 'lending' } });
  expect(result.eligibility).toBe('unassessed'); expect(JSON.stringify(result)).not.toContain(text);
});

test('cloned row and mismatched publication proof cannot admit numeric source facts', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 1, text: 'LVR up to 80%.' }]);
  expect(scopedFinancialConditionFacts(scopedRateConditions({ ...f.rows[0] }, 'Mortgage', f)).state).toBe('unverified');
  f.manifest.files.details.sha256 = '0'.repeat(64);
  expect(scopedFinancialConditionFacts(scopedRateConditions(f.rows[0], 'Mortgage', f)).state).toBe('unverified');
});
