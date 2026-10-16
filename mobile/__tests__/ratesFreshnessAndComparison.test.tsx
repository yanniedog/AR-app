import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { rateFreshness, rowVerificationReceipt, DAILY_VERIFICATION_CADENCE_MS } from '../src/data/rateFreshness';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../src/lib/appHealth/sourceContract';
import { RateFreshnessSymbol } from '../src/components/RateFreshnessSymbol';
import { mortgageComparisonMatch, mortgageComparisonRows } from '../src/data/mortgageComparison';
import { queryAndSort, EMPTY_FILTERS } from '../src/data/selectors';
import { ratesPageWindow } from '../src/data/ratesPagination';
import type { RateRow } from '../src/types';
import { compactBankLogoFrame } from '../src/components/product/compactProductRow';

jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { success: 'green', warning: 'amber', danger: 'red', textMuted: 'grey' } }) }));
const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate: '0.05', comparison_rate: '0.051',
  lvr_tier: 'lvr_70-80%', balance_min: 100000, balance_max: 500000, account_class: 'standard' };
const checked = Date.parse('2026-10-15T00:00:00Z');
const receipt = { kind: 'successful-product-verification' as const, provider: 'Bank', productKey: 'loan', verifiedAt: new Date(checked).toISOString() };
test('freshness follows daily successful verification plus the existing grace; packaging and product-change dates never qualify', () => {
  const day = DAILY_VERIFICATION_CADENCE_MS, grace = CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.freshnessGraceMs;
  expect(day).toBe(86400000); expect(grace).toBe(86400000);
  expect(rateFreshness(row, receipt, checked + day)).toBe('current');
  expect(rateFreshness(row, receipt, checked + day + 1)).toBe('overdue');
  expect(rateFreshness(row, receipt, checked + day + grace)).toBe('overdue');
  expect(rateFreshness(row, receipt, checked + day + grace + 1)).toBe('stale');
  for (const bad of [{ ...receipt, provider: 'Other' }, { ...receipt, productKey: 'other' }, { ...receipt, verifiedAt: '2026-10-15' }, { ...receipt, verifiedAt: 'bad' }, { ...receipt, verifiedAt: '2026-02-31T00:00:00Z' }]) expect(rateFreshness(row, bad, checked)).toBe('unknown');
  expect(rateFreshness(row, receipt, checked - 1)).toBe('unknown');
  expect(rowVerificationReceipt({ ...row, last_updated: '2026-10-16T00:00:00Z' })).toBeNull();
});
test('freshness states have distinct shapes, colours and nonvisual names', () => {
  const shapes: string[] = [], names: string[] = [];
  for (const [age, evidence] of [[0, receipt], [86400001, receipt], [172800001, receipt], [0, null]] as const) {
    let tree: any; act(() => { tree = TestRenderer.create(<RateFreshnessSymbol row={row} receipt={evidence} now={checked + age} />); });
    shapes.push(tree.root.findByType('Icon').props.name);
    names.push(tree.root.findByProps({ testID: 'rate-freshness' }).props.accessibilityLabel);
    act(() => tree.unmount());
  }
  expect(new Set(shapes).size).toBe(4);
  expect(names).toEqual(['Freshness · Current', 'Freshness · Overdue', 'Freshness · Stale', 'Freshness · Unknown']);
});
test('comparison keeps unknown bounds explicit, rejects known outside limits and invalid inputs, and respects exact LVR edges', () => {
  expect(mortgageComparisonMatch(row, { loanAmount: '', lvr: '' })).toBe('listed');
  expect(mortgageComparisonMatch(row, { loanAmount: '300,000', lvr: '80' })).toBe('listed');
  expect(mortgageComparisonMatch(row, { loanAmount: '600000', lvr: '80' })).toBe('outside');
  expect(mortgageComparisonMatch(row, { loanAmount: '300000', lvr: '70' })).toBe('outside');
  expect(mortgageComparisonMatch(row, { loanAmount: '-100', lvr: '101' })).toBe('invalid');
  expect(mortgageComparisonMatch({ ...row, lvr_tier: undefined }, { loanAmount: '', lvr: '80' })).toBe('unverified');
  const source = [row, { ...row, product_key: 'unknown', balance_min: undefined, balance_max: undefined }];
  expect(mortgageComparisonRows(source, { loanAmount: '300000', lvr: '' })).toMatchObject({ rows: source, unverified: 1, invalid: false });
  expect(mortgageComparisonRows(source, { loanAmount: 'bad', lvr: '' }).rows).toEqual([]);
});
test('filter and sort operate on all candidates before either page size slices them', () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ ...row, product_key: String(i), rate: String(0.05 + i / 1000), comparison_rate: String(0.05 + i / 1000), provider: i % 2 ? 'B' : 'A' })).reverse();
  const before = JSON.stringify(rows);
  const sorted = queryAndSort(rows, { ...EMPTY_FILTERS, providers: ['A'], includeNonStandard: true }, 'rate', 'Mortgage');
  expect(sorted).toHaveLength(23); expect(sorted[0].product_key).toBe('0');
  for (const size of [10, 20] as const) {
    const window = ratesPageWindow(sorted.length, 2, size), page = sorted.slice(window.offset, window.to);
    expect(page[0].product_key).toBe(String(size * 2)); expect(page.length).toBe(size === 10 ? 10 : 3);
  }
  expect(JSON.stringify(rows)).toBe(before);
});
test('logo frames follow varied row heights with a 3px inset, preserve a metric rail and never impose row height', () => {
  for (const width of [288, 328, 448]) for (const height of [56, 72, 112]) for (const scale of [1, 2, 3.2]) {
    const frame = compactBankLogoFrame(width, height, scale, 0.5);
    expect(frame.height + 2 * frame.inset + 0.5).toBe(height);
    expect(frame.inset).toBe(3); expect(frame.width).toBeGreaterThanOrEqual(48); expect(frame.width).toBeLessThanOrEqual(112);
    expect(width - frame.width - 48 - 16 - 3 * 4).toBeGreaterThan(0);
  }
});
