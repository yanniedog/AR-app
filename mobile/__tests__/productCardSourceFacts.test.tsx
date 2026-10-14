import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductCard } from '../src/components/ProductCard';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';
let mockState: Record<string, any>;
const mockSave = jest.fn();
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/PressFeedback', () => ({ PressFeedback: 'PressFeedback' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row', androidRipple: () => undefined }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ ProductRateChangeSummaryLine: 'ProductRateChangeSummaryLine', useProductRateChangeSummary: () => null, productRateChangeText: () => null }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { primaryMuted: '#eee', primary: '#123', text: '#222', textFaint: '#666', warning: '#a60' }, radius: { sm: 4 }, ledger: { rule: '#ddd' } }) }));
jest.mock('../src/lib/nav', () => ({ openBank: jest.fn() }));
type Tree = ReactTestRenderer & { root: { findAllByType(type: string): { props: Record<string, any> }[] } };
const loan: RateRow = { provider: 'Maitland Mutual Limited', product_key: 'maitland-budget', product_name: 'Budget Home Loan', rate: '0.0579', rate_index: 4, lvr_tier: 'lvr_=60%', account_class: 'standard' };
test('production result cards show each exact admitted LVR and preserve each save identity', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }], [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }]);
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree; act(() => { tree = TestRenderer.create(<>{f.rows.map(row => <ProductCard key={row.rate_index} row={row} section="Mortgage" />)}</>) as Tree; });
  try {
    const texts = tree.root.findAllByType('AppText').map(n => String(n.props.children));
    expect(texts.some(text => text.includes('LVR ≤59.99%'))).toBe(true); expect(texts.some(text => text.includes('LVR 60%–79.99%'))).toBe(true);
    expect(texts.some(text => text.includes('For LVR') || text.includes('LVR up to'))).toBe(false);
    const saves = tree.root.findAllByType('PressFeedback').filter(n => n.props.accessibilityLabel === 'Save');
    act(() => { saves[0].props.onPress(); saves[1].props.onPress(); });
    expect(mockSave).toHaveBeenNthCalledWith(1, f.rows[0], 'rate'); expect(mockSave).toHaveBeenNthCalledWith(2, f.rows[1], 'rate');
    const nav = tree.root.findAllByType('PressFeedback').filter(n => String(n.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(nav[0].props.accessibilityLabel).toContain('LVR ≤59.99%'); expect(nav[1].props.accessibilityLabel).toContain('LVR 60%–79.99%');
  } finally { act(() => tree.unmount()); }
});
