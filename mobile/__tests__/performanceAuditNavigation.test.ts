import { StackRouter } from '@react-navigation/routers';
import type { NavigationState } from '@react-navigation/native';

import { PerformanceAuditNavigationAnchor } from '../src/lib/performanceAuditNavigation';
import { PerformanceAuditMutationBarrier } from '../src/lib/performanceAuditTiming';

function navigationFixture(wrapped = false) {
  const navigator = StackRouter({ initialRouteName: '(tabs)' });
  const options = {
    routeNames: ['(tabs)', 'settings', 'performance-audit', 'product/[key]', 'bank/[provider]'],
    routeParamList: {}, routeGetIdList: {},
  };
  let state = navigator.getInitialState(options);
  const tabs = { index: 1, routes: [
    { key: 'home', name: 'index' },
    { key: 'rates', name: 'browse', params: { query: 'saved user search' } },
  ] };
  state = { ...state, routes: [{ ...state.routes[0], state: tabs }] };
  const dispatch = (action: Parameters<typeof navigator.getStateForAction>[1]) => {
    const next = navigator.getStateForAction(state, action, options);
    if (!next) throw new Error(`Unhandled navigation action: ${action.type}`);
    state = navigator.getRehydratedState(next, options);
  };
  const push = (name: string, params?: object) => dispatch({ type: 'PUSH', payload: { name, params } });
  push('settings', { retained: 'user preference panel' });
  push('performance-audit');
  const original = state;
  // Expo Router's NavigationContainer owns an internal stack whose active
  // __root route contains the app's Stack (ExpoRoot.Content in SDK 54).
  const containerRouter = StackRouter({ initialRouteName: '__root' });
  let container = containerRouter.getInitialState({
    routeNames: ['__root', '+not-found'], routeParamList: {}, routeGetIdList: {},
  });
  const getRootState = (): NavigationState => wrapped ? {
    ...container, routes: [{ ...container.routes[0], state }, ...container.routes.slice(1)],
  } : state;
  const resetRoot = jest.fn((snapshot: NavigationState) => {
    if (wrapped) container = snapshot as typeof container;
    dispatch({ type: 'RESET', payload: wrapped ? snapshot.routes[0].state : snapshot });
  });
  const navigation = { getRootState, resetRoot };
  const anchor = new PerformanceAuditNavigationAnchor(navigation, '/performance-audit');
  return { anchor, original, tabs, navigation, dispatch, push, state: () => state };
}

describe.each([false, true])('audit navigation with Expo container wrapper=%s', (wrapped) => {
  test('six product/bank scenarios in both passes keep the exact user prefix and at most two added routes', () => {
    const { anchor, original, tabs, navigation, push, dispatch, state } = navigationFixture(wrapped);
    const originalContainer = navigation.getRootState();
    const prefix = original.routes.map(route => route.key);
    const sequence: string[][] = [];
    for (const pass of ['first', 'repeat']) {
      for (let sample = 0; sample < 6; sample += 1) {
        anchor.restore(false);
        expect(anchor.isRestored()).toBe(true);
        push('product/[key]', { key: `${pass}-product-${sample}` });
        push('bank/[provider]', { provider: `${pass}-bank-${sample}` });
        expect(anchor.isRestored()).toBe(false);
        sequence.push(state().routes.map(route => route.name));
        expect(state().routes).toHaveLength(prefix.length + 2);
        expect(state().routes.slice(0, prefix.length).map(route => route.key)).toEqual(prefix);
        expect(state().routes[0].state).toBe(tabs);
        // Genuine in-scenario back still returns to that sample's mounted product.
        const productKey = state().routes.at(-2)!.key;
        dispatch({ type: 'GO_BACK' });
        expect(state().routes.at(-1)?.key).toBe(productKey);
        expect(state().routes.at(-1)?.params).toEqual({ key: `${pass}-product-${sample}` });
      }
      anchor.restore(false);
      expect(state().routes.map(route => route.key)).toEqual(prefix);
      expect(navigation.getRootState()).toEqual(originalContainer);
    }
    expect(sequence).toEqual(Array.from({ length: 12 }, () => [
      '(tabs)', 'settings', 'performance-audit', 'product/[key]', 'bank/[provider]',
    ]));
    // After final restoration the user's Back returns to their original screen.
    dispatch({ type: 'GO_BACK' });
    expect(state().routes.at(-1)).toBe(original.routes[1]);
    expect(state().routes[0].state).toBe(tabs);
  });

  test('restores the original anchor and tab state even after a tab action popped below it', () => {
    const { anchor, original, tabs, dispatch, state } = navigationFixture(wrapped);
    dispatch({ type: 'POP_TO', payload: { name: '(tabs)', params: { screen: 'market' } } });
    expect(state().routes).toHaveLength(1);
    expect(anchor.isRestored()).toBe(false);
    anchor.restore(false);
    expect(state().routes).toEqual(original.routes);
    expect(state().routes[0].params).toBe(original.routes[0].params);
    expect(state().routes[0].state).toBe(tabs);
  });

  test('does not unmount a screen while its tracked action can still mutate state', async () => {
    const { anchor, navigation, push } = navigationFixture(wrapped);
    push('product/[key]', { key: 'pending' });
    const barrier = new PerformanceAuditMutationBarrier();
    let settle!: () => void;
    const pending = barrier.track(new Promise<void>(resolve => { settle = resolve; }));
    expect(() => anchor.restore(barrier.hasPending)).toThrow('mounted action is pending');
    expect(navigation.resetRoot).not.toHaveBeenCalled();
    settle();
    await pending;
    anchor.restore(barrier.hasPending);
    expect(anchor.isRestored()).toBe(true);
  });

  test('refuses stale capture and a reset into a different navigator', () => {
    const { anchor, navigation, dispatch, state } = navigationFixture(wrapped);
    expect(() => new PerformanceAuditNavigationAnchor(navigation, '/settings')).toThrow('not the active');
    dispatch({ type: 'RESET', payload: { ...state(), key: 'new-root' } });
    expect(() => anchor.restore(false)).toThrow('root navigator changed');
    expect(navigation.resetRoot).not.toHaveBeenCalled();
  });

  test('rejects an inactive audit route even with the audit pathname', () => {
    const { navigation, push } = navigationFixture(wrapped);
    push('settings');
    expect(() => new PerformanceAuditNavigationAnchor(navigation, '/performance-audit')).toThrow('not the active');
  });
});

test('rejects an inactive Expo root branch and an unhydrated app stack', () => {
  const { navigation } = navigationFixture(true);
  const origin = navigation.getRootState();
  const getRootState = jest.spyOn(navigation, 'getRootState');
  getRootState.mockReturnValue({ ...origin, index: 1, routes: [
    ...origin.routes, { key: 'not-found', name: '+not-found' },
  ] });
  expect(() => new PerformanceAuditNavigationAnchor(navigation, '/performance-audit')).toThrow('not the active');
  getRootState.mockReturnValue({ ...origin, routes: [{ ...origin.routes[0], state: {
    stale: true, routes: [{ name: 'performance-audit' }],
  } }] });
  expect(() => new PerformanceAuditNavigationAnchor(navigation, '/performance-audit')).toThrow('not the active');
});

test('refuses restoration after the Expo container or nested route configuration changes', () => {
  const { anchor, navigation, state } = navigationFixture(true);
  const origin = navigation.getRootState();
  const getRootState = jest.spyOn(navigation, 'getRootState');
  getRootState.mockReturnValue({ ...origin, key: 'remounted-container' });
  expect(anchor.isRestored()).toBe(false);
  expect(() => anchor.restore(false)).toThrow('root navigator changed');
  getRootState.mockReturnValue({ ...origin, routes: [{ ...origin.routes[0], state: {
    ...state(), routeNames: ['(tabs)', 'settings'],
  } }] });
  expect(() => anchor.restore(false)).toThrow('root navigator changed');
  expect(navigation.resetRoot).not.toHaveBeenCalled();
});
