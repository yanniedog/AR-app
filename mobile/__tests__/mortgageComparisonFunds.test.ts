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
const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate_index: 4,
  rate: '0.05', lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 };
const facets = { loanPurposes: ['OO'], repaymentTypes: ['PI'] };
afterEach(() => clearMortgageComparison());

test('loan plus available funds determines LVR and ignores the inactive direct entry', () => {
  expect(mortgageComparisonValues(funds('$150,000.00', '$600,000'))).toMatchObject({
    amount: 600000, lvr: 80, lvrFraction: '0.8', propertyValue: 750000, invalid: false,
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
  expect(mortgageComparisonScenario('Mortgage', saved, funds())).toEqual({ ...saved, amount: '600000', lvr: '0.8' });
  expect(mortgageComparisonScenario('Mortgage', saved, funds('1', '2')).lvr).toBe('0.666666666666666666666667');
  for (const value of [funds(''), funds('150000', ''), funds('-1'), funds('0', '0')]) {
    expect(mortgageComparisonScenario('Mortgage', saved, value)).toEqual({ ...saved, amount: undefined, lvr: undefined });
  }
  expect(mortgageComparisonScenario('Savings', saved, funds())).toBe(saved);
  expect(saved).toEqual({ amount: '100000', lvr: '0.9', purpose: 'OWNER_OCCUPIED' });
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
});

test('full comparison replacement and clear remove inactive metadata; snapshot restoration preserves mode', () => {
  const snapshot = funds();
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
