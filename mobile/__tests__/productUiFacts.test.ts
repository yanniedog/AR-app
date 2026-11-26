import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import siblings from './fixtures/suitability-conditional-siblings-20260913.json';
import sample from '../assets/sample/details.json';
import type { ProductDetail } from '../src/types';
import { dedupeDetailItems, dedupeFacts, isAnnualFee, uiDetailItem, uiNormalizedProductFact } from '../src/lib/productUiFacts';
import { uiPublishedFeeName, uiProductKeyLabel, uiPublishedText } from '../src/lib/uiCopy';

const detail = fixture.detail as ProductDetail;

test('bundled structured cashback ranges retain both AUD bounds and their original condition reference', () => {
  const rows = Object.entries(sample.products as Record<string, ProductDetail>).flatMap(([key, product]) =>
    (product.features ?? []).map((item, index) => ({ key, item, index })))
    .filter(({ item }) => item.label === 'CASHBACK_OFFER' && ['2,500-3,000', '2500.00 - 3000.00'].includes(String(item.value)));
  expect(rows).toHaveLength(3);
  expect(rows.some(({ key }) => key.startsWith('Greater Bank Limited|'))).toBe(true);
  expect(rows.some(({ key }) => key.startsWith('Newcastle Permanent Building Society|'))).toBe(true);
  for (const { item, index } of rows) {
    const original = JSON.stringify(item), fact = uiDetailItem(item, index, 'Features');
    expect(fact).toMatchObject({ value: '$2,500–$3k', reference: String(index + 1), conditions: 'source-review-required', conditionsUnverified: true });
    expect(JSON.stringify(fact)).not.toContain(item.info);
    expect(JSON.stringify(item)).toBe(original);
  }
});

test('cashback range admission is bounded numeric syntax in the exact feature field', () => {
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '$2,500.25 – $3,000.75' }, 0, 'Features').value).toBe('$2,500.25–$3,000.75');
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '0 - 0' }, 0, 'Features').value).toBe('$0–$0');
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '2500.75' }, 0, 'Features').value).toBe('2,500.75');
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '0'.repeat(76) + '2500' }, 0, 'Features').value).toBe('2,500');
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '0'.repeat(77) + '2500' }, 0, 'Features').value).toBe('Unknown');
  for (const value of ['3000-2500', '-1-2500', '2,50-3,000', '1e3-2e3', '2500.001-3000',
    '2500-3000 cashback', '2500-3000\n', 'up to 3000', '2500 - ', '1'.repeat(100)]) {
    expect(uiDetailItem({ label: 'CASHBACK_OFFER', value, info: 'Unreviewed source condition.' }, 0, 'Features')).toMatchObject({ value: 'Unknown', conditions: 'source-review-required' });
  }
  expect(uiDetailItem({ label: 'OTHER', value: '2500-3000' }, 0, 'Features').value).toBe('Unknown');
  expect(uiDetailItem({ label: 'CASHBACK_OFFER', value: '2500-3000' }, 0, 'Eligibility').value).toBe('Unknown');
});

test('the published Bankwest charge names, categories, amounts and conditions survive', () => {
  const facts = detail.fees!.map((item, index) => uiDetailItem(item, index, 'Fees'));
  expect(facts.map(fact => [fact.label, fact.value, fact.reference])).toEqual([
    ['Maintenance Fee · Ongoing fee', '$0 · per month', '1'],
    ['Search Handling Fee · Event fee', '$40', '2'],
  ]);
  expect(facts.every(fact => fact.conditions === 'source-review-required')).toBe(true);
  expect(JSON.stringify(facts)).not.toContain('No monthly maintenance fees');
  expect(JSON.stringify(facts)).not.toContain('For completion of any search');
});

test('same-name charges remain distinct by category, amount and condition reference', () => {
  const periodic = uiDetailItem({ name: 'Redraw Fee', label: 'PERIODIC', amount: '0', additionalValue: 'P1M' }, 0, 'Fees');
  const event = uiDetailItem({ name: 'Redraw Fee', label: 'EVENT', amount: '20', info: 'Only charged for an additional request.' }, 1, 'Fees');
  expect(periodic).toMatchObject({ label: 'Redraw Fee · Ongoing fee', value: '$0 · per month', reference: '1', conditions: 'none' });
  expect(event).toMatchObject({ label: 'Redraw Fee · Event fee', value: '$20', reference: '2', conditions: 'source-review-required' });
});

test('reviewed source identities retain publisher case and do not duplicate identical categories', () => {
  expect(uiPublishedFeeName({ name: ' AnNuAl FeE ' })).toBe('AnNuAl FeE');
  expect(uiDetailItem({ name: 'Annual fee', amount: '0' }, 0, 'Fees')).toMatchObject({ label: 'Annual fee', value: '$0', reference: '1', conditions: 'none' });
  expect(uiDetailItem({ name: 'MONTHLY FEE', amount: '10', label: 'PERIODIC' }, 1, 'Fees')).toMatchObject({ label: 'MONTHLY FEE · Ongoing fee', value: '$10', reference: '2', conditions: 'none' });
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
  expect(uiDetailItem({ name, label: 'EVENT', amount: '40' }, 2, 'Fees')).toMatchObject({ label: 'Event fee', value: '$40', reference: '3', conditions: 'source-review-required' });
  expect(JSON.stringify(uiDetailItem({ name, amount: '0' }, 0, 'Fees'))).not.toContain(name);
});

test.each(['Fee\nDescription', 'Fee\tDescription', 'Fee\u0000Description', 'Fee\u2028Description', 'x'.repeat(161)])('invalid fee identity %j cannot admit a description', name => {
  expect(uiPublishedFeeName({ name, label: 'EVENT' })).toBe('Unknown');
  expect(uiDetailItem({ name, label: 'EVENT', amount: '40' }, 0, 'Fees')).toMatchObject({
    label: 'Event fee', value: '$40', conditions: 'source-review-required',
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

test.each([['MAX_LVR', '0.8', '80.0%'], ['MAX_LVR', '98.00', '98.0%'], ['MIN_LVR', '0.00', '0%']])('bundled %s=%s retains its actual LVR unit', (label, value, expected) => {
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
  expect(uiDetailItem({ label: 'MIN_LVR', value: '0.6001' }, 0, 'Constraints').value).toBe('60.0%');
  expect(uiDetailItem({ label: 'MIN_LVR', value: '0.60001' }, 0, 'Constraints').value).toBe('60.0%');
  expect(uiDetailItem({ label: 'MAX_LVR', value: '98.123' }, 0, 'Constraints').value).toBe('98.1%');
  expect(uiDetailItem({ label: 'MAX_LVR', value: '1' }, 0, 'Constraints').value).toBe('100%');
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
    ['Online Redraw Fee · Event fee', '$0', '1'], ['Manual Redraw Fee · Event fee', '$0', '2'],
    ['Break Cost Fee · Variable fee', 'Unknown', '3'], ['Discharge Administration Fee · Exit fee', '$350', '4'],
    ['Security Processing Fee · Upfront fee', '$199', '5'], ['Variation Fee · Event fee', '$250', '6'],
    ['Default Fee · Event fee', '$35', '7'], ['Duplicate Fee · Event fee', '$16.5', '8'],
    ['Bank Cheque Fee · Event fee', '$10', '9'], ['Monthly Admin Fee · Ongoing fee', 'Unknown · per month', '10'],
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
      label: 'Event fee', value: '$0', reference: '3', conditions: 'source-review-required',
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

test('repeated source entries are one fact and presence-only criteria read as required', () => {
  const entry = { label: 'NATURAL_PERSON' };
  expect(dedupeDetailItems([entry, { ...entry }, { label: 'STAFF' }])).toHaveLength(2);
  expect(uiDetailItem(entry, 0, 'Eligibility')).toMatchObject({ label: 'Individual applicants', value: 'Required' });
  expect(uiDetailItem({ label: 'OFFSET' }, 0, 'Features')).toMatchObject({ value: 'Included' });
  // Wording beside a presence-only criterion may narrow it, so it reads Required with conditions unverified.
  expect(uiDetailItem({ label: 'BUSINESS', info: 'Primary producers only' }, 0, 'Eligibility'))
    .toMatchObject({ value: 'Required', conditions: 'source-review-required', conditionsUnverified: true });
  expect(uiDetailItem(entry, 0, 'Eligibility').conditionsUnverified).toBe(false);
});

test('OTHER entries use the controlled generic label and never the source name', () => {
  expect(uiDetailItem({ label: 'OTHER', name: 'Arbitrary promotional wording.' }, 0, 'Eligibility')).toMatchObject({ label: 'Other criterion', value: 'Unknown' });
  const feature = uiDetailItem({ label: 'OTHER', name: 'Arbitrary promotional wording.' }, 0, 'Features');
  expect(feature.label).toBe('Other feature');
  expect(JSON.stringify(feature)).not.toContain('promotional');
});

test('fee categories read as labels, not source codes', () => {
  expect(uiDetailItem({ label: 'EXIT', amount: '350' }, 0, 'Fees')).toMatchObject({ label: 'Exit fee', value: '$350' });
});

test('free-text fact values stay Unknown and valueless facts keep the unverified flag', () => {
  const prose = uiNormalizedProductFact({ id: 'p', kind: 'attribute', canonicalKey: 'attribute.note', sourceType: 'NOTE', unit: 'text', value: 'Enjoy great benefits when you choose this account.' } as never);
  expect(prose.value).toBe('Unknown');
  const declared = uiNormalizedProductFact({ id: 'f', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET', condition: 'Subject to approval' } as never);
  expect(declared).toMatchObject({ value: 'Conditions apply', conditionsUnverified: true, conditions: 'source-review-required' });
});

test('valueless declared features read Included unless a condition is published', () => {
  expect(uiNormalizedProductFact({ id: 'a', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET' } as never).value).toBe('Included');
  expect(uiDetailItem({ label: 'OFFSET', info: 'Subject to approval' }, 0, 'Features')).toMatchObject({ value: 'Conditions apply', conditionsUnverified: true });
});

test('annual fees and fee categories use controlled labels, never raw codes', () => {
  expect(isAnnualFee({ label: 'ANNUAL_FEE' })).toBe(true);
  expect(isAnnualFee({ label: 'PERIODIC', additionalValue: 'P1Y' })).toBe(true);
  expect(uiDetailItem({ label: 'ANNUAL_FEE', amount: '395' }, 0, 'Fees').label).toBe('Annual fee');
  expect(uiDetailItem({ label: 'SURCHARGE_FEE', amount: '5' }, 0, 'Fees').label).toBe('Other fee');
  for (const [code, label] of [['CASH_ADVANCE', 'Cash advance fee'], ['DISHONOUR', 'Dishonour fee'], ['LATE_PAYMENT', 'Late payment fee'], ['ENQUIRY', 'Enquiry fee'], ['REPLACEMENT', 'Replacement fee'], ['UPFRONT_PER_PLAN', 'Upfront per plan fee']]) {
    expect(uiDetailItem({ label: code, amount: '46' }, 0, 'Fees').label).toBe(label);
  }
  expect(uiNormalizedProductFact({ id: 'f', kind: 'fee', canonicalKey: 'fee.annual_fee', value: 395 } as never).label).toBe('Annual fee');
});

test('identical normalized facts are one fact', () => {
  const fact = { id: 'x', kind: 'feature', canonicalKey: 'feature.offset' };
  expect(dedupeFacts([fact, { ...fact }])).toHaveLength(1);
});

test('published text rejects control characters before whitespace is normalised', () => {
  expect(uiPublishedText('Line one\nLine two')).toBeNull();
  expect(uiPublishedText('Tab\tseparated')).toBeNull();
  expect(uiPublishedText('Plain name')).toBe('Plain name');
});

test('opaque product keys are identifiers, not names', () => {
  expect(uiProductKeyLabel('Bankwest|123|Savings|Easy Saver')).toBe('Bankwest · Easy Saver');
  expect(uiProductKeyLabel('prod_8f3a2c')).toBe(uiProductKeyLabel('prod_8f3a2c'));
  expect(uiProductKeyLabel('prod_8f3a2c')).not.toContain('·');
});

test('ISO duration values on published criteria read as plain durations', () => {
  const read = (value: string) => uiDetailItem({ label: 'OTHER', value }, 0, 'Constraints').value;
  expect(read('P1Y')).toBe('1 year');
  expect(read('P30Y')).toBe('30 years');
  expect(read('P6M')).toBe('6 months');
  expect(read('P1Y6M')).toBe('1 year, 6 months');
  expect(read('P')).not.toMatch(/year|month|day|week/);
  expect(read('P1.5Y')).toBe('1.5 years');
  expect(read('PT12H')).toBe('12 hours');
  expect(read('P1DT2H')).toBe('1 day, 2 hours');
  expect(read('PT1M')).toBe('1 minute');
  expect(read('P2W')).toBe('2 weeks');
  expect(read('P1W2D')).toBe('P1W2D');
  expect(read('P1.5Y2M')).not.toMatch(/year|month/);
  expect(read('P1YT')).not.toMatch(/year/);
});

test('reviewed feature values read as plain lists; any unreviewed token leaves the value unknown', () => {
  const read = (value: string) => uiDetailItem({ label: 'DIGITAL_WALLET', value }, 0, 'Features').value;
  expect(read('Apple Pay')).toBe('Apple Pay');
  expect(read('Apple Pay and Google Pay')).toBe('Apple Pay, Google Pay');
  expect(read('Apple Pay, Samsung Pay or Google Pay')).toBe('Apple Pay, Samsung Pay, Google Pay');
  expect(uiDetailItem({ label: 'BILL_PAYMENT', value: 'BPAY' }, 0, 'Features').value).toBe('BPAY');
  expect(uiDetailItem({ label: 'CARD_ACCESS', value: 'Visa Debit Card' }, 0, 'Features').value).toBe('Visa Debit card');
  expect(read('Apple Pay and free coffee')).toBe('Unknown');
  expect(uiDetailItem({ label: 'NOTIFICATIONS', value: 'SMS or Email' }, 0, 'Features').value).toBe('SMS, Email');
  // The vocabulary applies to features only.
  expect(uiDetailItem({ label: 'OTHER', value: 'Apple Pay' }, 0, 'Eligibility').value).toBe('Unknown');
});
