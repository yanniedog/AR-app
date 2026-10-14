import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useDetailsCatalogue } from '../src/hooks/useDetailsCatalogue';
import { rateConditionFixture } from '../testUtils/rateConditions';
import { verifiedCatalogueDetails, detailsOnlyCatalogue } from '../src/data/detailsCatalogue';
function Catalogue() { const result = useDetailsCatalogue(); return React.createElement('CatalogueState', result); }
let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Stack: { Screen: 'StackScreen' } }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button' }));
test('requires exact verified details/core edition and never derives entries from inherited keys', () => {
  const f = rateConditionFixture(); f.details.products.extra = { description: 'Descriptive only' };
  expect(detailsOnlyCatalogue(f.core, f.details).map(item => item.key)).toEqual(['extra']);
  expect(verifiedCatalogueDetails(f.core, f.coreIntegrity, f.manifest, f.details)).toBe(f.details);
  expect(verifiedCatalogueDetails(f.core, f.coreIntegrity, f.manifest, { ...f.details })).toBeNull();
  expect(verifiedCatalogueDetails(f.core, f.coreIntegrity, { ...f.manifest, files: { ...f.manifest.files, details: { ...f.manifest.files.details, sha256: 'e'.repeat(64) } } }, f.details)).toBeNull();
  Object.setPrototypeOf(f.details.products, { inherited: { description: 'not an own product' } });
  expect(detailsOnlyCatalogue(f.core, f.details)).toHaveLength(1);
});
test('catalogue hook verifies the full source without pagination and coalesces requests', async () => {
  const f = rateConditionFixture(); for (let i = 0; i < 60; i++) f.details.products['extra-' + i] = { displayIdentity: { name: 'Name ' + i } };
  mockState = { ...f, detailsLoading: false, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<Catalogue />); });
  expect(tree.root.findByType('CatalogueState').props.details).toBe(f.details);
  expect(detailsOnlyCatalogue(f.core, f.details)).toHaveLength(60);
  await act(async () => tree.update(<Catalogue />)); expect(mockState.ensureDetails).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
test('stale details remain unavailable and retry is explicit and bounded', async () => {
  const f = rateConditionFixture(); mockState = { ...f, details: { ...f.details }, detailsLoading: false, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<Catalogue />); });
  expect(tree.root.findByType('CatalogueState').props.details).toBeNull();
  await act(async () => tree.root.findByType('CatalogueState').props.retry());
  expect(mockState.ensureDetails).toHaveBeenCalledTimes(2);
  expect(mockState.ensureDetails).toHaveBeenLastCalledWith({ forProductView: true, force: true });
  act(() => tree.unmount());
});
