import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import LegacyHome from '../app/(tabs)/index';
import Index from '../app/index';
import Categories from '../app/categories';
import Tools from '../app/(tabs)/tools';
import Changes from '../app/passthrough';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { captureRatesSession, initializeRatesSession, restoreRatesSession, updateRatesSection, useRatesSession } from '../src/data/ratesSession';
import { resolveRatesIntent } from '../src/lib/ratesIntent';

jest.mock('../src/lib/yieldToUi', () => ({
  scheduleAfterInteractions: (work: () => void) => {
    work();
    return () => undefined;
  },
}));

const originalSession = captureRatesSession();
afterEach(() => restoreRatesSession(originalSession));

let mockReady = false;
let mockHydrated = true;
let mockParams: Record<string, string | string[]> = {};
const mockListeners = { ready: new Set<() => void>(), state: new Set<() => void>() };
const mockDismissTo = jest.fn();
const mockPush = jest.fn();
const mockNavigation = {
  isReady: () => mockReady,
  addListener: (event: 'ready' | 'state', listener: () => void) => {
    mockListeners[event].add(listener);
    return () => mockListeners[event].delete(listener);
  },
};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => mockNavigation,
  router: { dismissTo: (...args: unknown[]) => {
    if (!mockReady) throw new Error('Attempted to navigate before mounting the Root Layout');
    mockDismissTo(...args);
  }, push: (...args: unknown[]) => {
    if (!mockReady) throw new Error('Attempted to navigate before mounting the Root Layout');
    mockPush(...args);
  } },
}));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ hydrated: mockHydrated }) }));
const emit = (event: 'ready' | 'state') => [...mockListeners[event]].forEach(listener => listener());
beforeEach(() => {
  mockReady = false; mockHydrated = true; mockParams = {};
  mockListeners.ready.clear(); mockListeners.state.clear(); mockDismissTo.mockClear(); mockPush.mockClear();
});

test('cold legacy Home waits for actual container readiness without an intermediate rerender', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<LegacyHome />); });
  try {
    expect(mockDismissTo).not.toHaveBeenCalled();
    // A root state notification alone does not imply a mounted container.
    act(() => emit('state')); expect(mockDismissTo).not.toHaveBeenCalled();
    act(() => { mockReady = true; emit('ready'); });
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/browse', params: {} });
    act(() => { emit('ready'); emit('state'); tree.update(<LegacyHome />); });
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('root entry requires hydration as well as navigation readiness', () => {
  mockHydrated = false;
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Index />); });
  try {
    act(() => { mockReady = true; emit('ready'); }); expect(mockDismissTo).not.toHaveBeenCalled();
    mockHydrated = true; act(() => tree.update(<Index />));
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('only the latest scoped intent is delivered after readiness arrives', () => {
  mockParams = { section: 'home-loans', path: 'OO.PI', query: 'old' };
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Categories />); });
  try {
    mockParams = { section: ['term-deposits', 'Mortgage'], path: '12M', query: 'Exact % Bank', sub: 'saved' };
    act(() => tree.update(<Categories />));
    expect(mockDismissTo).not.toHaveBeenCalled();
    act(() => { mockReady = true; emit('state'); });
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/browse', params: { scope: 'hierarchy', availability: 'listed', ...mockParams } });
  } finally { act(() => tree.unmount()); }
});

test('an unmounted cold entry cancels its pending redirect and unregisters listeners', () => {
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<LegacyHome />); });
  act(() => tree.unmount());
  expect(mockListeners.ready.size).toBe(0); expect(mockListeners.state.size).toBe(0);
  act(() => { mockReady = true; emit('ready'); emit('state'); });
  expect(mockDismissTo).not.toHaveBeenCalled();
});


test('cold Tools preserves exact calculation parameters and its Rates back destination after ready', () => {
  mockParams = { section: 'Savings', target: 'opaque/% key', ri: ['7', '7'], mode: 'project' };
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Tools />); });
  try {
    expect(mockDismissTo).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
    act(() => { mockReady = true; emit('ready'); });
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/browse');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/calculator', params: mockParams });
    expect(mockDismissTo.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]);
    act(() => emit('state')); expect(mockPush).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test.each([undefined, '2026-09-01'])('cold changes route date=%s waits and retains section/date parameters', date => {
  mockParams = { section: ['TD', 'Savings'], ...(date ? { date } : {}) };
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Changes />); });
  try {
    expect(mockDismissTo).not.toHaveBeenCalled();
    act(() => { mockReady = true; emit('ready'); });
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: date ? '/rba-response' : '/(tabs)/market', params: mockParams });
    act(() => emit('state')); expect(mockDismissTo).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});


test('Strict Mode effect replay cannot duplicate an already-ready Tools handoff', () => {
  mockReady = true; mockParams = { section: 'TD', target: 'exact', ri: '8' };
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<React.StrictMode><Tools /></React.StrictMode>); });
  try {
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('Strict Mode async schedule still delivers Tools handoff after cancelled first setup', () => {
  const pending: Array<() => void> = [];
  const scheduleMock = jest.requireMock('../src/lib/yieldToUi') as {
    scheduleAfterInteractions: (work: () => void) => () => void;
  };
  const previous = scheduleMock.scheduleAfterInteractions;
  scheduleMock.scheduleAfterInteractions = (work: () => void) => {
    pending.push(work);
    return () => {
      const index = pending.indexOf(work);
      if (index >= 0) pending.splice(index, 1);
    };
  };
  mockReady = true; mockParams = { section: 'TD', target: 'exact', ri: '8' };
  let tree!: ReactTestRenderer;
  try {
    act(() => { tree = TestRenderer.create(<React.StrictMode><Tools /></React.StrictMode>); });
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(pending.length).toBeGreaterThan(0);
    act(() => { pending.splice(0).forEach((work) => work()); });
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  } finally {
    scheduleMock.scheduleAfterInteractions = previous;
    act(() => tree.unmount());
  }
});


test('legacy categories restores listed hierarchy after an unlisted catalogue session', () => {
  initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  updateRatesSection('Mortgage', { availability: 'unlisted', query: 'retained', sort: 'bank', scrollOffset: 700 });
  mockParams = { section: 'home-loans', path: 'OO.PI' }; mockReady = true;
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Categories/>); });
  try {
    const delivered = mockDismissTo.mock.calls[0][0];
    expect(delivered).toEqual({ pathname: '/(tabs)/browse', params: { scope: 'hierarchy', availability: 'listed', ...mockParams } });
    const intent = resolveRatesIntent(delivered.params, useRatesSession.getState().section, []);
    updateRatesSection(intent.section, intent.patch, true);
    expect(useRatesSession.getState().sections.Mortgage).toMatchObject({ availability: 'listed', path: ['OO','PI'], hierarchyScoped: true, query: 'retained', sort: 'bank', scrollOffset: 0 });
  } finally { act(() => tree.unmount()); }
});

test('an explicit legacy availability parameter still overrides the default', () => {
  mockParams = { section: 'Savings', availability: 'unlisted', query: 'explicit' }; mockReady = true;
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<Categories/>); });
  try { expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/browse', params: { path: '', scope: 'hierarchy', ...mockParams } }); } finally { act(() => tree.unmount()); }
});
