import { rateConditionality, rateQualifier } from '../src/lib/rateQualifier';
import { rateConditionalFacts } from '../src/data/rateConditionalFacts';
import type { RateRow } from '../src/types';
const row = (partial: Partial<RateRow>): RateRow => ({ provider: 'Bank', product_key: 'k', product_name: 'P', rate: '0.05', ...partial });
test.each([
  ['Savings', { ribbon_deposit_kind: 'base' }, 'base'], ['Savings', { ribbon_deposit_kind: 'bonus' }, 'bonus'],
  ['Savings', { ribbon_deposit_kind: 'introductory' }, 'intro'], ['TD', { ribbon_rate_structure: 'bonus' }, 'bonus'],
  ['Mortgage', { ribbon_rate_structure: 'bonus' }, 'none'], ['Savings', { taxonomy_path: 'SAVINGS.SAVINGS_ACCT.BONUS.TIERED' }, 'bonus'],
  ['Savings', { taxonomy_path: 'SAVINGS.SAVINGS_ACCT.INTRO.FLAT' }, 'intro'], ['Savings', { taxonomy_path: 'SAVINGS.SAVINGS_ACCT.INTRODUCTORY.TIERED' }, 'intro'],
  ['Savings', { taxonomy_path: 'SAVINGS.SAVINGS_ACCT.BASE.FLAT' }, 'base'],
] as const)('preserves %s classification without note prose', (section, partial, kind) => {
  const q = rateQualifier(row(partial), section); expect(q.kind).toBe(kind); expect(rateConditionality(row(partial), section)).toBe(kind);
  expect(q).not.toHaveProperty('note'); expect(q.conditional).toBe(kind === 'bonus' || kind === 'intro');
});
test('intro period and known ongoing rate survive visible and spoken fact labels', () => {
  const q = rateQualifier(row({ ribbon_deposit_kind: 'introductory', term: 'P4M', ongoing_rate: '0.015' }), 'Savings');
  expect(q.introMonths).toBe(4); expect(q.ongoingRate).toBe('1.50%');
  expect(q.facts).toContainEqual({ kind: 'intro-period', state: 'known', months: 4 });
  expect(q.label).toBe('Introductory · Introductory period: 4 months · Ongoing rate: 1.50%');
});
test.each([undefined, '', 'bad', '-1'])('missing ongoing %s stays unknown, never inferred lower', ongoing_rate => {
  const q = rateQualifier(row({ ribbon_deposit_kind: 'bonus', ongoing_rate }), 'Savings');
  expect(q.ongoingRate).toBeNull(); expect(q.facts).toContainEqual({ kind: 'ongoing-rate', state: 'unknown' });
  expect(q.label).toContain('Ongoing rate: Unknown'); expect(q.label).not.toMatch(/lower|not publish|paid only|when/i);
});
test('known zero ongoing and absence of an intro period remain distinct', () => {
  const q = rateQualifier(row({ ribbon_deposit_kind: 'intro', ongoing_rate: '0' }), 'Savings');
  expect(q.ongoingRate).toBe('0.00%'); expect(q.facts).toContainEqual({ kind: 'ongoing-rate', state: 'known', fraction: 0 });
  expect(q.facts).toContainEqual({ kind: 'intro-period', state: 'unknown' });
});
test('bonus facts require conditions without inventing monthly eligibility or a lower rate', () => {
  const facts = rateConditionalFacts(row({ ribbon_deposit_kind: 'bonus' }), 'Savings');
  expect(facts.facts).toEqual([{ kind: 'rate-kind', value: 'bonus' }, { kind: 'bonus-conditions', state: 'required' }, { kind: 'ongoing-rate', state: 'unknown' }]);
  expect(rateConditionalFacts(null, 'Savings').facts).toEqual([]);
});
