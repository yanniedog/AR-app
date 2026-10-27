import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as preparation from '../src/data/mortgageResultsIndex';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { useMortgageResultsIndex } from '../src/hooks/useMortgageResultsIndex';
import { AS_OF, catalogue, core, programme, row } from '../testUtils/publicRateJourney';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); });
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
