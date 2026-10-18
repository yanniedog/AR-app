import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PublicPricingCoverage } from '../src/components/scenario/PublicPricingCoverage';

const mockLoadAll = jest.fn();
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ manifest: null, prefs: {} }) }));
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => ({
  status: 'error', allLoaded: false, loadAll: mockLoadAll, error: 'Transient network failure', products: [], coverage: [],
}) }));
jest.mock('../src/data/publicRateIntegration', () => ({ resolvedPublicRankingRows: () => ({ priced: 0, unresolved: 0 }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Disclosure: 'Disclosure' }));

it('offers a visible retry after acquisition failure without remounting the screen', async () => {
  let finish!: () => void;
  mockLoadAll.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  type Tree = ReactTestRenderer & { root: { findByProps(props: Record<string, unknown>): { props: { disabled: boolean; onPress(): void } } } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<PublicPricingCoverage section="TD" rows={[]} />) as Tree; });
  const retry = () => tree.root.findByProps({ title: 'Retry' });
  expect(retry().props.disabled).toBe(false);
  act(() => { retry().props.onPress(); });
  expect(mockLoadAll).toHaveBeenCalledTimes(1);
  expect(retry().props.disabled).toBe(true);
  await act(async () => { finish(); await Promise.resolve(); });
  expect(retry().props.disabled).toBe(false);
  act(() => tree.unmount());
});
