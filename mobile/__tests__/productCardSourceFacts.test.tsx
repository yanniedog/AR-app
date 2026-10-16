import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductCard } from '../src/components/ProductCard';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import { rateConditionFixture } from '../testUtils/rateConditions';
import bundledCore from '../assets/sample/core.json';
import type { RateRow, SectionKey } from '../src/types';
import { productSaveIdentity } from '../src/lib/productSaveIdentity';
let mockState: Record<string, any>;
const mockSave = jest.fn();
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/PressFeedback', () => ({ PressFeedback: 'PressFeedback' }));
jest.mock('../src/components/IconAction', () => ({ IconAction: (props: any) => jest.requireActual('react').createElement('PressFeedback', {
  ...props, accessibilityRole: 'button', style: { ...props.style, width: 48, minHeight: 48 },
}) }));
jest.mock('../src/components/WordBubble', () => ({ useWordBubble: () => ({ anchorRef: { current: null }, show: jest.fn(), dismiss: jest.fn(), overlay: null }) }));
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
    const rowLabels = tree.root.findAllByType('PressFeedback').map(n => String(n.props.accessibilityLabel));
    expect(rowLabels.some(text => text.includes('LVR ≤59.99%'))).toBe(true); expect(rowLabels.some(text => text.includes('LVR 60%–79.99%'))).toBe(true);
    expect(texts.some(text => text.includes('For LVR') || text.includes('LVR up to'))).toBe(false);
    const saves = tree.root.findAllByType('PressFeedback').filter(n => String(n.props.testID).startsWith('rate-save:'));
    expect(saves[0].props.accessibilityLabel).toContain('Save, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%');
    expect(saves[0].props.accessibilityLabel).toContain('LVR ≤59.99%');
    expect(saves[1].props.accessibilityLabel).toContain('Save, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%');
    expect(saves[1].props.accessibilityLabel).toContain('LVR 60%–79.99%');
    expect(saves.every(n => !n.props.accessibilityLabel.includes('Rate index'))).toBe(true);
    expect(saves.map(n => n.props.testID)).toEqual(['rate-save:maitland-budget:4', 'rate-save:maitland-budget:5']);
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
    const buttons = tree.root.findAllByType('PressFeedback').filter(node => String(node.props.testID).startsWith('rate-save:'));
    expect(buttons).toHaveLength(2);
    expect(new Set(buttons.map(node => node.props.accessibilityLabel)).size).toBe(2);
    expect(buttons[0].props.accessibilityLabel).toBe(`${action}, ${rows[0].product_name}, Macquarie, Rate 5.05%`);
    expect(buttons[1].props.accessibilityLabel).toBe(`${action}, ${rows[1].product_name}, Macquarie, Rate 5.15%`);
    expect(buttons.map(node => node.props.testID)).toEqual(rows.map(row => `rate-save:${encodeURIComponent(row.product_key)}:${row.rate_index}`));
    const nav = tree.root.findAllByType('PressFeedback').filter(node => String(node.props.accessibilityLabel).startsWith(rows[0].product_name + ','));
    expect(nav[0].props.accessibilityLabel).toContain('3 mo');
    expect(nav[1].props.accessibilityLabel).toContain('6 mo');
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
    expect(button.props.accessibilityLabel).toBe(`${action}, ${product.product_name}, Macquarie`);
    expect(button.props.accessibilityLabel).not.toContain('Rate index');
    expect(button.props.testID).toBe(`rate-save:${encodeURIComponent(product.product_key)}:all`);
    expect(button.props.style).toMatchObject({ width: 48, minHeight: 48 });
    expect(button.props.accessibilityState).toEqual({ selected: favorite });
    act(() => button.props.onPress());
    expect(mockSave).toHaveBeenCalledWith(product, 'product');
  } finally { act(() => tree.unmount()); }
});

test('a compact mortgage row preserves unspecified purpose in full accessible facts', () => {
  const row = { ...loan, loan_purpose: 'UNCONSTRAINED', security_purpose: 'owner_occupied', ribbon_repayment_type: 'UNCONSTRAINED' };
  mockState = { isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductCard row={row} section="Mortgage" />) as Tree; });
  try {
    const text = tree.root.findAllByType('AppText').map(node => String(node.props.children)).join(' | ');
    expect(text).not.toMatch(/UNCONSTRAINED|Owner occupied|Eligibility confirmed/);
    const nav = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(nav?.props.accessibilityLabel).toContain('Unspecified purpose');
    expect(nav?.props.accessibilityLabel).toContain('Unspecified');
    expect(row.loan_purpose).toBe('UNCONSTRAINED');
  } finally { act(() => tree.unmount()); }
});

test('bundled Liberty and Unity OTHER purposes stay explicit in compact row accessible facts', () => {
  const rows: RateRow[] = bundledCore.sections.Mortgage.rates.filter(row => row.loan_purpose === 'OTHER');
  expect(rows.map(row => row.provider)).toEqual(['Liberty Financial', 'Unity Bank']);
  expect(rows.every(row => row.security_purpose === 'owner_occupied')).toBe(true);
  const original = JSON.stringify(rows);
  mockState = { isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<>{rows.map(row => <ProductCard key={row.product_key} row={row} section="Mortgage" />)}</>) as Tree; });
  try {
    for (const row of rows) {
      const action = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith(`${row.product_name},`));
      expect(action).toBeDefined();
      expect(action!.props.accessibilityLabel).toContain('Other purpose');
      expect(action!.props.accessibilityLabel).not.toMatch(/Owner occupied|Eligibility confirmed/);
    }
    expect(JSON.stringify(rows)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

function renderRows(fixture: ReturnType<typeof selectedConstraintFixture>, section: SectionKey, visible = fixture.rows): Tree {
  mockSave.mockClear();
  mockState = { ...fixture, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<>{visible.map(row => <ProductCard key={`${row.product_key}:${row.rate_index}`} row={row} section={section} />)}</>) as Tree; });
  return tree;
}
function saveTargets(tree: Tree) { return tree.root.findAllByType('PressFeedback').filter(node => String(node.props.testID).startsWith('rate-save:')); }

test('a single visible source-bound tier keeps its discriminator against nonvisible product siblings', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }], [
    { rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' },
  ]);
  const tree = renderRows(f, 'Mortgage', [f.rows[0]]);
  try {
    const target = saveTargets(tree)[0];
    expect(target.props.accessibilityLabel).toBe('Save, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%, LVR ≤59.99%');
    expect(target.props.accessibilityLabel).not.toMatch(/Rate index|Eligibility|Source review|For LVR/);
    act(() => target.props.onPress());
    expect(mockSave).toHaveBeenCalledWith(f.rows[0], 'rate');
  } finally { act(() => tree.unmount()); }
});

test('real equal-rate deposit siblings use their term instead of an internal ordinal', () => {
  const f = rateConditionFixture(), rows = f.rows.filter(row => row.rate_index === 3 || row.rate_index === 8);
  expect(rows.map(row => row.rate)).toEqual(['0.0520', '0.0520']);
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree; act(() => { tree = TestRenderer.create(<>{rows.map(row => <ProductCard key={row.rate_index} row={row} section="TD" />)}</>) as Tree; });
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toContain('Rate 5.20%, 9 mo');
    expect(targets[1].props.accessibilityLabel).toContain('Rate 5.20%, 1 yr');
    expect(targets.every(node => !node.props.accessibilityLabel.includes('Rate index'))).toBe(true);
    expect(new Set(targets.map(node => node.props.testID)).size).toBe(2);
  } finally { act(() => tree.unmount()); }
});

test('equal metric and tier siblings retain their explicit standard/non-standard account class', () => {
  const f = selectedConstraintFixture('Mortgage', [
    { ...loan, rate_index: 1, account_class: 'standard' },
    { ...loan, rate_index: 2, account_class: 'non_standard' },
  ], []);
  const tree = renderRows(f, 'Mortgage');
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toBe('Save, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%, Standard');
    expect(targets[1].props.accessibilityLabel).toBe('Save, Budget Home Loan, Maitland Mutual Limited, Advertised rate 5.79%, Non-standard');
  } finally { act(() => tree.unmount()); }
});

test('unparsed source qualifiers remain on the row while unresolved actions use their actual index', () => {
  const f = selectedConstraintFixture('Savings', [
    { ...loan, rate_index: 1, lvr_tier: undefined, account_class: undefined, term: 'Only an eligible applicant may receive this promotional offer.' },
    { ...loan, rate_index: 2, lvr_tier: undefined, account_class: undefined, term: 'Read this explanatory product paragraph.' },
  ], [{ rateIndex: 1, text: 'Special eligibility wording requires review.' }, { rateIndex: 2, text: 'Other eligibility wording requires review.' }]);
  const tree = renderRows(f, 'Savings');
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toBe('Save, Budget Home Loan, Maitland Mutual Limited, Rate 5.79%, Rate index 1');
    expect(targets[1].props.accessibilityLabel).toBe('Save, Budget Home Loan, Maitland Mutual Limited, Rate 5.79%, Rate index 2');
    expect(targets.every(node => !/eligible|explanatory|wording|promotional/.test(node.props.accessibilityLabel))).toBe(true);
    const rowTargets = tree.root.findAllByType('PressFeedback').filter(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(rowTargets.every(node => node.props.accessibilityLabel.includes('Source review required'))).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('stale source conditions cannot replace the index with an unadmitted source distinction', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }], [
    { rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' },
  ]);
  f.details.run_date = '2026-10-13';
  const tree = renderRows(f, 'Mortgage');
  try {
    const labels = saveTargets(tree).map(node => node.props.accessibilityLabel);
    expect(labels[0]).toContain('Rate index 4'); expect(labels[1]).toContain('Rate index 5');
    expect(labels.every(value => !value.includes('59.99') && !value.includes('79.99'))).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('unknown sibling LVR cannot be treated as proof of a different tier', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5, lvr_tier: undefined }], []);
  const tree = renderRows(f, 'Mortgage');
  try {
    expect(saveTargets(tree)[0].props.accessibilityLabel).toContain('Rate index 4');
    expect(saveTargets(tree)[1].props.accessibilityLabel).toContain('Rate index 5');
  } finally { act(() => tree.unmount()); }
});

test('metric collisions use displayed precision and keep the full row facts out of the action name', () => {
  const unloan = bundledCore.sections.Mortgage.rates.find(row => row.provider === 'Unloan')!;
  const f = selectedConstraintFixture('Mortgage', [unloan], [{ rateIndex: unloan.rate_index!, text: 'Additional conditions require source review.' }]);
  const tree = renderRows(f, 'Mortgage');
  try {
    const action = saveTargets(tree)[0];
    expect(action.props.accessibilityLabel).toBe('Save, Unloan Home Loan, Unloan, Comparison rate 5.80%');
    expect(action.props.accessibilityLabel).not.toMatch(/Rate index|Advertised|LVR|Source review|Principal|Variable/);
    const full = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Unloan Home Loan,'))!;
    expect(full.props.accessibilityLabel).toMatch(/Advertised rate 5.89%.*Variable.*Principal & interest.*Listed LVR >70%–80%.*Source review required/);
    expect(action.props.testID).toBe(`rate-save:${encodeURIComponent(unloan.product_key)}:2`);
  } finally { act(() => tree.unmount()); }
  const rounded = selectedConstraintFixture('Mortgage', [
    { ...loan, rate_index: 1, rate: '0.0579001', lvr_tier: 'lvr_60-70%' },
    { ...loan, rate_index: 2, rate: '0.0579002', lvr_tier: 'lvr_70-80%' },
  ], []);
  const other = renderRows(rounded, 'Mortgage');
  try {
    const targets = saveTargets(other);
    expect(targets[0].props.accessibilityLabel).toContain('Advertised rate 5.79%, Listed LVR >60%–70%');
    expect(targets[1].props.accessibilityLabel).toContain('Advertised rate 5.79%, Listed LVR >70%–80%');
  } finally { act(() => other.unmount()); }
});

test('source-array identity and metric changes invalidate peer groups without per-card global rescans', () => {
  const f = selectedConstraintFixture('Mortgage', [
    { ...loan, rate_index: 1, comparison_rate: '0.06', lvr_tier: 'lvr_60-70%' },
    { ...loan, rate_index: 2, comparison_rate: '0.061', lvr_tier: 'lvr_70-80%' },
  ], []);
  let traversals = 0;
  const original = f.rows;
  f.core.sections.Mortgage.rates = new Proxy(original, { get(target, key, receiver) {
    if (key === Symbol.iterator) return () => { traversals++; return target[Symbol.iterator](); };
    if (key === 'filter' || key === 'includes') throw new Error('Per-card section rescan');
    return Reflect.get(target, key, receiver);
  } });
  const headline = productSaveIdentity(original[0], 'Mortgage', 'headline', f);
  expect(headline.name).toContain('Listed LVR >60%–70%');
  const comparison = productSaveIdentity(original[0], 'Mortgage', 'comparison', f);
  expect(comparison.name).toBe('Budget Home Loan, Maitland Mutual Limited, Comparison rate 6.00%');
  productSaveIdentity(original[1], 'Mortgage', 'comparison', f);
  productSaveIdentity(original[0], 'Mortgage', 'headline', f);
  expect(traversals).toBe(1);
  f.core.sections.Mortgage.rates = [original[0]];
  expect(productSaveIdentity(original[0], 'Mortgage', 'headline', f).name).not.toContain('LVR');
  expect(productSaveIdentity({ ...original[0] }, 'Mortgage', 'headline', f).name).toContain('Rate index 1');
});

test('the duplicate provider logo is decorative while full row, History and exact Save stay actionable', () => {
  const f = rateConditionFixture(), row = f.rows[0], open = jest.fn(), history = jest.fn(), logoState = jest.fn();
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  mockSave.mockClear();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductCard row={row} section="TD" onPress={open} onLongPress={history}
    logoRenderStateId="actual-logo-probe" onLogoRenderStateChange={logoState} />) as Tree; });
  try {
    const avatar = tree.root.findAllByType('BankAvatar')[0] as { props: Record<string, any>; parent: { props: Record<string, any> } };
    expect(avatar.parent.props).toMatchObject({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    expect(avatar.props.renderStateId).toBe('actual-logo-probe');
    expect(avatar.props.onRenderStateChange).toBe(logoState);
    const historyButton = tree.root.findAllByType('PressFeedback').find(node => node.props.accessibilityLabel === 'View Macquarie · History · Freshness · Unknown')!;
    expect(historyButton.props.accessibilityRole).toBe('button');
    expect(historyButton.props.disabled).toBe(false);
    act(() => historyButton.props.onPress());
    expect(history).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
    const fullRow = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith(row.product_name + ','))!;
    expect(fullRow.props.accessibilityLabel).toContain('Macquarie');
    expect(fullRow.props.accessibilityRole).toBe('button');
    expect(saveTargets(tree)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test('real bundled same-name deposit products keep distinct Save identities across source keys', () => {
  const rows: RateRow[] = bundledCore.sections.TD.rates.filter(row => row.provider === 'People First and Heritage Bank'
    && row.product_name === 'Term Deposit' && row.rate === '0.0535');
  expect(rows.map(row => row.rate_index)).toEqual([6, 12]);
  expect(new Set(rows.map(row => row.product_key)).size).toBe(2);
  expect(rows.map(row => row.term_months)).toEqual(['7', '7']);
  const f = selectedConstraintFixture('TD', rows, []);
  const tree = renderRows(f, 'TD');
  try {
    const targets = saveTargets(tree);
    expect(targets.map(node => node.props.accessibilityLabel)).toEqual([
      'Save, Term Deposit, People First and Heritage Bank, Rate 5.35%, Rate index 6',
      'Save, Term Deposit, People First and Heritage Bank, Rate 5.35%, Rate index 12',
    ]);
    expect(targets.map(node => node.props.testID)).toEqual(f.rows.map(row => `rate-save:${encodeURIComponent(row.product_key)}:${row.rate_index}`));
    act(() => { targets[0].props.onPress(); targets[1].props.onPress(); });
    expect(mockSave).toHaveBeenNthCalledWith(1, f.rows[0], 'rate');
    expect(mockSave).toHaveBeenNthCalledWith(2, f.rows[1], 'rate');
    const facts = tree.root.findAllByType('PressFeedback').map(node => node.props.accessibilityLabel);
    expect(facts.some(value => String(value).includes('7 mo · $1k+ · at maturity'))).toBe(true);
    expect(f.rows[0].balance_min).toBeUndefined();
    expect(f.rows[1].balance_min).toBe('1000');
  } finally { act(() => tree.unmount()); }
});

test('same-name different-key peers use each own admitted source rather than mixing published and listed LVR', () => {
  const f = selectedConstraintFixture('Mortgage', [
    { ...loan, product_key: 'first-product', rate_index: 1, lvr_tier: 'lvr_60-70%' },
    { ...loan, product_key: 'second-product', rate_index: 2, lvr_tier: 'lvr_70-80%' },
  ], [{ rateIndex: 1, text: 'LVR up to 59.99%.' }, { rateIndex: 2, text: 'LVR up to 59.99%.' }]);
  const tree = renderRows(f, 'Mortgage');
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toContain('Rate index 1');
    expect(targets[1].props.accessibilityLabel).toContain('Rate index 2');
    expect(targets.every(node => !node.props.accessibilityLabel.includes('LVR'))).toBe(true);
    const fullRows = tree.root.findAllByType('PressFeedback').filter(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'));
    expect(fullRows.every(node => node.props.accessibilityLabel.includes('LVR ≤59.99%'))).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('same rate-index ordinals across different products use natural term before a technical fallback', () => {
  const f = selectedConstraintFixture('TD', [
    { ...loan, product_key: 'first-product', product_id: 'first-id', rate_index: 1, term: 'P3M' },
    { ...loan, product_key: 'second-product', product_id: 'second-id', rate_index: 1, term: 'P6M' },
  ], []);
  const tree = renderRows(f, 'TD');
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toContain('Rate 5.79%, 3 mo');
    expect(targets[1].props.accessibilityLabel).toContain('Rate 5.79%, 6 mo');
    expect(targets.every(node => !/Rate index|Product ID/.test(node.props.accessibilityLabel))).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('fully unresolved same-name same-index products retain actual product ID and exact callback identity', () => {
  const f = selectedConstraintFixture('TD', [
    { ...loan, product_key: 'first-product', product_id: 'first-id', rate_index: 1, term: 'P3M' },
    { ...loan, product_key: 'second-product', product_id: 'second-id', rate_index: 1, term: 'P3M' },
  ], []);
  const tree = renderRows(f, 'TD');
  try {
    const targets = saveTargets(tree);
    expect(targets[0].props.accessibilityLabel).toContain('Rate index 1, Product ID first-id');
    expect(targets[1].props.accessibilityLabel).toContain('Rate index 1, Product ID second-id');
    expect(new Set(targets.map(node => node.props.testID)).size).toBe(2);
    act(() => { targets[0].props.onPress(); targets[1].props.onPress(); });
    expect(mockSave).toHaveBeenNthCalledWith(1, f.rows[0], 'rate');
    expect(mockSave).toHaveBeenNthCalledWith(2, f.rows[1], 'rate');
  } finally { act(() => tree.unmount()); }
});
