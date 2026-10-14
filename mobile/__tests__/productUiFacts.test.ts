import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import siblings from './fixtures/suitability-conditional-siblings-20260913.json';
import sample from '../assets/sample/details.json';
import type { ProductDetail } from '../src/types';
import { uiDetailItem } from '../src/lib/productUiFacts';
import { uiPublishedFeeName } from '../src/lib/uiCopy';

const detail = fixture.detail as ProductDetail;

test('the published Bankwest charge names, categories, amounts and conditions survive', () => {
  const facts = detail.fees!.map((item, index) => uiDetailItem(item, index, 'Fees'));
  expect(facts.map(fact => [fact.label, fact.value, fact.reference])).toEqual([
    ['Maintenance Fee · PERIODIC', '$0 · per month', '1'],
    ['Search Handling Fee · EVENT', '$40', '2'],
  ]);
  expect(facts.every(fact => fact.conditions === 'source-review-required')).toBe(true);
  expect(JSON.stringify(facts)).not.toContain('No monthly maintenance fees');
  expect(JSON.stringify(facts)).not.toContain('For completion of any search');
});

test('same-name charges remain distinct by category, amount and condition reference', () => {
  const periodic = uiDetailItem({ name: 'Redraw Fee', label: 'PERIODIC', amount: '0', additionalValue: 'P1M' }, 0, 'Fees');
  const event = uiDetailItem({ name: 'Redraw Fee', label: 'EVENT', amount: '20', info: 'Only charged for an additional request.' }, 1, 'Fees');
  expect(periodic).toMatchObject({ label: 'Redraw Fee · PERIODIC', value: '$0 · per month', reference: '1', conditions: 'none' });
  expect(event).toMatchObject({ label: 'Redraw Fee · EVENT', value: '$20', reference: '2', conditions: 'source-review-required' });
});

test('reviewed source identities retain publisher case and do not duplicate identical categories', () => {
  expect(uiPublishedFeeName({ name: ' AnNuAl FeE ' })).toBe('AnNuAl FeE');
  expect(uiDetailItem({ name: 'Annual fee', amount: '0' }, 0, 'Fees')).toMatchObject({ label: 'Annual fee', value: '$0', reference: '1', conditions: 'none' });
  expect(uiDetailItem({ name: 'MONTHLY FEE', amount: '10', label: 'PERIODIC' }, 1, 'Fees')).toMatchObject({ label: 'MONTHLY FEE', value: '$10', reference: '2', conditions: 'none' });
});

test('reviewed identities are bound to retained source fee names rather than descriptions', () => {
  for (const source of siblings.cases) {
    const fees = (source.detail as ProductDetail).fees!;
    for (const [index, item] of fees.entries()) {
      expect(uiPublishedFeeName(item)).toBe(item.name);
      expect(uiDetailItem(item, index, 'Fees').reference).toBe(String(index + 1));
    }
  }
  for (const name of ['Annual fee', 'Monthly fee', 'Application fee', 'Valuation fee', 'Discharge administration fee', 'Account service fee', 'Package fee']) {
    const actual = Object.values(sample.products as Record<string, ProductDetail>).flatMap(product => product.fees ?? [])
      .find(item => item.name?.trim().toLowerCase() === name.toLowerCase());
    expect(actual).toBeDefined();
    expect(uiPublishedFeeName(actual!)).toBe(actual!.name!.trim());
  }
});

test.each(['Arbitrary promotional fee label.', 'Maintenance Fee. Conditions apply.', 'Annual fee | Great benefits', 'Service fee'])('unreviewed source fee name %j cannot become consumer or report copy', name => {
  expect(uiPublishedFeeName({ name, label: 'EVENT', info: 'Maintenance Fee' })).toBe('Unknown');
  expect(uiDetailItem({ name, label: 'EVENT', amount: '40' }, 2, 'Fees')).toMatchObject({ label: 'EVENT', value: '$40', reference: '3', conditions: 'source-review-required' });
  expect(JSON.stringify(uiDetailItem({ name, amount: '0' }, 0, 'Fees'))).not.toContain(name);
});

test.each(['Fee\nDescription', 'Fee\tDescription', 'Fee\u0000Description', 'Fee\u2028Description', 'x'.repeat(161)])('invalid fee identity %j cannot admit a description', name => {
  expect(uiPublishedFeeName({ name, label: 'EVENT' })).toBe('Unknown');
  expect(uiDetailItem({ name, label: 'EVENT', amount: '40' }, 0, 'Fees')).toMatchObject({
    label: 'EVENT', value: '$40', conditions: 'source-review-required',
  });
});

test('fee descriptions cannot substitute for names or suppress a repeated actual name', () => {
  expect(uiPublishedFeeName({ label: 'EVENT', info: 'Payable whenever a search is requested.' })).toBe('Unknown');
  expect(uiPublishedFeeName({ name: 'Maintenance Fee', info: 'Maintenance Fee' })).toBe('Maintenance Fee');
  expect(uiDetailItem({ name: 'Search Handling Fee', label: 'EVENT' }, 0, 'Fees').value).toBe('Unknown');
});

test('published residency alternatives remain explicit without implying bank approval or dropping extra conditions', () => {
  const item = detail.eligibility!.find(item => item.label === 'RESIDENCY_STATUS')!;
  const fact = uiDetailItem(item, 0, 'Eligibility');
  expect(fact.value).toBe('Australian citizen or Australian permanent resident');
  expect(fact.conditions).toBe('source-review-required');
  expect(fact.reference).toBe('1');
  expect(JSON.stringify(fact)).not.toContain('residential address');
  expect(JSON.stringify(fact)).not.toContain('Verified');
});

test('known residency values preserve country and permanent status independently', () => {
  expect(uiDetailItem({ label: 'RESIDENCY_STATUS', value: 'Permanent Australian resident' }, 0, 'Eligibility').value).toBe('Australian permanent resident');
  expect(uiDetailItem({ label: 'RESIDENCY_STATUS', value: 'Permanent resident' }, 0, 'Eligibility').value).toBe('Permanent resident');
  expect(uiDetailItem({ label: 'OTHER', value: 'Australian citizen or Australian permanent resident' }, 0, 'Eligibility').value).toBe('Unknown');
});

test.each(['Australian citizen and Australian permanent resident', 'Australian citizen or temporary resident',
  'Australian citizen or Australian permanent resident. Conditions apply.', 'Australian citizen\nor Australian permanent resident'])('unsupported residency %j remains Unknown and requires source review', value => {
  expect(uiDetailItem({ label: 'RESIDENCY_STATUS', value }, 0, 'Eligibility')).toMatchObject({
    value: 'Unknown', conditions: 'source-review-required',
  });
});

test.each([['MAX_LVR', '0.8', '80.00%'], ['MAX_LVR', '98.00', '98.00%'], ['MIN_LVR', '0.00', '0.00%']])('bundled %s=%s retains its actual LVR unit', (label, value, expected) => {
  const item = Object.values(sample.products as Record<string, ProductDetail>).flatMap(product => product.constraints ?? [])
    .find(item => item.label === label && item.value === value)!;
  expect(item).toBeDefined();
  const original = JSON.stringify(item);
  expect(uiDetailItem(item, 0, 'Constraints')).toMatchObject({ value: expected, reference: '1' });
  if (item.info) expect(uiDetailItem(item, 0, 'Constraints').conditions).toBe('source-review-required');
  expect(JSON.stringify(item)).toBe(original);
});

test('LVR unit recognition is restricted to numeric, in-domain MIN/MAX LVR constraints', () => {
  for (const value of ['-0.8', '101', '$80', '98%', 'LVR up to 80%', '', 'Infinity', Number.NaN]) {
    expect(uiDetailItem({ label: 'MAX_LVR', value }, 0, 'Constraints').value).toBe('Unknown');
  }
  expect(uiDetailItem({ label: 'MIN_LVR', value: '0.6001' }, 0, 'Constraints').value).toBe('60.01%');
  expect(uiDetailItem({ label: 'MIN_LVR', value: '0.60001' }, 0, 'Constraints').value).toBe('60.001%');
  expect(uiDetailItem({ label: 'MAX_LVR', value: '98.123' }, 0, 'Constraints').value).toBe('98.123%');
  expect(uiDetailItem({ label: 'MAX_LVR', value: '1' }, 0, 'Constraints').value).toBe('100.00%');
  expect(uiDetailItem({ label: 'OTHER', value: '0.8', info: 'Maximum LVR is 80%' }, 0, 'Constraints')).toMatchObject({ value: '0.8', conditions: 'source-review-required' });
  expect(uiDetailItem({ label: 'MAX_BALANCE', value: '98' }, 0, 'Constraints').value).toBe('$98');
});
