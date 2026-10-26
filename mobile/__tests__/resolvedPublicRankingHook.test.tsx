import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { useResolvedPublicRankingRows } from '../src/hooks/useResolvedPublicRankingRows';
import { AS_OF, catalogue, product, programme, row } from '../testUtils/publicRateJourney';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(AS_OF));
  installMandatoryEligibility(selectMandatoryEligibility(null, null, null));
});
afterEach(() => {
  jest.useRealTimers();
});

test('a large public catalogue does not expand during the Rates render', () => {
  const products = Array.from({ length: 60 }, (_, index) => ({
    ...product,
    productId: `p-${index}`,
    productKey: `k-${index}`,
    programmeIds: [`prog-${index}`],
    section: 'Savings' as const,
  }));
  const view = catalogue([], products.map(item => ({ ...item })));
  let ready = true;
  let count = -1;
  function Probe() {
    const result = useResolvedPublicRankingRows({
      sourceRows: [{ ...row, product_key: 'k-0', category: 'TRANS_AND_SAVINGS_ACCOUNTS' }],
      catalogue: view,
      section: 'Savings',
      sectionScenario: {},
      rowScenario: () => ({}),
      focused: true,
      interactive: true,
      revision: 1,
    });
    ready = result.ready;
    count = result.candidates.length;
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  expect(ready).toBe(false);
  expect(count).toBe(0);
  act(() => { tree.unmount(); });
});

test('a small public catalogue still resolves during render', () => {
  const view = catalogue([programme({ section: 'Savings' })], [{ ...product, section: 'Savings' }]);
  let ready = false;
  function Probe() {
    const result = useResolvedPublicRankingRows({
      sourceRows: [{ ...row, category: 'TRANS_AND_SAVINGS_ACCOUNTS' }],
      catalogue: view,
      section: 'Savings',
      sectionScenario: {},
      rowScenario: () => ({}),
      focused: true,
      interactive: true,
      revision: 1,
    });
    ready = result.ready;
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  expect(ready).toBe(true);
  act(() => { tree.unmount(); });
});

test('large pricing converges after repeated renders and interrupted navigation', async () => {
  const products = Array.from({ length: 1200 }, (_, index) => ({ ...product,
    productId: `p-${index}`, productKey: `k-${index}`, programmeIds: [`prog-${index}`], section: 'Savings' as const }));
  const programmes = products.map((item, index) => programme({ productId: item.productId,
    programmeId: `prog-${index}`, offerId: `offer-${index}`, section: 'Savings',
    components: programme().components.map(component => ({ ...component, scopeId: `offer-${index}` })) }));
  const view = catalogue(programmes, products);
  const source = products.map(item => ({ ...row, product_key: item.productKey,
    category: 'TRANS_AND_SAVINGS_ACCOUNTS' }));
  const scenario = {};
  let latest: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe({ focused, revision }: { focused: boolean; revision: number }) {
    latest = useResolvedPublicRankingRows({ sourceRows: source, catalogue: view, section: 'Savings',
      sectionScenario: scenario, rowScenario: () => scenario, focused, interactive: true, revision });
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe focused revision={1} />); });
  expect(latest!.ready).toBe(false);
  act(() => { tree.update(<Probe focused={false} revision={2} />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(latest!.ready).toBe(false);
  act(() => { tree.update(<Probe focused revision={3} />); });
  act(() => { tree.update(<Probe focused revision={4} />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(latest!.ready).toBe(true);
  expect(latest!.candidates).toHaveLength(1200);
  expect(latest!.resolution.rows).toHaveLength(1200);
  expect(latest!.resolution.unresolved).toBe(0);
  const warm = latest!.resolution;
  act(() => { tree.update(<Probe focused revision={4} />); });
  expect(latest!.ready).toBe(true);
  expect(latest!.resolution).toBe(warm);
  act(() => { tree.unmount(); });
}, 30000);


test('an asynchronous pricing error is terminal and retry can produce usable rows', async () => {
  const source = Array.from({ length: 128 }, () => ({ ...row }));
  const view = catalogue(); const scenario = {};
  let fail = true;
  let latest!: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe() {
    latest = useResolvedPublicRankingRows({ candidates: source, catalogue: view, section: 'Mortgage', sectionScenario: scenario,
      rowScenario: () => { if (fail) throw new Error('Pricing test failure'); return scenario; }, focused: true, interactive: true, revision: 1 });
    return null;
  }
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(latest.error).toBe('Pricing test failure');
    expect(latest.ready).toBe(false);
    fail = false; act(() => latest.retry());
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(latest.error).toBeNull(); expect(latest.ready).toBe(true);
    expect(latest.resolution.rows).toHaveLength(128);
  } finally { act(() => tree.unmount()); }
});

test.each(['candidates', 'resolution', 'scope'] as const)('generation replacement while %s is suspended restarts and publishes the current request', async stage => {
  const host = globalThis as typeof globalThis & { nativeRuntimeScheduler?: { unstable_NormalPriority: number; unstable_scheduleCallback: (priority: number, callback: () => null) => unknown } };
  const previous = host.nativeRuntimeScheduler;
  const callbacks: (() => null)[] = [];
  host.nativeRuntimeScheduler = { unstable_NormalPriority: 3, unstable_scheduleCallback: (_priority, callback) => { callbacks.push(callback); return callbacks.length; } };
  const source = Array.from({ length: 128 }, () => ({ ...row })), view = catalogue();
  let latest!: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe({ version }: { version: number }) {
    const book = React.useMemo(() => ({ ...view, generationId: `generation-${version}` }), [version]);
    const inputs = React.useMemo(() => ({ loanAmount: version === 1 ? '500000' : '600000', lvr: '75' }), [version]);
    const scenario = React.useMemo(() => ({ amount: inputs.loanAmount, lvr: '0.75', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' }), [inputs]);
    latest = useResolvedPublicRankingRows({ sourceRows: source, catalogue: book, section: 'Mortgage',
      sectionScenario: scenario, rowScenario: () => scenario, mortgageInputs: inputs, applyMortgageScope: true,
      focused: true, interactive: true, revision: version });
    return null;
  }
  let tree!: ReactTestRenderer;
  try {
    act(() => { tree = TestRenderer.create(<Probe version={1} />); });
    await act(async () => { await jest.advanceTimersByTimeAsync(49); });
    for (let step = 0; latest.work.pricingStage !== stage && step < 20; step++) {
      const resume = callbacks.shift(); expect(resume).toBeDefined();
      await act(async () => { resume!(); });
    }
    expect(latest.work.pricingStage).toBe(stage);
    expect(latest.ready).toBe(false);
    act(() => tree.update(<Probe version={2} />));
    // The old callback remains abandoned. Acknowledgement fallbacks must let
    // the current generation finish without publishing the old request.
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(latest.ready).toBe(true); expect(latest.error).toBeNull();
    expect(latest.work.workerRestarts).toBeGreaterThanOrEqual(1);
    expect(latest.work.pricingRequestRevision).toBe(2);
    expect(latest.mortgageScope.rows.length).toBeGreaterThan(0);
    const published = latest.resolution;
    await act(async () => { callbacks.forEach(resume => resume()); });
    expect(latest.ready).toBe(true); expect(latest.resolution).toBe(published);
  } finally { act(() => tree?.unmount()); if (previous) host.nativeRuntimeScheduler = previous; else delete host.nativeRuntimeScheduler; }
});

test('a same-day freshness boundary invalidates cached section prices on rerender', () => {
  jest.setSystemTime(new Date('2026-10-26T11:59:00Z'));
  const view = catalogue([programme({ freshness: { state: 'current', checkedAt: '2026-10-24T12:00:00Z', lastSuccessAt: '2026-10-24T12:00:00Z', reasonCodes: [] } })]);
  const rows = [row], scenario = {}; let latest!: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe() { latest = useResolvedPublicRankingRows({ sourceRows: rows, catalogue: view, section: 'Mortgage', sectionScenario: scenario, rowScenario: () => scenario, focused: true, revision: 1 }); return null; }
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(latest.resolution.rows).toHaveLength(1);
    jest.setSystemTime(new Date('2026-10-26T12:00:00.001Z'));
    act(() => tree.update(<Probe />));
    expect(latest.resolution.rows).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test.each(['freshness', 'effective-end', 'effective-start'] as const)('idle pricing wakes at the exact %s boundary', async kind => {
  jest.setSystemTime(new Date('2026-10-26T11:59:00Z'));
  const p = programme({ freshness: { state: 'current', checkedAt: kind === 'freshness' ? '2026-10-24T12:00:00Z' : '2026-10-26T11:00:00Z', lastSuccessAt: kind === 'freshness' ? '2026-10-24T12:00:00Z' : '2026-10-26T11:00:00Z', reasonCodes: [] },
    ...(kind === 'effective-end' ? { effectiveTo: '2026-10-26T12:00:00Z' } : kind === 'effective-start' ? { effectiveFrom: '2026-10-26T12:00:00Z' } : {}) });
  const view = catalogue([p]), rows = [row], scenario = {}; let latest!: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe() { latest = useResolvedPublicRankingRows({ sourceRows: rows, catalogue: view, section: 'Mortgage', sectionScenario: scenario, rowScenario: () => scenario, focused: true, revision: 1 }); return null; }
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(latest.resolution.rows).toHaveLength(kind === 'effective-start' ? 0 : 1);
    await act(async () => { await jest.advanceTimersByTimeAsync(61_002); });
    expect(latest.ready).toBe(true);
    expect(latest.resolution.rows).toHaveLength(kind === 'effective-start' ? 1 : 0);
  } finally { act(() => tree.unmount()); }
});

test('a large suspended pricing pass cannot publish stale rows across its freshness boundary', async () => {
  jest.setSystemTime(new Date('2026-10-26T11:59:00Z'));
  const host = globalThis as typeof globalThis & { nativeRuntimeScheduler?: { unstable_NormalPriority: number; unstable_scheduleCallback: (priority: number, callback: () => null) => unknown } };
  const previousScheduler = host.nativeRuntimeScheduler;
  const callbacks: (() => null)[] = [];
  host.nativeRuntimeScheduler = { unstable_NormalPriority: 3, unstable_scheduleCallback: (_priority, callback) => { callbacks.push(callback); return callbacks.length; } };
  const expiry = Date.parse('2026-10-26T12:00:00.001Z');
  const p = programme({ freshness: { state: 'current', checkedAt: '2026-10-24T12:00:00Z', lastSuccessAt: '2026-10-24T12:00:00Z', reasonCodes: [] } });
  const view = catalogue([p]), rows = Array.from({ length: 128 }, () => ({ ...row })), scenario = {};
  const observed: { at: number; ready: boolean; rows: number }[] = []; let latest!: ReturnType<typeof useResolvedPublicRankingRows>;
  function Probe() { latest = useResolvedPublicRankingRows({ candidates: rows, catalogue: view, section: 'Mortgage', sectionScenario: scenario, rowScenario: () => scenario, focused: true, interactive: true, revision: 1 }); observed.push({ at: Date.now(), ready: latest.ready, rows: latest.resolution.rows.length }); return null; }
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Probe />); });
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(49); });
    for (let step = 0; latest.work.pricingStage !== 'resolution' && step < 10; step++) {
      const resume = callbacks.shift(); expect(resume).toBeDefined();
      await act(async () => { resume!(); });
    }
    expect(latest.work.pricingStage).toBe('resolution');
    jest.setSystemTime(new Date(expiry));
    for (let step = 0; step < 20; step++) {
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      if (Date.now() >= expiry && latest.ready) break;
    }
    expect(latest.ready).toBe(true); expect(latest.resolution.rows).toHaveLength(0);
    expect(latest.work.workerRestarts).toBeGreaterThanOrEqual(1);
    expect(observed.filter(value => value.at >= expiry && value.ready).every(value => value.rows === 0)).toBe(true);
  } finally { act(() => tree.unmount()); if (previousScheduler) host.nativeRuntimeScheduler = previousScheduler; else delete host.nativeRuntimeScheduler; }
});
