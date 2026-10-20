import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { FilterSheet } from '../src/components/FilterSheet';
import { EMPTY_FILTERS, filterRows } from '../src/data/selectors';
import { prepareSearchFilterOptions } from '../src/data/searchFilterOptions';
import bundledCore from '../assets/sample/core.json';
import type { RateRow } from '../src/types';

jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar' }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: ({ children, footer }: any) => mockReact.createElement('SheetSurface', null, children, footer) }));
jest.mock('../src/components/ui', () => ({
  AppText: 'AppText', Button: 'Button', Chip: 'Chip', Disclosure: 'Disclosure', Divider: 'Divider', Row: 'Row',
}));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { surface: '#fff', text: '#000', textFaint: '#ddd' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type TestNode = {
  type: unknown;
  props: { label?: string; value?: string; title?: string; selected?: boolean; onPress?: () => void; onChangeText?: (value: string) => void };
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

test('a stale filter count cannot replace a newer draft or update a closed sheet', async () => {
  const options = (await prepareSearchFilterOptions([], null, 'Mortgage', { yieldControl: async () => {} }))!;
  const pending: { resolve(value: number): void; cancelled: () => boolean }[] = [];
  const resultCount = jest.fn((_draft: unknown, cancelled?: () => boolean) => new Promise<number>(resolve => {
    pending.push({ resolve, cancelled: cancelled! });
  }));
  const filters = { ...EMPTY_FILTERS };
  const props = { onClose: jest.fn(), onApply: jest.fn(), options, filters, resultCount };
  let tree!: InspectableRenderer;
  await act(async () => { tree = TestRenderer.create(<FilterSheet {...props} visible />) as InspectableRenderer; });
  try {
    const latestFilters = { ...filters, providers: ['Bank'] };
    await act(async () => tree.update(<FilterSheet {...props} visible filters={latestFilters} />));
    expect(pending[0].cancelled()).toBe(true);
    await act(async () => pending.at(-1)!.resolve(2));
    const titles = () => tree.root.findAll(node => node.type === 'Button').map(node => node.props.title);
    expect(titles()).toContain('Show 2 products');
    await act(async () => pending[0].resolve(999));
    expect(titles()).not.toContain('Show 999 products');
    const closingDraft = { ...latestFilters, providers: ['Other bank'] };
    await act(async () => tree.update(<FilterSheet {...props} visible filters={closingDraft} />));
    const late = pending.at(-1)!;
    await act(async () => tree.update(<FilterSheet {...props} visible={false} filters={closingDraft} />));
    expect(late.cancelled()).toBe(true);
    await act(async () => late.resolve(777));
    await act(async () => tree.update(<FilterSheet {...props} visible filters={closingDraft} />));
    expect(titles()).not.toContain('Show 777 products');
    expect(titles()).toContain('Apply');
    await act(async () => pending.at(-1)!.resolve(3));
    expect(titles()).toContain('Show 3 products');
  } finally { act(() => tree.unmount()); }
});

test('an active lender query stays clearable when live rows shrink below the search threshold', async () => {
  const rows: RateRow[] = Array.from({ length: 13 }, (_, i) => ({
    provider: `Bank ${i + 1}`,
    product_name: 'Loan',
    product_key: `bank-${i + 1}`,
    rate: '0.05',
  }));
  const props = {
    visible: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    filters: { ...EMPTY_FILTERS },
  };
  const options = (await prepareSearchFilterOptions(rows, null, 'Mortgage', { yieldControl: async () => {} }))!;
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<FilterSheet {...props} options={options} />) as InspectableRenderer; });
  const nodes = (type: string) => tree.root.findAll(node => node.type === type);
  const lenderLabels = () => nodes('Chip').map(node => node.props.label).filter(label => label?.startsWith('Bank'));
  try {
    expect(nodes('SearchBar')).toHaveLength(1);
    act(() => nodes('SearchBar')[0].props.onChangeText!('Bank 13'));
    expect(lenderLabels()).toEqual(['Bank 13']);

    // Search keeps effectiveFilters memoized across a core/rows replacement.
    const refreshedRows = rows.slice(0, 12);
    const refreshedOptions = (await prepareSearchFilterOptions(refreshedRows, null, 'Mortgage', { yieldControl: async () => {} }))!;
    act(() => tree.update(<FilterSheet {...props} options={refreshedOptions} />));
    expect(nodes('SearchBar')).toHaveLength(1);
    expect(nodes('SearchBar')[0].props.value).toBe('Bank 13');
    expect(lenderLabels()).toEqual([]);

    act(() => nodes('SearchBar')[0].props.onChangeText!(''));
    expect(lenderLabels()).toHaveLength(12);
    expect(new Set(lenderLabels())).toEqual(new Set(refreshedRows.map(row => row.provider)));
    expect(nodes('SearchBar')).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('readable purpose, feature and eligibility chips apply the exact published keys', async () => {
  const rows: RateRow[] = [{ provider: 'Bank', product_name: 'Loan', product_key: 'loan', rate: '0.05', loan_purpose: 'UNCONSTRAINED' }];
  const options = (await prepareSearchFilterOptions(rows, {
    loan: { facts: [
      { id: 'overdraft', kind: 'feature', canonicalKey: 'OVERDRAFT', value: true, unit: 'boolean' },
      { id: 'individual', kind: 'eligibility', canonicalKey: 'NATURAL_PERSON', value: true, unit: 'boolean' },
      { id: 'employment', kind: 'eligibility', canonicalKey: 'EMPLOYMENT_STATUS', value: 'PAYG', unit: 'enum' },
    ] },
  }, 'Mortgage', { yieldControl: async () => {} }))!;
  const onApply = jest.fn(), onClose = jest.fn();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<FilterSheet visible onClose={onClose} onApply={onApply} filters={{ ...EMPTY_FILTERS }} options={options} />) as InspectableRenderer; });
  try {
    const chip = (label: string) => tree.root.findAll(node => node.type === 'Chip' && node.props.label === label)[0];
    for (const label of ['Unspecified purpose', 'Overdraft', 'Individual applicants', 'Employment status']) {
      expect(chip(label)).toBeDefined();
      act(() => chip(label).props.onPress!());
      expect(chip(label).props.selected).toBe(true);
    }
    act(() => tree.root.findAll(node => node.type === 'Button' && Boolean(node.props.title?.startsWith('Apply')))[0].props.onPress!());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({ loanPurposes: ['UNCONSTRAINED'], accountFeatures: ['OVERDRAFT'], eligibilityCriteria: ['NATURAL_PERSON', 'EMPLOYMENT_STATUS'] });
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('the real bundled OTHER purpose chip applies the publisher code without rewriting rows', async () => {
  const rows: RateRow[] = bundledCore.sections.Mortgage.rates.filter(row => row.loan_purpose === 'OTHER');
  expect(rows.map(row => row.provider)).toEqual(['Liberty Financial', 'Unity Bank']);
  const original = JSON.stringify(rows);
  const options = (await prepareSearchFilterOptions(rows, null, 'Mortgage', { yieldControl: async () => {} }))!;
  const onApply = jest.fn();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<FilterSheet visible onClose={jest.fn()} onApply={onApply} filters={{ ...EMPTY_FILTERS }} options={options} />) as InspectableRenderer; });
  try {
    const chip = () => tree.root.findAll(node => node.type === 'Chip' && node.props.label === 'Other purpose')[0];
    expect(chip()).toBeDefined();
    expect(chip().props.selected).toBe(false);
    act(() => chip().props.onPress!());
    expect(chip().props.selected).toBe(true);
    act(() => tree.root.findAll(node => node.type === 'Button' && node.props.title === 'Apply')[0].props.onPress!());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].loanPurposes).toEqual(['OTHER']);
    expect(JSON.stringify(rows)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

test('bundle-rate chip labels preserve the exact raw selections and filter membership', async () => {
  const codes = ['BUNDLE_DISCOUNT_FIXED', 'BUNDLE_DISCOUNT_VARIABLE', 'FIXED'];
  const rows: RateRow[] = codes.map((rate_type, index) => ({ provider: 'Bank', product_name: `Loan ${index}`,
    product_key: `loan-${index}`, rate: '0.05', rate_type }));
  const original = JSON.stringify(rows);
  const options = (await prepareSearchFilterOptions(rows, null, 'Mortgage', { yieldControl: async () => {} }))!;
  const onApply = jest.fn();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<FilterSheet visible onClose={jest.fn()} onApply={onApply}
    filters={{ ...EMPTY_FILTERS, includeNonStandard: true }} options={options} />) as InspectableRenderer; });
  try {
    const chip = (label: string) => tree.root.findAll(node => node.type === 'Chip' && node.props.label === label)[0];
    for (const label of ['Fixed · bundle', 'Variable · bundle']) {
      expect(chip(label)).toBeDefined();
      expect(chip(label).props.selected).toBe(false);
      act(() => chip(label).props.onPress!());
      expect(chip(label).props.selected).toBe(true);
    }
    expect(chip('Fixed').props.selected).toBe(false);
    act(() => tree.root.findAll(node => node.type === 'Button' && node.props.title === 'Apply')[0].props.onPress!());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].rateTypes).toEqual(codes.slice(0, 2));
    expect(filterRows(rows, onApply.mock.calls[0][0]).map(row => row.rate_type)).toEqual(codes.slice(0, 2));
    expect(JSON.stringify(rows)).toBe(original);
  } finally { act(() => tree.unmount()); }
});
