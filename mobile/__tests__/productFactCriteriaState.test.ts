import { productFactCriterionState, productFactCriteriaState, factOptionCriterion, normalizeFactCriterion } from '../src/data/productFactsCore';
import { prepareRowFilter, EMPTY_FILTERS } from '../src/data/selectors';
import type { NormalizedProductFact, ProductDetail } from '../src/types';

const fact: NormalizedProductFact = { id: 'protocol-precision', kind: 'fee', canonicalKey: 'fee.monthly',
  criteriaVersion: 1, valueType: 'decimal', evidenceState: 'observed', sourcePath: '/fees/0', sourcePathBasis: 'raw-cdr', value: '9007199254740993', unit: 'AUD' };
test('compares exact decimal strings without a binary-number round trip', () => {
  const detail: ProductDetail = { facts: [fact] };
  expect(productFactCriterionState(detail, { canonicalKey: fact.canonicalKey, operator: 'eq', value: '9007199254740992', unit: 'AUD' })).toBe('no-match');
  expect(productFactCriterionState(detail, { canonicalKey: fact.canonicalKey, operator: 'gte', value: fact.value, unit: 'AUD' })).toBe('match');
  expect(factOptionCriterion(fact)).toMatchObject({ operator: 'eq', value: '9007199254740993', unit: 'AUD' });
});
test.each(['conditional', 'conflicting', 'unknown'] as const)('%s facts remain unknown for filters', evidenceState => {
  expect(productFactCriterionState({ facts: [{ ...fact, evidenceState }] }, { canonicalKey: fact.canonicalKey, operator: 'exists' })).toBe('unknown');
  expect(factOptionCriterion({ ...fact, evidenceState })).toBeNull();
});
test('wrong units, unsupported decimals and missing scoped facts remain unknown', () => {
  const criterion = { canonicalKey: fact.canonicalKey, operator: 'eq' as const, value: '1', unit: 'AUD' };
  expect(productFactCriterionState({ facts: [{ ...fact, unit: 'fraction' }] }, criterion)).toBe('unknown');
  expect(productFactCriterionState({ facts: [{ ...fact, value: '1e100' }] }, criterion)).toBe('unknown');
  expect(productFactCriterionState({ facts: [{ ...fact, appliesTo: ['INVESTMENT'] }] }, criterion, ['OWNER_OCCUPIED'])).toBe('unknown');
  expect(productFactCriteriaState(null, [criterion])).toBe('unknown');
});
test('selects the explicit unknown group without treating missing data as a match', () => {
  const row = { product_key: 'unknown', provider: 'Bank', product_name: 'Loan', rate: '0.05' };
  const filters = { ...EMPTY_FILTERS, includeNonStandard: true,
    factCriteria: [{ canonicalKey: fact.canonicalKey, operator: 'eq' as const, value: '10', unit: 'AUD' }] };
  expect(prepareRowFilter(filters)(row)).toBe(false);
  expect(prepareRowFilter({ ...filters, factMatchMode: 'unknown' })(row)).toBe(true);
});
test('a periodic amount never equates monthly, annual and unknown fee cadence', () => {
  const monthly = { ...fact, value: '5', cadence: 'P1M' }, annual = { ...fact, value: '5', cadence: 'P1Y' };
  const criterion = factOptionCriterion(monthly)!;
  expect(criterion).toMatchObject({ value: '5', unit: 'AUD', cadence: 'P1M' });
  expect(productFactCriterionState({ facts: [monthly] }, criterion)).toBe('match');
  expect(productFactCriterionState({ facts: [annual] }, criterion)).toBe('unknown');
  expect(productFactCriterionState({ facts: [{ ...fact, value: '5' }] }, criterion)).toBe('unknown');
  expect(productFactCriterionState({ facts: [monthly] }, { ...criterion, cadence: undefined })).toBe('unknown');
  expect(normalizeFactCriterion(factOptionCriterion({ ...monthly, cadence: 'P1Y6M' }))).toMatchObject({ cadence: 'P1Y6M' });
  expect(normalizeFactCriterion(factOptionCriterion({ ...monthly, cadence: 'P1.5Y' }))).toMatchObject({ cadence: 'P1.5Y' });
  expect(factOptionCriterion({ ...monthly, cadence: 'monthly' })).toBeNull();
});
