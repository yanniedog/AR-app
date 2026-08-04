import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  loadUserRateScenario,
  migrateLegacyCalculatorInputs,
  normalizeUserRateScenario,
  saveUserRateScenario,
} from '../src/data/userRateScenario';

describe('UserRateScenario', () => {
  const originalOs = Platform.OS;
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });
  it('keeps mortgage, savings, and term-deposit inputs separate', () => {
    const value = normalizeUserRateScenario({
      mortgage: { currentRate: '6.1', propertyValue: '800000' },
      savings: { balance: '20000', currentRate: '4.2' },
      termDeposit: { balance: '50000', currentRate: '4.8' },
    });
    expect(value.mortgage.currentRate).toBe('6.1');
    expect(value.savings).toEqual({ balance: '20000', currentRate: '4.2' });
    expect(value.termDeposit).toEqual({ balance: '50000', currentRate: '4.8' });
  });

  it('uses encrypted native storage and round-trips normalized data', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const value = normalizeUserRateScenario({ savings: { balance: '12345', currentRate: '4.1' } });
    await saveUserRateScenario(value);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'user-rate-scenario-v1',
      JSON.stringify(value),
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(value));
    await expect(loadUserRateScenario()).resolves.toEqual(value);
  });

  it('migrates legacy calculator inputs only when encrypted mortgage data is empty', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await migrateLegacyCalculatorInputs({ propertyValue: '750000', currentRate: '6.2' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'user-rate-scenario-v1',
      expect.stringContaining('750000'),
      expect.any(Object),
    );
  });
});
