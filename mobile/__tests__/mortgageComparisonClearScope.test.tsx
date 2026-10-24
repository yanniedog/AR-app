import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { MortgageComparisonControls } from '../src/components/MortgageComparisonControls';
import { clearMortgageComparison, useMortgageComparison } from '../src/data/mortgageComparison';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, useRatesSession } from '../src/data/ratesSession';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { EMPTY_FILTERS } from '../src/data/selectors';

jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ prefs: { mortgageRateMetric: 'comparison' } }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, font: { body: 14 } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));

test('clearing numerical comparison inputs preserves selected purpose, repayment and provider filters', () => {
  const original = captureRatesSession();
  initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  const filters = { ...EMPTY_FILTERS, providers: ['Bank A'], loanPurposes: ['OO'], repaymentTypes: ['PI'] };
  updateRatesSection('Mortgage', { filters, page: 3 });
  useMortgageComparison.setState({ loanAmount: '500000', lvr: '80' });
  let tree!: ReactTestRenderer & { root: { findByProps: (props: any) => { props: { onPress: () => void } } } };
  act(() => { tree = TestRenderer.create(<MortgageComparisonControls rows={[]} filters={filters} unverified={0} invalid={false} />) as typeof tree; });
  try {
    act(() => tree.root.findByProps({ title: 'Clear comparison inputs' }).props.onPress());
    expect(useMortgageComparison.getState()).toEqual({ loanAmount: '', lvr: '' });
    expect(useRatesSession.getState().sections.Mortgage).toMatchObject({ filters, page: 1, scrollOffset: 0 });
  } finally { act(() => tree.unmount()); restoreRatesSession(original); clearMortgageComparison(); }
});

test('fast typing keeps the latest draft and unmount flushes without committing intermediate keystrokes early', () => {
  jest.useFakeTimers();
  const original = captureRatesSession();
  initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  clearMortgageComparison();
  let tree!: ReactTestRenderer & { root: { findByProps: (props: object) => { props: { onChangeText: (text: string) => void } } } };
  act(() => {
    tree = TestRenderer.create(
      <MortgageComparisonControls rows={[]} filters={EMPTY_FILTERS} unverified={0} invalid={false} />,
    ) as typeof tree;
  });
  try {
    const amount = tree.root.findByProps({ accessibilityLabel: 'Loan amount' });
    act(() => { amount.props.onChangeText('6'); });
    act(() => { amount.props.onChangeText('62'); });
    expect(useMortgageComparison.getState().loanAmount).toBe('');
    act(() => { jest.advanceTimersByTime(200); });
    expect(useMortgageComparison.getState().loanAmount).toBe('62');
    act(() => { amount.props.onChangeText('625'); });
    expect(useMortgageComparison.getState().loanAmount).toBe('62');
    act(() => { tree.unmount(); });
    expect(useMortgageComparison.getState().loanAmount).toBe('625');
  } finally {
    jest.useRealTimers();
    restoreRatesSession(original);
    clearMortgageComparison();
  }
});

test('external store clear discards a pending typed draft instead of restoring it', () => {
  jest.useFakeTimers();
  const original = captureRatesSession();
  initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  clearMortgageComparison();
  let tree!: ReactTestRenderer & { root: { findByProps: (props: object) => { props: { onChangeText: (text: string) => void; value?: string } } } };
  act(() => {
    tree = TestRenderer.create(
      <MortgageComparisonControls rows={[]} filters={EMPTY_FILTERS} unverified={0} invalid={false} />,
    ) as typeof tree;
  });
  try {
    const amount = tree.root.findByProps({ accessibilityLabel: 'Loan amount' });
    act(() => { amount.props.onChangeText('625000'); });
    act(() => { clearMortgageComparison(); });
    act(() => { jest.advanceTimersByTime(200); });
    expect(useMortgageComparison.getState().loanAmount).toBe('');
    expect(tree.root.findByProps({ accessibilityLabel: 'Loan amount' }).props.value ?? '').toBe('');
  } finally {
    act(() => { tree.unmount(); });
    jest.useRealTimers();
    restoreRatesSession(original);
    clearMortgageComparison();
  }
});
