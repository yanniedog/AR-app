import * as SecureStore from 'expo-secure-store';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';

import { ScenarioRecoveryBanner } from '../src/components/ScenarioRecoveryBanner';
import {
  ensureUserRateScenarioLoaded,
  resetUserRateScenarioStoreForTests,
} from '../src/hooks/useUserRateScenario';

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

describe('ScenarioRecoveryBanner', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.clearAllMocks();
    resetUserRateScenarioStoreForTests();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  it('shows unavailable saved inputs without deleting them and provides retry', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => (
      key === 'user-rate-scenario-v1'
        ? JSON.stringify({ kind: 'ar.secure-value', schemaVersion: 1, generation: 'missing', chunks: 1 })
        : null
    ));
    await ensureUserRateScenarioLoaded();

    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<ScenarioRecoveryBanner />) as InspectableRenderer;
      await ensureUserRateScenarioLoaded();
    });
    expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    const dismiss = tree.root.findByProps({
      accessibilityLabel: 'Retry',
    });
    const values = new Map<string, string>();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => values.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
    await act(async () => {
      (dismiss.props.onPress as () => void)();
      await ensureUserRateScenarioLoaded();
    });
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(() => tree.root.findByProps({ accessibilityRole: 'alert' })).toThrow();
    act(() => tree.unmount());
  });
});
