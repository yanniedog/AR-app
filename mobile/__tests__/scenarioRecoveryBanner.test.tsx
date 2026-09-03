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

  it('explains recovered defaults at the navigation root and can be acknowledged', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => (
      key === 'user-rate-scenario-v1'
        ? JSON.stringify({ kind: 'ar.secure-value', schemaVersion: 1, generation: 'missing', chunks: 1 })
        : null
    ));
    await ensureUserRateScenarioLoaded();

    let tree!: InspectableRenderer;
    act(() => {
      tree = TestRenderer.create(<ScenarioRecoveryBanner />) as InspectableRenderer;
    });
    expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    const dismiss = tree.root.findByProps({
      accessibilityLabel: 'Dismiss saved scenario reset notice',
    });
    act(() => {
      (dismiss.props.onPress as () => void)();
    });
    expect(() => tree.root.findByProps({ accessibilityRole: 'alert' })).toThrow();
    act(() => tree.unmount());
  });
});
