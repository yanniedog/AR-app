import { mergeCustomerSync, validateSyncDocument } from '../src/data/customerSyncMerge';

test('independent financial edits merge and equal edits do not conflict', () => {
  const base = { loan: { balance: '650000', rate: '6.74' }, theme: 'dark' };
  expect(mergeCustomerSync(base, { ...base, loan: { ...base.loan, balance: '640000' } }, { ...base, theme: 'light' })).toEqual({
    document: { loan: { balance: '640000', rate: '6.74' }, theme: 'light' }, conflicts: [],
  });
  expect(mergeCustomerSync(base, base, base).conflicts).toEqual([]);
});

test('conflicting amounts require an explicit choice and expose paths only', () => {
  const base = { loan: { balance: '650000' } };
  expect(mergeCustomerSync(base, { loan: { balance: '640000' } }, { loan: { balance: '630000' } }).conflicts).toEqual(['/loan/balance']);
  expect(mergeCustomerSync(base, { loan: { balance: '640000' } }, { loan: { balance: '630000' } }, { '/loan/balance': 'google' })).toEqual({
    document: { loan: { balance: '630000' } }, conflicts: [],
  });
});

test('fresh installation restores remote values and deletion is preserved', () => {
  expect(mergeCustomerSync({}, {}, { loan: '650000' })).toEqual({ document: { loan: '650000' }, conflicts: [] });
  expect(mergeCustomerSync({ loan: '650000', rate: '6.74' }, { rate: '6.74' }, { loan: '650000', rate: '6.70' })).toEqual({ document: { rate: '6.70' }, conflicts: [] });
});

test('arrays remain atomic; property order and pointer characters are handled', () => {
  expect(mergeCustomerSync({ a: [{ x: 1, y: 2 }] }, { a: [{ y: 2, x: 1 }] }, { a: [{ x: 3, y: 2 }] }).conflicts).toEqual([]);
  expect(mergeCustomerSync({}, { 'a/b~': [1] }, { 'a/b~': [2] }).conflicts).toEqual(['/a~1b~0']);
});

test.each([JSON.parse('{"__proto__":{}}'), { value: NaN }, { value: undefined }, new Date(), []])('rejects malformed downloaded data', value => {
  expect(() => validateSyncDocument(value)).toThrow('Invalid customer');
});
