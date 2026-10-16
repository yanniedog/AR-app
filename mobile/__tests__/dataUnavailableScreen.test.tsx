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
  root: {
    findByProps: (props: { title: string }) => { props: { disabled: boolean; onPress: () => void } };
    findAllByType: (type: string) => { children: unknown[] }[];
  };
};
let tree: Renderer;
const createScreen = () => TestRenderer.create(<DataUnavailableScreen />) as Renderer;
const remove = jest.fn();
const connectivityStatus = () => tree.root.findAllByType('AppText')
  .map(node => node.children.join(''));

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

test('connectivity facts follow network events without requiring a retry', async () => {
  await act(async () => { tree = createScreen(); });
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Unknown']);
  await act(async () => resolveRead(offline));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Offline']);
  act(() => listener(online));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Online']);
  act(() => listener(offline));
  expect(connectivityStatus()).toEqual(['Data unavailable', 'Offline']);
  expect(mockState.retryDataLoad).not.toHaveBeenCalled();
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
