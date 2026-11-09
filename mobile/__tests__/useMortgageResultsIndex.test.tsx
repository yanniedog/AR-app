import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as preparation from '../src/data/mortgageResultsIndex';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { clearReusableMortgageIndexes, useMortgageResultsIndex } from '../src/hooks/useMortgageResultsIndex';
import { AS_OF, catalogue, core, programme, row } from '../testUtils/publicRateJourney';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';

beforeEach(() => { clearReusableMortgageIndexes(); jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); });
afterEach(() => jest.useRealTimers());
test.each(['expiry', 'rollback'])('%s observed before timer delivery rebuilds instead of stranding ready state', async kind => {
  const source = [row], view = catalogue([programme({ effectiveTo: '2026-10-14T03:01:00Z' })]);
  const context = { core: core(), details: null, manifest: null, coreIntegrity: null };
  let result!: ReturnType<typeof useMortgageResultsIndex>;
  const statuses: string[] = [];
  function Probe({ revision: _revision }: { revision: number }) { result = useMortgageResultsIndex(source, view, context, false, 0, true); statuses.push(result.status); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe revision={0} />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  expect(result.status).toBe('ready');
  const oldIndex = result.index;
  jest.setSystemTime(new Date(kind === 'expiry' ? oldIndex!.until + 1 : oldIndex!.from - 1000));
  const observed = statuses.length;
  act(() => { tree.update(<Probe revision={1} />); });
  expect(statuses.slice(observed)).not.toContain('unsupported');
  expect(result.index).toBeNull(); expect(result.status).toBe('preparing');
  await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  expect(result.status).not.toBe('preparing');
  if (kind === 'rollback') expect(result.index).not.toBe(oldIndex);
  act(() => tree.unmount());
});


test.each(['mandatory', 'suitability'])('%s revision during preparation rebuilds without a caller revision change', async kind => {
  let release!: () => void;
  const prepare = jest.spyOn(preparation, 'prepareMortgageResultsIndex').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(null); }));
  const source = [row], view = catalogue(), context = { core: core(), details: null, manifest: null, coreIntegrity: null };
  let result!: ReturnType<typeof useMortgageResultsIndex>; const statuses: string[] = [];
  function Probe() { result = useMortgageResultsIndex(source, view, context, false, 0, true); statuses.push(result.status); return null; }
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(100); }); expect(prepare).toHaveBeenCalledTimes(1);
    act(() => { if (kind === 'mandatory') installMandatoryEligibility(selectMandatoryEligibility(core(), null, null)); else setSuitabilityAllowed(new Set([row.product_key])); });
    await act(async () => { release(); await jest.advanceTimersByTimeAsync(100); });
    expect(prepare).toHaveBeenCalledTimes(2); expect(result.status).toBe('ready'); expect(statuses).not.toContain('unsupported');
  } finally { act(() => tree.unmount()); prepare.mockRestore(); setSuitabilityAllowed(null); }
});

test('legacy warm input edits are synchronous and reuse preparation; source replacement immediately revokes old results', async () => {
  const context = selectedConstraintFixture('Mortgage', [{ ...row, lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 }], []);
  const source = context.rows;
  const view = { ...catalogue(), status: 'unavailable' as const, allLoaded: false, products: [], getProgrammes: () => [] };
  const prepare = jest.spyOn(preparation, 'prepareMortgageResultsIndex');
  let result!: ReturnType<typeof useMortgageResultsIndex>, matches: typeof source | null = null;
  function Probe({ amount, lvr, rows = source }: { amount: string; lvr: string; rows?: typeof source }) {
    result = useMortgageResultsIndex(rows, view, context, true, 0, true);
    matches = result.index?.select({ amount, lvr: String(Number(lvr) / 100), purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' },
      { loanAmount: amount, lvr })?.filtered({ ...EMPTY_FILTERS, includeNonStandard: true }, 'rate', 'headline') as typeof source ?? null;
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe amount="650000" lvr="72" />); });
  try {
    expect(matches).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    expect(result.status).toBe('ready'); expect(matches).toEqual(source); expect(prepare).toHaveBeenCalledTimes(1);
    for (const [amount, lvr, count] of [['650001', '72', 1], ['650002', '81', 0], ['900001', '72', 0], ['650000', '72', 1]] as const) {
      act(() => tree.update(<Probe amount={amount} lvr={lvr} />));
      expect(matches).toHaveLength(count); expect(result.status).toBe('ready');
    }
    expect(prepare).toHaveBeenCalledTimes(1);
    const replacement = source.map(value => ({ ...value, rate: '0.03' }));
    act(() => tree.update(<Probe amount="650000" lvr="72" rows={replacement} />));
    expect(matches).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    expect(matches).toEqual(replacement); expect(prepare).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); prepare.mockRestore(); }
});

test('a delayed obsolete legacy preparation cannot replace the new source index', async () => {
  const context = selectedConstraintFixture('Mortgage', [{ ...row, rate: '0.09' }], []);
  const first = context.rows, second = [{ ...row, rate: '0.03' }];
  const view = { ...catalogue(), status: 'unavailable' as const, allLoaded: false, products: [], getProgrammes: () => [] };
  const oldPending = preparation.prepareMortgageResultsIndex({ source: first, catalogue: view, context, includeNonStandard: true, cancelled: () => false });
  await jest.advanceTimersByTimeAsync(100); const old = await oldPending;
  let release!: () => void;
  const prepare = jest.spyOn(preparation, 'prepareMortgageResultsIndex').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(old); }));
  let result!: ReturnType<typeof useMortgageResultsIndex>;
  function Probe({ source }: { source: typeof first }) { result = useMortgageResultsIndex(source, view, context, true, 0, true); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe source={first} />); });
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    act(() => tree.update(<Probe source={second} />));
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    const current = result.index; expect(current).not.toBeNull(); expect(current).not.toBe(old);
    await act(async () => { release(); });
    expect(result.index).toBe(current); expect(prepare).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); prepare.mockRestore(); }
});

test('a remounted Rates surface reuses the completed index synchronously and never reuses an expired one', async () => {
  const context = selectedConstraintFixture('Mortgage', [{ ...row, lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 }], []);
  const source = context.rows;
  const view = { ...catalogue(), status: 'unavailable' as const, allLoaded: false, products: [], getProgrammes: () => [] };
  const prepare = jest.spyOn(preparation, 'prepareMortgageResultsIndex');
  let result!: ReturnType<typeof useMortgageResultsIndex>;
  // A remount rebuilds the caller's context object; only its contents identify the dataset.
  function Probe() { result = useMortgageResultsIndex(source, view, { ...context }, true, 0, true); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    expect(result.status).toBe('ready'); expect(prepare).toHaveBeenCalledTimes(1);
    const first = result.index;
    act(() => tree.unmount());
    act(() => { tree = TestRenderer.create(<Probe />); });
    expect(result.status).toBe('ready'); expect(result.index).toBe(first);
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    expect(prepare).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    if (Number.isFinite(first!.until)) jest.setSystemTime(new Date(first!.until + 1));
    else jest.setSystemTime(new Date(first!.from - 1000));
    act(() => { tree = TestRenderer.create(<Probe />); });
    expect(result.index).toBeNull(); expect(result.status).toBe('preparing');
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    expect(prepare).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); prepare.mockRestore(); }
});
