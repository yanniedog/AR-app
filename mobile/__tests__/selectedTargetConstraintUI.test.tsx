import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { normalizeUserRateScenario, type UserRateScenario } from '../src/data/userRateScenario';
import { computeLvr } from '../src/data/calc';
import { buildLifecycleProjection } from '../src/data/projections';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { RateCheckWorkspace } from '../src/components/calculation/RateCheckWorkspace';
import { ProjectionWorkspace } from '../src/components/calculation/ProjectionWorkspace';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow, SectionKey } from '../src/types';
type InspectableRenderer = ReactTestRenderer & { root: {
  findAllByType(type: unknown): { props: Record<string, unknown> }[];
  findByProps(props: Record<string, unknown>): { props: Record<string, unknown> };
} };

let mockScenario: UserRateScenario;
let mockState: Record<string, any>;
let mockSection: SectionKey = 'Mortgage';
const mockParams: Record<string, string> = {};
const mockSave = jest.fn(async () => true);
const mockUpdate = jest.fn((update: (current: UserRateScenario) => UserRateScenario) => {
  mockScenario = normalizeUserRateScenario(update(mockScenario));
  return true;
});
jest.mock('expo-router', () => ({ router: { setParams: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../src/data/store', () => ({ useStore: Object.assign((select: (state: typeof mockState) => unknown) => select(mockState), { getState: () => mockState }) }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario,
  storageStatus: 'ready', saveStatus: 'idle', error: null, update: mockUpdate, flush: mockSave, retryLoad: jest.fn() }) }));
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
  expect(texts(tree).some(text => /-\$[\d,.]+\s*\/\s*mo$/.test(text))).toBe(true);
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

test('an exact target requests and awaits verified details with no saved current product', async () => {
  const fixture=prepare('Mortgage',[loan,{...loan,rate_index:5,rate:'0.04',lvr_tier:'lvr_0-90%'}],
    [{rateIndex:4,text:'LVR up to 59.99%.'},{rateIndex:5,text:'LVR up to 90%.'}],mortgageScenario('300000'),'4');
  expect(mockScenario.currentProducts.mortgage.productKey).toBe('');
  mockState.details=null;
  let complete!:()=>void;
  mockState.ensureDetails=jest.fn(()=>new Promise<void>(resolve=>{complete=resolve;}));
  let tree!:InspectableRenderer;
  act(()=>{tree=TestRenderer.create(<RateCheckWorkspace/>) as InspectableRenderer;});
  expect(mockState.ensureDetails).toHaveBeenCalledWith({forProductView:true});
  expect(texts(tree)).toContain('Selected loan');expect(texts(tree)).toContain('Rate only');
  expect(texts(tree).some(value=>/\/\s*mo$/.test(value))).toBe(false);
  expect(surface('calculator.results').probes?.find(probe=>probe.id==='calculator.details')?.status).toBe('pending');
  expect(surface('calculator.results').probes?.find(probe=>probe.id==='calculator.details')?.actualCount).toBe(0);
  mockState.details=fixture.details;
  await act(async()=>{complete();tree.update(<RateCheckWorkspace/>);});
  expect(texts(tree)).toContain('Outside published LVR');
  expect(texts(tree).some(value=>/\/\s*mo$/.test(value))).toBe(false);
  expect(tree.root.findAllByType('BankAvatar' as never).map(node=>node.props.renderStateId)).toEqual(['calculator:loan:4']);
  expect(surface('calculator.results').probes?.find(probe=>probe.id==='calculator.details')?.status).toBe('ready');
  expect(surface('calculator.results').probes?.find(probe=>probe.id==='calculator.target')?.status).toBe('ready');
  act(()=>tree.unmount());
});

test('failed same-publication details admission stays rate-only without a sibling or a ready probe', async()=>{
  prepare('Mortgage',[loan,{...loan,rate_index:5,rate:'0.04'}],[{rateIndex:4,text:'LVR up to 59.99%.'}],mortgageScenario('250000'),'4');
  // A structurally similar copied object has no loader-established details hash binding.
  mockState.details=JSON.parse(JSON.stringify(mockState.details));
  let tree!:InspectableRenderer;
  await act(async()=>{tree=TestRenderer.create(<RateCheckWorkspace/>) as InspectableRenderer;});
  expect(mockState.ensureDetails).toHaveBeenCalledTimes(1);
  expect(texts(tree)).toContain('Sources unverified');
  expect(texts(tree).some(value=>/\/\s*mo$/.test(value))).toBe(false);
  expect(tree.root.findAllByType('BankAvatar' as never).map(node=>node.props.renderStateId)).toEqual(['calculator:loan:4']);
  const probes=surface('calculator.results').probes;
  expect(probes?.find(probe=>probe.id==='calculator.details')?.status).toBe('error');
  expect(probes?.find(probe=>probe.id==='calculator.details')?.actualCount).toBe(0);
  expect(probes?.find(probe=>probe.id==='calculator.candidates')?.status).toBe('error');
  act(()=>tree.unmount());
});

function numericField(tree: InspectableRenderer, label: string) {
  const field = tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label);
  if (!field) throw new Error(`Missing input: ${label}`);
  return field.props;
}

test.each([
  ['Mortgage', 'buy'], ['Mortgage', 'refi'], ['Savings', 'buy'], ['TD', 'buy'],
] as const)('empty %s %s rate-check inputs have no financial example or median hint', (section, mode) => {
  prepare(section, [loan], [], normalizeUserRateScenario({ mortgage: { mode } }), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<RateCheckWorkspace />) as InspectableRenderer; });
  try {
    const fields = tree.root.findAllByType(TextInput);
    expect(fields).toHaveLength(section === 'Mortgage' ? mode === 'buy' ? 5 : 4 : 2);
    for (const field of fields) {
      expect(field.props.value).toBe('');
      expect(field.props.placeholder).toBeUndefined();
      expect(field.props.keyboardType).toBe('numeric');
      expect(field.props.accessibilityLabel).toEqual(expect.any(String));
    }
    expect(texts(tree)).toContain('Inputs incomplete');
    expect(texts(tree)).not.toContain('$520,000');
  } finally { act(() => tree.unmount()); }
});

test('actual entered buying amounts including zero still derive the identical loan and LVR', () => {
  prepare('Mortgage', [loan], [], normalizeUserRateScenario(undefined), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<RateCheckWorkspace />) as InspectableRenderer; });
  try {
    for (const [label, value] of [
      ['Property price in dollars', '650000'], ['Savings available as deposit', '130000'],
      ['Upfront costs paid from savings', '0'], ['Current interest rate percent', '6.00'], ['Years remaining on loan', '25'],
    ]) {
      act(() => { (numericField(tree, label).onChangeText as (value: string) => void)(value); tree.update(<RateCheckWorkspace />); });
      expect(numericField(tree, label).value).toBe(value);
      expect(numericField(tree, label).placeholder).toBeUndefined();
    }
    expect(mockScenario.mortgage).toMatchObject({ propertyValue: '650000', deposit: '130000', costs: '0', currentRate: '6.00', years: '25' });
    expect(computeLvr(mockScenario.mortgage)).toEqual({ loan: 520000, lvr: 80, depositApplied: 130000 });
    expect(texts(tree)).toContain('$520,000');
    expect(texts(tree)).toContain('Scenario LVR: 80.0%');
    act(() => { (numericField(tree, 'Property price in dollars').onChangeText as (value: string) => void)(''); tree.update(<RateCheckWorkspace />); });
    expect(numericField(tree, 'Property price in dollars').value).toBe('');
    expect(texts(tree)).not.toContain('$520,000');
    expect(computeLvr(mockScenario.mortgage).loan).toBeNull();
  } finally { act(() => tree.unmount()); }
});

test.each(['Mortgage', 'Savings', 'TD'] as const)('empty %s projection inputs retain date/automatic contracts without numeric examples', section => {
  prepare(section, [loan], [], normalizeUserRateScenario(undefined), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<ProjectionWorkspace />) as InspectableRenderer; });
  try {
    const toggle = tree.root.findByProps({ accessibilityLabel: 'Show Assumptions' });
    act(() => (toggle.props.onPress as () => void)());
    const fields = tree.root.findAllByType(TextInput);
    expect(fields.length).toBeGreaterThan(6);
    for (const field of fields) {
      if (field.props.accessibilityLabel === 'Starting date') {
        expect(field.props.placeholder).toBe('YYYY-MM-DD');
        expect(field.props.keyboardType).toBe('numbers-and-punctuation');
      } else {
        expect(field.props.placeholder).toBe(['Lower scenario', 'Higher scenario'].includes(String(field.props.accessibilityLabel)) ? 'Automatic' : undefined);
        expect(field.props.keyboardType).toBe('decimal-pad');
      }
      expect(field.props.value).toBe(field.props.accessibilityLabel === 'Rollovers after first maturity' ? '0' : '');
    }
    if (section === 'TD') expect(mockScenario.projections.termDeposit.rollovers).toBe('0');
    expect(tree.root.findAllByType('LifecycleChart')).toHaveLength(0);
    expect(texts(tree)).toContain('Inputs incomplete');
  } finally { act(() => tree.unmount()); }
});

test('entered projection zero and positive amounts still reach the unchanged lifecycle model', () => {
  prepare('Mortgage', [loan], [], mortgageScenario('450000'), '4');
  let tree!: InspectableRenderer; act(() => { tree = TestRenderer.create(<ProjectionWorkspace />) as InspectableRenderer; });
  try {
    for (const [label, value] of [['Current offset balance', '0'], ['Amount added to offset', '99.50']]) {
      act(() => { (numericField(tree, label).onChangeText as (value: string) => void)(value); tree.update(<ProjectionWorkspace />); });
      expect(numericField(tree, label).value).toBe(value);
      expect(numericField(tree, label).placeholder).toBeUndefined();
    }
    const actual = buildLifecycleProjection('Mortgage', mockScenario);
    expect(actual.ready).toBe(true);
    expect(mockScenario.projections.mortgage).toMatchObject({ offsetBalance: '0', offsetContributionAmount: '99.50' });
    expect(tree.root.findAllByType('LifecycleChart')[0].props.series).toEqual(actual.rateSeries);
    expect(numericField(tree, 'Current loan balance').value).toBe('450000');
    expect(numericField(tree, 'Current interest rate').value).toBe('8');
    expect(numericField(tree, 'Years remaining').value).toBe('25');
  } finally { act(() => tree.unmount()); }
});
