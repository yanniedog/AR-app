import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AppState } from '../data/storeTypes';
import {
  normalizeUserRateScenario,
  type UserRateScenario,
} from '../data/userRateScenario';
import {
  captureUserRateScenarioForAudit,
  ensureUserRateScenarioLoaded,
  restoreUserRateScenarioForAudit,
} from '../hooks/useUserRateScenario';
import { ForegroundElapsed, subscribePerformanceAudit } from './performanceAudit';

export const PERFORMANCE_AUDIT_ROLLBACK_KEY = '@ar/performance-audit/rollback-v1';
/** Encrypted companion for calculator/projection inputs; never written to AsyncStorage. */
export const PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY = 'performance-audit-rollback-scenario-v1';
const PERSISTED_STORE_KEY = 'ar-rates';
const ROLLBACK_SCHEMA_VERSION = 1 as const;
const PERSISTENCE_TIMEOUT_MS = 3_000;

export interface PerformanceAuditUserSnapshot {
  prefs: AppState['prefs'];
  savedRates: AppState['savedRates'];
  favorites: AppState['favorites'];
  subscriptions: AppState['subscriptions'];
  activeSection: AppState['activeSection'];
  /** Calculator/projection scenario held in memory / SecureStore; never persisted in AsyncStorage. */
  userRateScenario: UserRateScenario | null;
}

interface PerformanceAuditRollbackJournal {
  schemaVersion: typeof ROLLBACK_SCHEMA_VERSION;
  startedAt: string;
  snapshot: PerformanceAuditUserSnapshot;
}

/** AsyncStorage shape: scenario payload is omitted; only a capture flag remains. */
interface PersistedRollbackJournal {
  schemaVersion: typeof ROLLBACK_SCHEMA_VERSION;
  startedAt: string;
  snapshot: Omit<PerformanceAuditUserSnapshot, 'userRateScenario'> & {
    userRateScenario: null;
    userRateScenarioCaptured: boolean;
  };
}

export interface PerformanceAuditRollbackStore {
  getState: () => AppState;
  setState: (next: Partial<AppState>) => void;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function capturePerformanceAuditUserSnapshot(
  state: Pick<AppState, 'prefs' | 'savedRates' | 'favorites' | 'subscriptions' | 'activeSection'>,
  userRateScenario: UserRateScenario | null = captureUserRateScenarioForAudit(),
): PerformanceAuditUserSnapshot {
  return clone({
    prefs: state.prefs,
    savedRates: state.savedRates,
    favorites: state.favorites,
    subscriptions: state.subscriptions,
    activeSection: state.activeSection,
    userRateScenario,
  });
}

export function performanceAuditSnapshotFingerprint(
  snapshot: PerformanceAuditUserSnapshot,
): string {
  return JSON.stringify(snapshot);
}

function toPersistedJournal(journal: PerformanceAuditRollbackJournal): PersistedRollbackJournal {
  return {
    schemaVersion: journal.schemaVersion,
    startedAt: journal.startedAt,
    snapshot: {
      prefs: journal.snapshot.prefs,
      savedRates: journal.snapshot.savedRates,
      favorites: journal.snapshot.favorites,
      subscriptions: journal.snapshot.subscriptions,
      activeSection: journal.snapshot.activeSection,
      userRateScenario: null,
      userRateScenarioCaptured: journal.snapshot.userRateScenario != null,
    },
  };
}

async function persistRollbackScenario(scenario: UserRateScenario | null): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!scenario) {
    try {
      await SecureStore.deleteItemAsync(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY);
    } catch {
      // Missing key is fine during cleanup.
    }
    return;
  }
  await SecureStore.setItemAsync(
    PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY,
    JSON.stringify(normalizeUserRateScenario(scenario)),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}

async function loadRollbackScenario(): Promise<UserRateScenario | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(PERFORMANCE_AUDIT_ROLLBACK_SCENARIO_KEY);
    return raw ? normalizeUserRateScenario(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function clearRollbackArtifacts(): Promise<void> {
  await AsyncStorage.removeItem(PERFORMANCE_AUDIT_ROLLBACK_KEY);
  await persistRollbackScenario(null);
}

function parseJournal(raw: string | null): {
  journal: PerformanceAuditRollbackJournal;
  legacyScenario: UserRateScenario | null;
  captured: boolean;
} | null {
  if (!raw) return null;
  try {
    const journal = JSON.parse(raw) as Partial<PersistedRollbackJournal> & {
      snapshot?: Partial<PerformanceAuditUserSnapshot> & {
        userRateScenarioCaptured?: boolean;
      };
    };
    const snapshot = journal.snapshot;
    if (
      journal.schemaVersion !== ROLLBACK_SCHEMA_VERSION ||
      typeof journal.startedAt !== 'string' ||
      !snapshot ||
      !snapshot.prefs ||
      !Array.isArray(snapshot.savedRates) ||
      !Array.isArray(snapshot.favorites) ||
      !Array.isArray(snapshot.subscriptions) ||
      typeof snapshot.activeSection !== 'string'
    ) {
      return null;
    }
    const legacyScenario = snapshot.userRateScenario ?? null;
    return {
      journal: {
        schemaVersion: ROLLBACK_SCHEMA_VERSION,
        startedAt: journal.startedAt,
        snapshot: {
          prefs: snapshot.prefs,
          savedRates: snapshot.savedRates,
          favorites: snapshot.favorites,
          subscriptions: snapshot.subscriptions,
          activeSection: snapshot.activeSection,
          userRateScenario: null,
        },
      },
      legacyScenario,
      captured: snapshot.userRateScenarioCaptured === true || legacyScenario != null,
    };
  } catch {
    return null;
  }
}

async function readRollbackJournal(): Promise<PerformanceAuditRollbackJournal | null> {
  const parsed = parseJournal(await AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY));
  if (!parsed) return null;
  const secureScenario = await loadRollbackScenario();
  const userRateScenario = secureScenario ?? parsed.legacyScenario ?? null;
  if (parsed.captured && !userRateScenario) {
    throw new Error(
      'Performance audit rollback scenario is missing from SecureStore; journal retained for recovery',
    );
  }
  return {
    ...parsed.journal,
    snapshot: {
      ...parsed.journal.snapshot,
      userRateScenario,
    },
  };
}

export async function beginPerformanceAuditRollback(
  store: PerformanceAuditRollbackStore,
): Promise<PerformanceAuditUserSnapshot> {
  const stale = await readRollbackJournal();
  if (stale) {
    await restoreSnapshot(store, stale.snapshot);
  }
  await ensureUserRateScenarioLoaded().catch(() => undefined);
  const snapshot = capturePerformanceAuditUserSnapshot(store.getState());
  const journal: PerformanceAuditRollbackJournal = {
    schemaVersion: ROLLBACK_SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    snapshot,
  };
  await persistRollbackScenario(snapshot.userRateScenario);
  await AsyncStorage.setItem(
    PERFORMANCE_AUDIT_ROLLBACK_KEY,
    JSON.stringify(toPersistedJournal(journal)),
  );
  return snapshot;
}

function persistedSnapshot(raw: string | null): PerformanceAuditUserSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: Partial<AppState> };
    const state = parsed.state;
    if (!state?.prefs) return null;
    return capturePerformanceAuditUserSnapshot({
      prefs: state.prefs as AppState['prefs'],
      savedRates: state.savedRates ?? [],
      favorites: state.favorites ?? [],
      subscriptions: state.subscriptions ?? [],
      activeSection: state.activeSection ?? state.prefs.defaultSection,
    }, null);
  } catch {
    return null;
  }
}

function persistedComparable(snapshot: PerformanceAuditUserSnapshot): unknown {
  const { calc: _calc, diagnosticsEnabled: _legacy, rateIntelligencePro: _pro, ...prefs } = snapshot.prefs;
  return {
    prefs,
    savedRates: snapshot.savedRates,
    favorites: snapshot.favorites,
    subscriptions: snapshot.subscriptions,
    activeSection: snapshot.activeSection,
  };
}

async function waitForPersistence(snapshot: PerformanceAuditUserSnapshot): Promise<void> {
  const expected = JSON.stringify(persistedComparable(snapshot));
  // Three seconds of the app actually running, not three seconds of wall clock.
  // Android suspends the JS thread when the app leaves the foreground, so a
  // wall-clock deadline could expire during a pause and fail a completed audit
  // before this loop ever got to re-check whether Zustand had persisted.
  const elapsed = new ForegroundElapsed();
  const unsubscribe = subscribePerformanceAudit(() => elapsed.accrue());
  try {
    for (;;) {
      const stored = persistedSnapshot(await AsyncStorage.getItem(PERSISTED_STORE_KEY));
      if (stored && JSON.stringify(persistedComparable(stored)) === expected) return;
      elapsed.accrue();
      if (elapsed.foregroundMs >= PERSISTENCE_TIMEOUT_MS) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
      elapsed.accrue();
    }
  } finally {
    unsubscribe();
  }
  throw new Error('Performance audit state restoration was not durably persisted');
}

async function restoreSnapshot(
  store: PerformanceAuditRollbackStore,
  snapshot: PerformanceAuditUserSnapshot,
): Promise<void> {
  const restored = clone(snapshot);
  store.setState({
    prefs: restored.prefs,
    savedRates: restored.savedRates,
    favorites: restored.favorites,
    subscriptions: restored.subscriptions,
    activeSection: restored.activeSection,
  });
  if (restored.userRateScenario) {
    await restoreUserRateScenarioForAudit(restored.userRateScenario);
  }
  const actual = capturePerformanceAuditUserSnapshot(
    store.getState(),
    restored.userRateScenario ? captureUserRateScenarioForAudit() : null,
  );
  if (
    performanceAuditSnapshotFingerprint({
      ...actual,
      userRateScenario: restored.userRateScenario ? actual.userRateScenario : null,
    }) !== performanceAuditSnapshotFingerprint(restored)
  ) {
    throw new Error('Performance audit state restoration did not match the captured snapshot');
  }
  await waitForPersistence(restored);
}

export async function restorePerformanceAuditRollback(
  store: PerformanceAuditRollbackStore,
  fallback?: PerformanceAuditUserSnapshot,
): Promise<boolean> {
  const journal = await readRollbackJournal();
  if (!journal && !fallback) return false;
  // Prefer SecureStore/journal scenario, then the in-memory begin() snapshot
  // (required on web where SecureStore persistence is a no-op).
  const snapshot: PerformanceAuditUserSnapshot = {
    ...(journal?.snapshot ?? fallback!),
    userRateScenario:
      journal?.snapshot.userRateScenario
      ?? fallback?.userRateScenario
      ?? null,
  };
  await restoreSnapshot(store, snapshot);
  await clearRollbackArtifacts();
  return true;
}

export async function recoverInterruptedPerformanceAudit(
  store: PerformanceAuditRollbackStore,
): Promise<boolean> {
  return restorePerformanceAuditRollback(store);
}
