import { StackRouter } from '@react-navigation/routers';
import type { NavigationState } from '@react-navigation/native';

import { PerformanceAuditNavigationAnchor } from '../src/lib/performanceAuditNavigation';
import { PerformanceAuditMutationBarrier } from '../src/lib/performanceAuditTiming';

function navigationFixture() {
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
  const resetRoot = jest.fn((snapshot: NavigationState) => dispatch({ type: 'RESET', payload: snapshot }));
  const navigation = { getRootState: () => state, resetRoot };
  const anchor = new PerformanceAuditNavigationAnchor(navigation, '/performance-audit');
  return { anchor, original, tabs, navigation, dispatch, push, state: () => state };
}

test('six product/bank scenarios in both passes keep the exact user prefix and at most two added routes', () => {
  const { anchor, original, tabs, push, dispatch, state } = navigationFixture();
  const prefix = original.routes.map(route => route.key);
  const sequence: string[][] = [];
  for (const pass of ['first', 'repeat']) {
    for (let sample = 0; sample < 6; sample += 1) {
      anchor.restore(false);
      expect(anchor.isRestored()).toBe(true);
      push('product/[key]', { key: `${pass}-product-${sample}` });
      push('bank/[provider]', { provider: `${pass}-bank-${sample}` });
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
  const { anchor, original, tabs, dispatch, state } = navigationFixture();
  dispatch({ type: 'POP_TO', payload: { name: '(tabs)', params: { screen: 'market' } } });
  expect(state().routes).toHaveLength(1);
  expect(anchor.isRestored()).toBe(false);
  anchor.restore(false);
  expect(state().routes).toEqual(original.routes);
  expect(state().routes[0].params).toBe(original.routes[0].params);
  expect(state().routes[0].state).toBe(tabs);
});

test('does not unmount a screen while its tracked action can still mutate state', async () => {
  const { anchor, navigation, push } = navigationFixture();
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
  const { anchor, navigation, dispatch, state } = navigationFixture();
  expect(() => new PerformanceAuditNavigationAnchor(navigation, '/settings')).toThrow('not the active');
  dispatch({ type: 'RESET', payload: { ...state(), key: 'new-root' } });
  expect(() => anchor.restore(false)).toThrow('root navigator changed');
  expect(navigation.resetRoot).not.toHaveBeenCalled();
});
