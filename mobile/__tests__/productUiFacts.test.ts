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

test('all bundled AFG family fee identities retain amounts, cadence, unknowns and occurrence references', () => {
  const family = Object.entries(sample.products as Record<string, ProductDetail>).filter(([key]) => key.startsWith('AFG '));
  const original = JSON.stringify(family);
  const names = new Set(family.flatMap(([, product]) => product.fees ?? []).map(item => item.name));
  expect([...names].sort()).toEqual(['Bank Cheque Fee', 'Break Cost Fee', 'Default Fee', 'Discharge Administration Fee',
    'Duplicate Fee', 'Establishment Fee', 'Manual Redraw Fee', 'Monthly Admin Fee', 'Online Redraw Fee', 'Security Processing Fee', 'Variation Fee']);
  for (const [, product] of family) {
    for (const [index, item] of (product.fees ?? []).entries()) {
      expect(uiPublishedFeeName(item)).toBe(item.name);
      expect(uiDetailItem(item, index, 'Fees').reference).toBe(String(index + 1));
    }
  }
  const basic = family.find(([key]) => key.startsWith('AFG Home Loans Alpha|') && key.endsWith('|AFG Alpha Basic Home Loan'))![1];
  const facts = basic.fees!.map((item, index) => uiDetailItem(item, index, 'Fees'));
  expect(facts.map(fact => [fact.label, fact.value, fact.reference])).toEqual([
    ['Online Redraw Fee · EVENT', '$0', '1'], ['Manual Redraw Fee · EVENT', '$0', '2'],
    ['Break Cost Fee · Variable', 'Unknown', '3'], ['Discharge Administration Fee · EXIT', '$350', '4'],
    ['Security Processing Fee · UPFRONT', '$199', '5'], ['Variation Fee · EVENT', '$250', '6'],
    ['Default Fee · EVENT', '$35', '7'], ['Duplicate Fee · EVENT', '$16.5', '8'],
    ['Bank Cheque Fee · EVENT', '$10', '9'], ['Monthly Admin Fee · PERIODIC', 'Unknown · per month', '10'],
  ]);
  expect(facts[0].conditions).toBe('source-review-required');
  expect(facts[1].conditions).toBe('source-review-required');
  expect(facts[2].conditions).toBe('source-review-required');
  expect(facts[9].conditions).toBe('source-review-required');
  expect(facts[5].conditions).toBe('none');
  expect(JSON.stringify(facts)).not.toContain('Charged when');
  expect(JSON.stringify(facts)).not.toContain('Break Events');
  expect(JSON.stringify(family)).toBe(original);
});

test('reviewed AFG names cannot admit source condition prose or malformed publisher names', () => {
  for (const name of ['Online Redraw Fee. Conditions apply.', 'Manual Redraw Fee | Great benefits',
    'Break Cost Fee is payable when breaking a fixed loan.', 'Monthly Admin Fee\n', 'Variation Fee\u0000']) {
    expect(uiPublishedFeeName({ name })).toBe('Unknown');
    expect(uiDetailItem({ name, label: 'EVENT', value: '0' }, 2, 'Fees')).toMatchObject({
      label: 'EVENT', value: '$0', reference: '3', conditions: 'source-review-required',
    });
  }
});

const REVIEWED_RESIDENCY_SPELLINGS = new Map([
  ['australian citizen', 'Australian citizen'], ['australian citizens', 'Australian citizen'],
  ['australian resident', 'Australian resident'], ['australian residents', 'Australian resident'],
  ['australian resident only', 'Australian resident'], ['australian residents only', 'Australian resident'],
  ['australian residents only.', 'Australian resident'], ['permanent resident', 'Permanent resident'],
  ['permanent australian resident', 'Australian permanent resident'], ['australian permanent resident', 'Australian permanent resident'],
  ['australian citizen or australian permanent resident', 'Australian citizen or Australian permanent resident'],
  ['an australian citizen or permanent resident', 'Australian citizen or Permanent resident'],
  ['australian citizen or permanent resident', 'Australian citizen or Permanent resident'],
  ['australian citizens or permanent residents', 'Australian citizen or Permanent resident'],
  ['australian citizen or permanent residency only', 'Australian citizen or Permanent resident'],
  ['australian citizen or premanent residency only', 'Australian citizen or Permanent resident'],
  ['citizen or permanent resident', 'Citizen or Permanent resident'], ['resident or citizen', 'Resident or Citizen'],
  ['australian resident or citizen', 'Australian resident or Citizen'],
  ['permanent australian residents or australian citizens', 'Australian permanent resident or Australian citizen'],
]);

test('all bundled residency spellings resolve only reviewed compact aliases; additional qualifications stay unknown and referenced', () => {
  const products = Object.values(sample.products as Record<string, ProductDetail>);
  const items = products.flatMap(product => (product.eligibility ?? []).map((item, index) => ({ item, index })))
    .filter(({ item }) => item.label === 'RESIDENCY_STATUS');
  const values = new Set(items.filter(({ item }) => item.value != null).map(({ item }) => String(item.value).toLowerCase()));
  expect(values.size).toBe(88);
  const original = JSON.stringify(items);
  for (const { item, index } of items) {
    const source = item.value == null || item.value === '' ? item.info : item.value;
    const expected = typeof source === 'string' ? REVIEWED_RESIDENCY_SPELLINGS.get(source.trim().toLowerCase()) : undefined;
    const fact = uiDetailItem(item, index, 'Eligibility');
    expect(fact.reference).toBe(String(index + 1));
    if (expected) expect(fact.value).toBe(expected);
    else {
      expect(fact.value.startsWith('Unknown')).toBe(true);
      if (item.value != null || item.info) expect(fact.conditions).toBe('source-review-required');
    }
  }
  expect(JSON.stringify(items)).toBe(original);
});

test('actual AMP country-unspecified alternatives preserve OR without inventing nationality or dropping qualification review', () => {
  const products = Object.entries(sample.products as Record<string, ProductDetail>).filter(([key, product]) => key.startsWith('AMP - My AMP|')
    && product.eligibility?.some(item => item.label === 'RESIDENCY_STATUS'));
  expect(products).toHaveLength(2);
  for (const [, product] of products) {
    const item = product.eligibility!.find(item => item.label === 'RESIDENCY_STATUS')!;
    expect(item.value).toBe('Citizen or Permanent Resident');
    expect(uiDetailItem(item, 0, 'Eligibility')).toMatchObject({ value: 'Citizen or Permanent resident',
      reference: '1', conditions: 'source-review-required' });
    expect(JSON.stringify(uiDetailItem(item, 0, 'Eligibility'))).not.toMatch(/living and working|Australian citizen|Verified/);
  }
  for (const value of ['Citizen or Permanent Resident. Conditions apply.', 'Citizen\nor Permanent Resident',
    'AU', 'Australia', 'NZ', 'Y', 'CITIZEN, PERMANENT_RESIDENT', 'Australian citizen or permanent resident, or as otherwise approved']) {
    expect(uiDetailItem({ label: 'RESIDENCY_STATUS', value }, 0, 'Eligibility')).toMatchObject({ value: 'Unknown', conditions: 'source-review-required' });
  }
  expect(uiDetailItem({ label: 'OTHER', value: 'Citizen or Permanent Resident' }, 0, 'Eligibility').value).toBe('Unknown');
});
