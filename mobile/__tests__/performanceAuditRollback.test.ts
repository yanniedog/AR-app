import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_PREFS, type AppState } from '../src/data/storeTypes';
import { makeSavedRateRef } from '../src/data/savedRates';
import { makeTrackedRate } from '../src/data/trackedRates';
import type { RateRow } from '../src/types';
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
  retryPerformanceAuditRollback,
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
    trackedRates: [],
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
    const journal = JSON.parse(journalRaw as string);
    // Scan the snapshot rather than the whole record: the journal's own
    // `startedAt` timestamp contains a seconds/milliseconds pair such as
    // "06.256Z" roughly one run in a hundred, which matches /6\.25/ and fails
    // this assertion for a leak that never happened.
    expect(JSON.stringify(journal.snapshot)).not.toMatch(/6\.25|750000/);
    expect(journal.snapshot.userRateScenarioCaptured).toBe(true);
    expect(journal.snapshot.userRateScenario).toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY,
      expect.stringMatching(/6\.25/),
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
    expect(secureStore.get(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY)).toMatch(/6\.25/);
  });

  it('keeps tracked date metadata out of AsyncStorage and recovers it from SecureStore', async () => {
    const row: RateRow = {
      provider: 'Example Bank',
      product_key: 'EX|TD',
      product_name: 'Term Deposit 12 months',
      rate_index: 4,
      rate: '0.0475',
    };
    const saved = makeSavedRateRef(row, 'rate', '2026-08-13T00:00:00.000Z');
    const tracked = {
      ...makeTrackedRate(saved),
      relevantDate: '2027-08-13',
      relevantDateKind: 'term-maturity' as const,
    };
    const store = makeStore({
      ...makeState(),
      savedRates: [saved],
      trackedRates: [tracked],
      favorites: [saved.productKey],
      activeSection: 'TD',
    });

    const before = await beginPerformanceAuditRollback(store);
    const journalRaw = await AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY);
    expect(journalRaw).not.toContain('2027-08-13');
    expect(JSON.parse(journalRaw as string).snapshot).not.toHaveProperty('trackedRates');
    expect([...secureStore.values()].some((value) => value.includes('2027-08-13'))).toBe(true);

    store.setState({ trackedRates: [] });
    const restarted = makeStore(store.getState());
    await expect(recoverInterruptedPerformanceAudit(restarted)).resolves.toBe(true);
    expect(restarted.getState().trackedRates).toEqual(before.trackedRates);
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

  it('uses a bounded third restoration attempt and reports the successful attempt count', async () => {
    const attempt = jest.fn()
      .mockResolvedValueOnce({ restored: false, error: 'first' })
      .mockResolvedValueOnce({ restored: false, error: 'second' })
      .mockResolvedValueOnce({ restored: true });
    const beforeRetry = jest.fn();

    await expect(
      retryPerformanceAuditRollback(attempt, 3, beforeRetry),
    ).resolves.toEqual({ restored: true, attempts: 3 });
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(beforeRetry.mock.calls.map(([attemptNumber]) => attemptNumber)).toEqual([2, 3]);
  });

  it('retains all failure evidence when the bounded restoration attempts are exhausted', async () => {
    const attempt = jest.fn(async (attemptNumber: number) => ({
      restored: false,
      error: `failure-${attemptNumber}`,
    }));

    await expect(retryPerformanceAuditRollback(attempt, 3)).resolves.toMatchObject({
      restored: false,
      attempts: 3,
      error: 'failure-1\nRetry: failure-2\nRetry: failure-3',
    });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes non-finite retry limit %p to three bounded attempts',
    async (maxAttempts) => {
      const attempt = jest.fn().mockResolvedValue({ restored: false });

      await expect(retryPerformanceAuditRollback(attempt, maxAttempts)).resolves.toMatchObject({
        restored: false,
        attempts: 3,
      });
      expect(attempt).toHaveBeenCalledTimes(3);
    },
  );
});
