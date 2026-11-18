import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { loadUserRateScenario } from '../src/data/userRateScenario';
import { loadCustomerProfile } from '../src/data/customerProfileStorage';

import {
  ensureUserRateScenarioLoaded,
  flushUserRateScenario,
  getUserRateScenarioSnapshotForTests,
  resetUserRateScenarioStoreForTests,
  updateUserRateScenario,
} from '../src/hooks/useUserRateScenario';

describe('shared user rate scenario store', () => {
  const originalOs = Platform.OS;
  const values = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.clearAllMocks();
    values.clear();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => values.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
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

  it('retains an incomplete encrypted generation and blocks edits until recovery', async () => {
    values.set('user-rate-scenario-v1', JSON.stringify({ kind: 'ar.secure-value', schemaVersion: 1, generation: 'missing', chunks: 1 }));
    await ensureUserRateScenarioLoaded();
    expect(getUserRateScenarioSnapshotForTests().storageStatus).toBe('error');
    expect(updateUserRateScenario(value => value)).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('flushes the latest rapid edit before navigation', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await ensureUserRateScenarioLoaded();
    updateUserRateScenario((value) => ({ ...value, savings: { balance: '100', currentRate: '4' } }));
    updateUserRateScenario((value) => ({ ...value, savings: { ...value.savings, balance: '250' } }));

    await expect(flushUserRateScenario()).resolves.toBe(true);
    expect((await loadUserRateScenario()).savings.balance).toBe('250');
  });

  it('coalesces rapid keystrokes into one verified profile write and flushes before the timer', async () => {
    await ensureUserRateScenarioLoaded();
    const initialRevision = (await loadCustomerProfile()).revision;
    jest.useFakeTimers();
    try {
      jest.mocked(SecureStore.setItemAsync).mockClear();
      updateUserRateScenario(value => ({ ...value, savings: { ...value.savings, balance: '1' } }));
      jest.advanceTimersByTime(100);
      updateUserRateScenario(value => ({ ...value, savings: { ...value.savings, balance: '12' } }));
      jest.advanceTimersByTime(100);
      updateUserRateScenario(value => ({ ...value, savings: { ...value.savings, balance: '125' } }));
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      await expect(flushUserRateScenario()).resolves.toBe(true);
      expect((await loadCustomerProfile()).revision).toBe(initialRevision + 1);
      expect((await loadUserRateScenario()).savings.balance).toBe('125');
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('retries a failed save without requiring another edit', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await ensureUserRateScenarioLoaded();
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('device locked'));
    updateUserRateScenario((value) => ({ ...value, termDeposit: { balance: '50000', currentRate: '4.8' } }));

    await expect(flushUserRateScenario()).resolves.toBe(false);
    await expect(flushUserRateScenario()).resolves.toBe(true);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.some(
      ([key, value]) => key === 'ar.customer-profile.v1' && value.includes('ar.secure-value'),
    )).toBe(true);
    expect(getUserRateScenarioSnapshotForTests().saveStatus).toBe('saved');
  });
});
