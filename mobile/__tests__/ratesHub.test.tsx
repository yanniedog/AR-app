import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Rates from '../app/(tabs)/browse';
import RatesWorkspace from '../src/components/rates/RatesWorkspace';
import Search from '../app/search';
import Categories from '../app/categories';
import Catalogue from '../app/catalogue';
import Onboarding from '../app/onboarding';
import Tools from '../app/(tabs)/tools';
let mockParams: Record<string, string | string[]> = {};
const mockDismissTo = jest.fn();
const mockPush = jest.fn();
const mockNavigation = { isReady: () => true, addListener: () => () => undefined };
jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterInteractions: (work: () => void) => {
    work();
    return () => undefined;
  },
}));
jest.mock('../src/components/rates/RatesWorkspace', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ router: { dismissTo: (...args: unknown[]) => mockDismissTo(...args), push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockParams, useNavigationContainerRef: () => mockNavigation, Redirect: 'Redirect' }));
beforeEach(() => { mockParams = {}; mockDismissTo.mockClear(); mockPush.mockClear(); });
it('Rates mounts the sole full results workspace, without a preview hub', () => expect(Rates).toBe(RatesWorkspace));
it.each([[Search, { query: '', path: '' }], [Categories, { path: '', scope: 'hierarchy', availability: 'listed' }],
  [Catalogue, { availability: 'unlisted', query: '', path: '', scope: '' }], [Onboarding, {}]] as const)(
  'adapts an old entry to the existing canonical navigator, once per parameter identity', (Entry, defaults) => {
    mockParams = { section: ['term-deposits', 'Mortgage'], path: '12M', query: 'Exact % Bank', sub: 'saved' };
    let tree!: ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<Entry />); });
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/browse', params: { ...defaults, ...mockParams } });
    act(() => tree.update(<Entry />)); expect(mockDismissTo).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
it('Tools redirects directly to Calculate preserving entered target and exact tier', () => {
  mockParams = { section: 'Savings', target: 'opaque/% product', ri: ['7', '8'], mode: 'project' };
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Tools />); });
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/browse');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/calculator', params: mockParams });
  expect(mockDismissTo.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]);
  act(() => tree.unmount());
});
