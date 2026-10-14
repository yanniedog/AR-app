import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
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
  const periodic = uiDetailItem({ name: 'Service fee', label: 'PERIODIC', amount: '0', additionalValue: 'P1M' }, 0, 'Fees');
  const event = uiDetailItem({ name: 'Service fee', label: 'EVENT', amount: '20', info: 'Only charged for an additional request.' }, 1, 'Fees');
  expect(periodic).toMatchObject({ label: 'Service fee · PERIODIC', value: '$0 · per month', reference: '1', conditions: 'none' });
  expect(event).toMatchObject({ label: 'Service fee · EVENT', value: '$20', reference: '2', conditions: 'source-review-required' });
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
