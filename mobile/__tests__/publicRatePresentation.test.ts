import { publicComponentFact, publicConditionFact, publicRateReason } from '../src/data/publicRatePresentation';
import { component, condition } from '../testUtils/publicRates';
import { uiPublicEvidenceLocator } from '../src/lib/uiCopy';

test('public conditions preserve rate fractions, money and term units', () => {
  expect(publicConditionFact(condition('lvr', { operator: 'bounds', minimum: '0.8001', maximum: '0.95', maximumInclusive: false }))).toBe('LVR: ≥80.0100%, <95.0000%');
  expect(publicConditionFact(condition('amount', { operator: 'bounds', minimum: '1000' }))).toBe('Loan amount: ≥$1000');
  expect(publicConditionFact(condition('termMonths', { operator: 'eq', value: '24' }))).toBe('Term (months): 24');
  expect(publicComponentFact(component('discount', 'discount', '-0.025'))).toBe('Discount: -2.5 pp');
});

test('source descriptions and arbitrary reason or locator prose cannot enter pricing facts', () => {
  const prose = 'Please read our attractive offer and contact the bank for more information.';
  expect(publicConditionFact(condition('custom', { operator: 'eq', value: prose, description: prose }))).toBe('CUSTOM: Unknown');
  expect(publicRateReason(prose)).toBe('Unknown');
  expect(uiPublicEvidenceLocator({ evidenceId: 'e', url: 'https://www.nab.com.au', sha256: 'a'.repeat(64), locator: prose })).toBe('Unknown');
});
