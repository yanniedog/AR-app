import { cachedBankRateHistoryScope, prepareBankRateHistoryScope, type BankRateHistoryScopeInput } from '../src/data/bankRateHistoryScope';
import { visibleAccountRows } from '../src/data/format';
import { EMPTY_PROFILE, profileFilterRows } from '../src/data/profile';
import { getMandatoryEligibilityRevision, installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import type { CorePayload, RateRow } from '../src/types';

function input(): BankRateHistoryScopeInput {
  const rates: RateRow[] = Array.from({ length: 1200 }, (_, index) => ({ provider: 'A', product_key: `p-${index}`,
    product_name: `Loan ${index}`, rate: '0.05', rate_type: index % 2 ? 'FIXED' : 'VARIABLE' }));
  const core = { run_date: '2026-10-13', sections: { Mortgage: { rates }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
  installMandatoryEligibility(selectMandatoryEligibility(core, EMPTY_PROFILE, null));
  return { core, details: null, includeNonStandard: true, interests: ['Mortgage', 'Savings', 'TD'],
    profileFilters: { ...EMPTY_PROFILE, rateTypes: ['VARIABLE'] }, suitabilityRevision: 1,
    mandatoryRevision: getMandatoryEligibilityRevision() };
}
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('large scope misses yield before work and concurrent screens share exact ordered eligibility', async () => {
  const request = input(), yieldControl = jest.fn(async () => undefined);
  expect(cachedBankRateHistoryScope(request)).toBeNull();
  const first = prepareBankRateHistoryScope(request, yieldControl);
  const second = prepareBankRateHistoryScope({ ...request }, yieldControl);
  expect(first).toBe(second);
  expect(yieldControl).toHaveBeenCalledTimes(1);
  const result = await first;
  expect(result!.rows.Mortgage).toEqual(profileFilterRows(visibleAccountRows(request.core.sections.Mortgage.rates,
    request.includeNonStandard, request.details), request.profileFilters, 'Mortgage', request.details));
  expect(result!.rows.Mortgage).toHaveLength(600);
  expect(cachedBankRateHistoryScope(request)).toBe(result);
});

test('a same-day new core supersedes paused work without caching its stale rows', async () => {
  const previous = input();
  let resume!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  const oldWork = prepareBankRateHistoryScope(previous, () => paused);
  const next = { ...previous, core: { ...previous.core, sections: { ...previous.core.sections,
    Mortgage: { ...previous.core.sections.Mortgage, rates: previous.core.sections.Mortgage.rates.map(row => ({ ...row, rate: '0.07' })) },
  } } };
  expect(cachedBankRateHistoryScope(next)).toBeNull();
  const nextWork = prepareBankRateHistoryScope(next, async () => undefined);
  resume();
  expect(await oldWork).toBeNull();
  const result = await nextWork;
  expect(result!.rows.Mortgage.every(row => row.rate === '0.07')).toBe(true);
  expect(cachedBankRateHistoryScope(next)).toBe(result);
  expect(cachedBankRateHistoryScope(previous)).toBeNull();
});

test('an uncommitted different render lookup cannot cancel mounted scope preparation', async () => {
  const current = input();
  let resume!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  const work = prepareBankRateHistoryScope(current, () => paused);
  const speculative = { ...current, includeNonStandard: false };
  expect(cachedBankRateHistoryScope(speculative)).toBeNull();
  resume();
  const result = await work;
  expect(result!.rows.Mortgage).toHaveLength(600);
  expect(cachedBankRateHistoryScope(current)).toBe(result);
});

test('changed mandatory criteria cancel preparation before a mixed gate result is installed', async () => {
  const previous = input();
  let resume!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  const work = prepareBankRateHistoryScope(previous, () => paused);
  installMandatoryEligibility(selectMandatoryEligibility(previous.core, { ...EMPTY_PROFILE, rateTypes: ['FIXED'] }, null));
  resume();
  expect(await work).toBeNull();
  const next = { ...previous, mandatoryRevision: getMandatoryEligibilityRevision(), suitabilityRevision: 2 };
  const result = await prepareBankRateHistoryScope(next, async () => undefined);
  expect(result!.rows.Mortgage).toEqual([]);
  expect(cachedBankRateHistoryScope(next)).toBe(result);
});
