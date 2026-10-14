import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_PROFILE } from '../src/data/profile';
import { buildCalculationRoute, calculationMode, resolveCalculationTarget, selectedDepositCalculation } from '../src/lib/calculationTarget';
import type { CorePayload, RateRow } from '../src/types';

const key = 'Bank|opaque%key,with/slash';
const first: RateRow = { product_key: key, product_id: key, product_name: 'Savings account', provider: 'Bank',
  rate: '0.04', rate_index: 1, ribbon_deposit_kind: 'base', account_class: 'standard' };
const second = { ...first, rate_index: 7, rate: '0.03' };
const core = { sections: { Mortgage: { rates: [] }, Savings: { rates: [first, second] }, TD: { rates: [] } } } as unknown as CorePayload;
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('waits for required profile evidence, without blocking an already eligible deposit target', () => {
  const mortgage = { ...first, product_key: 'profile-mortgage', taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE', rate_type: 'VARIABLE' };
  const publication = { ...core, sections: { ...core.sections, Mortgage: { rates: [mortgage] } } } as CorePayload;
  const profile = { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] };
  installMandatoryEligibility(selectMandatoryEligibility(publication, profile, null));
  expect(resolveCalculationTarget(publication, 'Mortgage', { target: mortgage.product_key, ri: '1' })).toEqual({ status: 'pending' });
  expect(resolveCalculationTarget(publication, 'Savings', { target: first.product_key, ri: '1' })).toMatchObject({ status: 'available', row: first });
  const facts = { 'profile-mortgage': { facts: [{ id: 'offset', kind: 'feature' as const, canonicalKey: 'OFFSET', unit: 'boolean', value: true }] } };
  installMandatoryEligibility(selectMandatoryEligibility(publication, profile, facts));
  expect(resolveCalculationTarget(publication, 'Mortgage', { target: mortgage.product_key, ri: '1' })).toMatchObject({ status: 'available', row: mortgage });
  installMandatoryEligibility(selectMandatoryEligibility(publication, profile, { 'profile-mortgage': { facts: [] } }));
  expect(resolveCalculationTarget(publication, 'Mortgage', { target: mortgage.product_key, ri: '1' })).toEqual({ status: 'unavailable' });
});

test('uses an opaque key and exact tier across repeated identical route parameters', () => {
  expect(buildCalculationRoute(second, 'Savings')).toEqual({ pathname: '/calculator', params: {
    section: 'Savings', mode: 'check', target: key, ri: '7',
  } });
  expect(resolveCalculationTarget(core, 'Savings', { target: [key, key], ri: ['7', '7'] }))
    .toEqual({ status: 'available', section: 'Savings', row: second });
  expect(calculationMode(['project', 'project'])).toBe('project');
});

test.each(['missing', 'bad', '-1', '2.5', 'Infinity', '9007199254740992'])('never substitutes a sibling for unavailable index %s', index => {
  expect(resolveCalculationTarget(core, 'Savings', { target: key, ri: index })).toEqual({ status: 'unavailable' });
});

test('keeps legacy product-wide links and explicit empty resets distinct from invalid repeated input', () => {
  expect(resolveCalculationTarget(core, 'Savings', { target: key, ri: '' })).toMatchObject({ status: 'available', row: first });
  expect(resolveCalculationTarget(core, 'Savings', { target: ['', ''] })).toEqual({ status: 'none' });
  expect(resolveCalculationTarget(core, 'Savings', { target: [key, 'another'], ri: '7' })).toEqual({ status: 'unavailable' });
  expect(resolveCalculationTarget(core, 'Savings', { target: key, ri: ['1', '7'] })).toEqual({ status: 'unavailable' });
  expect(resolveCalculationTarget(core, 'Mortgage', { target: key, ri: '7' })).toEqual({ status: 'unavailable' });
  expect(resolveCalculationTarget(null, 'Savings', { target: key, ri: '7' })).toEqual({ status: 'pending' });
  expect(calculationMode(['project', 'check'])).toBe('check');
});

test('compares a worse selected savings rate without changing the actual current inputs', () => {
  const scenario = normalizeUserRateScenario({ savings: { balance: '50,000', currentRate: '5' } });
  const before = JSON.stringify(scenario);
  const result = selectedDepositCalculation(second, 'Savings', scenario);
  expect(result).toMatchObject({ status: 'ready', targetRate: 0.03, months: null, basis: 'annual-simple-interest' });
  expect(result.difference).toBeCloseTo(-1000, 8);
  expect(JSON.stringify(scenario)).toBe(before);
});

test('refuses invented amounts, conditional dollar claims and an unknown maturity', () => {
  const empty = normalizeUserRateScenario(undefined);
  expect(selectedDepositCalculation(first, 'Savings', empty)).toMatchObject({ status: 'inputs-required', difference: null });
  const scenario = normalizeUserRateScenario({ savings: { balance: '50000', currentRate: '5' } });
  expect(selectedDepositCalculation({ ...first, ribbon_deposit_kind: 'bonus' }, 'Savings', scenario))
    .toMatchObject({ status: 'rate-only', difference: null });
  expect(selectedDepositCalculation({ ...first, ribbon_deposit_kind: 'fixed' }, 'TD', scenario))
    .toMatchObject({ status: 'rate-only', difference: null, months: null });
});

test('uses the selected published term instead of a generic yearly multiplier', () => {
  const scenario = normalizeUserRateScenario({ termDeposit: { balance: '50000', currentRate: '3' } });
  const term = { ...first, rate: '0.05', term: 'P6M' };
  const result = selectedDepositCalculation(term, 'TD', scenario);
  expect(result).toMatchObject({ status: 'ready', months: 6, basis: 'published-maturity' });
  expect(result.difference).toBeCloseTo(500, 8);
});
