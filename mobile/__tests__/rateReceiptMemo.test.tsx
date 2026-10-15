import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import RateReceiptScreen from '../app/rate-receipt';
import { makeHealthyCore } from '../__fixtures__/appHealth';
import * as selectors from '../src/data/selectors';
import * as receipt from '../src/data/rateReceipt';
import { EMPTY_USER_RATE_SCENARIO as mockScenario } from '../src/data/userRateScenario';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import * as Clipboard from 'expo-clipboard';

type TestNode = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => TestNode;
  findByType: (type: string) => TestNode; findAllByType: (type: string) => TestNode[] };
type InspectableRenderer = ReturnType<typeof TestRenderer.create> & { root: TestNode };
let mockRevision = 0;
let mockParams = { key: 'mortgage-1', ri: '0' };
let mockState = { core: makeHealthyCore(), details: null, manifest: null, coreIntegrity: null,
  ensureDetails: jest.fn(async () => undefined) };
jest.mock('expo-router', () => ({ Stack: { Screen: 'StackScreen' }, router: {}, useLocalSearchParams: () => mockParams }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState) }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => mockRevision }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario, storageStatus: 'ready' }) }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/icons/AppIcon', () => 'Icon');
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/product/ProductDetailParts', () => ({ SectionTitle: 'SectionTitle' }));
jest.mock('../src/components/product/RateConditionsDisclosure', () => ({ RateConditionsDisclosure: 'RateConditionsDisclosure' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Disclosure: 'Disclosure', Divider: 'Divider', Row: 'Row' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { primary: 'blue', success: 'green' } }) }));

afterEach(() => {
  jest.restoreAllMocks();
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
});

test('comparable mortgage comparison rates reach the rendered brief and its copied text', () => {
  mockParams = { key: 'mortgage-1', ri: '0' };
  const core = makeHealthyCore();
  const selected = core.sections.Mortgage.rates[0];
  core.sections.Mortgage.rates.push({ ...selected, product_key: 'mortgage-comparable', provider: 'Comparable bank', product_name: 'Comparable home loan', rate: '0.05', comparison_rate: '0.0657', account_class: 'standard', lvr_tier: 'LVR_70_80' });
  mockState = { ...mockState, core };
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<RateReceiptScreen />) as InspectableRenderer; });
  try {
    expect(tree.root.findAllByType('AppText').some(node => node.props.children === 'Comparison rate: 6.57%')).toBe(true);
    act(() => tree.root.findByProps({ title: 'Copy' }).props.onPress());
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(expect.stringContaining('Comparable bank: 5.00% · Comparison rate: 6.57% · Comparable home loan'));
    delete core.sections.Mortgage.rates[1].comparison_rate;
    mockState = { ...mockState, core: { ...core } };
    act(() => tree.update(<RateReceiptScreen />));
    expect(tree.root.findAllByType('AppText').some(node => node.props.children === 'Comparison rate: 6.57%')).toBe(false);
    act(() => tree.root.findByProps({ title: 'Copy' }).props.onPress());
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(expect.not.stringContaining('Comparison rate:'));
  } finally { act(() => tree.unmount()); }
});

test('layout and disclosure commits reuse receipt work, while core, product and eligibility changes invalidate it', () => {
  mockRevision = 0;
  mockParams = { key: 'mortgage-1', ri: '0' };
  mockState = { ...mockState, core: makeHealthyCore() };
  const find = jest.spyOn(selectors, 'findEligibleByKey');
  const buildReceipt = jest.spyOn(receipt, 'buildRateReceipt');
  const buildBrief = jest.spyOn(receipt, 'buildNegotiationBrief');
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<RateReceiptScreen />) as InspectableRenderer; });
  try {
    expect(find).toHaveBeenCalledTimes(1);
    expect(buildReceipt).toHaveBeenCalledTimes(1);
    expect(buildBrief).toHaveBeenCalledTimes(1);
    act(() => tree.root.findByType('ScreenScrollView').props.onLayout());
    act(() => tree.root.findByProps({ title: 'Published evidence' }).props.onToggle());
    act(() => tree.update(<RateReceiptScreen />));
    expect(find).toHaveBeenCalledTimes(1);
    expect(buildReceipt).toHaveBeenCalledTimes(1);
    expect(buildBrief).toHaveBeenCalledTimes(1);

    mockState = { ...mockState, core: { ...mockState.core, run_date: '2026-10-12' } };
    act(() => tree.update(<RateReceiptScreen />));
    expect(buildReceipt).toHaveBeenCalledTimes(2);
    expect(buildBrief).toHaveBeenCalledTimes(2);
    expect(buildReceipt.mock.results[1].value.evidenceDate).toBe('2026-10-12');

    mockParams = { key: 'savings-2', ri: '0' };
    act(() => tree.update(<RateReceiptScreen />));
    expect(buildReceipt).toHaveBeenCalledTimes(3);
    expect(buildBrief).toHaveBeenCalledTimes(3);
    expect(buildReceipt.mock.results[2].value.productKey).toBe('savings-2');

    installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet(), productKeys: new Set() });
    mockRevision++;
    act(() => tree.update(<RateReceiptScreen />));
    expect(find).toHaveBeenCalledTimes(4);
    expect(tree.root.findByProps({ title: 'Exact rate no longer available' })).toBeDefined();
    expect(buildBrief).toHaveBeenCalledTimes(3);
  } finally { act(() => tree.unmount()); }
});
