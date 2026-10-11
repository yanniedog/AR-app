import { StackRouter } from '@react-navigation/routers';

import { navigateToAppDestination, navigateToPrimaryTab } from '../src/lib/primaryNavigation';

const mockNavigate = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
  },
}));
beforeEach(() => {
  mockNavigate.mockClear();
  mockDismissTo.mockClear();
});

it.each(['/', '/browse', '/market', '/watchlist', '/tools', '/(tabs)/tools'])(
  'switches existing tabs directly when already at %s',
  (pathname) => {
    navigateToPrimaryTab('market', pathname);
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/market');
    expect(mockDismissTo).not.toHaveBeenCalled();
  },
);

it.each(['/search', '/product/a', '/settings', '/compare', '/categories', '/unknown'])(
  'returns to the existing tab navigator from %s',
  (pathname) => {
    navigateToPrimaryTab('market', pathname);
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/market');
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

it('uses the same section-return behavior for menu and breadcrumb destinations', () => {
  navigateToAppDestination('/(tabs)/tools', '/projections');
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/tools');
  navigateToAppDestination({ pathname: '/calculator', params: { section: 'Savings' } }, '/tools');
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/calculator', params: { section: 'Savings' } });
});

it('POP_TO preserves the mounted tab navigator and its nested state after a detail journey', () => {
  const navigator = StackRouter({ initialRouteName: '(tabs)' });
  const options = { routeNames: ['(tabs)', 'search'], routeParamList: {}, routeGetIdList: {} };
  const initial = navigator.getInitialState(options);
  const nestedTabs = { index: 1, routes: [{ key: 'home', name: 'index' }, { key: 'rates', name: 'browse', params: { query: 'retained' } }] };
  const existingTabs = { ...initial.routes[0], state: nestedTabs };
  const state = { ...initial, index: 1, routes: [existingTabs, { key: 'search', name: 'search' }] };
  // Expo's dismissTo from a detail route targets the first divergent navigator:
  // the root stack, with `(tabs)` as its route and the chosen tab in params.
  const restored = navigator.getStateForAction(state, {
    type: 'POP_TO', payload: { name: '(tabs)', params: { screen: 'market', params: {} } },
  }, options)!;
  expect(restored.routes).toHaveLength(1);
  expect(restored.routes[0].key).toBe(existingTabs.key);
  expect(restored.routes[0].state).toBe(nestedTabs);
  expect(restored.routes[0].params).toEqual({ screen: 'market', params: {} });
});

it('POP_TO recovers a cold deep link that has no existing tab navigator', () => {
  const navigator = StackRouter({ initialRouteName: 'search' });
  const options = { routeNames: ['(tabs)', 'search'], routeParamList: {}, routeGetIdList: {} };
  const restored = navigator.getStateForAction(navigator.getInitialState(options), {
    type: 'POP_TO', payload: { name: '(tabs)', params: { screen: 'market', params: {} } },
  }, options)!;
  expect(restored.routes).toHaveLength(1);
  expect(restored.routes[0].name).toBe('(tabs)');
});
