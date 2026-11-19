import React from 'react';
import { Animated as RNAnimated, StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { AppTabBar } from '../src/components/AppTabBar';
import { OfflineBanner } from '../src/components/feedbackBanner';
import { RefreshOutcomeSnackbar } from '../src/components/feedbackSnackbar';
import { MortgageComparisonControls } from '../src/components/MortgageComparisonControls';
import { FilterSheet } from '../src/components/FilterSheet';
import { RatesPagination } from '../src/components/RatesPagination';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { EMPTY_SEARCH_FILTER_OPTIONS } from '../src/data/searchFilterOptions';
import { clearMortgageComparison, useMortgageComparison } from '../src/data/mortgageComparison';
import { captureRatesSession, initializeRatesSession, restoreRatesSession, updateRatesSection } from '../src/data/ratesSession';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { useStore } from '../src/data/store';

let mockPathname = '/browse';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  usePathname: () => mockPathname,
}));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/components/IconAction', () => ({ IconAction: 'IconAction' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const R = jest.requireActual('react');
  const fade = { duration: () => undefined };
  return {
    __esModule: true,
    default: { View: 'ReanimatedView' },
    FadeIn: fade,
    FadeOut: fade,
    useSharedValue: (value: unknown) => R.useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: (value: unknown) => value,
  };
});

describe('home-loans-ux improvements', () => {
  const originalSession = captureRatesSession();

  beforeEach(() => {
    mockPathname = '/browse';
    clearMortgageComparison();
    initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
    useStore.setState({
      hydrated: true,
      refreshOutcome: 'success',
      core: {
        run_date: '2026-10-16',
        sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } },
      } as any,
      payloadProgress: null,
      refreshing: false,
      pendingIngestRunDate: null,
      status: 'ready',
    });
  });

  afterEach(() => {
    restoreRatesSession(originalSession);
    clearMortgageComparison();
  });

  test('MortgageComparisonControls starts collapsed when collapsible and expands on Edit', () => {
    let tree: any;
    act(() => {
      tree = TestRenderer.create(
        <MortgageComparisonControls collapsible rows={[]} filters={EMPTY_FILTERS} unverified={0} invalid={false} />,
      );
    });
    try {
      const summary = tree.root.findByProps({ testID: 'mortgage-scenario-summary' });
      expect(summary).toBeTruthy();
      for (const fact of ['Owner occupied', 'Principal & interest', 'LVR ≤80%']) expect(JSON.stringify(tree.toJSON())).toContain(`"${fact}"`);
      const editBtn = tree.root.findByProps({ accessibilityLabel: 'Edit' });
      act(() => editBtn.props.onPress());
      expect(tree.root.findByProps({ testID: 'mortgage-comparison-controls' })).toBeTruthy();
      const hideBtn = tree.root.findByProps({ accessibilityLabel: 'Hide' });
      act(() => hideBtn.props.onPress());
      expect(tree.root.findByProps({ testID: 'mortgage-scenario-summary' })).toBeTruthy();
    } finally {
      act(() => tree.unmount());
    }
  });

  test('MortgageComparisonControls keeps defaults in force when only a loan amount is entered', () => {
    useMortgageComparison.setState({ loanAmount: '500000', lvr: '', lvrMode: 'lvr' });
    let tree: any;
    act(() => {
      tree = TestRenderer.create(
        <MortgageComparisonControls collapsible rows={[]} filters={EMPTY_FILTERS} unverified={0} invalid={false} />,
      );
    });
    try {
      act(() => tree.root.findByProps({ accessibilityLabel: 'Edit' }).props.onPress());
      const text = JSON.stringify(tree.toJSON());
      expect(text).not.toContain('Required');
      expect(text).toContain('"placeholder":"80%"');
    } finally {
      act(() => tree.unmount());
    }
  });

  test('RatesPagination uses a streamlined 3-row layout', () => {
    let tree: any;
    act(() => {
      tree = TestRenderer.create(
        <RatesPagination total={43} page={1} size={20} onPage={jest.fn()} onSize={jest.fn()} />,
      );
    });
    try {
      const json = tree.toJSON() as { children?: unknown[] };
      expect(json.children).toHaveLength(3);
    } finally {
      act(() => tree.unmount());
    }
  });

  test('RefreshOutcomeSnackbar lifts above CompareDock when CompareDock is visible', () => {
    updateRatesSection('Mortgage', { selectMode: true, selected: ['0#a', '1#b'] });
    let tree: any;
    act(() => {
      tree = TestRenderer.create(<RefreshOutcomeSnackbar />);
    });
    try {
      const overlay = tree.root.findByType(RNAnimated.View);
      expect(StyleSheet.flatten(overlay.props.style).bottom).toBe(84);
      act(() => {
        updateRatesSection('Mortgage', { selectMode: false, selected: [] });
      });
      expect(StyleSheet.flatten(tree.root.findByType(RNAnimated.View).props.style).bottom).toBe(8);
    } finally {
      act(() => tree.unmount());
    }
  });

  test('DataHealthBanner uses an overflow-hidden non-overlapping layout container', () => {
    let tree: any;
    act(() => {
      tree = TestRenderer.create(<OfflineBanner source="remote" offline={true} />);
    });
    try {
      const container = tree.root.findByType(View);
      expect(StyleSheet.flatten(container.props.style)).toMatchObject({ overflow: 'hidden', width: '100%' });
    } finally {
      act(() => tree.unmount());
    }
  });

  test('AppTabBar places active primaryMuted pill at zIndex 0 behind LedgerIcon at zIndex 1', () => {
    let tree: any;
    act(() => {
      tree = TestRenderer.create(<AppTabBar />);
    });
    try {
      const pills = tree.root
        .findAllByType(RNAnimated.View)
        .filter((node: any) => StyleSheet.flatten(node.props.style)?.borderRadius != null);
      expect(pills).toHaveLength(3);
      for (const pill of pills) {
        expect(StyleSheet.flatten(pill.props.style).zIndex).toBe(0);
      }
      const iconWrappers = tree.root.findAll(
        (node: any) => node.type === View && StyleSheet.flatten(node.props.style)?.zIndex === 1,
      );
      expect(iconWrappers.length).toBe(3);
    } finally {
      act(() => tree.unmount());
    }
  });

  test('FilterSheet shortens Reset temporary filters to Reset', () => {
    let tree: any;
    act(() => {
      tree = TestRenderer.create(
        <FilterSheet
          visible
          onClose={jest.fn()}
          options={EMPTY_SEARCH_FILTER_OPTIONS}
          filters={EMPTY_FILTERS}
          onApply={jest.fn()}
        />,
      );
    });
    try {
      const json = JSON.stringify(tree.toJSON());
      expect(json).toContain('"Reset"');
      expect(json).not.toContain('Reset temporary filters');
    } finally {
      act(() => tree.unmount());
    }
  });
});
