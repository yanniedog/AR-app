import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_PREFS, type AppState } from '../src/data/storeTypes';
import {
  resetUserRateScenarioStoreForTests,
  updateUserRateScenario,
} from '../src/hooks/useUserRateScenario';
import {
  beginPerformanceAuditRollback,
  capturePerformanceAuditUserSnapshot,
  PERFORMANCE_AUDIT_ROLLBACK_KEY,
  performanceAuditSnapshotFingerprint,
  recoverInterruptedPerformanceAudit,
  restorePerformanceAuditRollback,
  type PerformanceAuditRollbackStore,
} from '../src/lib/performanceAuditRollback';

const originalOs = Platform.OS;

function makeState(): AppState {
  return {
    prefs: { ...DEFAULT_PREFS, onboarded: true },
    savedRates: [],
    favorites: [],
    subscriptions: [],
    activeSection: 'Mortgage',
  } as unknown as AppState;
}

function makeStore(initial = makeState()): PerformanceAuditRollbackStore {
  let state = initial;
  return {
    getState: () => state,
    setState: (next) => {
      state = { ...state, ...next };
      const { calc: _calc, diagnosticsEnabled: _legacy, rateIntelligencePro: _pro, ...prefs } = state.prefs;
      void AsyncStorage.setItem('ar-rates', JSON.stringify({
        state: {
          prefs,
          savedRates: state.savedRates,
          favorites: state.favorites,
          subscriptions: state.subscriptions,
          activeSection: state.activeSection,
        },
        version: 0,
      }));
    },
  };
}

describe('performance audit rollback journal', () => {
  beforeEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    await AsyncStorage.clear();
    resetUserRateScenarioStoreForTests();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  it('captures user state before mutations and restores exact values and ordering', async () => {
    const store = makeStore();
    const before = await beginPerformanceAuditRollback(store);
    store.setState({
      prefs: { ...store.getState().prefs, themeMode: 'dark', depositRankMetric: 'max' },
      favorites: ['changed'],
      activeSection: 'Savings',
    });
    updateUserRateScenario((value) => ({
      ...value,
      mortgage: { ...value.mortgage, currentRate: '9.99', propertyValue: '1' },
    }));

    await expect(restorePerformanceAuditRollback(store, before)).resolves.toBe(true);
    expect(performanceAuditSnapshotFingerprint(capturePerformanceAuditUserSnapshot(store.getState())))
      .toBe(performanceAuditSnapshotFingerprint(before));
    await expect(AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY)).resolves.toBeNull();
  });

  it('recovers an interrupted audit from its durable journal on the next launch', async () => {
    const store = makeStore();
    const before = await beginPerformanceAuditRollback(store);
    store.setState({
      prefs: { ...store.getState().prefs, showHistoryRibbon: true },
      activeSection: 'TD',
    });

    const restarted = makeStore(store.getState());
    await expect(recoverInterruptedPerformanceAudit(restarted)).resolves.toBe(true);
    expect(performanceAuditSnapshotFingerprint(capturePerformanceAuditUserSnapshot(restarted.getState())))
      .toBe(performanceAuditSnapshotFingerprint(before));
  });

  it('refuses to clear the journal when persistence never confirms restoration', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    const before = await beginPerformanceAuditRollback(store);
    store.setState = (next) => {
      const current = store.getState();
      (store as { getState: () => AppState }).getState = () => ({ ...current, ...next });
    };
    const pending = restorePerformanceAuditRollback(store, before);
    const rejected = expect(pending).rejects.toThrow(/not durably persisted/);
    await jest.advanceTimersByTimeAsync(3_100);
    await rejected;
    await expect(AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY)).resolves.not.toBeNull();
    jest.useRealTimers();
  });
});
