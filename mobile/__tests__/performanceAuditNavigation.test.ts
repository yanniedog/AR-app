import { StackRouter, TabRouter } from '@react-navigation/routers';
import type { NavigationState } from '@react-navigation/native';

import { measureAuditBackNavigation, PerformanceAuditNavigationAnchor } from '../src/lib/performanceAuditNavigation';
import { PerformanceAuditMutationBarrier } from '../src/lib/performanceAuditTiming';

function tabBackFixture(destination: 'browse' | 'watchlist' | 'market', initial: 'browse' | 'index' = 'browse') {
  const tabs = TabRouter({ initialRouteName: initial, backBehavior: 'initialRoute' });
  const tabOptions = { routeNames: ['browse', 'watchlist', 'market', 'index'], routeParamList: {}, routeGetIdList: {} };
  let tabState = tabs.getInitialState(tabOptions);
  tabState = tabs.getRehydratedState(tabs.getStateForAction(tabState,
    { type: 'JUMP_TO', payload: { name: destination } }, tabOptions)!, tabOptions);
  const root = StackRouter({ initialRouteName: '(tabs)' });
  const rootOptions = { routeNames: ['(tabs)', 'performance-audit'], routeParamList: {}, routeGetIdList: {} };
  let rootState = root.getInitialState(rootOptions);
  rootState = root.getRehydratedState(root.getStateForAction(rootState,
    { type: 'PUSH', payload: { name: 'performance-audit' } }, rootOptions)!, rootOptions);
  const origin = rootState;
  rootState = root.getRehydratedState(root.getStateForAction(rootState,
    { type: 'PUSH', payload: { name: '(tabs)' } }, rootOptions)!, rootOptions);
  const currentPath = () => rootState.index === origin.index ? '/performance-audit'
    : tabState.routes[tabState.index].name === 'index' ? '/' : `/${tabState.routes[tabState.index].name}`;
  const back = jest.fn(() => {
    const nextTab = tabs.getStateForAction(tabState, { type: 'GO_BACK' }, tabOptions);
    if (nextTab) tabState = tabs.getRehydratedState(nextTab, tabOptions);
    else {
      const nextRoot = root.getStateForAction(rootState, { type: 'GO_BACK' }, rootOptions);
      if (nextRoot) rootState = root.getRehydratedState(nextRoot, rootOptions);
    }
  });
  let clock = 100;
  const recordFirst = jest.fn();
  return { back, recordFirst, currentPath, rootState: () => rootState, origin,
    measure: () => measureAuditBackNavigation({ currentPath, back, recordFirst, tabJourney: true,
      now: () => clock, settle: async () => { clock += 25; },
      matchesPath: (actual, expected) => actual === expected }) };
}

test.each(['watchlist', 'market'] as const)('measures both genuine %s Back transitions through canonical Rates', async destination => {
  const f = tabBackFixture(destination);
  const result = await f.measure();
  expect(f.back).toHaveBeenCalledTimes(2);
  expect(f.recordFirst).toHaveBeenCalledWith({ destination: '/browse', durationMs: 25,
    changedPath: true, returnedToAudit: false });
  expect(result).toMatchObject({ destination: '/performance-audit', durationMs: 50,
    secondBackMs: 25, changedPath: true, returnedToAudit: true,
    first: { destination: '/browse', durationMs: 25, returnedToAudit: false } });
  expect(f.rootState()).toEqual(f.origin);
});

test('retains the measured second Back for the legacy root tab alias', async () => {
  const f = tabBackFixture('market', 'index');
  const result = await f.measure();
  expect(result.first.destination).toBe('/');
  expect(result.secondBackMs).toBe(25);
  expect(result.returnedToAudit).toBe(true);
  expect(f.back).toHaveBeenCalledTimes(2);
});

test('path commit is the measured Back and the following settle is bookkeeping', async () => {
  let clock = 0;
  const paths = ['/browse', '/browse', '/performance-audit'];
  let index = 0;
  const result = await measureAuditBackNavigation({
    currentPath: () => paths[Math.min(index, paths.length - 1)],
    back: () => { index += 1; },
    awaitCommit: async () => { clock += 40; index = 2; },
    settle: async () => { clock += 650; },
    now: () => clock,
    matchesPath: (actual, expected) => actual === expected,
    tabJourney: false,
    recordFirst: () => {},
  });
  expect(result.durationMs).toBe(40);
  expect(result.settleMs).toBe(650);
  expect(result.returnedToAudit).toBe(true);
});

test('Rates returns directly to the saved audit origin with one measured Back', async () => {
  const f = tabBackFixture('browse');
  const result = await f.measure();
  expect(result).toMatchObject({ destination: '/performance-audit', durationMs: 25,
    secondBackMs: null, returnedToAudit: true });
  expect(f.back).toHaveBeenCalledTimes(1);
});

test('a failed second Back remains a failed native return and retains the first transition', async () => {
  let current = '/market', clock = 0;
  const back = jest.fn(() => { current = '/browse'; });
  const result = await measureAuditBackNavigation({ currentPath: () => current, back,
    recordFirst: jest.fn(), tabJourney: true, now: () => clock,
    settle: async () => { clock += 20; }, matchesPath: (actual, expected) => actual === expected });
  expect(result).toMatchObject({ destination: '/browse', returnedToAudit: false,
    durationMs: 40, secondBackMs: 20, first: { destination: '/browse', changedPath: true } });
  expect(back).toHaveBeenCalledTimes(2);
});

test('does not manufacture another Back from an unexpected destination or a stack journey', async () => {
  for (const [destination, tabJourney] of [['/settings', true], ['/browse', false]] as const) {
    let current = '/market', clock = 0;
    const back = jest.fn(() => { current = destination; });
    const result = await measureAuditBackNavigation({ currentPath: () => current, back,
      recordFirst: jest.fn(), tabJourney, now: () => clock, settle: async () => { clock += 20; },
      matchesPath: (actual, expected) => actual === expected });
    expect(result.returnedToAudit).toBe(false);
    expect(result.secondBackMs).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
  }
});

test('preserves first Back and the genuine second dispatch when later settlement fails', async () => {
  let current = '/market', clock = 0, settles = 0;
  const back = jest.fn(() => { current = '/browse'; });
  const recordFirst = jest.fn(), recordSecondStart = jest.fn();
  await expect(measureAuditBackNavigation({ currentPath: () => current, back, recordFirst, recordSecondStart,
    tabJourney: true, now: () => clock, matchesPath: (actual, expected) => actual === expected,
    settle: async () => { clock += 20; if (++settles === 2) throw new Error('Dataset changed'); },
  })).rejects.toThrow('Dataset changed');
  expect(recordFirst).toHaveBeenCalledWith({ destination: '/browse', durationMs: 20,
    changedPath: true, returnedToAudit: false });
  expect(recordSecondStart).toHaveBeenCalledTimes(1);
  expect(back).toHaveBeenCalledTimes(2);
});

test('a no-op first Back cannot become a passing Back contract after a second dispatch', async () => {
  let current = '/browse', clock = 0, calls = 0;
  const result = await measureAuditBackNavigation({ currentPath: () => current,
    back: () => { if (++calls === 2) current = '/performance-audit'; },
    recordFirst: jest.fn(), tabJourney: true, now: () => clock,
    settle: async () => { clock += 20; }, matchesPath: (actual, expected) => actual === expected });
  expect(result.returnedToAudit).toBe(true);
  expect(result.first).toMatchObject({ destination: '/browse', changedPath: false });
  expect(result.changedPath).toBe(false);
  expect(result.secondBackMs).toBe(20);
});

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
