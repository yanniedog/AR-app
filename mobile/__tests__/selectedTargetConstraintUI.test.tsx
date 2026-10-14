import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { normalizeUserRateScenario, type UserRateScenario } from '../src/data/userRateScenario';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { RateCheckWorkspace } from '../src/components/calculation/RateCheckWorkspace';
import { ProjectionWorkspace } from '../src/components/calculation/ProjectionWorkspace';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow, SectionKey } from '../src/types';
type InspectableRenderer = ReactTestRenderer & { root: { findAllByType(type: string): { props: Record<string, unknown> }[] } };

let mockScenario: UserRateScenario;
let mockState: Record<string, any>;
let mockSection: SectionKey = 'Mortgage';
const mockParams: Record<string, string> = {};
const mockSave = jest.fn(async () => true);
jest.mock('expo-router', () => ({ router: { setParams: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../src/data/store', () => ({ useStore: Object.assign((select: (state: typeof mockState) => unknown) => select(mockState), { getState: () => mockState }) }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario,
  storageStatus: 'ready', saveStatus: 'idle', error: null, update: jest.fn(), flush: mockSave, retryLoad: jest.fn() }) }));
jest.mock('../src/hooks/useScenarioSection', () => ({ useScenarioSection: () => [mockSection] }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: (_revision: string, ids: string[]) => ({ ready: true,
  expectedCount: ids.length, terminalCount: ids.length, fallbackCount: 0, onLogoRenderStateChange: jest.fn() }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { bg: '#fff', primary: '#06f',
  border: '#ddd', surfaceAlt: '#eee', text: '#111', textFaint: '#888', warning: '#a60', danger: '#c00', success: '#070' },
  radius: { sm: 4, md: 12 }, font: { body: 16 } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Badge: 'Badge',
  Card: 'Card', Chip: 'Chip', Row: 'Row', Disclosure: 'Disclosure' }));
jest.mock('../src/components/controls', () => ({ CompactToggle: 'CompactToggle', SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/icons/AppIcon', () => 'Icon');
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/feedback', () => ({ IndeterminateProgressBar: 'IndeterminateProgressBar', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/ProfileEditor', () => ({ ProfileEditor: 'ProfileEditor' }));
jest.mock('../src/components/scenario/CurrentBankPicker', () => ({ CurrentBankPicker: 'CurrentBankPicker' }));
jest.mock('../src/components/scenario/SwitchCostEditor', () => ({ SwitchCostEditor: 'SwitchCostEditor' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ productRateChangeText: () => null,
  ProductRateChangeSummaryLine: 'ProductRateChangeSummaryLine' }));
jest.mock('../src/components/projections/LifecycleChart', () => ({ LifecycleChart: 'LifecycleChart' }));
jest.mock('../src/components/scenario/ProjectionSummary', () => ({ ProjectionSummary: 'ProjectionSummary' }));
jest.mock('../src/components/scenario/StaySwitchChart', () => ({ StaySwitchChart: 'StaySwitchChart' }));

const loan: RateRow = { provider: 'Bank', product_key: 'loan', product_name: 'Selected loan', rate_index: 4,
  rate: '0.0579', lvr_tier: 'lvr_=60%', account_class: 'standard', rate_type: 'VARIABLE' };
function prepare(section: SectionKey, rows: RateRow[], clauses: { rateIndex: number; text: string }[], scenario: UserRateScenario, ri: string) {
  const f = selectedConstraintFixture(section, rows, clauses);
  mockSection = section; mockScenario = scenario;
  Object.assign(mockParams, { section, target: rows[0].product_key, ri });
  mockState = { ...f, status: 'ready', error: null, activeSection: section, detailsLoading: false, productHistory: null,
    ensureDetails: jest.fn(async () => undefined), prefs: { profileFilters: EMPTY_PROFILE, includeNonStandard: false,
      depositRankMetric: 'base', mortgageRateMetric: 'comparison' }, setPref: jest.fn() };
  installMandatoryEligibility(selectMandatoryEligibility(f.core, EMPTY_PROFILE, f.details.products));
  return f;
}
const mortgageScenario = (balance = '450000') => normalizeUserRateScenario({ mortgage: {
  mode: 'refi', propertyValue: '500000', loanBalance: balance, currentRate: '8', years: '25' },
  projections: { mortgage: { periodicAmount: '3500' } },
});
function surface(id: string) {
  return jest.mocked(usePerformanceAuditSurface).mock.calls.map(call => call[0]).reverse().find(value => value.id === id)!;
}
function texts(tree: InspectableRenderer): string[] {
  const extract = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value)
    : Array.isArray(value) ? value.map(extract).join('') : '';
  return tree.root.findAllByType('AppText').map(node => extract(node.props.children));
}
beforeEach(() => { jest.clearAllMocks(); Object.keys(mockParams).forEach(key => delete mockParams[key]); });
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('actual rate-check keeps an outside selected mortgage as rate-only, ready identity and no sibling', () => {
  prepare('Mortgage', [loan, { ...loan, rate_index: 5, rate: '0.07', lvr_tier: 'lvr_85-90%' }],
    [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }], mortgageScenario(), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<RateCheckWorkspace />) as InspectableRenderer; });
  const visible = texts(tree);
  expect(visible).toContain('Selected loan'); expect(visible).toContain('Outside published LVR');
  expect(visible).toContain('Rate only'); expect(visible).not.toContain('Lower matched rates');
  expect(visible.some(text => /\$631|\/mo$/.test(text))).toBe(false);
  expect(tree.root.findAllByType('BankAvatar' as never).map(node => node.props.renderStateId)).toEqual(['calculator:loan:4']);
  expect(surface('calculator.results').probes?.find(probe => probe.id === 'calculator.target')?.status).toBe('ready');
  expect(surface('calculator.results').probes?.find(probe => probe.id === 'calculator.candidates')?.actualCount).toBe(1);
  act(() => tree.unmount());
});

test('actual selected worse mortgage retains a negative hypothetical amount instead of swapping sibling', () => {
  prepare('Mortgage', [{ ...loan, rate: '0.09' }, { ...loan, rate_index: 5, rate: '0.05' }],
    [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'LVR up to 59.99%.' }], mortgageScenario('250000'), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<RateCheckWorkspace />) as InspectableRenderer; });
  expect(texts(tree).some(text => text.startsWith('$-') && text.endsWith('/mo'))).toBe(true);
  expect(texts(tree)).toContain('Eligibility unverified'); expect(texts(tree)).not.toContain('Lower matched rates');
  expect(tree.root.findAllByType('BankAvatar' as never).map(node => node.props.renderStateId)).toEqual(['calculator:loan:4']);
  act(() => tree.unmount());
});

test('actual projection suppresses target switch money for outside LVR while current scenario remains usable', () => {
  prepare('Mortgage', [loan], [{ rateIndex: 4, text: 'LVR up to 59.99%.' }], mortgageScenario(), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<ProjectionWorkspace />) as InspectableRenderer; });
  expect(texts(tree)).toContain('Selected loan'); expect(texts(tree)).toContain('Outside published LVR');
  expect(tree.root.findAllByType('StaySwitchChart' as never)).toHaveLength(0);
  expect(tree.root.findAllByType('LifecycleChart' as never)).toHaveLength(1);
  expect(surface('projections.lifecycle-chart').probes?.find(probe => probe.id === 'projections.target')?.status).toBe('ready');
  act(() => tree.unmount());
});

test('actual projection admits ri5 numeric source range despite conflicting normalized core label', () => {
  prepare('Mortgage', [{ ...loan, rate_index: 5 }], [{ rateIndex: 5, text: 'For LVR 60% to 79.99%.' }], mortgageScenario('350000'), '5');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<ProjectionWorkspace />) as InspectableRenderer; });
  expect(texts(tree)).toContain('Eligibility unverified');
  expect(texts(tree).some(text => text.startsWith('Outside '))).toBe(false);
  expect(tree.root.findAllByType('StaySwitchChart' as never)).toHaveLength(1);
  act(() => tree.unmount());
});

test('actual deposit projection does not show whole-balance interest outside selected tier', () => {
  const deposit: RateRow = { provider: 'Bank', product_key: 'saver', product_name: 'Selected saver', rate_index: 7,
    rate: '0.06', account_class: 'standard', ribbon_deposit_kind: 'base', balance_min: '1000', balance_max: '10000' };
  prepare('Savings', [deposit], [{ rateIndex: 7, text: 'Deposit balance from $1000 to $10000.' }],
    normalizeUserRateScenario({ savings: { balance: '50000', currentRate: '3' }, projections: { savings: { horizonYears: '5' } } }), '7');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<ProjectionWorkspace />) as InspectableRenderer; });
  expect(texts(tree)).toContain('Outside published balance'); expect(texts(tree)).toContain('Rate only');
  expect(texts(tree).some(text => /\$1,500 interest difference/.test(text))).toBe(false);
  expect(texts(tree)).toContain('Selected saver');
  act(() => tree.unmount());
});
