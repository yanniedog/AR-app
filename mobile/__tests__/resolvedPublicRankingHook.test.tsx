import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

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
  let tree!: TestRenderer.ReactTestRenderer;
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
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  expect(ready).toBe(true);
  act(() => { tree.unmount(); });
});
