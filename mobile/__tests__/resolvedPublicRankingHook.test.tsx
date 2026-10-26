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
  await act(async () => { await jest.runAllTimersAsync(); });
  expect(latest!.ready).toBe(false);
  act(() => { tree.update(<Probe focused revision={3} />); });
  act(() => { tree.update(<Probe focused revision={4} />); });
  await act(async () => { await jest.runAllTimersAsync(); });
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
    await act(async () => { await jest.runAllTimersAsync(); });
    expect(latest.error).toBe('Pricing test failure');
    expect(latest.ready).toBe(false);
    fail = false; act(() => latest.retry());
    await act(async () => { await jest.runAllTimersAsync(); });
    expect(latest.error).toBeNull(); expect(latest.ready).toBe(true);
    expect(latest.resolution.rows).toHaveLength(128);
  } finally { act(() => tree.unmount()); }
});
