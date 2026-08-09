import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_PREFS, type AppState } from '../src/data/storeTypes';
import {
  resetUserRateScenarioStoreForTests,
  ensureUserRateScenarioLoaded,
  updateUserRateScenario,
} from '../src/hooks/useUserRateScenario';
import {
  beginPerformanceAuditRollback,
  capturePerformanceAuditUserSnapshot,
  PERFORMANCE_AUDIT_ROLLBACK_KEY,
  PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY,
  performanceAuditSnapshotFingerprint,
  recoverInterruptedPerformanceAudit,
  restorePerformanceAuditRollback,
  tryRestorePerformanceAuditRollback,
  type PerformanceAuditRollbackStore,
} from '../src/lib/performanceAuditRollback';

const originalOs = Platform.OS;
const secureStore = new Map<string, string>();

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
    secureStore.clear();
    resetUserRateScenarioStoreForTests();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => secureStore.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
      secureStore.set(key, value);
    });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      secureStore.delete(key);
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('captures user state before mutations and restores exact values and ordering', async () => {
    const store = makeStore();
    await ensureUserRateScenarioLoaded();
    const before = await beginPerformanceAuditRollback(store);
    store.setState({
      prefs: { ...store.getState().prefs, themeMode: 'dark', depositRankMetric: 'max' },
      favorites: ['changed'],
      activeSection: 'Savings',
    });
    expect(updateUserRateScenario((value) => ({
      ...value,
      mortgage: { ...value.mortgage, currentRate: '9.99', propertyValue: '1' },
    }))).toBe(true);

    await expect(restorePerformanceAuditRollback(store, before)).resolves.toBe(true);
    expect(performanceAuditSnapshotFingerprint(capturePerformanceAuditUserSnapshot(store.getState())))
      .toBe(performanceAuditSnapshotFingerprint(before));
    await expect(AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY)).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('stores calculator scenario in SecureStore instead of the AsyncStorage rollback journal', async () => {
    const store = makeStore();
    await ensureUserRateScenarioLoaded();
    expect(updateUserRateScenario((value) => ({
      ...value,
      mortgage: { ...value.mortgage, currentRate: '6.25', propertyValue: '750000' },
    }))).toBe(true);

    await beginPerformanceAuditRollback(store);

    const journalRaw = await AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY);
    expect(journalRaw).not.toBeNull();
    expect(journalRaw).not.toMatch(/6\.25|750000/);
    expect(JSON.parse(journalRaw as string).snapshot.userRateScenarioCaptured).toBe(true);
    expect(JSON.parse(journalRaw as string).snapshot.userRateScenario).toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY,
      expect.stringMatching(/6\.25/),
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
    expect(secureStore.get(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY)).toMatch(/6\.25/);
  });

  it('recovers an interrupted audit from its durable journal on the next launch', async () => {
    const store = makeStore();
    await ensureUserRateScenarioLoaded();
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
  });

  it('retains rollback artifacts when a captured SecureStore scenario companion is missing', async () => {
    const store = makeStore();
    await ensureUserRateScenarioLoaded();
    expect(updateUserRateScenario((value) => ({
      ...value,
      mortgage: { ...value.mortgage, currentRate: '5.50', propertyValue: '400000' },
    }))).toBe(true);
    await beginPerformanceAuditRollback(store);
    secureStore.delete(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY);

    await expect(restorePerformanceAuditRollback(store)).rejects.toThrow(/missing from SecureStore/);
    await expect(AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY)).resolves.not.toBeNull();
  });

  it('reports a teardown restoration failure without throwing or clearing recovery artifacts', async () => {
    const store = makeStore();
    const before = await beginPerformanceAuditRollback(store);
    store.setState = (next) => {
      const current = store.getState();
      (store as { getState: () => AppState }).getState = () => ({ ...current, ...next });
    };

    jest.useFakeTimers();
    const pending = tryRestorePerformanceAuditRollback(store, before);
    await jest.advanceTimersByTimeAsync(3_100);
    const result = await pending;

    expect(result.restored).toBe(false);
    expect(result.error).toMatch(/not durably persisted/);
    await expect(AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY)).resolves.not.toBeNull();
    await expect(
      SecureStore.getItemAsync(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY),
    ).resolves.not.toBeNull();
  });
});
