import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Catalogue from '../app/catalogue';
import { rateConditionFixture } from '../testUtils/rateConditions';
import { verifiedCatalogueDetails, detailsOnlyCatalogue } from '../src/data/detailsCatalogue';
import { router } from 'expo-router';
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
test('actual catalogue requests once, paginates25, searches descriptions and opens key-only route', async () => {
  const f = rateConditionFixture(); for (let i = 0; i < 60; i++) f.details.products[`extra-${String(i).padStart(2, '0')}`] = { description: i === 47 ? 'Special description' : 'Published text' };
  mockState = { ...f, detailsLoading: false, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<Catalogue />); });
  const opens = () => tree.root.findAllByType('Button').filter((node: any) => node.props.title.startsWith('Open product'));
  expect(opens()).toHaveLength(25); expect(mockState.ensureDetails).toHaveBeenCalledTimes(1);
  act(() => tree.root.findByProps({ title: 'Next page' }).props.onPress()); expect(opens()).toHaveLength(25);
  act(() => tree.root.findByProps({ label: 'Search products' }).props.onChangeText('Special'));
  expect(opens()).toHaveLength(1); act(() => opens()[0].props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[key]', params: { key: 'extra-47' } }); expect(mockState.ensureDetails).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
test('failed or stale details stay unavailable with explicit bounded retry', async () => {
  const f = rateConditionFixture(); mockState = { ...f, details: { ...f.details }, detailsLoading: false, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<Catalogue />); });
  expect(JSON.stringify(tree.toJSON())).toContain('could not be verified');
  await act(async () => tree.root.findByProps({ title: 'Retry catalogue' }).props.onPress());
  expect(mockState.ensureDetails).toHaveBeenCalledTimes(2);
  expect(mockState.ensureDetails).toHaveBeenLastCalledWith({ forProductView: true, force: true });
  act(() => tree.unmount());
});

test('uses only exact supplied display identity for search and preserves unknown-key fallback', async () => {
  const f = rateConditionFixture();
  f.details.products['opaque-key'] = { displayIdentity: { name: '  Supplied Name  ', provider: 'Recorded Provider', productCategory: 'RESIDENTIAL_MORTGAGES' } };
  f.details.products['fallback-key'] = { displayIdentity: { name: ' ' } };
  const before = JSON.stringify(f.details);
  mockState = { ...f, detailsLoading: false, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<Catalogue />); });
  expect(tree.root.findAllByProps({ title: 'Open product   Supplied Name  ' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ title: 'Open product fallback-key' })).toHaveLength(1);
  act(() => tree.root.findByProps({ label: 'Search products' }).props.onChangeText('Recorded Provider'));
  expect(tree.root.findAllByType('Button').filter((node: any) => node.props.title.startsWith('Open product'))).toHaveLength(1);
  expect(JSON.stringify(f.details)).toBe(before);
});
