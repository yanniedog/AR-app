import {
  mortgageComparisonCriteriaReady,
  mortgageComparisonMatch,
  mortgageComparisonRows,
} from '../src/data/mortgageComparison';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';

const under60: RateRow = {
  product_key: 'low-lvr', provider: 'Bank', product_name: 'Low LVR', rate_index: 4,
  rate: '0.05', lvr_tier: 'lvr_<60%', balance_min: 100000, balance_max: 900000,
};
const midBand: RateRow = {
  product_key: 'mid-lvr', provider: 'Bank', product_name: 'Mid LVR', rate_index: 5,
  rate: '0.055', lvr_tier: 'lvr_70-80%', balance_min: 100000, balance_max: 900000,
};

test('LVR 71% excludes listed <60% tiers and admitted <60% source bands', () => {
  expect(mortgageComparisonMatch(under60, { loanAmount: '', lvr: '71' })).toBe('outside');
  expect(mortgageComparisonMatch(midBand, { loanAmount: '', lvr: '71' })).toBe('listed');
  const listed = mortgageComparisonRows([under60, midBand], { loanAmount: '', lvr: '71' });
  expect(listed.rows.map(row => row.product_key)).toEqual(['mid-lvr']);

  const source = selectedConstraintFixture('Mortgage', [under60], [
    { rateIndex: 4, text: 'LVR up to 59.99%.' },
  ]);
  expect(mortgageComparisonMatch(source.rows[0], { loanAmount: '', lvr: '71' }, source)).toBe('outside');
  expect(mortgageComparisonRows(source.rows, { loanAmount: '', lvr: '71' }, source).rows).toEqual([]);
});

test('admitted source without LVR facts still honors listed <60% exclusion at 71%', () => {
  const f = selectedConstraintFixture('Mortgage', [under60], [
    { rateIndex: 4, text: 'Available to eligible customers only.' },
  ]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '71' }, f)).toBe('outside');
  expect(mortgageComparisonRows(f.rows, { loanAmount: '', lvr: '71' }, f).rows).toEqual([]);
});

test('user LVR with missing or unparseable listed tier is outside, not unverified keep', () => {
  const missing: RateRow = { ...under60, lvr_tier: undefined };
  const junk: RateRow = { ...under60, lvr_tier: 'see PDS' };
  expect(mortgageComparisonMatch(missing, { loanAmount: '', lvr: '71' })).toBe('outside');
  expect(mortgageComparisonMatch(junk, { loanAmount: '', lvr: '71' })).toBe('outside');
  expect(mortgageComparisonRows([missing, junk, midBand], { loanAmount: '', lvr: '71' })
    .rows.map(row => row.product_key)).toEqual(['mid-lvr']);
});

test('admitted LVR exclusion does not fall through to a looser listed tier', () => {
  const wideTier: RateRow = { ...under60, lvr_tier: 'lvr_<=90%' };
  const f = selectedConstraintFixture('Mortgage', [wideTier], [
    { rateIndex: 4, text: 'LVR up to 59.99%.' },
  ]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '71' }, f)).toBe('outside');
});

test('distinct-pointer LVR alternatives OR, but listed <60% tier still excludes 71%', () => {
  const row: RateRow = { ...under60, lvr_tier: 'lvr_<60%' };
  const alternatives = selectedConstraintFixture('Mortgage', [row], [
    { rateIndex: 4, text: 'LVR up to 60%.' },
    { rateIndex: 4, text: 'LVR 70% to 80%.', sourcePointer: '/data/lendingRates/3/applicabilityConditions/0/additionalInfo' },
  ]);
  // Second pointer would admit 71%; listed tier remains conclusive.
  expect(mortgageComparisonMatch(alternatives.rows[0], { loanAmount: '', lvr: '71' }, alternatives))
    .toBe('outside');
  const mid = selectedConstraintFixture('Mortgage', [midBand], [
    { rateIndex: 5, text: 'LVR up to 60%.' },
    { rateIndex: 5, text: 'LVR 70% to 80%.', sourcePointer: '/data/lendingRates/4/applicabilityConditions/0/additionalInfo' },
  ]);
  expect(mortgageComparisonMatch(mid.rows[0], { loanAmount: '', lvr: '71' }, mid)).toBe('listed');
  expect(mortgageComparisonMatch(mid.rows[0], { loanAmount: '', lvr: '65' }, mid)).toBe('outside');
});

test('Rates mortgage criteria require LVR, purpose, and repayment; amount stays optional', () => {
  const empty = { loanPurposes: [] as string[], repaymentTypes: [] as string[] };
  expect(mortgageComparisonCriteriaReady({ loanAmount: '', lvr: '' }, empty)).toBe(false);
  expect(mortgageComparisonCriteriaReady({ loanAmount: '500000', lvr: '' }, empty)).toBe(false);
  expect(mortgageComparisonCriteriaReady({ loanAmount: '', lvr: '71' }, empty)).toBe(false);
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '', lvr: '71' },
    { loanPurposes: ['OO'], repaymentTypes: [] },
  )).toBe(false);
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '', lvr: '71' },
    { loanPurposes: [], repaymentTypes: ['PI'] },
  )).toBe(false);
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '', lvr: '71' },
    { loanPurposes: ['OO'], repaymentTypes: ['PI'] },
  )).toBe(true);
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '600000', lvr: '71' },
    { loanPurposes: ['INV'], repaymentTypes: ['IO'] },
  )).toBe(true);
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '', lvr: '0' },
    { loanPurposes: ['OO'], repaymentTypes: ['PI'] },
  )).toBe(false);
  // Trailing whitespace after % must still parse (pasted "71% ").
  expect(mortgageComparisonCriteriaReady(
    { loanAmount: '', lvr: '71% ' },
    { loanPurposes: ['OO'], repaymentTypes: ['PI'] },
  )).toBe(true);
  expect(mortgageComparisonMatch(midBand, { loanAmount: '', lvr: '71% ' })).toBe('listed');
});
