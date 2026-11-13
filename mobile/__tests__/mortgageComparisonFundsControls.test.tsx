import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, TextInput, View } from 'react-native';
import { MortgageComparisonControls } from '../src/components/MortgageComparisonControls';
import { clearMortgageComparison, setMortgageComparisonInputs, useMortgageComparison } from '../src/data/mortgageComparison';
import { captureRatesSession, restoreRatesSession } from '../src/data/ratesSession';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { catalogue, programme, product, row } from '../testUtils/publicRateJourney';

let mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ prefs: { mortgageRateMetric: 'comparison' } }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, font: { body: 14 }, ledger: {} }) }));
jest.mock('../src/components/IconAction', () => ({ IconAction: 'IconAction' }));
jest.mock('../src/components/PressFeedback', () => ({ PressFeedback: 'PressFeedback' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Row: 'Row', androidRipple: () => undefined }));
jest.mock('../src/lib/haptics', () => ({ hapticSelection: jest.fn() }));

type TestNode = { props: Record<string, any>; findAllByType(type: any): TestNode[]; findByProps(props: object): TestNode; findAllByProps(props: object): TestNode[] };
type Tree = ReactTestRenderer & { root: TestNode };
const screen = () => <MortgageComparisonControls rows={[]} filters={EMPTY_FILTERS} unverified={0} invalid={false} />;
function mount(): Tree {
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(screen()) as Tree; });
  return tree;
}
function input(tree: Tree, label: string) {
  return tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label);
}
function tab(tree: Tree, label: string) {
  return tree.root.findAllByType('PressFeedback').find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)!;
}
function choose(tree: Tree, label: string) { act(() => tab(tree, label).props.onPress()); }
function type(tree: Tree, label: string, text: string) { act(() => input(tree, label)!.props.onChangeText(text)); }
function fact(tree: Tree, id: string) { return String(tree.root.findByProps({ testID: id }).props.children); }

let previousSession: ReturnType<typeof captureRatesSession>;
beforeEach(() => {
  mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
  previousSession = captureRatesSession(); jest.useFakeTimers(); clearMortgageComparison();
});
afterEach(() => { clearMortgageComparison(); restoreRatesSession(previousSession); jest.useRealTimers(); });

test.each([1, 49])('widely available facets exclude placeholders from rows, selections and %i catalogue products', async count => {
  const products = Array.from({ length: count }, (_, i) => ({ ...product, productId: `p-${i}` }));
  const view = catalogue(products.map(p => programme({ productId: p.productId, conditions: [
    { conditionId: 'purpose', evidenceIds: [], field: 'purpose', operator: 'in', values: ['OO', 'INV', 'UNCONSTRAINED', 'OTHER'] },
    { conditionId: 'repayment', evidenceIds: [], field: 'repayment', operator: 'in', values: ['PI', 'IO', 'UNKNOWN'] },
  ] })), products);
  const filters = { ...EMPTY_FILTERS, loanPurposes: ['UNKNOWN'], repaymentTypes: ['UNSPECIFIED'] };
  const render = (includeNonStandard: boolean) => <MortgageComparisonControls
    rows={[row, { ...row, loan_purpose: 'OTHER', ribbon_repayment_type: 'UNKNOWN' }]}
    catalogue={view} filters={{ ...filters, includeNonStandard }} unverified={0} invalid={false} />;
  let tree!: Tree;
  await act(async () => { tree = TestRenderer.create(render(true)) as Tree; });
  await act(async () => { await jest.runAllTimersAsync(); });
  const labels = () => tree.root.findAllByType('Chip').map(node => node.props.label);
  try {
    expect(labels()).toEqual(expect.arrayContaining(['Unspecified', 'OTHER', 'UNKNOWN']));
    act(() => tree.update(render(false)));
    expect(labels()).toEqual(['Owner occupied', 'Investor', 'Principal & interest', 'Interest only']);
    act(() => tree.update(render(true)));
    expect(labels()).toEqual(expect.arrayContaining(['Unspecified', 'OTHER', 'UNKNOWN']));
  } finally { act(() => tree.unmount()); }
});

test('exclusive accessible modes keep raw direct LVR and show computed facts without editable LVR in funds mode', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '72' });
  const tree = mount();
  try {
    expect(tab(tree, 'LVR').props.accessibilityState).toEqual({ selected: true });
    expect(input(tree, 'LVR')?.props.value).toBe('72');
    expect(input(tree, 'Deposit')).toBeUndefined();
    choose(tree, 'Funds available');
    expect(tab(tree, 'Funds available').props.accessibilityState).toEqual({ selected: true });
    expect(tab(tree, 'LVR').props.accessibilityState).toEqual({ selected: false });
    expect(input(tree, 'LVR')).toBeUndefined();
    expect(input(tree, 'Deposit')?.props.keyboardType).toBe('decimal-pad');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    type(tree, 'Deposit', '150000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-property-value')).toBe('Property value · $750,000');
    expect(useMortgageComparison.getState().fundsAvailable).toBeUndefined();
    act(() => jest.advanceTimersByTime(200));
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '600000', lvr: '72', lvrMode: 'funds', fundsAvailable: '150000' });
    choose(tree, 'LVR');
    expect(input(tree, 'LVR')?.props.value).toBe('72');
    expect(input(tree, 'Deposit')).toBeUndefined();
    choose(tree, 'Funds available');
    expect(input(tree, 'Deposit')?.props.value).toBe('150000');
    expect(input(tree, 'Loan amount')?.props.value).toBe('600000');
  } finally { act(() => tree.unmount()); }
});

test('funds typing stays local and changing mode commits only the latest draft without an old timer restoring it', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '75', lvrMode: 'funds', fundsAvailable: '' });
  const tree = mount();
  try {
    type(tree, 'Deposit', '1');
    act(() => jest.advanceTimersByTime(100));
    type(tree, 'Deposit', '15');
    act(() => jest.advanceTimersByTime(100));
    expect(useMortgageComparison.getState().fundsAvailable).toBe('');
    type(tree, 'Deposit', '150000');
    choose(tree, 'LVR');
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '600000', lvr: '75', lvrMode: 'lvr', fundsAvailable: '150000' });
    act(() => jest.advanceTimersByTime(500));
    expect(useMortgageComparison.getState().lvrMode).toBe('lvr');
    expect(input(tree, 'LVR')?.props.value).toBe('75');
  } finally { act(() => tree.unmount()); }
});

test.each(['clear', 'replace'])('external %s discards pending funds and wins over debounce and unmount flush', action => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '75', lvrMode: 'funds', fundsAvailable: '' });
  const tree = mount();
  type(tree, 'Deposit', '200000');
  const expected = action === 'clear' ? { loanAmount: '', lvr: '' } : { loanAmount: '500000', lvr: '60' };
  try {
    act(() => setMortgageComparisonInputs(expected));
    expect(input(tree, 'Deposit')).toBeUndefined();
    expect(input(tree, 'Loan amount')?.props.value).toBe(expected.loanAmount);
    expect(input(tree, 'LVR')?.props.value).toBe(expected.lvr);
    act(() => jest.advanceTimersByTime(500));
  } finally { act(() => tree.unmount()); }
  expect(useMortgageComparison.getState()).toEqual(expected);
});

test('remount retains both drafts and mode; Clear removes both drafts and resets to direct LVR', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '71', lvrMode: 'funds' });
  let tree = mount();
  type(tree, 'Deposit', '200000');
  act(() => tree.unmount());
  expect(useMortgageComparison.getState().fundsAvailable).toBe('200000');
  tree = mount();
  try {
    expect(input(tree, 'Deposit')?.props.value).toBe('200000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 75.00%');
    choose(tree, 'LVR');
    expect(input(tree, 'LVR')?.props.value).toBe('71');
    choose(tree, 'Funds available');
    type(tree, 'Deposit', '250000');
    act(() => tree.root.findByProps({ accessibilityLabel: 'Clear comparison inputs' }).props.onPress());
    act(() => jest.advanceTimersByTime(500));
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '', lvr: '' });
    expect(input(tree, 'Deposit')).toBeUndefined();
    expect(input(tree, 'Loan amount')?.props.value).toBe('');
    expect(input(tree, 'LVR')?.props.value).toBe('');
  } finally { act(() => tree.unmount()); }
});

test('blank and invalid funds remain editable unknowns; explicit zero yields 100 percent and loan edits update facts immediately', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '80', lvrMode: 'funds', fundsAvailable: '' });
  const tree = mount();
  try {
    for (const text of ['.', '-1', 'abc', '']) {
      type(tree, 'Deposit', text);
      expect(input(tree, 'Deposit')?.props.value).toBe(text);
      expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    }
    type(tree, 'Deposit', '0');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 100.00%');
    type(tree, 'Deposit', '150000');
    type(tree, 'Loan amount', '450000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 75.00%');
    expect(fact(tree, 'mortgage-property-value')).toBe('Property value · $600,000');
    type(tree, 'Loan amount', '');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    expect(fact(tree, 'mortgage-property-value')).toBe('Property value · Unknown');
  } finally { act(() => tree.unmount()); }
});

test('computed money facts retain cents and rounded displayed LVR never overwrites the direct draft', () => {
  setMortgageComparisonInputs({ loanAmount: '600000.01', lvr: '71.2345', lvrMode: 'funds', fundsAvailable: '149999.98' });
  const tree = mount();
  try {
    expect(fact(tree, 'mortgage-property-value')).toBe('Property value · $749,999.99');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    act(() => jest.advanceTimersByTime(500));
    expect(useMortgageComparison.getState().lvr).toBe('71.2345');
    choose(tree, 'LVR');
    expect(input(tree, 'LVR')?.props.value).toBe('71.2345');
  } finally { act(() => tree.unmount()); }
});

test('large text retains wrapping fields and both labelled selectable tabs with 48dp targets', () => {
  mockDimensions = { width: 320, height: 800, scale: 3, fontScale: 3 };
  const tree = mount();
  try {
    const group = tree.root.findAllByProps({ accessibilityRole: 'tablist' })[0];
    expect(group.props.style.flexWrap).toBe('wrap');
    for (const label of ['Funds available', 'LVR']) {
      const control = tab(tree, label);
      const style = StyleSheet.flatten(control.props.style({ pressed: false }));
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    }
    choose(tree, 'Funds available');
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs.map(node => node.props.accessibilityLabel)).toEqual(['Loan amount', 'Deposit']);
    expect(inputs.every(node => node.props.style.minHeight >= 48 && node.props.allowFontScaling !== false)).toBe(true);
    expect(tree.root.findAllByType(View).filter(node => node.props.style?.flexBasis === 220)).toHaveLength(2);
    expect(tree.root.findAllByType('Row').some(node => node.props.style?.flexWrap === 'wrap'
      && node.props.style?.alignItems === 'flex-end')).toBe(true);
    expect(tab(tree, 'Funds available').props.accessibilityState.selected).toBe(true);
    expect(tab(tree, 'LVR').props.accessibilityState.selected).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('offset mode prices lender LVR from property value and keeps interest-bearing balance separate', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '71', lvrMode: 'funds', fundsAvailable: '150000' });
  const tree = mount();
  try {
    expect(tab(tree, 'Deposit').props.accessibilityState.selected).toBe(true);
    choose(tree, 'Offset account');
    expect(tab(tree, 'Deposit').props.accessibilityState.selected).toBe(false);
    expect(tab(tree, 'Offset account').props.accessibilityState.selected).toBe(true);
    expect(input(tree, 'Deposit')).toBeUndefined();
    expect(input(tree, 'Offset balance')?.props.value).toBe('150000');
    expect(input(tree, 'Property value')?.props.value).toBe('');
    expect(input(tree, 'LVR')).toBeUndefined();
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    type(tree, 'Property value', '750000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · $450,000');
    type(tree, 'Offset balance', '250000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · $350,000');
    choose(tree, 'Deposit');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 70.59%');
    expect(fact(tree, 'mortgage-property-value')).toBe('Property value · $850,000');
    expect(input(tree, 'Property value')).toBeUndefined();
    choose(tree, 'Offset account');
    expect(input(tree, 'Property value')?.props.value).toBe('750000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    choose(tree, 'LVR');
    expect(input(tree, 'LVR')?.props.value).toBe('71');
    expect(input(tree, 'Property value')).toBeUndefined();
    choose(tree, 'Funds available');
    expect(tab(tree, 'Offset account').props.accessibilityState.selected).toBe(true);
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '600000', lvr: '71', lvrMode: 'funds',
      fundsAvailable: '250000', fundsType: 'offset', propertyValue: '750000' });
  } finally { act(() => tree.unmount()); }
});

test('offset zero, missing property and invalid raw edits stay distinct without blocking input', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '71', lvrMode: 'funds', fundsType: 'offset', fundsAvailable: '', propertyValue: '' });
  const tree = mount();
  try {
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · Unknown');
    type(tree, 'Property value', '750000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · Unknown');
    type(tree, 'Property value', '');
    type(tree, 'Offset balance', '0');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    type(tree, 'Property value', '750000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · $600,000');
    type(tree, 'Offset balance', '650000');
    expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · 80.00%');
    expect(fact(tree, 'mortgage-loan-less-offset')).toBe('Loan less offset · $0');
    for (const text of ['.', '-1', 'abc', '']) {
      type(tree, 'Property value', text);
      expect(input(tree, 'Property value')?.props.value).toBe(text);
      expect(fact(tree, 'mortgage-calculated-lvr')).toBe('Calculated LVR · Unknown');
    }
  } finally { act(() => tree.unmount()); }
});

test('property edits debounce and survive remount; external replacement clears every inactive offset field', () => {
  setMortgageComparisonInputs({ loanAmount: '600000', lvr: '71', lvrMode: 'funds', fundsType: 'offset', fundsAvailable: '150000', propertyValue: '' });
  let tree = mount();
  type(tree, 'Property value', '7');
  act(() => jest.advanceTimersByTime(100));
  type(tree, 'Property value', '750000');
  expect(useMortgageComparison.getState().propertyValue).toBe('');
  act(() => tree.unmount());
  expect(useMortgageComparison.getState().propertyValue).toBe('750000');
  tree = mount();
  try {
    expect(input(tree, 'Property value')?.props.value).toBe('750000');
    type(tree, 'Property value', '900000');
    act(() => setMortgageComparisonInputs({ loanAmount: '600000', lvr: '71' }));
    act(() => jest.advanceTimersByTime(500));
    expect(input(tree, 'Property value')).toBeUndefined();
    expect(input(tree, 'LVR')?.props.value).toBe('71');
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '600000', lvr: '71' });
    choose(tree, 'Funds available');
    expect(tab(tree, 'Deposit').props.accessibilityState.selected).toBe(true);
    choose(tree, 'Offset account');
    type(tree, 'Property value', '800000');
    type(tree, 'Offset balance', '100000');
    act(() => tree.root.findByProps({ accessibilityLabel: 'Clear comparison inputs' }).props.onPress());
    act(() => jest.advanceTimersByTime(500));
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '', lvr: '' });
  } finally { act(() => tree.unmount()); }
  expect(useMortgageComparison.getState()).toEqual({ loanAmount: '', lvr: '' });
});

test('offset inputs and type selector retain wrapping accessible controls at large text sizes', () => {
  mockDimensions = { width: 320, height: 800, scale: 3, fontScale: 3 };
  setMortgageComparisonInputs({ loanAmount: '', lvr: '', lvrMode: 'funds', fundsType: 'offset' });
  const tree = mount();
  try {
    expect(tree.root.findAllByType(TextInput).map(node => node.props.accessibilityLabel))
      .toEqual(['Loan amount', 'Offset balance', 'Property value']);
    expect(tree.root.findAllByType(View).filter(node => node.props.style?.flexBasis === 220)).toHaveLength(3);
    for (const label of ['Deposit', 'Offset account']) {
      const control = tab(tree, label), style = StyleSheet.flatten(control.props.style({ pressed: false }));
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    }
    expect(tab(tree, 'Deposit').props.accessibilityState.selected).toBe(false);
    expect(tab(tree, 'Offset account').props.accessibilityState.selected).toBe(true);
  } finally { act(() => tree.unmount()); }
});
