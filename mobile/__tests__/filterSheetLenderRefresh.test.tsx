import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { FilterSheet } from '../src/components/FilterSheet';
import { EMPTY_FILTERS } from '../src/data/selectors';
import type { RateRow } from '../src/types';

jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar' }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
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
  props: { label?: string; value?: string; onChangeText?: (value: string) => void };
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

test('an active lender query stays clearable when live rows shrink below the search threshold', () => {
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
    section: 'Mortgage' as const,
  };
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<FilterSheet {...props} rows={rows} />) as InspectableRenderer; });
  const nodes = (type: string) => tree.root.findAll(node => node.type === type);
  const lenderLabels = () => nodes('Chip').map(node => node.props.label).filter(label => label?.startsWith('Bank'));
  try {
    expect(nodes('SearchBar')).toHaveLength(1);
    act(() => nodes('SearchBar')[0].props.onChangeText!('Bank 13'));
    expect(lenderLabels()).toEqual(['Bank 13']);

    // Search keeps effectiveFilters memoized across a core/rows replacement.
    const refreshedRows = rows.slice(0, 12);
    act(() => tree.update(<FilterSheet {...props} rows={refreshedRows} />));
    expect(nodes('SearchBar')).toHaveLength(1);
    expect(nodes('SearchBar')[0].props.value).toBe('Bank 13');
    expect(lenderLabels()).toEqual([]);

    act(() => nodes('SearchBar')[0].props.onChangeText!(''));
    expect(lenderLabels()).toHaveLength(12);
    expect(new Set(lenderLabels())).toEqual(new Set(refreshedRows.map(row => row.provider)));
    expect(nodes('SearchBar')).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});
