import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FlashList } from '@shopify/flash-list';
import { TextInput } from 'react-native';

import RatesWorkspace from '../src/components/rates/RatesWorkspace';
import { SearchBar } from '../src/components/controls';
import { PressFeedback } from '../src/components/PressFeedback';
import { captureRatesSession, initializeRatesSession, recordRatesScroll, restoreRatesSession, updateRatesSection, useRatesSession } from '../src/data/ratesSession';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { rateConditionFixture } from '../testUtils/rateConditions';

// Exercise RN's actual JS event/controlled-value boundary, not the preset's
// TextInput mock. The Android host and geometry remain Jest native stubs;
// this regression does not establish keyboard/ADB delivery on a device.
jest.unmock('react-native/Libraries/Components/TextInput/TextInput');
jest.mock('react-native/Libraries/Utilities/Platform', () =>
  jest.requireActual('react-native/Libraries/Utilities/Platform.android'));

let mockState: Record<string, unknown>;
const mockNavigation = {
  isReady: () => true,
  isFocused: () => true,
  addListener: () => () => undefined,
};
const mockParams = {};
jest.mock('../src/data/store', () => ({
  useStore: Object.assign((selector: (state: unknown) => unknown) => selector(mockState), { getState: () => mockState }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() }, Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => mockParams, useNavigationContainerRef: () => mockNavigation,
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => mockNavigation }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/lib/yieldToUi', () => ({ scheduleAfterInteractions: () => () => undefined }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: () => undefined }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true }) }));
jest.mock('../src/hooks/useSearchFilterOptions', () => ({ useSearchFilterOptions: () => ({ ready: true, options: {} }) }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'AppIcon' }));
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/ToolbarIconButton', () => ({ ToolbarIconButton: 'ToolbarIconButton' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', LoadingRows: 'LoadingRows', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row', androidRipple: () => undefined }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: 'SheetSurface' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));

// Match FlashList's own unit-test geometry boundary. Its header renderer,
// scroll container and React reconciliation are the installed implementation.
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 411, height: 914 })),
  measureFirstChildLayout: () => ({ x: 0, y: 0, width: 411, height: 914 }),
  measureItemLayout: () => ({ x: 0, y: 0, width: 411, height: 100 }),
}));

type Node = {
  type: unknown;
  props: Record<string, any>;
  findByType(type: unknown): Node;
  findAllByType(type: unknown): Node[];
  findByProps(props: Record<string, unknown>): Node;
};
type Renderer = ReactTestRenderer & { root: Node };
const originalSession = captureRatesSession();
const progressive = ['U', 'Un', 'Unl', 'Unlo', 'Unloa'];

beforeEach(() => {
  jest.useFakeTimers();
  restoreRatesSession(originalSession);
  initializeRatesSession(DEFAULT_PREFS, 'TD');
  setSuitabilityAllowed(null);
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
  mockState = {
    ...rateConditionFixture(), prefs: { ...DEFAULT_PREFS, enableDeepSearch: false, includeNonStandard: true },
    subscriptions: [], hydrated: true, activeSection: 'TD', setActiveSection: jest.fn(),
    detailsLoading: false, ensureDetails: jest.fn(async () => undefined), searchIndexStatus: 'idle',
  };
});
afterEach(() => {
  restoreRatesSession(originalSession);
  setSuitabilityAllowed(null);
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
  jest.clearAllTimers();
  jest.useRealTimers();
});

function mount(): Renderer {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<RatesWorkspace />) as Renderer; });
  expect(jest.requireMock('@shopify/flash-list/dist/recyclerview/utils/measureLayout').measureParentSize).toHaveBeenCalled();
  return tree;
}
function nativeInput(tree: Renderer): Node {
  return tree.root.findByType(TextInput).findByType('AndroidTextInput');
}
function sendChange(tree: Renderer, text: string, eventCount: number): void {
  nativeInput(tree).props.onChange({ nativeEvent: { text, eventCount, target: 1 } });
}
function clearActions(tree: Renderer): Node[] {
  return tree.root.findAllByType(PressFeedback).filter(node => node.props.accessibilityLabel === 'Clear search');
}
function expectInput(tree: Renderer, input: Node, native: Node, query: string): void {
  expect(tree.root.findByType(TextInput)).toBe(input);
  expect(nativeInput(tree)).toBe(native);
  expect(input.props.value).toBe(query);
  expect(native.props.text).toBe(query);
  expect(useRatesSession.getState().sections.TD.query).toBe(query);
}

test.each(['batched', 'paced'] as const)('%s native changes retain the entire query through result updates and Clear mounting', delivery => {
  const tree = mount();
  try {
    const input = tree.root.findByType(TextInput);
    const native = nativeInput(tree);
    const search = tree.root.findByType(SearchBar);
    const list = tree.root.findByType(FlashList);
    const initialRows = list.props.data.length;
    expect(initialRows).toBeGreaterThan(0);
    expect(clearActions(tree)).toHaveLength(0);
    act(() => native.props.onFocus({ nativeEvent: { target: 1 } }));
    const focusedInput = TextInput.State.currentlyFocusedInput();
    expect(focusedInput).not.toBeNull();
    const deliver = (text: string, index: number) => {
      sendChange(tree, text, index + 1);
      // Native events are whole-value edits; production must consume every
      // event immediately even if React commits only once at the batch end.
      expect(useRatesSession.getState().sections.TD.query).toBe(text);
    };
    if (delivery === 'batched') {
      act(() => progressive.forEach(deliver));
    } else {
      progressive.forEach((text, index) => {
        act(() => deliver(text, index));
        expectInput(tree, input, native, text);
        expect(clearActions(tree)).toHaveLength(1);
        expect(tree.root.findByType(SearchBar)).toBe(search);
        expect(tree.root.findByType(FlashList)).toBe(list);
        expect(TextInput.State.currentlyFocusedInput()).toBe(focusedInput);
        // Let both intermediate and final result revisions commit.
        act(() => jest.advanceTimersByTime(160));
        expectInput(tree, input, native, text);
      });
    }
    expectInput(tree, input, native, 'Unloa');
    expect(clearActions(tree)).toHaveLength(1);
    expect(tree.root.findByType(SearchBar)).toBe(search);
    expect(tree.root.findByType(FlashList)).toBe(list);
    expect(native.props.mostRecentEventCount).toBe(progressive.length);
    expect(TextInput.State.currentlyFocusedInput()).toBe(focusedInput);
    act(() => jest.advanceTimersByTime(160));
    expect(list.props.data).toHaveLength(0);
    expectInput(tree, input, native, 'Unloa');
  } finally { act(() => tree.unmount()); }
});

test('ordinary filter, sort and scroll changes preserve the live input; Clear resets it without remounting', () => {
  const tree = mount();
  try {
    const input = tree.root.findByType(TextInput);
    const native = nativeInput(tree);
    const list = tree.root.findByType(FlashList);
    expect(input.props.placeholder).toBe('Search');
    expect(input.props.accessibilityLabel).toBe('Search rates or banks');
    act(() => sendChange(tree, 'Unloa', 1));
    expectInput(tree, input, native, 'Unloa');
    act(() => tree.root.findByProps({ word: 'Filter' }).props.onPress());
    const sheet = tree.root.findByType('FilterSheet');
    act(() => sheet.props.onDraftChange({ ...sheet.props.controlledDraft, providers: ['Macquarie'] }));
    act(() => sheet.props.onApply(sheet.props.controlledDraft));
    expect(useRatesSession.getState().sections.TD.filters.providers).toEqual(['Macquarie']);
    expectInput(tree, input, native, 'Unloa');
    act(() => list.findByProps({ word: 'Bank' }).props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('bank');
    act(() => recordRatesScroll('TD', 240));
    act(() => updateRatesSection('TD', current => ({ filters: { ...current.filters, providers: [] } })));
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(240);
    act(() => jest.advanceTimersByTime(160));
    expectInput(tree, input, native, 'Unloa');
    expect(tree.root.findByType(FlashList)).toBe(list);
    act(() => clearActions(tree)[0].props.onPress());
    expectInput(tree, input, native, '');
    expect(clearActions(tree)).toHaveLength(0);
    act(() => sendChange(tree, 'Unloa', 2));
    expectInput(tree, input, native, 'Unloa');
    expect(clearActions(tree)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});
