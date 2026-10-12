import * as Network from 'expo-network';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { DataUnavailableScreen } from '../src/components/DataUnavailableScreen';

const mockState = { refreshing: false, status: 'error', retryDataLoad: jest.fn() };
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

const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };
let listener: (state: Network.NetworkState) => void;
let resolveRead: (state: Network.NetworkState) => void;
let rejectRead: (error: Error) => void;
type Renderer = ReactTestRenderer & {
  toJSON: () => unknown;
  root: { findByProps: (props: { title: string }) => { props: { disabled: boolean } } };
};
let tree: Renderer;
const createScreen = () => TestRenderer.create(<DataUnavailableScreen />) as Renderer;
const remove = jest.fn();
const rendered = () => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockState.refreshing = false;
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

test('advice follows network events without requiring a retry', async () => {
  await act(async () => { tree = createScreen(); });
  await act(async () => resolveRead(offline));
  expect(rendered()).toContain('You’re offline.');
  act(() => listener(online));
  expect(rendered()).toContain('We couldn’t load the rates. Try again in a moment.');
  expect(rendered()).not.toContain('You’re offline.');
  act(() => listener(offline));
  expect(rendered()).toContain('You’re offline.');
  expect(mockState.retryDataLoad).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('newer network events survive a slow initial read that %ss', async (outcome) => {
  await act(async () => { tree = createScreen(); });
  act(() => listener(online));
  await act(async () => {
    if (outcome === 'resolve') resolveRead(offline);
    else rejectRead(new Error('Connectivity unavailable'));
  });
  expect(rendered()).toContain('We couldn’t load the rates. Try again in a moment.');
  expect(rendered()).not.toContain('Check your connection');
  expect(rendered()).not.toContain('You’re offline.');
});

test('listener remains active during retry and is removed on unmount', async () => {
  await act(async () => { tree = createScreen(); });
  mockState.refreshing = true;
  act(() => tree.update(<DataUnavailableScreen />));
  act(() => listener(offline));
  expect(rendered()).toContain('You’re offline.');
  expect(tree.root.findByProps({ title: 'Try again' }).props.disabled).toBe(true);
  expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => resolveRead(online));
  act(() => listener(online));
  expect(tree.toJSON()).toBeNull();
});

test('unreadable initial connectivity retains the unknown advice', async () => {
  await act(async () => { tree = createScreen(); });
  await act(async () => rejectRead(new Error('Connectivity unavailable')));
  expect(rendered()).toContain('We couldn’t load the rates. Check your connection and try again.');
});
