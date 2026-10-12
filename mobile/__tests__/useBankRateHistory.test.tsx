import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useBankRateHistory } from '../src/hooks/useBankRateHistory';
import { EMPTY_PROFILE } from '../src/data/profile';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { yieldToUi } from '../src/lib/yieldToUi';
import type { CorePayload } from '../src/types';

const mockState = {
  core: null as CorePayload | null,
  bankRateHistoryRevision: 0,
  bankRateHistoryLoading: false,
  prefs: { ...DEFAULT_PREFS, includeNonStandard: true },
  details: null,
  ensureDetails: jest.fn(),
};
let mockSuitabilityRevision = 1;
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState) }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => mockSuitabilityRevision }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => undefined) }));

function makeCore(): CorePayload {
  return { run_date: '2026-09-22', sections: {
    Mortgage: { rates: [{ provider: 'Alpha', product_key: 'loan', product_name: 'Loan', rate: '0.06', rate_type: 'VARIABLE' }] },
    Savings: { rates: [] }, TD: { rates: [] },
  } } as unknown as CorePayload;
}

beforeEach(() => {
  jest.mocked(yieldToUi).mockReset().mockResolvedValue(undefined);
  mockState.ensureDetails.mockReset();
  mockState.core = makeCore();
  mockState.bankRateHistoryRevision = 0;
  mockState.bankRateHistoryLoading = false;
  mockState.prefs = { ...DEFAULT_PREFS, includeNonStandard: true };
  mockSuitabilityRevision = 1;
  installMandatoryEligibility(selectMandatoryEligibility(mockState.core, EMPTY_PROFILE, null));
});
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('disabled consumers do not prepare history or fetch details, and enabled consumers can resume', async () => {
  const core = mockState.core!;
  const previousDate = '2026-09-21';
  const source = { kind: 'retained_legacy_export' as const, banks_sha256: 'a'.repeat(64), bytes: 100 };
  core.bank_rate_history_catalogue = { schema_version: 2, run_dates: [previousDate, core.run_date],
    sources: { [previousDate]: source, [core.run_date]: source }, unavailable_dates: {}, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [{ row: { provider: 'Retired Bank', product_key: 'old', product_name: 'Old loan', rate_type: 'VARIABLE' }, spans: [[0, 1, [5], 0]] }], Savings: [], TD: [] },
  };
  mockState.prefs = { ...mockState.prefs, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  let value!: ReturnType<typeof useBankRateHistory>;
  function Consumer({ enabled }: { enabled: boolean }) { value = useBankRateHistory(enabled); return null; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Consumer enabled={false} />); });
  expect(value.snapshots).toBeNull();
  expect(value.updating).toBe(false);
  expect(value.historyAvailable).toBe(false);
  expect(mockState.ensureDetails).not.toHaveBeenCalled();
  expect(yieldToUi).not.toHaveBeenCalled();
  await act(async () => tree.update(<Consumer enabled />));
  expect(value.snapshots).not.toBeNull();
  expect(value.cataloguePrepared).toBe(true);
  expect(value.historyAvailable).toBe(true);
  expect(mockState.ensureDetails).toHaveBeenCalledTimes(1);
  expect(yieldToUi).toHaveBeenCalled();
  act(() => tree.unmount());
});

test('revision covers same-day core corrections, profile requirements and live eligibility changes', () => {
  let value!: ReturnType<typeof useBankRateHistory>;
  function Consumer() { value = useBankRateHistory(); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Consumer />); });
  const initialRevision = value.revision;
  expect(value.snapshots![mockState.core!.run_date].Mortgage!.Alpha.mean).toBe(6);
  act(() => tree.update(<Consumer />));
  expect(value.revision).toBe(initialRevision);

  mockState.core = makeCore();
  mockState.core.sections.Mortgage.rates[0].rate = '0.07';
  installMandatoryEligibility(selectMandatoryEligibility(mockState.core, EMPTY_PROFILE, null));
  act(() => tree.update(<Consumer />));
  expect(value.revision).not.toBe(initialRevision);
  expect(value.snapshots![mockState.core.run_date].Mortgage!.Alpha.mean).toBeCloseTo(7);
  const correctedRevision = value.revision;

  mockState.prefs = { ...mockState.prefs, profileFilters: { ...EMPTY_PROFILE, rateTypes: ['FIXED'] } };
  act(() => tree.update(<Consumer />));
  expect(value.revision).not.toBe(correctedRevision);
  expect(value.snapshots![mockState.core.run_date].Mortgage).toEqual({});
  const filteredRevision = value.revision;

  mockSuitabilityRevision++;
  act(() => tree.update(<Consumer />));
  expect(value.revision).not.toBe(filteredRevision);
  act(() => tree.unmount());
});

test('startup loading keeps current-only data hidden until the store completes history preparation', () => {
  mockState.bankRateHistoryLoading = true;
  let value!: ReturnType<typeof useBankRateHistory>;
  function Consumer() { value = useBankRateHistory(); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Consumer />); });
  expect(value.snapshots).toBeNull();
  expect(value.updating).toBe(true);
  const previousRevision = value.revision;
  mockState.bankRateHistoryLoading = false;
  mockState.bankRateHistoryRevision++;
  act(() => tree.update(<Consumer />));
  expect(value.updating).toBe(false);
  expect(value.snapshots![mockState.core!.run_date].Mortgage!.Alpha.mean).toBe(6);
  expect(value.revision).not.toBe(previousRevision);
  act(() => tree.unmount());
});

test('product, lender and chart mounts share the exact eligible scope and invalidate live profile changes', () => {
  const values: ReturnType<typeof useBankRateHistory>[] = [];
  function Consumer({ index }: { index: number }) { values[index] = useBankRateHistory(); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<><Consumer index={0} /><Consumer index={1} /><Consumer index={2} /></>); });
  const initial = values[0].scope;
  expect(values[1].scope).toBe(initial);
  expect(values[2].scope).toBe(initial);
  expect(initial.rows.Mortgage).toEqual(mockState.core!.sections.Mortgage.rates);

  // Same-day corrected objects and mandatory-gate revisions must break reuse.
  mockState.core = makeCore();
  mockState.core.sections.Mortgage.rates[0].rate = '0.07';
  mockSuitabilityRevision++;
  act(() => tree.update(<><Consumer index={0} /><Consumer index={1} /></>));
  expect(values[0].scope).not.toBe(initial);
  expect(values[1].scope).toBe(values[0].scope);
  expect(values[0].snapshots![mockState.core.run_date].Mortgage!.Alpha.mean).toBeCloseTo(7);

  mockState.prefs = { ...mockState.prefs, profileFilters: { ...EMPTY_PROFILE, rateTypes: ['FIXED'] } };
  act(() => tree.update(<><Consumer index={0} /><Consumer index={1} /></>));
  expect(values[0].scope.rows.Mortgage).toEqual([]);
  expect(values[1].scope).toBe(values[0].scope);
  act(() => tree.unmount());
});

test('uncached large scope stays blank while preparing and never publishes a cancelled edition', async () => {
  const original = makeCore();
  original.sections.Mortgage.rates = Array.from({ length: 100 }, (_, index) => ({ ...original.sections.Mortgage.rates[0], product_key: `loan-${index}` }));
  mockState.core = original;
  let resume!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  jest.mocked(yieldToUi).mockImplementationOnce(() => paused);
  let value!: ReturnType<typeof useBankRateHistory>;
  function Consumer() { value = useBankRateHistory(); return null; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Consumer />); });
  expect(value.snapshots).toBeNull();
  expect(value.updating).toBe(true);
  const corrected = makeCore();
  corrected.sections.Mortgage.rates[0].rate = '0.07';
  mockState.core = corrected;
  act(() => tree.update(<Consumer />));
  expect(value.snapshots![corrected.run_date].Mortgage!.Alpha.mean).toBeCloseTo(7);
  await act(async () => { resume(); await paused; });
  expect(value.snapshots![corrected.run_date].Mortgage!.Alpha.mean).toBeCloseTo(7);
  act(() => tree.unmount());
});
