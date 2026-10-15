import { uiCanonicalTermValue, uiEngineScope, uiSavingsTier } from '../src/components/product/engineComparisonUi';

test('scope wording remains closed or an opaque exact identifier', () => {
  expect(uiEngineScope('all_source_declared')).toBe('All');
  expect(uiEngineScope('none_source_declared')).toBe('None');
  expect(uiEngineScope('technical-tier-2')).toBe('technical-tier-2');
  expect(uiEngineScope('All customers are eligible.')).toBe('Unknown');
});

test('canonical cells admit represented numeric and boolean facts only', () => {
  expect(uiCanonicalTermValue({ value: '0.000000000001' })).toBe('0.000000000001');
  expect(uiCanonicalTermValue({ value: false })).toBe('No');
  expect(uiCanonicalTermValue({ value: 0 })).toBe('0');
  for (const value of ['Conditions apply. Read more.', { description: 'Guaranteed return' }, Infinity, null]) expect(uiCanonicalTermValue({ value })).toBe('Source review required');
});

test('tier facts preserve exact bounds and whole versus marginal allocation', () => {
  const tiers = [{ id: 'a', upperInclusive: '1000.000000000001', annualRate: '0.03', evidenceIds: [] }, { id: 'b', upperInclusive: null, annualRate: '0.04', evidenceIds: [] }];
  expect(uiSavingsTier({ tiers, allocation: 'marginal' }, 1)).toBe('Marginal tier · >$1000.000000000001');
  expect(uiSavingsTier({ tiers, allocation: 'whole_balance' }, 0)).toBe('Whole balance · ≥$0 · ≤$1000.000000000001');
});
