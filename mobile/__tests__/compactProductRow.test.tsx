import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet, View } from 'react-native';
import { ProductCard } from '../src/components/ProductCard';
import { LoadingRows, ScreenSkeleton } from '../src/components/feedbackPlaceholders';
import { COMPACT_ROW, compactFactWidth, compactMetricHasPeers, compactProductFacet, compactProductRowLayout, compactTierIndex, type CompactProductRowLayout } from '../src/components/product/compactProductRow';
import { scopedFinancialConditionFacts } from '../src/data/scopedFinancialConditionFacts';
import { scopedRateConditions } from '../src/data/rateConditions';
import { uiLabel, uiRate } from '../src/lib/uiCopy';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';

let mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
let mockState: Record<string, any>;
let mockReducedMotion: boolean | null = true;
const mockSave = jest.fn(), mockHistory = jest.fn(), mockShow = jest.fn(), mockDismiss = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/PressFeedback', () => ({ PressFeedback: 'PressFeedback' }));
jest.mock('../src/components/IconAction', () => ({ IconAction: (props: any) => jest.requireActual('react').createElement('PressFeedback', {
  ...props, accessibilityRole: 'button', style: { ...props.style, minWidth: 48, minHeight: 48 },
}) }));
jest.mock('../src/components/WordBubble', () => ({ useWordBubble: (word: string) => ({ anchorRef: { current: null },
  show: (override?: string) => mockShow(override ?? word), dismiss: mockDismiss, overlay: null }) }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', androidRipple: () => undefined }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ useProductRateChangeSummary: () => null, productRateChangeText: () => null }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { primaryMuted: '#eee', primary: '#123', text: '#222', textMuted: '#555', warning: '#a60' }, radius: { sm: 4 }, ledger: { rule: '#ddd' } }) }));
jest.mock('../src/lib/nav', () => ({ openBank: (...args: unknown[]) => mockHistory(...args) }));

const row: RateRow = { provider: 'Maitland Mutual Limited', product_key: 'maitland-budget', product_name: 'Budget Home Loan',
  rate: '0.0579', comparison_rate: '0.0580', rate_index: 4, lvr_tier: 'lvr_=60%', account_class: 'standard' };
const fixture = () => selectedConstraintFixture('Mortgage', [row, { ...row, rate_index: 5 }], [
  { rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' },
]);
type Tree = ReactTestRenderer & { root: {
  findAllByType(type: unknown): { props: Record<string, any> }[];
  findByProps(props: Record<string, unknown>): { props: Record<string, any> };
} };
function render(exact: RateRow = row, props: Partial<React.ComponentProps<typeof ProductCard>> = {}) {
  const f = fixture();
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<ProductCard row={exact} section="Mortgage" {...props} />) as Tree; });
  return tree;
}
function mainTarget(tree: Tree) {
  return tree.root.findAllByType('PressFeedback').find(node => !node.props.testID && !String(node.props.accessibilityLabel).startsWith('View '))!;
}
function railWidth(layout: CompactProductRowLayout) {
  const cells = [layout.identity, layout.primary, layout.facet].filter(width => width > 0);
  return cells.reduce((total, width) => total + width, 0) + (cells.length - 1) * COMPACT_ROW.gap
    + (layout.showSecondary ? layout.secondary + COMPACT_ROW.gap : 0);
}
/** Synthetic native layout events exercise hit mapping, not Android geometry acceptance. */
function measureRegions(tree: Tree) {
  const main = mainTarget(tree), name = tree.root.findAllByType('AppText').find(node => node.props.testID === 'compact-product-name');
  const primary = tree.root.findByProps({ testID: 'compact-primary-cell' });
  const secondary = tree.root.findAllByType('AppText').some(node => node.props.testID === 'compact-secondary-rate')
    ? tree.root.findByProps({ testID: 'compact-secondary-cell' }) : null;
  const facts = tree.root.findAllByType(View).find(node => node.props.testID === 'compact-product-facts');
  const nameWidth = name?.props.style.width ?? 0, primaryWidth = primary.props.style.width;
  const metricsWidth = primaryWidth + (secondary ? secondary.props.style.width + 4 : 0);
  const metricsX = name ? nameWidth + 4 : 0;
  const factsX = metricsX + metricsWidth + (facts ? 4 : 0), width = factsX + (facts?.props.style.width ?? 0);
  const positions: Record<string, number> = {};
  const measure = (node: { props: Record<string, any> }, id: string, x: number, measuredWidth: number, parentX = 0) => {
    node.props.onLayout({ nativeEvent: { layout: { x, y: 0, width: measuredWidth, height: 20 } } });
    positions[id] = parentX + x + measuredWidth / 2;
  };
  act(() => {
    main.props.onLayout({ nativeEvent: { layout: { width, height: 48 } } });
    if (name) measure(name, 'name', 0, nameWidth);
    measure(tree.root.findByProps({ testID: 'compact-product-metrics' }), 'metrics', metricsX, metricsWidth);
    measure(primary, 'primary', 0, primaryWidth, metricsX);
    if (secondary) measure(secondary, 'secondary', primaryWidth + 4, secondary.props.style.width, metricsX);
    if (facts) measure(facts, 'facts', factsX, facts.props.style.width);
    const fields = [...tree.root.findAllByType('AppText'), ...tree.root.findAllByType('Icon')].filter(node =>
      ['compact-facet-value', 'compact-facet-symbol', 'compact-tier-index'].includes(node.props.testID)
      || String(node.props.testID).startsWith('compact-status-'));
    const eachWidth = (facts?.props.style.width ?? 0) / fields.length;
    fields.forEach((field, index) => measure(field, field.props.testID, index * eachWidth, eachWidth, factsX));
  });
  return { main, positions, width };
}
function hold(main: { props: Record<string, any> }, x: number, y = 24) {
  act(() => {
    main.props.onPressIn();
    main.props.onLongPress({ nativeEvent: { locationX: x, locationY: y } });
    main.props.onPress();
  });
}
beforeEach(() => { mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 }; jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); mockReducedMotion = true; });

test.each([false, true])('loading rows keep the same56dp single baseline and noninteractive action slots with screen wrapper=%s', wholeScreen => {
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(wholeScreen ? <ScreenSkeleton rows={3} /> : <LoadingRows count={3} />) as Tree; });
  try {
    const views = tree.root.findAllByType(View);
    const rows = views.filter(node => node.props.testID === 'loading-product-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.props.style).toMatchObject({ flexDirection: 'row', alignItems: 'center', gap: COMPACT_ROW.gap,
        paddingVertical: 4, paddingHorizontal: 0, minHeight: COMPACT_ROW.minHeight });
      expect(row.props.style.minHeight).toBe(56);
      expect(row.props.style.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
      expect(row.props).toMatchObject({ accessible: false, accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' });
    }
    for (const id of ['loading-bank-slot', 'loading-save-slot']) {
      const slots = views.filter(node => node.props.testID === id);
      expect(slots).toHaveLength(3);
      expect(slots.every(node => node.props.style.width === 48 && node.props.style.minHeight === 48)).toBe(true);
    }
    expect(views.filter(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.width === 24 && style?.height === 24;
    })).toHaveLength(6);
    expect(views.some(node => node.props.accessibilityRole === 'button' || node.props.onPress)).toBe(false);
    expect(views.some(node => node.props.accessibilityRole === 'progressbar' && node.props.accessibilityLabel === 'Loading content')).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test.each([true, null])('loading rows leave shimmer static while reduced motion is %s', preference => {
  mockReducedMotion = preference;
  const loop = jest.spyOn(Animated, 'loop');
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<LoadingRows count={1} />) as Tree; });
  try { expect(loop).not.toHaveBeenCalled(); }
  finally { act(() => tree.unmount()); }
});

test('the compact skeleton retains native shimmer timing and stops each animation on unmount', () => {
  mockReducedMotion = false;
  const start = jest.fn(), stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  const loop = jest.spyOn(Animated, 'loop').mockImplementation(() => ({ start, stop, reset: jest.fn() }));
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<LoadingRows count={1} />) as Tree; });
  try {
    expect(loop).toHaveBeenCalledTimes(4);
    expect(start).toHaveBeenCalledTimes(4);
    expect(timing.mock.calls.every(call => call[1].duration === 1500 && call[1].useNativeDriver)).toBe(true);
  } finally { act(() => tree.unmount()); }
  expect(stop).toHaveBeenCalledTimes(4);
});

test.each([[360, 1], [411, 1], [360, 2], [411, 2]])('fits one product rail at %sdp/font%s without truncating numbers', (width, fontScale) => {
  const f = fixture(), facet = compactProductFacet(f.rows[0], 'Mortgage', scopedFinancialConditionFacts(scopedRateConditions(f.rows[0], 'Mortgage', f)));
  const layout = compactProductRowLayout(width - 32, fontScale, uiRate(0.058), uiRate(0.0579), facet, 0);
  expect(layout.main + 2 * COMPACT_ROW.action + 2 * COMPACT_ROW.gap).toBe(width - 32);
  expect(railWidth(layout)).toBe(layout.main);
  expect(layout.identity).toBeGreaterThan(0);
  expect(layout.showSecondary).toBe(fontScale === 1);
  mockDimensions = { ...mockDimensions, width, fontScale };
  const tree = render();
  try {
    expect(tree.root.findByProps({ testID: 'compact-product-row' }).props.style).toMatchObject({ flexDirection: 'row', minHeight: 56 });
    expect(tree.root.findByProps({ testID: 'compact-product-metrics' }).props.style.flexDirection).toBe('row');
    expect(tree.root.findByProps({ testID: 'compact-product-name' }).props.numberOfLines).toBe(1);
    const primary = tree.root.findByProps({ testID: 'compact-primary-rate' });
    expect(primary.props.children).toBe('5.80%');
    expect(primary.props.numberOfLines).toBeUndefined();
    const secondary = tree.root.findAllByType('AppText').filter(node => node.props.testID === 'compact-secondary-rate');
    expect(secondary).toHaveLength(fontScale === 1 ? 1 : 0);
    const full = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    expect(full.props.accessibilityLabel).toContain('Comparison rate 5.80%');
    expect(full.props.accessibilityLabel).toContain('Advertised rate 5.79%');
    for (const text of tree.root.findAllByType('AppText')) {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.maxFontSizeMultiplier).toBeUndefined();
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
    }
  } finally { act(() => tree.unmount()); }
});

test('keeps exact admitted source ranges instead of the shared normalized LVR', () => {
  const f = fixture();
  const facts = f.rows.map(exact => compactProductFacet(exact, 'Mortgage', scopedFinancialConditionFacts(scopedRateConditions(exact, 'Mortgage', f))));
  expect(facts.map(fact => fact.value)).toEqual(['≤59.99%', '60%–79.99%']);
  const narrow = compactProductRowLayout(328, 1, uiRate(0.058), uiRate(0.0579), facts[0], 0);
  expect(narrow.showFacetValue).toBe(false);
  const wider = compactProductRowLayout(379, 1, uiRate(0.058), uiRate(0.0579), facts[0], 0);
  expect(wider.showFacetValue).toBe(true);
});

test('keeps actual measured row and numeric width in the budget', () => {
  const tree = render();
  try {
    act(() => tree.root.findByProps({ testID: 'compact-product-row' }).props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 110 }] } }));
    expect(tree.root.findAllByType('AppText').filter(node => node.props.testID === 'compact-secondary-rate')).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe('5.80%');
    expect(tree.root.findByProps({ testID: 'compact-product-name' }).props.style.width).toBeGreaterThan(0);
  } finally { act(() => tree.unmount()); }
});

test('has independent exact Save/History actions and holding the row only names Details', () => {
  const open = jest.fn(), history = jest.fn(), tree = render(row, { onPress: open, onLongPress: history });
  try {
    const targets = tree.root.findAllByType('PressFeedback');
    expect(targets).toHaveLength(3);
    const full = targets.find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    const lender = targets.find(node => node.props.accessibilityLabel === 'View Maitland Mutual Limited · History')!;
    const save = targets.find(node => node.props.testID === 'rate-save:maitland-budget:4')!;
    expect(targets.every(node => node.props.style.minHeight >= 48)).toBe(true);
    act(() => { full.props.onPressIn(); full.props.onLongPress(); full.props.onPress(); });
    expect(mockShow).toHaveBeenCalledWith('Details'); expect(open).not.toHaveBeenCalled(); expect(history).not.toHaveBeenCalled();
    act(() => { full.props.onPressIn(); full.props.onPress(); }); expect(open).toHaveBeenCalledTimes(1);
    act(() => { lender.props.onPressIn(); lender.props.onLongPress(); lender.props.onPress(); });
    expect(mockShow).toHaveBeenCalledWith('History'); expect(history).not.toHaveBeenCalled();
    act(() => { lender.props.onPressIn(); lender.props.onPress(); }); expect(history).toHaveBeenCalledTimes(1);
    act(() => save.props.onPress()); expect(mockSave).toHaveBeenCalledWith(row, 'rate'); expect(open).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('centres one main48dp target and names only measured visible symbols without opening or selecting', () => {
  const open = jest.fn(), tree = render(row, { onPress: open, selectMode: true });
  try {
    const { main, positions } = measureRegions(tree);
    expect(main.props.style).toMatchObject({ minHeight: 48, justifyContent: 'center' });
    expect(tree.root.findAllByType('PressFeedback')).toHaveLength(3);
    for (const [id, expected] of [['name', 'Details'], ['primary', 'Comparison'], ['secondary', 'Advertised'],
      ['compact-facet-symbol', 'LVR'], ['compact-tier-index', 'Tier']]) {
      expect(positions[id]).toBeDefined();
      hold(main, positions[id]);
      expect(mockShow).toHaveBeenLastCalledWith(expected);
    }
    expect(open).not.toHaveBeenCalled(); expect(mockHistory).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
    act(() => { main.props.onPressIn(); main.props.onPress(); });
    expect(open).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('negative, non-finite, unmeasured and outside points fall back to Details', () => {
  const tree = render();
  try {
    const target = mainTarget(tree);
    hold(target, 100); expect(mockShow).toHaveBeenLastCalledWith('Details');
    const { main, width } = measureRegions(tree);
    for (const [x, y] of [[-1, 24], [width, 24], [width + 10, 24], [20, -1], [20, 48], [NaN, 24], [Infinity, 24]]) {
      hold(main, x, y); expect(mockShow).toHaveBeenLastCalledWith('Details');
    }
  } finally { act(() => tree.unmount()); }
});

test('a hidden secondary and stale region events cannot claim a word after font/layout changes', () => {
  const tree = render();
  try {
    const { positions } = measureRegions(tree);
    const old = tree.root.findByProps({ testID: 'compact-secondary-cell' }).props.onLayout;
    mockDimensions = { ...mockDimensions, fontScale: 2 };
    act(() => tree.update(<ProductCard row={{ ...row }} section="Mortgage" />));
    expect(tree.root.findAllByType('AppText').some(node => node.props.testID === 'compact-secondary-rate')).toBe(false);
    act(() => old({ nativeEvent: { layout: { x: 0, width: 224 } } }));
    hold(mainTarget(tree), positions.secondary);
    expect(mockShow).toHaveBeenLastCalledWith('Details');
  } finally { act(() => tree.unmount()); }
});

test('hidden facet and presentation-warning cells never claim the prior LVR or a rate metric', () => {
  const tree = render();
  try {
    const { positions } = measureRegions(tree);
    const old = tree.root.findByProps({ testID: 'compact-facet-symbol' }).props.onLayout;
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 250 }] } }));
    const visibleFields = [...tree.root.findAllByType('AppText'), ...tree.root.findAllByType('Icon')];
    expect(visibleFields.some(node => ['compact-facet-value', 'compact-facet-symbol', 'compact-primary-rate'].includes(node.props.testID))).toBe(false);
    act(() => old({ nativeEvent: { layout: { x: 0, width: 224 } } }));
    hold(mainTarget(tree), positions['compact-facet-symbol']);
    expect(mockShow).toHaveBeenLastCalledWith('Details');
    const current = measureRegions(tree);
    hold(current.main, current.positions.primary);
    expect(mockShow).toHaveBeenLastCalledWith('Details');
  } finally { act(() => tree.unmount()); }
});

test('visible conditional and unknown symbols and the Savings balance facet name their own meanings', () => {
  const tree = render({ ...row, ribbon_deposit_kind: 'BONUS', ongoing_rate: undefined }, { section: 'Savings' });
  try {
    const { main, positions } = measureRegions(tree);
    hold(main, positions['compact-facet-symbol']); expect(mockShow).toHaveBeenLastCalledWith('Balance');
    const statuses = tree.root.findAllByType('Icon').filter(node => String(node.props.testID).startsWith('compact-status-'));
    expect(statuses.map(node => node.props.name)).toEqual(['flash-outline', 'help-circle-outline']);
    hold(main, positions['compact-status-0']); expect(mockShow).toHaveBeenLastCalledWith('Conditional');
    hold(main, positions['compact-status-1']); expect(mockShow).toHaveBeenLastCalledWith('Unknown');
  } finally { act(() => tree.unmount()); }
});

test.each([
  [{}, {}, 'Details'],
  [{ ribbon_deposit_kind: 'BASE' }, {}, 'Ongoing'],
  [{ ribbon_deposit_kind: 'BONUS' }, {}, 'Details'],
  [{}, { displayedRate: 0, displayedRateLabel: 'Ongoing rate' }, 'Ongoing'],
  [{}, { displayedRate: 0.01, displayedRateLabel: 'Bonus' }, 'Bonus'],
] as const)('generic Savings metrics keep their actual semantics %j / %j', (fields, props, expected) => {
  const tree = render({ ...row, ...fields }, { section: 'Savings', ...props });
  try {
    const { main, positions } = measureRegions(tree);
    hold(main, positions.primary);
    expect(mockShow).toHaveBeenLastCalledWith(expected);
  } finally { act(() => tree.unmount()); }
});

test('old font numeric callbacks cannot replace current measured widths or remount-loop the body', () => {
  const tree = render();
  try {
    const old = tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout;
    mockDimensions = { ...mockDimensions, fontScale: 2 };
    act(() => tree.update(<ProductCard row={{ ...row }} section="Mortgage" />));
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 110 }] } }));
    const main = mainTarget(tree);
    const width = tree.root.findByProps({ testID: 'compact-primary-cell' }).props.style.width;
    const name = tree.root.findByProps({ testID: 'compact-product-name' });
    act(() => old({ nativeEvent: { lines: [{ width: 250 }] } }));
    expect(tree.root.findByProps({ testID: 'compact-primary-cell' }).props.style.width).toBe(width);
    expect(tree.root.findByProps({ testID: 'compact-product-name' })).toBe(name);
    expect(mainTarget(tree)).toBe(main);
    expect(tree.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe('5.80%');
  } finally { act(() => tree.unmount()); }
});

test.each([true, false])('tapping the visible selection checkbox toggles its exact row once with lender action=%s', showLenderAction => {
  const select = jest.fn(), f = fixture();
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  function Selection() {
    const [selected, setSelected] = React.useState(false);
    return <ProductCard row={f.rows[0]} section="Mortgage" selectMode selected={selected} showLenderAction={showLenderAction}
      onPress={() => { select(f.rows[0]); setSelected(value => !value); }} />;
  }
  let tree!: Tree; act(() => { tree = TestRenderer.create(<Selection />) as Tree; });
  try {
    const checkbox = () => tree.root.findAllByType('PressFeedback').find(node => node.props.accessibilityLabel === 'View Maitland Mutual Limited · History')!;
    const main = () => tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    expect(checkbox().props.disabled).toBe(false);
    expect(checkbox().props.style).toMatchObject({ width: 48, minHeight: 48 });
    expect(checkbox().props.accessibilityElementsHidden).toBe(true);
    expect(checkbox().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(checkbox().props.onLongPress).toBeUndefined();
    expect(main().props.accessibilityState).toEqual({ selected: false });
    act(() => checkbox().props.onPress());
    expect(select).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledWith(f.rows[0]);
    expect(main().props.accessibilityState).toEqual({ selected: true });
    expect(tree.root.findAllByType('Icon').some(node => node.props.name === 'checkbox')).toBe(true);
    expect(tree.root.findAllByType('PressFeedback').find(node => String(node.props.testID).startsWith('rate-save:'))!.props.disabled).toBe(true);
    expect(mockHistory).not.toHaveBeenCalled(); expect(mockShow).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
    act(() => checkbox().props.onPress());
    expect(select).toHaveBeenCalledTimes(2); expect(main().props.accessibilityState).toEqual({ selected: false });
  } finally { act(() => tree.unmount()); }
});

test('distinguishes unknown comparison, conditional ongoing unknown and published zero', () => {
  const tree = render({ ...row, comparison_rate: undefined });
  try {
    const full = tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    expect(full.props.accessibilityLabel).toContain('Comparison rate Unknown');
  } finally { act(() => tree.unmount()); }
  const savings: RateRow = { ...row, comparison_rate: undefined, ribbon_deposit_kind: 'BONUS', ongoing_rate: undefined, balance_min: '99.50' };
  const conditional = render(savings, { section: 'Savings' });
  try {
    const icons = conditional.root.findAllByType('Icon').map(node => node.props.name);
    expect(icons).toContain('flash-outline'); expect(icons).toContain('help-circle-outline');
    const full = conditional.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    expect(full.props.accessibilityLabel).toContain('Ongoing rate: Unknown');
  } finally { act(() => conditional.unmount()); }
  const zero = render({ ...savings, ongoing_rate: '0' }, { section: 'Savings', displayedRate: 0, displayedRateLabel: 'Ongoing rate' });
  try { expect(zero.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe('0.00%'); }
  finally { act(() => zero.unmount()); }
  expect(compactProductFacet(savings, 'Savings', { state: 'unverified', eligibility: 'unassessed', facts: [], unresolved: [] }).value).toBe('≥$99.50');
  expect(compactProductFacet({ ...savings, balance_min: 'bad' }, 'Savings', { state: 'unverified', eligibility: 'unassessed', facts: [], unresolved: [] }).value).toBe('Unverified');
  expect(compactProductRowLayout(328, 2, uiLabel('—'), null, { kind: 'LVR', known: false, value: uiLabel('Unverified') }, 1).identity).toBeGreaterThan(0);
});

test('equal-metric actual tiers remain visibly distinct even when their long LVR bounds cannot fit', () => {
  const f = fixture();
  mockState = { ...f, isRateSaved: () => false, toggleSavedRate: mockSave, prefs: { mortgageRateMetric: 'comparison' } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<>{f.rows.map(exact => <ProductCard key={exact.rate_index} row={exact} section="Mortgage" />)}</>) as Tree; });
  try {
    expect(tree.root.findAllByType('AppText').filter(node => node.props.testID === 'compact-tier-index').map(node => node.props.children)).toEqual(['#4', '#5']);
    const labels = tree.root.findAllByType('PressFeedback').map(node => String(node.props.accessibilityLabel));
    expect(labels.some(value => value.includes('LVR ≤59.99%'))).toBe(true);
    expect(labels.some(value => value.includes('LVR 60%–79.99%'))).toBe(true);
    expect(compactTierIndex({ ...row, rate_index: undefined })).toBeNull();
    expect(compactTierIndex({ ...row, rate_index: 0 })).toBe('#0');
    expect(compactTierIndex({ ...row, rate_index: -1 })).toBeNull();
  } finally { act(() => tree.unmount()); }
  const rates = f.rows;
  let traversals = 0;
  const indexed = new Proxy(rates, { get(target, key, receiver) {
    if (key === Symbol.iterator) traversals++;
    return Reflect.get(target, key, receiver);
  } });
  expect(compactMetricHasPeers(rates[0], indexed, 'Comparison rate')).toBe(true);
  expect(compactMetricHasPeers(rates[1], indexed, 'Comparison rate')).toBe(true);
  expect(compactMetricHasPeers(rates[0], indexed, 'Comparison rate')).toBe(true);
  expect(traversals).toBe(1);
  const changed = [{ ...rates[0], comparison_rate: '0.06' }, rates[1]];
  expect(compactMetricHasPeers(changed[0], changed, 'Comparison rate')).toBe(false);
});

test.each([0, 110])('keeps font2/#172/max-warning geometry and the full rate with native primary measurement %s', measuredPrimary => {
  const layout = compactProductRowLayout(328, 2, uiRate(0.058), null,
    { kind: 'LVR', known: true, value: uiLabel('LVR') }, 3, measuredPrimary, 0, compactTierIndex({ ...row, rate_index: 172 }), true);
  expect(layout.identity).toBeGreaterThanOrEqual(28);
  expect(railWidth(layout)).toBe(layout.main);
  expect(layout.main + 2 * COMPACT_ROW.action + 2 * COMPACT_ROW.gap).toBe(328);
  expect(layout.showSecondary).toBe(false);
  expect(layout.warningOnly).toBe(false);
  expect(layout.primary).toBeGreaterThanOrEqual(measuredPrimary);
  expect(layout.showTier).toBe(measuredPrimary === 0);
  if (measuredPrimary === 0) {
    expect(layout.warningOnly).toBe(false);
    expect(layout.combinedStatus).toBe(true);
    expect(layout.showFacetSymbol).toBe(false);
  }
});

test.each([
  [uiRate(0.115), 0], [uiRate(0.115), 145], [uiLabel('Unknown'), 0],
  [uiLabel('Unknown'), 200], [uiRate(0.115), 220], [uiLabel('Unknown'), 224],
] as const)('font2 preserves fitting primary %s before #172, three statuses or name at measured width%s', (primary, measured) => {
  const layout = compactProductRowLayout(328, 2, primary, uiRate(0.118),
    { kind: 'LVR', known: true, value: uiLabel('LVR') }, 3, measured, 0, compactTierIndex({ ...row, rate_index: 172 }), true);
  expect(layout.warningOnly).toBe(false);
  expect(layout.primary).toBeGreaterThanOrEqual(Math.max(compactFactWidth(primary, 2), measured));
  expect(railWidth(layout)).toBe(layout.main);
  expect(layout.main).toBe(224);
  expect(layout.showSecondary).toBe(false);
  expect(layout.showTier).toBe(false);
  if (measured >= 220) {
    expect(layout.identity).toBe(0);
    expect(layout.facet).toBe(0);
    expect(layout.showStatuses).toBe(false);
  }
});

test.each([uiRate(0.115), uiLabel('—')])('renders actual font2 primary %s and preserves its metric bubble when optional cells disappear', primary => {
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  const exact = { ...row, rate: primary === '—' ? '' : row.rate,
    comparison_rate: primary === '—' ? undefined : '0.115', rate_index: 172 };
  const metricWord = primary === '—' ? 'Advertised' : 'Comparison';
  const tree = render(exact);
  try {
    expect(tree.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe(primary);
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 220 }] } }));
    expect(tree.root.findAllByType('AppText').some(node => node.props.testID === 'compact-product-name')).toBe(false);
    expect(tree.root.findAllByType(View).some(node => node.props.testID === 'compact-product-facts')).toBe(false);
    expect(tree.root.findByProps({ testID: 'compact-primary-cell' }).props.style.width).toBe(224);
    const rate = tree.root.findByProps({ testID: 'compact-primary-rate' });
    expect(rate.props.children).toBe(primary);
    expect(rate.props.numberOfLines).toBeUndefined();
    expect(rate.props.maxFontSizeMultiplier).toBeUndefined();
    expect(rate.props.adjustsFontSizeToFit).toBeUndefined();
    const measured = measureRegions(tree);
    expect(measured.width).toBe(224);
    expect(measured.main.props.accessibilityLabel).toContain(`${metricWord} rate ${primary}`);
    expect(measured.main.props.accessibilityLabel).toContain(exact.product_name);
    hold(measured.main, measured.positions.primary);
    expect(mockShow).toHaveBeenLastCalledWith(metricWord);
    expect(tree.root.findAllByType('PressFeedback').every(node => node.props.style.minHeight >= 48)).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('a fitting caution remains beside a wide full rate before the clipped name', () => {
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  const tree = render({ ...row, rate: '0.115', ribbon_deposit_kind: 'BONUS', ongoing_rate: undefined }, { section: 'Savings' });
  try {
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 200 }] } }));
    expect(tree.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe('11.50%');
    expect(tree.root.findAllByType('AppText').some(node => node.props.testID === 'compact-product-name')).toBe(false);
    expect(tree.root.findByProps({ testID: 'compact-status-0' }).props.name).toBe('help-circle-outline');
    const measured = measureRegions(tree);
    hold(measured.main, measured.positions['compact-status-0']);
    expect(mockShow).toHaveBeenLastCalledWith('Unknown');
  } finally { act(() => tree.unmount()); }
});

test('only a primary glyph wider than the entire numeric rail uses the unsupported presentation warning', () => {
  const primary = uiRate(0.115);
  const layout = compactProductRowLayout(328, 2, primary, null,
    { kind: 'LVR', known: true, value: uiLabel('LVR') }, 3, 225, 0, compactTierIndex({ ...row, rate_index: 172 }), true);
  expect(layout.warningOnly).toBe(true);
  expect(layout).toMatchObject({ primary: 224, identity: 0, facet: 0, showTier: false, showStatuses: false });
  expect(railWidth(layout)).toBe(224);
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  const tree = render({ ...row, comparison_rate: '0.115', rate_index: 172 });
  try {
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 225 }] } }));
    expect(tree.root.findAllByType('AppText').some(node => node.props.testID === 'compact-primary-rate')).toBe(false);
    expect(mainTarget(tree).props.accessibilityLabel).toContain('Comparison rate 11.50%');
    expect(tree.root.findAllByType('Icon').some(node => node.props.name === 'warning-outline')).toBe(true);
  } finally { act(() => tree.unmount()); }
});
