import fixture from './fixtures/published-descriptive-placeholders-20260915.json';
import { descriptiveValue } from '../src/data/descriptiveValue';
import { productDetailSearchText } from '../src/data/detailSearch';
import type { ProductDetail } from '../src/types';

test('all 23 original published placeholders are absent from descriptive search without changing source items', () => {
  expect(fixture.items).toHaveLength(23);
  const original = JSON.stringify(fixture);
  for (const { kind, item } of fixture.items) {
    expect(descriptiveValue(item.value)).toBeNull();
    const text = productDetailSearchText({ [kind]: [item] } as ProductDetail);
    expect(text).not.toMatch(/\bnull\b/i);
    expect(text).toContain(item.label.toLowerCase());
    if ('info' in item && item.info) expect(text).toContain(item.info.toLowerCase().replace(/\s+/g, ' '));
  }
  expect(JSON.stringify(fixture)).toBe(original);
});

test('only exact trimmed placeholders are suppressed, preserving zero, false and substantive text', () => {
  for (const v of [null, undefined, '', '  ', ' NULL ', 'NoNe']) expect(descriptiveValue(v)).toBeNull();
  for (const [value, expected] of [[0, '0'], [false, 'false'], ['None of these fees', 'None of these fees'], ['nullified', 'nullified']] as const) expect(descriptiveValue(value)).toBe(expected);
});
