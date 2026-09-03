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

  it('recovers an incomplete encrypted generation as editable defaults with a warning', async () => {
    const manifest = JSON.stringify({
      kind: 'ar.secure-value',
      schemaVersion: 1,
      generation: 'missing',
      chunks: 1,
    });
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
      key === 'user-rate-scenario-v1' ? manifest : null,
    );

    await ensureUserRateScenarioLoaded();
    const recovered = getUserRateScenarioSnapshotForTests();
    expect(recovered.storageStatus).toBe('ready');
    expect(recovered.error).toMatch(/incomplete.*reset/i);
    expect(updateUserRateScenario((value) => ({
      ...value,
      savings: { balance: '100', currentRate: '4' },
    }))).toBe(true);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user-rate-scenario-v1');
  });

  it('flushes the latest rapid edit before navigation', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await ensureUserRateScenarioLoaded();
    updateUserRateScenario((value) => ({ ...value, savings: { balance: '100', currentRate: '4' } }));
    updateUserRateScenario((value) => ({ ...value, savings: { ...value.savings, balance: '250' } }));

    await expect(flushUserRateScenario()).resolves.toBe(true);
    const savedChunks = jest.mocked(SecureStore.setItemAsync).mock.calls
      .filter(([key]) => key.startsWith('user-rate-scenario-v1.chunk.'))
      .map(([, value]) => value)
      .join('');
    const saved = JSON.parse(savedChunks) as {
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
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.some(
      ([key, value]) => key === 'user-rate-scenario-v1' && value.includes('ar.secure-value'),
    )).toBe(true);
    expect(getUserRateScenarioSnapshotForTests().saveStatus).toBe('saved');
  });
});
