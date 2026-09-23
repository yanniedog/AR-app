import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BankRatesPanel } from '../src/components/passthrough/BankRatesPanel';
import type { BankRateChartModel } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE } from '../src/data/profile';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import type { CorePayload } from '../src/types';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
type TestNode = { type: unknown; props: { value: string; label: string; gap: boolean; model: BankRateChartModel; onChange: (value: string) => void }; find: (predicate: (node: TestNode) => boolean) => TestNode; findAll: (predicate: (node: TestNode) => boolean) => TestNode[] };
type Renderer = ReactTestRenderer & { root: TestNode };
const core = { run_date: '2026-09-22', sections: {
  Mortgage: { rates: [{ provider: 'Alpha', product_key: 'a', product_name: 'Loan', rate: '0.06', rate_type: 'VARIABLE' }, { provider: 'Beta', product_key: 'b', product_name: 'Fixed', rate: '0.09', rate_type: 'FIXED' }] },
  Savings: { rates: [{ provider: 'Alpha', product_key: 's', product_name: 'Savings', rate: '0.04' }] },
  TD: { rates: [{ provider: 'Term Bank', product_key: 't', product_name: 'Term Deposit', rate: '0.05' }] },
} } as unknown as CorePayload;
core.bank_rate_history = { schema_version: 1, row_tiers: { Mortgage: [0, 1], Savings: [0], TD: [0] }, run_dates: ['2026-08-01', '2026-09-22'], sections: { Mortgage: [[[0, 2, [6]]], [[0, 2, [9]]]], Savings: [[[0, 2, [4]]]], TD: [[[0, 2, [5]]]] } };
for (const section of ['Mortgage', 'Savings', 'TD'] as const) core.sections[section].rates.forEach((row, i) => { row.bank_rate_tier = i; });
const mockState = { core, prefs: { ...DEFAULT_PREFS, includeNonStandard: true }, source: 'remote', rbaCalendar: null,
  ensureDetails: jest.fn(), ensureRbaCalendar: jest.fn(), details: null };
jest.mock('../src/data/store', () => ({ useStore: (selector: (s: typeof mockState) => unknown) => selector(mockState) }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Button: 'Button' }));
jest.mock('../src/components/passthrough/BankRateChart', () => ({ BankRateChart: 'BankRateChart' }));
beforeEach(() => { mockState.prefs = { ...DEFAULT_PREFS, includeNonStandard: true }; installMandatoryEligibility(selectMandatoryEligibility(core, EMPTY_PROFILE, null)); });
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));
test('opens Rates/Mean; all statistics, product sections and secondary Gap are selectable', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankRatesPanel />) as Renderer; });
  const controls = () => tree.root.findAll(n => n.type === ('SegmentedControl' as unknown));
  const chart = () => tree.root.find(n => n.type === ('BankRateChart' as unknown));
  expect(chart().props.model.dates).toEqual(['2026-08-01', '2026-09-22']);
  expect(chart().props.model.lines.every(line => line.points.length === 2)).toBe(true);
  expect(controls()[0].props.value).toBe('rates'); expect(chart().props.label).toBe('Mean');
  for (const statistic of ['min', 'mean', 'median', 'max']) act(() => controls()[2].props.onChange(statistic));
  act(() => controls()[1].props.onChange('TD'));
  expect(chart().props.model.lines[0].provider).toBe('Term Bank');
  act(() => controls()[0].props.onChange('gap'));
  expect(chart().props.gap).toBe(true); expect(chart().props.model.lines[0].points[0].value).toBe(2);
  act(() => tree.unmount());
});
test('profile changes remove excluded banks immediately; missing mandatory feature details fail closed', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankRatesPanel />) as Renderer; });
  mockState.prefs = { ...mockState.prefs, profileFilters: { ...EMPTY_PROFILE, rateTypes: ['VARIABLE'] } };
  act(() => tree.update(<BankRatesPanel />));
  expect(tree.root.find(n => n.type === ('BankRateChart' as unknown)).props.model.lines.map((l: { provider: string }) => l.provider)).toEqual(['Alpha']);
  mockState.prefs = { ...mockState.prefs, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  act(() => tree.update(<BankRatesPanel />));
  expect(tree.root.findAll(n => n.type === ('BankRateChart' as unknown))).toHaveLength(0);
  act(() => tree.unmount());
});
