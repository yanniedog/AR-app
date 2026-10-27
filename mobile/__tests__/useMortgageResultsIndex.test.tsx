import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
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
  function Probe({ revision: _revision }: { revision: number }) { result = useMortgageResultsIndex(source, view, context, false, 0, true); return null; }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe revision={0} />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  expect(result.status).toBe('ready');
  const oldIndex = result.index;
  jest.setSystemTime(new Date(kind === 'expiry' ? oldIndex!.until + 1 : oldIndex!.from - 1000));
  act(() => { tree.update(<Probe revision={1} />); });
  expect(result.index).toBeNull(); expect(result.status).toBe('preparing');
  await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  expect(result.status).not.toBe('preparing');
  if (kind === 'rollback') expect(result.index).not.toBe(oldIndex);
  act(() => tree.unmount());
});
