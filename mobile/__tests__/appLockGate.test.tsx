import React, { useEffect } from 'react';
import { AppState, Modal, type AppStateStatus, View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppLockGate } from '../src/components/AppLockGate';
import { authenticateBiometric } from '../src/lib/appLock';
import { setAppLockScreenProtection } from '../src/lib/appLockScreenProtection';

type TestNode = {
  props: Record<string, unknown>;
  findByType: (type: unknown) => TestNode;
  findAllByType: (type: unknown) => TestNode[];
};

type InspectableRenderer = ReactTestRenderer & { root: TestNode };

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: 'Ionicons',
}));

jest.mock('../src/data/store', () => {
  const state = { hydrated: true, prefs: { appLockEnabled: true } };
  return {
    useStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});

jest.mock('../src/lib/appLock', () => ({
  authenticateBiometric: jest.fn(async () => true),
}));

jest.mock('../src/lib/appLockScreenProtection', () => ({
  setAppLockScreenProtection: jest.fn(async () => {}),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { bg: '#000000', primary: '#ffffff' } }),
}));

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Button: 'Button',
}));

describe('AppLockGate', () => {
  let lifecycleListener: ((state: AppStateStatus) => void) | null;
  let currentStateDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    lifecycleListener = null;
    currentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      lifecycleListener = listener;
      return { remove: jest.fn() } as never;
    });
    jest.mocked(authenticateBiometric).mockResolvedValue(true);
    jest.mocked(setAppLockScreenProtection).mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (currentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', currentStateDescriptor);
    }
  });

  it('keeps the application tree mounted while obscuring and re-unlocking it', async () => {
    let mounts = 0;
    let unmounts = 0;

    function PrivateTree() {
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return React.createElement('PrivateTree');
    }

    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <AppLockGate>
          <PrivateTree />
        </AppLockGate>,
      ) as InspectableRenderer;
      await Promise.resolve();
    });
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);

    await act(async () => {
      lifecycleListener?.('background');
      await Promise.resolve();
    });
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    const privateWrapper = tree.root
      .findAllByType(View)
      .find((node) => node.props.pointerEvents !== undefined);
    expect(privateWrapper?.props.pointerEvents).toBe('none');
    expect(privateWrapper?.props.accessibilityElementsHidden).toBe(true);
    expect(privateWrapper?.props.importantForAccessibility).toBe('no-hide-descendants');
    await act(async () => {
      lifecycleListener?.('active');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(authenticateBiometric).toHaveBeenCalledTimes(2);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);

    act(() => tree.unmount());
    expect(unmounts).toBe(1);
  });
});
