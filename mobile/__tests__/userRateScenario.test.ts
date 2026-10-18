import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadUserRateScenario,
  migrateLegacyCalculatorInputs,
  normalizeUserRateScenario,
  saveUserRateScenario,
} from '../src/data/userRateScenario';

describe('UserRateScenario', () => {
  const originalOs = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
  });
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
    expect(value.version).toBe(4);
    expect(value.projections.mortgage.periodicFrequency).toBe('monthly');
    expect(value.currentProducts.mortgage).toEqual({ provider: '', productKey: '', rateIndex: null });
    expect(value.mortgageSwitch.fundingMethod).toBe('cash-or-offset');
  });

  it('migrates optional projection inputs and rejects invalid enum values', () => {
    const value = normalizeUserRateScenario({
      version: 1,
      projections: {
        mortgage: {
          offsetBalance: '32000',
          offsetContributionFrequency: 'weekly',
          periodicFrequency: 'hourly',
        },
      },
    });
    expect(value.version).toBe(4);
    expect(value.projections.mortgage.offsetBalance).toBe('32000');
    expect(value.projections.mortgage.offsetContributionFrequency).toBe('weekly');
    expect(value.projections.mortgage.periodicFrequency).toBe('monthly');
  });

  it('migrates v3 entered values and semantic product references without opting into reference estimates or alerts', () => {
    const value = normalizeUserRateScenario({ version: 3, mortgage: { currentRate: '6.271' }, savings: { currentRate: '0.50' },
      currentProducts: { mortgage: { provider: 'Unit Bank', productKey: 'unit-product', offerId: 'stable-offer', programmeId: 'stable-programme', rateIndex: 8 } } });
    expect(value.mortgage.currentRate).toBe('6.271'); expect(value.savings.currentRate).toBe('0.50');
    expect(value.localRates.mortgage).toMatchObject({ mode: 'entered', totalAdjustment: '', referenceChangeAlerts: false, referenceScenario: {} });
    expect(value.currentProducts.mortgage).toMatchObject({ offerId: 'stable-offer', programmeId: 'stable-programme' });
    expect(value.projections.mortgage.holdVariableRate).toBe(false);
    expect(value.projections.savings.bonusQualification).toBe('unknown');
  });

  it('keeps numerical assumptions and explicit reference scope in protected storage, outside ordinary app caches and logs', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const log = jest.spyOn(console, 'log'), info = jest.spyOn(console, 'info');
    const value = normalizeUserRateScenario({ mortgage: { currentRate: '6.271', loanBalance: '487321' }, localRates: { mortgage: {
      mode: 'reference', referenceId: 'public-family', totalAdjustment: '-2.619', referenceScenario: { customerCategory: 'OVERSEAS_BORROWER', termMonths: '24', secret: 'must-drop' } } } });
    await saveUserRateScenario(value);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled();
    expect(value.localRates.mortgage.referenceScenario).toEqual({ customerCategory: 'OVERSEAS_BORROWER', termMonths: '24' });
    await expect(loadUserRateScenario()).resolves.toEqual(value);
    expect(value.mortgage.currentRate).toBe('6.271');
    log.mockRestore(); info.mockRestore();
  });

  it('migrates v2 values and normalizes section bank and optional product references', () => {
    const value = normalizeUserRateScenario({
      version: 2,
      mortgage: { loanBalance: '480000', currentRate: '6.21' },
      projections: { mortgage: { offsetBalance: '40000' } },
      currentProducts: {
        mortgage: { provider: '  Bank Australia  ', productKey: 'loan-key', rateIndex: 3 },
        savings: { provider: '__not_listed__', productKey: 'must-clear', rateIndex: 2 },
      },
      mortgageSwitch: {
        currentBankExitFees: '350',
        fundingMethod: 'new-loan',
        targetOffsetAvailable: 'yes',
      },
    });
    expect(value.version).toBe(4);
    expect(value.mortgage.loanBalance).toBe('480000');
    expect(value.projections.mortgage.offsetBalance).toBe('40000');
    expect(value.currentProducts.mortgage).toEqual({ provider: 'Bank Australia', productKey: 'loan-key', rateIndex: 3 });
    expect(value.currentProducts.savings).toEqual({ provider: '__not_listed__', productKey: '', rateIndex: null });
    expect(value.mortgageSwitch).toEqual(expect.objectContaining({
      currentBankExitFees: '350',
      fundingMethod: 'new-loan',
      targetOffsetAvailable: 'yes',
    }));
  });

  it('uses encrypted native storage and round-trips normalized data', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const value = normalizeUserRateScenario({ savings: { balance: '12345', currentRate: '4.1' } });
    await saveUserRateScenario(value);
    const baseCall = jest.mocked(SecureStore.setItemAsync).mock.calls.find(
      ([key]) => key === 'user-rate-scenario-v1',
    );
    expect(baseCall).toEqual([
      'user-rate-scenario-v1',
      expect.stringContaining('ar.secure-value'),
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    ]);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.some(
      ([key, chunk]) => key.startsWith('user-rate-scenario-v1.chunk.') && chunk.includes('12345'),
    )).toBe(true);
    await expect(loadUserRateScenario()).resolves.toEqual(value);
  });

  it('surfaces encrypted read failures instead of replacing the scenario with blanks', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('device locked'));
    await expect(loadUserRateScenario()).rejects.toThrow(/unable to read.*device locked/i);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('migrates legacy calculator inputs only when encrypted mortgage data is empty', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await migrateLegacyCalculatorInputs({ propertyValue: '750000', currentRate: '6.2' });
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.some(
      ([key, chunk]) => key.startsWith('user-rate-scenario-v1.chunk.') && chunk.includes('750000'),
    )).toBe(true);
  });
});
