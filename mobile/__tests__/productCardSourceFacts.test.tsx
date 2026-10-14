import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductCard } from '../src/components/ProductCard';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import { rateConditionFixture } from '../testUtils/rateConditions';
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
    const saves = tree.root.findAllByType('PressFeedback').filter(n => String(n.props.accessibilityLabel).startsWith('Save, Rate index '));
    expect(saves[0].props.accessibilityLabel).toContain('Rate index 4, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%');
    expect(saves[0].props.accessibilityLabel).toContain('LVR ≤59.99%');
    expect(saves[1].props.accessibilityLabel).toContain('Rate index 5, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%');
    expect(saves[1].props.accessibilityLabel).toContain('LVR 60%–79.99%');
    act(() => { saves[0].props.onPress(); saves[1].props.onPress(); });
    expect(mockSave).toHaveBeenNthCalledWith(1, f.rows[0], 'rate'); expect(mockSave).toHaveBeenNthCalledWith(2, f.rows[1], 'rate');
    const nav = tree.root.findAllByType('PressFeedback').filter(n => String(n.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(nav[0].props.accessibilityLabel).toContain('LVR ≤59.99%'); expect(nav[1].props.accessibilityLabel).toContain('LVR 60%–79.99%');
  } finally { act(() => tree.unmount()); }
});

test.each([false, true])('captured sibling Save/Remove targets retain the exact rate and scope when saved=%s', favorite => {
  const fixture = rateConditionFixture(), rows = fixture.rows.slice(0, 2);
  const original = JSON.stringify(rows), open = jest.fn();
  mockSave.mockClear();
  mockState = { ...fixture, isRateSaved: () => favorite, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'headline' } };
  let tree!: Tree; act(() => { tree = TestRenderer.create(<>{rows.map(row => <ProductCard key={row.rate_index} row={row} section="TD" onPress={open} />)}</>) as Tree; });
  try {
    const action = favorite ? 'Remove' : 'Save';
    const buttons = tree.root.findAllByType('PressFeedback').filter(node => String(node.props.accessibilityLabel).startsWith(action + ', Rate index '));
    expect(buttons).toHaveLength(2);
    expect(new Set(buttons.map(node => node.props.accessibilityLabel)).size).toBe(2);
    expect(buttons[0].props.accessibilityLabel).toContain(`Rate index 1, ${rows[0].product_name}, Macquarie, Rate 5.05%`);
    expect(buttons[0].props.accessibilityLabel).toContain('3 mo');
    expect(buttons[1].props.accessibilityLabel).toContain(`Rate index 2, ${rows[1].product_name}, Macquarie, Rate 5.15%`);
    expect(buttons[1].props.accessibilityLabel).toContain('6 mo');
    for (const button of buttons) {
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityState).toEqual({ selected: favorite });
      expect(button.props.style).toMatchObject({ width: 48, minHeight: 48 });
    }
    act(() => { buttons[0].props.onPress(); buttons[1].props.onPress(); });
    expect(mockSave).toHaveBeenNthCalledWith(1, rows[0], 'rate');
    expect(mockSave).toHaveBeenNthCalledWith(2, rows[1], 'rate');
    expect(open).not.toHaveBeenCalled();
    expect(JSON.stringify(rows)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

test.each([false, true])('a product-scoped favorite names all rates rather than an invented exact index when saved=%s', favorite => {
  const fixture = rateConditionFixture(), product = { ...fixture.rows[0], rate_index: undefined };
  mockSave.mockClear();
  mockState = { ...fixture, isRateSaved: () => favorite, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'headline' } };
  let tree!: Tree; act(() => { tree = TestRenderer.create(<ProductCard row={product} section="TD" />) as Tree; });
  try {
    const action = favorite ? 'Remove all rates' : 'Save all rates';
    const button = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith(action + ', '))!;
    expect(button).toBeDefined();
    expect(button.props.accessibilityLabel).toContain(product.product_name);
    expect(button.props.accessibilityLabel).toContain('Rate 5.05%');
    expect(button.props.accessibilityLabel).not.toContain('Rate index');
    expect(button.props.style).toMatchObject({ width: 48, minHeight: 48 });
    expect(button.props.accessibilityState).toEqual({ selected: favorite });
    act(() => button.props.onPress());
    expect(mockSave).toHaveBeenCalledWith(product, 'product');
  } finally { act(() => tree.unmount()); }
});

test('a mortgage card preserves unspecified purpose in visible and accessible facts', () => {
  const row = { ...loan, loan_purpose: 'UNCONSTRAINED', security_purpose: 'owner_occupied', ribbon_repayment_type: 'UNCONSTRAINED' };
  mockState = { isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductCard row={row} section="Mortgage" />) as Tree; });
  try {
    const text = tree.root.findAllByType('AppText').map(node => String(node.props.children)).join(' | ');
    expect(text).toContain('Unspecified purpose');
    expect(text).toContain('Unspecified');
    expect(text).not.toMatch(/UNCONSTRAINED|Owner occupied|Eligibility confirmed/);
    const nav = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(nav?.props.accessibilityLabel).toContain('Unspecified purpose');
    expect(row.loan_purpose).toBe('UNCONSTRAINED');
  } finally { act(() => tree.unmount()); }
});
