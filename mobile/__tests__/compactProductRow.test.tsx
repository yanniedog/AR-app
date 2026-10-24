import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { ProductCard } from '../src/components/ProductCard';
import { LoadingRows, ScreenSkeleton } from '../src/components/feedbackPlaceholders';
import { COMPACT_ROW, compactMetricHasPeers, compactFactWidth, compactProductFacet, compactProductRowLayout, compactTierIndex } from '../src/components/product/compactProductRow';
import { scopedFinancialConditionFacts } from '../src/data/scopedFinancialConditionFacts';
import { scopedRateConditions } from '../src/data/rateConditions';
import { uiLabel, uiProductName, uiRate } from '../src/lib/uiCopy';
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
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { primaryMuted: '#eee', primary: '#123', text: '#222', textMuted: '#555', warning: '#a60', success: '#087' }, radius: { sm: 4 }, ledger: { rule: '#ddd' } }) }));
jest.mock('../src/lib/nav', () => ({ openBank: (...args: unknown[]) => mockHistory(...args) }));

const row: RateRow = { provider: 'Maitland Mutual Limited', product_key: 'maitland-budget', product_name: 'Budget Home Loan',
  rate: '0.0579', comparison_rate: '0.0580', rate_index: 4, lvr_tier: 'lvr_=60%', account_class: 'standard' };
const fixture = () => selectedConstraintFixture('Mortgage', [row, { ...row, rate_index: 5 }], [
  { rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' },
]);
type TestNode = { props: Record<string, any>; type: unknown; parent: TestNode; children: TestNode[];
  findAllByType(type: unknown): TestNode[]; findByProps(props: Record<string, unknown>): TestNode;
  findAllByProps(props: Record<string, unknown>): TestNode[] };
type Tree = ReactTestRenderer & { root: TestNode };
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

beforeEach(() => { mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 }; jest.clearAllMocks(); });

test.each([[320, 1], [360, 1], [411, 1], [320, 2], [360, 3]])('preserves a scrubbable complete rail with product name last at %sdp/font%s', (width, fontScale) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  const exact = { ...row, product_name: 'An exceptionally long product name with every qualifier preserved' };
  const tree = render(exact);
  try {
    const scroll = tree.root.findByProps({ testID: 'compact-product-scroll' });
    expect(scroll.type).toBe(ScrollView);
    expect(scroll.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: true, directionalLockEnabled: true });
    const name = tree.root.findByProps({ testID: 'compact-product-name' });
    const facts = tree.root.findByProps({ testID: 'compact-product-facts' });
    const metrics = tree.root.findByProps({ testID: 'compact-product-metrics' });
    expect(name.parent).toBe(facts.parent);
    const ordered = name.parent.children;
    expect(ordered.indexOf(metrics)).toBeLessThan(ordered.indexOf(facts));
    expect(ordered.indexOf(facts)).toBeLessThan(ordered.indexOf(name));
    expect(name.props.children).toBe(exact.product_name);
    expect(name.props.style.width).toBeGreaterThanOrEqual(compactFactWidth(uiProductName(exact), fontScale));
    expect(tree.root.findByProps({ testID: 'compact-primary-rate' }).props.children).toBe('5.80%');
    expect(tree.root.findByProps({ testID: 'compact-secondary-rate' }).props.children).toBe('5.79%');
    expect(tree.root.findByProps({ testID: 'compact-facet-value' }).props.children).toBe('≤60%');
    expect(mainTarget(tree).props.style.width).toBeGreaterThan(width);
    expect(mainTarget(tree).props.accessibilityLabel).toContain('Advertised rate 5.79%');
    const icons = tree.root.findAllByType('Icon');
    expect(icons.find(node => node.props.name === 'calculator-outline')!.props.color).toBe('#123');
    expect(icons.find(node => node.props.name === 'cash-outline')!.props.color).toBe('#087');
    expect(icons.some(node => node.props.name === 'home')).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('scrubbing cancels opening; fixed save action preserves exact identity', () => {
  const open = jest.fn(), tree = render(row, { onPress: open });
  try {
    const main = mainTarget(tree);
    act(() => { main.props.onPressIn(); tree.root.findByProps({ testID: 'compact-product-scroll' }).props.onScrollBeginDrag(); main.props.onPress(); });
    expect(open).not.toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'compact-product-scroll' }).findAllByProps({ testID: 'rate-save:maitland-budget:4' })).toHaveLength(0);
    act(() => tree.root.findByProps({ testID: 'rate-save:maitland-budget:4' }).props.onPress());
    expect(mockSave).toHaveBeenCalledWith(row, 'rate');
    expect(tree.root.findAllByType('PressFeedback').every(node => node.props.style.minHeight >= 48)).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('native widths expand the rail without suppressing unknowns or conditional warnings', () => {
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  const tree = render({ ...row, ribbon_deposit_kind: 'BONUS', ongoing_rate: undefined }, { section: 'Savings' });
  try {
    act(() => tree.root.findByProps({ testID: 'compact-primary-rate' }).props.onTextLayout({ nativeEvent: { lines: [{ width: 500 }] } }));
    expect(tree.root.findByProps({ testID: 'compact-primary-cell' }).props.style.width).toBeGreaterThan(500);
    expect(mainTarget(tree).props.accessibilityLabel).toContain('Ongoing rate: Unknown');
    expect(tree.root.findByProps({ testID: 'compact-product-name' }).props.children).toBe(row.product_name);
    expect(tree.root.findByProps({ testID: 'compact-tier-index' }).props.children).toBe('#4');
    expect(tree.root.findByProps({ testID: 'compact-status-0' }).props.name).toBe('flash-outline');
    expect(tree.root.findByProps({ testID: 'compact-status-1' }).props.name).toBe('help-circle-outline');
  } finally { act(() => tree.unmount()); }
});

test('preserves exact source ranges with all statuses, tier and rates at large text size', () => {
  const f = fixture();
  const facets = f.rows.map(exact => compactProductFacet(exact, 'Mortgage', scopedFinancialConditionFacts(scopedRateConditions(exact, 'Mortgage', f))));
  expect(facets.map(facet => facet.value)).toEqual(['≤59.99%', '60%–79.99%']);
  for (const facet of facets) {
    const layout = compactProductRowLayout(280, 3, uiRate(0.058), uiRate(0.0579), facet, 3, 500, 400, compactTierIndex(row));
    expect(layout).toMatchObject({ showSecondary: true, showFacetValue: true, showStatuses: true, showTier: true, combinedStatus: false, warningOnly: false });
    expect(layout.primary).toBeGreaterThan(500); expect(layout.secondary).toBeGreaterThan(400);
    expect(layout.main).toBeGreaterThan(1000);
  }
});

test('holding does not open the row and checkbox preserves selection behavior', () => {
  const open = jest.fn(), tree = render(row, { onPress: open, selectMode: true });
  try {
    const main = mainTarget(tree);
    act(() => { main.props.onPressIn(); main.props.onLongPress(); main.props.onPress(); });
    expect(open).not.toHaveBeenCalled(); expect(mockShow).toHaveBeenCalledWith('Details');
    expect(main.props.accessibilityState).toEqual({ selected: false });
    act(() => tree.root.findAllByType('PressFeedback').find(node => String(node.props.accessibilityLabel).startsWith('View '))!.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ testID: 'rate-save:maitland-budget:4' }).props.disabled).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test.each([false, true])('logo height follows content shrinking independently of the old outer row with embedded=%s', embedded => {
  const tree = render(row, { embedded });
  const outer = () => tree.root.findByProps({ testID: 'compact-product-row' });
  const avatar = () => tree.root.findAllByType('BankAvatar')[0].props;
  const layout = (height: number) => ({ nativeEvent: { layout: { width: 328, height } } });
  const normal = COMPACT_ROW.minHeight - 6 - (embedded ? 0 : StyleSheet.hairlineWidth);
  try {
    act(() => outer().props.onLayout(layout(119)));
    expect(avatar().height).toBeCloseTo(normal);
    act(() => mainTarget(tree).props.onLayout(layout(112)));
    expect(avatar().height).toBeCloseTo(112);
    act(() => outer().props.onLayout(layout(119)));
    act(() => mainTarget(tree).props.onLayout(layout(48)));
    expect(avatar().height).toBeCloseTo(normal);
    act(() => outer().props.onLayout(layout(119)));
    expect(avatar().height).toBeCloseTo(normal);
  } finally { act(() => tree.unmount()); }
});



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

test('has independent exact Save/History actions and holding the row only names Details', () => {
  const open = jest.fn(), history = jest.fn(), tree = render(row, { onPress: open, onLongPress: history });
  try {
    const targets = tree.root.findAllByType('PressFeedback');
    expect(targets).toHaveLength(3);
    const full = targets.find(node => String(node.props.accessibilityLabel).startsWith('Budget Home Loan,'))!;
    const lender = targets.find(node => node.props.accessibilityLabel === 'View Maitland Mutual Limited · History · Freshness · Unknown')!;
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
    const checkbox = () => tree.root.findAllByType('PressFeedback').find(node => node.props.accessibilityLabel === 'View Maitland Mutual Limited · History · Freshness · Unknown')!;
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


afterEach(() => { jest.restoreAllMocks(); mockReducedMotion = true; });

test('holds measured icons in the scrolled content coordinate space and ignores stale geometry', () => {
  const tree = render();
  try {
    const main = mainTarget(tree);
    const metrics = tree.root.findByProps({ testID: 'compact-product-metrics' });
    const primary = tree.root.findByProps({ testID: 'compact-primary-cell' });
    const secondary = tree.root.findByProps({ testID: 'compact-secondary-cell' });
    const facts = tree.root.findByProps({ testID: 'compact-product-facts' });
    const facet = tree.root.findByProps({ testID: 'compact-facet-cell' });
    const layout = (node: { props: Record<string, any> }, x: number, width: number) => node.props.onLayout({ nativeEvent: { layout: { x, y: 0, width, height: 48 } } });
    const primaryWidth = primary.props.style.width, secondaryWidth = secondary.props.style.width;
    const metricsWidth = primaryWidth + secondaryWidth + 4, factsX = metricsWidth + 4;
    act(() => {
      layout(main, 0, main.props.style.width);
      layout(metrics, 0, metricsWidth);
      layout(primary, 0, primaryWidth);
      layout(secondary, primaryWidth + 4, secondaryWidth);
      layout(facts, factsX, facts.props.style.width);
      layout(facet, 0, 70);
    });
    for (const [x, word] of [[10, 'Comparison'], [primaryWidth + 10, 'Advertised'], [factsX + 10, 'LVR']] as const) {
      act(() => { main.props.onPressIn(); main.props.onLongPress({ nativeEvent: { locationX: x, locationY: 24 } }); });
      expect(mockShow).toHaveBeenLastCalledWith(word);
    }
    const oldLayout = facet.props.onLayout;
    mockDimensions = { ...mockDimensions, fontScale: 2 };
    act(() => tree.update(<ProductCard row={{ ...row }} section="Mortgage" />));
    act(() => oldLayout({ nativeEvent: { layout: { x: 0, width: 70 } } }));
    act(() => mainTarget(tree).props.onLongPress({ nativeEvent: { locationX: factsX + 10, locationY: 24 } }));
    expect(mockShow).toHaveBeenLastCalledWith('Details');
  } finally { act(() => tree.unmount()); }
});
