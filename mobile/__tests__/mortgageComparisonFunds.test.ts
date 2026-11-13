import {
  clearMortgageComparison, indexedMortgageComparisonRows, mortgageComparisonCriteriaReady,
  mortgageComparisonInputsInvalid, mortgageComparisonMatch, mortgageComparisonRows,
  mortgageComparisonRowsCooperatively, mortgageComparisonValues, prepareMortgageComparisonRow,
  setMortgageComparisonInputs, useMortgageComparison, type MortgageComparisonInputs,
} from '../src/data/mortgageComparison';
import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';
import { prepareMortgageResultsIndex } from '../src/data/mortgageResultsIndex';
import { catalogue } from '../testUtils/publicRateJourney';

const funds = (fundsAvailable = '150000', loanAmount = '600000'): MortgageComparisonInputs => ({
  loanAmount, lvr: 'invalid inactive input', lvrMode: 'funds', fundsAvailable,
});
const offset = (fundsAvailable = '150000', propertyValue = '750000', loanAmount = '600000'): MortgageComparisonInputs => ({
  ...funds(fundsAvailable, loanAmount), fundsType: 'offset', propertyValue,
});
const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate_index: 4,
  rate: '0.05', lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 };
const facets = { loanPurposes: ['OO'], repaymentTypes: ['PI'] };
afterEach(() => clearMortgageComparison());

test('loan plus available funds determines LVR and ignores the inactive direct entry', () => {
  expect(mortgageComparisonValues(funds('$150,000.00', '$600,000'))).toMatchObject({
    amount: 600000, lvr: 80, lvrFraction: '0.8', propertyValue: 750000, invalid: false,
    offsetBalance: 0, interestBearingBalance: 600000,
  });
  expect(mortgageComparisonCriteriaReady(funds(), facets)).toBe(true);
  expect(mortgageComparisonValues(funds('0'))).toMatchObject({ lvr: 100, lvrFraction: '1', invalid: false });
  expect(mortgageComparisonValues({ loanAmount: '', lvr: '75%', fundsAvailable: 'invalid' }))
    .toMatchObject({ amount: null, lvr: 75, lvrFraction: '0.75', invalid: false });
  expect(mortgageComparisonCriteriaReady({ loanAmount: '', lvr: '75%', fundsAvailable: 'invalid' }, facets)).toBe(true);
});

test.each([funds(''), funds('150000', ''), funds('', '')])('missing funds-mode fields are incomplete and cannot widen scope: %p', async value => {
  expect(mortgageComparisonValues(value)).toMatchObject({ lvr: null, lvrFraction: undefined, invalid: false });
  expect(mortgageComparisonCriteriaReady(value, facets)).toBe(false);
  expect(mortgageComparisonRows([row], value).rows).toEqual([]);
  expect((await mortgageComparisonRowsCooperatively([row], value, undefined, { yieldControl: async () => {} }))?.rows).toEqual([]);
});

test.each([funds('-1'), funds('private'), funds('100000001'), funds('0.001'), funds('150000', '0'), funds('0', '-1')])(
  'invalid active amounts never resolve a ratio: %p', value => {
    expect(mortgageComparisonInputsInvalid(value)).toBe(true);
    expect(mortgageComparisonValues(value).lvrFraction).toBeUndefined();
    expect(mortgageComparisonCriteriaReady(value, facets)).toBe(false);
    expect(mortgageComparisonRows([row], value).rows).toEqual([]);
  });

test('listed 80% bounds retain exact equality and one-cent differences without display rounding', () => {
  expect(mortgageComparisonMatch(row, funds())).toBe('listed');
  expect(mortgageComparisonMatch(row, funds('149999.99'))).toBe('outside');
  expect(mortgageComparisonMatch(row, funds('150000.01'))).toBe('listed');
  const exclusive = { ...row, lvr_tier: 'lvr_<80%' };
  expect(mortgageComparisonMatch(exclusive, funds())).toBe('outside');
  expect(mortgageComparisonMatch(exclusive, funds('150000.01'))).toBe('listed');
  expect(mortgageComparisonValues(funds('150000.01')).lvr).toBeLessThan(80);
  expect(mortgageComparisonValues(funds('149999.99')).lvr).toBeGreaterThan(80);
});

test('small published bounds in exponential numeric notation retain exact open-ended comparisons', () => {
  const tinyBound = { ...row, lvr_tier: 'lvr_>=0.00000001', balance_min: 0, balance_max: 100000000 };
  expect(mortgageComparisonMatch(tinyBound, funds('100000000', '0.01'))).toBe('outside');
  expect(mortgageComparisonMatch(tinyBound, funds('99999999.99', '0.01'))).toBe('listed');
  expect(mortgageComparisonMatch(tinyBound, funds('99999999.98', '0.01'))).toBe('listed');
});

test('source scope, prepared scope and cooperative scope agree at exact funds boundaries', async () => {
  const fixture = selectedConstraintFixture('Mortgage', [row], [
    { rateIndex: 4, text: 'LVR below 80%.' },
  ]);
  const prepared = new WeakMap(fixture.rows.map(value => [value, prepareMortgageComparisonRow(value, fixture)] as const));
  for (const [available, count] of [['149999.99', 0], ['150000', 0], ['150000.01', 1]] as const) {
    const value = funds(available);
    const canonical = mortgageComparisonRows(fixture.rows, value, fixture);
    expect(canonical.rows).toHaveLength(count);
    const indexed = indexedMortgageComparisonRows(fixture.rows, value, prepared);
    const cooperative = await mortgageComparisonRowsCooperatively(fixture.rows, value, fixture, { yieldControl: async () => {} });
    expect(indexed.rows).toEqual(canonical.rows);
    expect(cooperative?.rows).toEqual(canonical.rows);
    expect(indexed.unverified).toBe(canonical.unverified);
  }
});

test('funds scenario replaces saved assumptions and carries computational ratio precision', () => {
  const saved = { amount: '100000', lvr: '0.9', purpose: 'OWNER_OCCUPIED' };
  expect(mortgageComparisonScenario('Mortgage', saved, funds())).toEqual({ ...saved, amount: '600000', lvr: '0.8', offsetBalance: '0',
    lvrSourceAmount: '600000', lvrPropertyValue: '750000' });
  expect(mortgageComparisonScenario('Mortgage', saved, funds('1', '2')).lvr).toBe('0.666666666666666666666667');
  for (const value of [funds(''), funds('150000', ''), funds('-1'), funds('0', '0')]) {
    expect(mortgageComparisonScenario('Mortgage', saved, value)).toEqual({ ...saved, amount: undefined, lvr: undefined, offsetBalance: undefined });
  }
  expect(mortgageComparisonScenario('Savings', saved, funds())).toBe(saved);
  expect(saved).toEqual({ amount: '100000', lvr: '0.9', purpose: 'OWNER_OCCUPIED' });
});

test('offset balances affect interest-bearing principal but never lender LVR or amount eligibility', () => {
  for (const [balance, bearing] of [['0', 600000], ['150000', 450000], ['600000', 0], ['700000', 0]] as const) {
    const value = offset(balance);
    expect(mortgageComparisonValues(value)).toMatchObject({ amount: 600000, lvr: 80, lvrFraction: '0.8',
      propertyValue: 750000, offsetBalance: Number(balance), interestBearingBalance: bearing, invalid: false });
    expect(mortgageComparisonCriteriaReady(value, facets)).toBe(true);
    expect(mortgageComparisonMatch(row, value)).toBe('listed');
    expect(mortgageComparisonMatch({ ...row, lvr_tier: 'lvr_=70%' }, value)).toBe('outside');
    expect(mortgageComparisonMatch({ ...row, balance_max: 500000 }, value)).toBe('outside');
  }
  expect(mortgageComparisonMatch({ ...row, lvr_tier: 'lvr_=70%' }, funds('300000'))).toBe('listed');
  expect(mortgageComparisonMatch({ ...row, lvr_tier: 'lvr_=70%' }, offset('300000'))).toBe('outside');
  expect(mortgageComparisonValues(offset('0.01', '0.05', '0.03')).interestBearingBalance).toBe(0.02);
});

test('offset property value preserves exact lender LVR boundaries and excludes above-100% inputs', () => {
  expect(mortgageComparisonMatch(row, offset('600000', '749999.99'))).toBe('outside');
  expect(mortgageComparisonMatch(row, offset('600000', '750000'))).toBe('listed');
  expect(mortgageComparisonMatch({ ...row, lvr_tier: 'lvr_<80%' }, offset('600000', '750000'))).toBe('outside');
  expect(mortgageComparisonMatch({ ...row, lvr_tier: 'lvr_<80%' }, offset('600000', '750000.01'))).toBe('listed');
  expect(mortgageComparisonValues(offset('150000', '600000'))).toMatchObject({ lvr: 100, invalid: false });
  expect(mortgageComparisonValues(offset('150000', '599999.99'))).toMatchObject({ lvr: null, invalid: true });
});

test.each(['0', '-1', 'private', '100000001'])('invalid active offset property value is rejected: %s', property => {
  const value = offset('150000', property);
  expect(mortgageComparisonValues(value)).toMatchObject({ invalid: true, lvrFraction: undefined, offsetBalance: null, interestBearingBalance: null });
  expect(mortgageComparisonRows([row], value).rows).toEqual([]);
});

test('blank offset is unknown even with a calculable lender LVR; blank property cannot fall back to loan plus funds', () => {
  expect(mortgageComparisonValues(offset(''))).toMatchObject({ lvr: 80, propertyValue: 750000, invalid: false, incompleteFunds: true,
    lvrFraction: undefined, offsetBalance: null, interestBearingBalance: null });
  for (const value of [offset(''), offset('150000', ''), offset('150000', '750000', '')]) {
    expect(mortgageComparisonCriteriaReady(value, facets)).toBe(false);
    expect(mortgageComparisonRows([row], value).rows).toEqual([]);
  }
  expect(mortgageComparisonValues({ ...funds(), propertyValue: 'invalid inactive' })).toMatchObject({ lvr: 80, invalid: false });
  expect(mortgageComparisonValues({ ...offset('-1', 'invalid'), lvrMode: 'lvr', lvr: '75' })).toMatchObject({ lvr: 75, invalid: false });
});

test('only active complete funds modes override offset cost assumptions without mutating saved state', () => {
  const saved = { amount: '100000', lvr: '0.9', offsetBalance: '25000' };
  expect(mortgageComparisonScenario('Mortgage', saved, offset('150000'))).toEqual({ amount: '600000', lvr: '0.8', offsetBalance: '150000',
    lvrSourceAmount: '600000', lvrPropertyValue: '750000' });
  expect(mortgageComparisonScenario('Mortgage', saved, funds())).toEqual({ amount: '600000', lvr: '0.8', offsetBalance: '0',
    lvrSourceAmount: '600000', lvrPropertyValue: '750000' });
  expect(mortgageComparisonScenario('Mortgage', saved, { ...offset(), lvrMode: 'lvr', lvr: '75' }))
    .toEqual({ amount: '600000', lvr: '0.75', offsetBalance: '25000' });
  for (const value of [offset(''), offset('150000', ''), offset('-1'), offset('0', '599999.99')]) {
    const scenario = mortgageComparisonScenario('Mortgage', saved, value);
    expect(scenario).toEqual({ amount: undefined, lvr: undefined, offsetBalance: undefined });
    expect(Object.hasOwn(scenario, 'offsetBalance')).toBe(true);
  }
  expect(saved).toEqual({ amount: '100000', lvr: '0.9', offsetBalance: '25000' });
});

test('one prepared Mortgage index reflects each funds edit at the same loan amount', async () => {
  const context = selectedConstraintFixture('Mortgage', [row], []);
  const view = { ...catalogue(), status: 'unavailable' as const, allLoaded: false, products: [], getProgrammes: () => [] };
  const index = await prepareMortgageResultsIndex({ source: context.rows, catalogue: view, context,
    includeNonStandard: true, cancelled: () => false });
  expect(index).not.toBeNull();
  for (const [available, count] of [['150000', 1], ['149999.99', 0], ['150000.01', 1], ['', 0]] as const) {
    const value = funds(available);
    const scenario = mortgageComparisonScenario('Mortgage', {}, value, facets);
    const selected = index!.select(scenario, value)!;
    expect(selected.scope.rows).toHaveLength(count);
    expect(selected.scope.rows).toEqual(mortgageComparisonRows(context.rows, value, context).rows);
  }
  for (const balance of ['0', '150000', '700000']) {
    const value = offset(balance), scenario = mortgageComparisonScenario('Mortgage', {}, value, facets);
    expect(index!.select(scenario, value)!.scope.rows).toEqual(context.rows);
  }
  const ineligible = offset('700000', '749999.99');
  expect(index!.select(mortgageComparisonScenario('Mortgage', {}, ineligible, facets), ineligible)!.scope.rows).toEqual([]);
});

test('full comparison replacement and clear remove inactive metadata; snapshot restoration preserves mode', () => {
  const snapshot = offset();
  setMortgageComparisonInputs(snapshot);
  expect(useMortgageComparison.getState()).toEqual(snapshot);
  setMortgageComparisonInputs({ loanAmount: '500000', lvr: '75' });
  expect(useMortgageComparison.getState()).toEqual({ loanAmount: '500000', lvr: '75' });
  setMortgageComparisonInputs(snapshot);
  clearMortgageComparison();
  expect(useMortgageComparison.getState()).toEqual({ loanAmount: '', lvr: '' });
  setMortgageComparisonInputs(snapshot);
  expect(mortgageComparisonValues(useMortgageComparison.getState()).lvr).toBe(80);
});
