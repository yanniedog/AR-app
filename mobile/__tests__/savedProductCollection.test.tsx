import { isProductSubscribed, makeProductSubscription, productSubscriptionId } from '../src/data/subscriptions';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Modal, StyleSheet, TextInput } from 'react-native';
import MyRates from '../app/(tabs)/watchlist';
import { ProductCard } from '../src/components/ProductCard';
import { IconAction } from '../src/components/IconAction';
import { SavedRateActions } from '../src/components/product/SavedRateActions';
import { COMPACT_ROW } from '../src/components/product/compactProductRow';
import { WordBubbleProvider } from '../src/components/WordBubble';
import { makeSavedRateRef } from '../src/data/savedRates';
import { formatRate } from '../src/data/format';
import { makeTrackedRate } from '../src/data/trackedRates';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { ensurePermissions } from '../src/data/notifications';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { openProduct, openCompare } from '../src/lib/nav';
import { useMortgageComparison, clearMortgageComparison } from '../src/data/mortgageComparison';
import { rateConditionFixture } from '../testUtils/rateConditions';

type Node = { props: Record<string, any>; parent: Node | null; children: unknown[];
  findAllByType(type: unknown): Node[]; findByType(type: unknown): Node; findAllByProps(props: Record<string, unknown>): Node[] };
type Tree = ReactTestRenderer & { root: Node };
let mockState: Record<string, any>;
const mockScenario = normalizeUserRateScenario(undefined);
jest.mock('../src/data/store', () => ({ useStore: Object.assign((selector: (state: typeof mockState) => unknown) => selector(mockState),
  { getState: () => mockState }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useScrollToTop: jest.fn() }));
jest.mock('../src/hooks/useNavigationContentReady', () => ({
  useNavigationContentReady: () => true,
}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario, storageStatus: 'ready' }) }));
jest.mock('../src/hooks/useUndoSnackbar', () => ({ useUndoSnackbar: () => ({ snack: null, showUndo: jest.fn(), undo: jest.fn() }) }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: (_revision: string, ids: string[]) => ({ ready: true,
  expectedCount: ids.length, terminalCount: ids.length, fallbackCount: 0, onLogoRenderStateChange: jest.fn() }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Row: 'Row',
  Disclosure: 'Disclosure', SectionHeading: 'SectionHeading', androidRipple: () => undefined }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/Snackbar', () => ({ UndoSnackbar: 'UndoSnackbar' }));
jest.mock('../src/components/SwipeableRow', () => ({ SwipeableRow: 'SwipeableRow' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ useProductRateChangeSummary: () => null, productRateChangeText: () => null }));
jest.mock('../src/data/notifications', () => ({ ensurePermissions: jest.fn(async () => true) }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn(), openCompare: jest.fn(), openBank: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  setSuitabilityAllowed(null);
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
  const fixture = rateConditionFixture();
  const refs = fixture.rows.slice(0, 3).map(row => makeSavedRateRef(row));
  mockState = { ...fixture, status: 'ready', savedRates: refs, trackedRates: refs.map(ref => makeTrackedRate(ref)), subscriptions: [],
    prefs: { profileFilters: EMPTY_PROFILE, includeNonStandard: true, mortgageRateMetric: 'comparison', depositRankMetric: 'base', notificationsEnabled: true },
    detailsLoading: false, ensureDetails: jest.fn(), removeSavedRate: jest.fn(), restoreSavedRate: jest.fn(),
    isRateSaved: () => true, toggleSavedRate: jest.fn(), setActiveSection: jest.fn(),
    isProductSubscribed: jest.fn(() => false), subscribeProduct: jest.fn(), unsubscribeProduct: jest.fn(),
    setPref: jest.fn(), setTrackedRateRelevantDate: jest.fn(async () => undefined) };
  jest.mocked(ensurePermissions).mockResolvedValue(true);
});
afterEach(() => { setSuitabilityAllowed(null); installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() }); });
function mount(child: React.ReactElement): Tree {
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<WordBubbleProvider>{child}</WordBubbleProvider>) as Tree; });
  return tree;
}
function buttons(tree: Tree) { return tree.root.findAllByType('Button'); }
function button(tree: Tree, title: string) { return buttons(tree).find(node => node.props.title === title)!; }
function copy(tree: Tree) { return tree.root.findAllByType('AppText').map(node => String(node.props.children)).join('\n'); }

test('Saved collection contains only adjacent real shared56dp rows with exact Open/selection and financial facts', () => {
  const tree = mount(<MyRates />);
  try {
    const group = tree.root.findAllByProps({ testID: 'saved-product-rows' })[0];
    expect(group.props.style).toBeUndefined();
    const swipeRows = group.findAllByType('SwipeableRow');
    expect(swipeRows).toHaveLength(3);
    swipeRows.forEach(node => {
      expect(React.Children.toArray(node.props.children)).toHaveLength(1);
      expect(node.props.children.type).toBe(ProductCard);
    });
    const rows = group.findAllByProps({ testID: 'compact-product-row' }).filter(node => node.parent?.props.testID !== 'compact-product-row');
    expect(rows).toHaveLength(3);
    rows.forEach(row => expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: COMPACT_ROW.minHeight, paddingVertical: 3, paddingHorizontal: 0 }));
    expect(group.findAllByType('Button')).toHaveLength(0);
    expect(group.findAllByType(IconAction)).toHaveLength(3); // Shared Save only; no second action row.
    expect(copy(tree)).not.toContain('Last updated');
    expect(copy(tree)).not.toContain('Alert me');
    const cards = swipeRows.map(node => node.props.children);
    cards.forEach((card, index) => {
      expect(card.props.row.rate_index).toBe(mockState.savedRates[index].rateIndex);
      act(() => card.props.onPress());
      expect(openProduct).toHaveBeenNthCalledWith(index + 1, card.props.row.product_key, card.props.row.rate_index);
    });
    const labels = rows[0].findAllByProps({ accessibilityRole: 'button' }).map(node => node.props.accessibilityLabel);
    expect(labels.some(label => String(label).includes(cards[0].props.row.product_name)
      && String(label).includes(cards[0].props.row.provider)
      && String(label).includes(formatRate(cards[0].props.row.rate)))).toBe(true);
    const audit = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
    expect(audit.actions).not.toHaveProperty('saved.calculate.open');
    act(() => { audit.actions!['saved.product.open']({ savedId: mockState.savedRates[1].id }); });
    expect(openProduct).toHaveBeenLastCalledWith(cards[1].props.row.product_key, cards[1].props.row.rate_index);
    act(() => tree.root.findByType('SectionHeading').props.action.props.onPress());
    act(() => tree.root.findAllByType('SwipeableRow')[1].props.children.props.onPress());
    expect(tree.root.findAllByType('SwipeableRow')[1].props.children.props.selected).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('Product context retains exact-tier alert management without subscribing its saved sibling', async () => {
  const row = mockState.core.sections.TD.rates[1];
  const tree = mount(<SavedRateActions row={row} section="TD" />);
  try {
    expect(copy(tree)).toContain('Last updated');
    await act(async () => { tree.root.findByType(IconAction).props.onPress(); });
    expect(ensurePermissions).toHaveBeenCalledTimes(1);
    expect(mockState.subscribeProduct).toHaveBeenCalledWith(row.product_key, row.rate_index, row);
    expect(mockState.subscribeProduct).toHaveBeenCalledTimes(1);
    mockState.isProductSubscribed.mockReturnValue(true);
    act(() => tree.update(<WordBubbleProvider><SavedRateActions row={row} section="TD" /></WordBubbleProvider>));
    expect(tree.root.findByType(IconAction).props).toMatchObject({ active: true, accessibilityLabel: 'Disable alerts' });
    await act(async () => { tree.root.findByType(IconAction).props.onPress(); });
    expect(mockState.unsubscribeProduct).toHaveBeenCalledWith(row.product_key, row.rate_index, undefined);
    expect(ensurePermissions).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('saved maturity date edits/clears exact ref, Cancel and native Back preserve stored dates', async () => {
  const row = mockState.core.sections.TD.rates[1], ref = mockState.savedRates[1];
  const tree = mount(<SavedRateActions row={row} section="TD" />);
  try {
    act(() => button(tree, 'Add maturity date').props.onPress());
    act(() => tree.root.findByType(TextInput).props.onChangeText('2027-03-04'));
    await act(async () => { button(tree, 'Save date').props.onPress(); });
    expect(mockState.setTrackedRateRelevantDate).toHaveBeenCalledWith(ref.id, '2027-03-04', 'term-maturity');
    act(() => button(tree, 'Add maturity date').props.onPress());
    act(() => tree.root.findByType(TextInput).props.onChangeText('2027-05-06'));
    act(() => button(tree, 'Remove date').props.onPress());
    await act(async () => { button(tree, 'Save date').props.onPress(); });
    expect(mockState.setTrackedRateRelevantDate).toHaveBeenLastCalledWith(ref.id, null, null);
    act(() => button(tree, 'Add maturity date').props.onPress());
    act(() => button(tree, 'Cancel').props.onPress());
    act(() => button(tree, 'Add maturity date').props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(mockState.setTrackedRateRelevantDate).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});

test('unsaved sibling has no saved controls; permission denial creates no subscription', async () => {
  const row = mockState.core.sections.TD.rates[4];
  const tree = mount(<SavedRateActions row={row} section="TD" />);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    expect(tree.root.findAllByType(IconAction)).toHaveLength(0);
    jest.mocked(ensurePermissions).mockResolvedValue(false);
    const exact = mockState.core.sections.TD.rates[0];
    act(() => tree.update(<WordBubbleProvider><SavedRateActions row={exact} section="TD" /></WordBubbleProvider>));
    await act(async () => { tree.root.findByType(IconAction).props.onPress(); });
    expect(mockState.subscribeProduct).not.toHaveBeenCalled();
    expect(mockState.setPref).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Notifications disabled');
  } finally { act(() => tree.unmount()); alert.mockRestore(); }
});


test('Saved UI/audit comparison opens without a Rates pricing origin while exploratory inputs linger', () => {
  useMortgageComparison.setState({ loanAmount: '600000', lvr: '90' });
  const tree = mount(<MyRates />);
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.map(call => call[0]).filter(value => value.id === 'saved.list').at(-1)!;
  const tokens = mockState.savedRates.slice(0, 2).map((ref: any) => `${ref.rateIndex}#${ref.productKey}`);
  try {
    act(() => { surface().actions!['saved.compare.mode'](); });
    act(() => { surface().actions!['saved.compare.select.0']({ selectionToken: tokens[0] }); });
    act(() => { surface().actions!['saved.compare.select.1']({ selectionToken: tokens[1] }); });
    act(() => { surface().actions!['saved.compare.open'](); });
    expect(openCompare).toHaveBeenCalledWith(tokens);
    expect(useMortgageComparison.getState()).toMatchObject({ loanAmount: '600000', lvr: '90' });
  } finally { act(() => tree.unmount()); clearMortgageComparison(); }
});

test('catalogue-only saved offers retain their own alert state and can unsubscribe without touching siblings', async () => {
  const base = mockState.core.sections.TD.rates[1];
  const sibling = { ...base, rate_index: undefined, exact_alert_eligible: true, public_offer_id: 'offer-a', public_programme_id: 'programme-a' };
  const row = { ...base, rate_index: undefined, exact_alert_eligible: true, public_offer_id: 'offer-b', public_programme_id: 'programme-b' };
  const refs = [makeSavedRateRef(sibling), makeSavedRateRef(row)];
  mockState.savedRates = refs; mockState.trackedRates = refs.map(ref => makeTrackedRate(ref));
  mockState.subscriptions = [makeProductSubscription(sibling, null)];
  mockState.isProductSubscribed.mockImplementation((key: string, index: number | null, offer?: string) =>
    isProductSubscribed(mockState.subscriptions, key, index, offer));
  mockState.subscribeProduct.mockImplementation((_key: string, index: number | null, selected: typeof row) => {
    mockState.subscriptions = [...mockState.subscriptions, makeProductSubscription(selected, index)];
  });
  mockState.unsubscribeProduct.mockImplementation((key: string, index: number | null, offer?: string) => {
    mockState.subscriptions = mockState.subscriptions.filter((sub: { id: string }) => sub.id !== productSubscriptionId(key, index, offer));
  });
  const tree = mount(<SavedRateActions row={row} section="TD" />);
  try {
    expect(tree.root.findByType(IconAction).props.active).toBe(false);
    await act(async () => { tree.root.findByType(IconAction).props.onPress(); });
    expect(mockState.subscribeProduct).toHaveBeenCalledWith(row.product_key, null, row);
    act(() => tree.update(<WordBubbleProvider><SavedRateActions row={row} section="TD" /></WordBubbleProvider>));
    expect(tree.root.findByType(IconAction).props.active).toBe(true);
    await act(async () => { tree.root.findByType(IconAction).props.onPress(); });
    expect(mockState.unsubscribeProduct).toHaveBeenCalledWith(row.product_key, null, 'offer-b');
    expect(mockState.subscriptions.map((sub: { offerId: string }) => sub.offerId)).toEqual(['offer-a']);
    act(() => button(tree, 'Add maturity date').props.onPress());
    act(() => tree.root.findByType(TextInput).props.onChangeText('2027-03-04'));
    await act(async () => { button(tree, 'Save date').props.onPress(); });
    expect(mockState.setTrackedRateRelevantDate).toHaveBeenCalledWith(refs[1].id, '2027-03-04', 'term-maturity');
  } finally { act(() => tree.unmount()); }
});
