import * as Network from 'expo-network';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { DataUnavailableScreen } from '../src/components/DataUnavailableScreen';

const mockState: {
  refreshing: boolean; retrying: boolean; status: string; retryDataLoad: jest.Mock;
  loadFailure: { kind: string; httpStatus: number | null; at: string } | null;
} = { refreshing: false, retrying: false, status: 'error', retryDataLoad: jest.fn(async () => {}), loadFailure: null };
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(), addNetworkStateListener: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { card: '#fff', border: '#ddd', primary: '#000' }, radius: { xl: 12 } }),
}));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen' }));
jest.mock('../src/components/BrandLockup', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button' }));
const mockStartAppUpdate = jest.fn(async () => {});
jest.mock('../src/lib/startAppUpdate', () => ({ startAppUpdate: () => mockStartAppUpdate() }));

const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };
let listener: (state: Network.NetworkState) => void;
let resolveRead: (state: Network.NetworkState) => void;
let rejectRead: (error: Error) => void;
type Renderer = ReactTestRenderer & {
  toJSON: () => unknown;
  root: {
    findByProps: (props: { title: string }) => { props: { disabled: boolean; onPress: () => void } };
    findAllByType: (type: string) => { children: unknown[] }[];
  };
};
let tree: Renderer;
const createScreen = () => TestRenderer.create(<DataUnavailableScreen />) as Renderer;
const remove = jest.fn();
const allText = () => tree.root.findAllByType('AppText')
  .map(node => node.children.join(''));
const connectivityStatus = () => allText().slice(0, 2);

beforeEach(() => {
  jest.clearAllMocks();
  mockState.refreshing = false;
  mockState.retrying = false;
  mockState.loadFailure = null;
  mockState.status = 'error';
  (Network.addNetworkStateListener as jest.Mock).mockImplementation((callback) => {
    listener = callback;
    return { remove };
  });
  (Network.getNetworkStateAsync as jest.Mock).mockImplementation(() => new Promise((resolve, reject) => {
    resolveRead = resolve;
    rejectRead = reject;
  }));
});

afterEach(() => { act(() => tree.unmount()); });

test('connectivity facts follow network events', async () => {
  await act(async () => { tree = createScreen(); });
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Unknown']);
  await act(async () => resolveRead(offline));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Offline']);
  act(() => listener(online));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Online']);
  act(() => listener(offline));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Offline']);
  // Regaining the network is an automatic retry trigger.
  expect(mockState.retryDataLoad).toHaveBeenCalledTimes(1);
  expect(mockState.retryDataLoad).toHaveBeenCalledWith({ automatic: true });
});

test.each(['resolve', 'reject'])('newer network events survive a slow initial read that %ss', async (outcome) => {
  await act(async () => { tree = createScreen(); });
  act(() => listener(online));
  await act(async () => {
    if (outcome === 'resolve') resolveRead(offline);
    else rejectRead(new Error('Connectivity unavailable'));
  });
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Online']);
});

test('listener remains active during retry and is removed on unmount', async () => {
  await act(async () => { tree = createScreen(); });
  mockState.refreshing = true;
  act(() => tree.update(<DataUnavailableScreen />));
  act(() => listener(offline));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Offline']);
  expect(tree.root.findByProps({ title: 'Try again' }).props.disabled).toBe(true);
  expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => resolveRead(online));
  act(() => listener(online));
  expect(tree.toJSON()).toBeNull();
});

test('unreadable initial connectivity retains Unknown rather than an offline assumption or raw error', async () => {
  await act(async () => { tree = createScreen(); });
  await act(async () => rejectRead(new Error('Connectivity unavailable')));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Unknown']);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Connectivity unavailable');
});

test('the explicit recovery action invokes the real store retry', async () => {
  await act(async () => { tree = createScreen(); });
  const retry = tree.root.findByProps({ title: 'Try again' });
  expect(retry.props.disabled).toBe(false);
  await act(async () => retry.props.onPress());
  expect(mockState.retryDataLoad).toHaveBeenCalledTimes(1);
});

test.each([
  [{ kind: 'network', httpStatus: null }, 'Network error'],
  [{ kind: 'timeout', httpStatus: null }, 'Timed out'],
  [{ kind: 'server', httpStatus: 503 }, 'Server error 503'],
  [{ kind: 'pending', httpStatus: null }, 'Publishing pending'],
  [{ kind: 'update', httpStatus: null }, 'App update required'],
])('shows the structured failure status %j', async (failure, label) => {
  mockState.loadFailure = { ...failure, at: '2026-11-19T01:02:03.000Z' };
  await act(async () => { tree = createScreen(); });
  const text = allText();
  expect(text[2]).toBe(label);
  expect(text[3]).toMatch(/^Last attempt: \S/);
  expect(text[3]).not.toContain('Unknown');
});

test('automatic retry backs off and shows the countdown as a fact', async () => {
  jest.useFakeTimers();
  try {
    await act(async () => { tree = createScreen(); });
    await act(async () => resolveRead(online));
    expect(allText()).toContain('Retry 00:02');
    act(() => { jest.advanceTimersByTime(1_000); });
    expect(allText()).toContain('Retry 00:01');
    act(() => { jest.advanceTimersByTime(1_000); });
    expect(mockState.retryDataLoad).toHaveBeenCalledWith({ automatic: true });
    // The attempt settles; the next delay is longer.
    mockState.retrying = true;
    act(() => tree.update(<DataUnavailableScreen />));
    expect(allText().some(line => line.startsWith('Retry'))).toBe(false);
    mockState.retrying = false;
    act(() => tree.update(<DataUnavailableScreen />));
    expect(allText()).toContain('Retry 00:05');
  } finally {
    jest.useRealTimers();
  }
});

test('offline and update-required states do not schedule automatic retries', async () => {
  jest.useFakeTimers();
  try {
    await act(async () => { tree = createScreen(); });
    await act(async () => resolveRead(offline));
    act(() => { jest.advanceTimersByTime(120_000); });
    expect(mockState.retryDataLoad).not.toHaveBeenCalled();
    act(() => tree.unmount());
    mockState.loadFailure = { kind: 'update', httpStatus: null, at: '2026-11-19T01:02:03.000Z' };
    await act(async () => { tree = createScreen(); });
    await act(async () => resolveRead(online));
    act(() => { jest.advanceTimersByTime(120_000); });
    expect(mockState.retryDataLoad).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('update-required offers the update action', async () => {
  mockState.loadFailure = { kind: 'update', httpStatus: null, at: '2026-11-19T01:02:03.000Z' };
  await act(async () => { tree = createScreen(); });
  await act(async () => tree.root.findByProps({ title: 'Update' }).props.onPress());
  expect(mockStartAppUpdate).toHaveBeenCalledTimes(1);
});

test('a recovery attempt shows one busy state', async () => {
  mockState.retrying = true;
  await act(async () => { tree = createScreen(); });
  expect(tree.root.findByProps({ title: 'Try again' }).props.disabled).toBe(true);
});
