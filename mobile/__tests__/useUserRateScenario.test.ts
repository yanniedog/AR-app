import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  ensureUserRateScenarioLoaded,
  flushUserRateScenario,
  getUserRateScenarioSnapshotForTests,
  resetUserRateScenarioStoreForTests,
  updateUserRateScenario,
} from '../src/hooks/useUserRateScenario';

describe('shared user rate scenario store', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.clearAllMocks();
    resetUserRateScenarioStoreForTests();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  it('does not overwrite encrypted data when a read fails and can retry', async () => {
    jest.mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error('keystore unavailable'))
      .mockResolvedValueOnce(null);

    await ensureUserRateScenarioLoaded();
    expect(getUserRateScenarioSnapshotForTests().storageStatus).toBe('error');
    expect(updateUserRateScenario((value) => value)).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();

    await ensureUserRateScenarioLoaded();
    expect(getUserRateScenarioSnapshotForTests().storageStatus).toBe('ready');
  });

  it('flushes the latest rapid edit before navigation', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await ensureUserRateScenarioLoaded();
    updateUserRateScenario((value) => ({ ...value, savings: { balance: '100', currentRate: '4' } }));
    updateUserRateScenario((value) => ({ ...value, savings: { ...value.savings, balance: '250' } }));

    await expect(flushUserRateScenario()).resolves.toBe(true);
    const saved = JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1]) as {
      savings: { balance: string };
    };
    expect(saved.savings.balance).toBe('250');
  });

  it('retries a failed save without requiring another edit', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    jest.mocked(SecureStore.setItemAsync)
      .mockRejectedValueOnce(new Error('device locked'))
      .mockResolvedValueOnce(undefined);
    await ensureUserRateScenarioLoaded();
    updateUserRateScenario((value) => ({ ...value, termDeposit: { balance: '50000', currentRate: '4.8' } }));

    await expect(flushUserRateScenario()).resolves.toBe(false);
    await expect(flushUserRateScenario()).resolves.toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    expect(getUserRateScenarioSnapshotForTests().saveStatus).toBe('saved');
  });
});
