import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppState } from '../data/storeTypes';

export const PERFORMANCE_AUDIT_ROLLBACK_KEY = '@ar/performance-audit/rollback-v1';
const PERSISTED_STORE_KEY = 'ar-rates';
const ROLLBACK_SCHEMA_VERSION = 1 as const;
const PERSISTENCE_TIMEOUT_MS = 3_000;

export interface PerformanceAuditUserSnapshot {
  prefs: AppState['prefs'];
  savedRates: AppState['savedRates'];
  favorites: AppState['favorites'];
  subscriptions: AppState['subscriptions'];
  activeSection: AppState['activeSection'];
}

interface PerformanceAuditRollbackJournal {
  schemaVersion: typeof ROLLBACK_SCHEMA_VERSION;
  startedAt: string;
  snapshot: PerformanceAuditUserSnapshot;
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
): PerformanceAuditUserSnapshot {
  return clone({
    prefs: state.prefs,
    savedRates: state.savedRates,
    favorites: state.favorites,
    subscriptions: state.subscriptions,
    activeSection: state.activeSection,
  });
}

export function performanceAuditSnapshotFingerprint(
  snapshot: PerformanceAuditUserSnapshot,
): string {
  return JSON.stringify(snapshot);
}

function parseJournal(raw: string | null): PerformanceAuditRollbackJournal | null {
  if (!raw) return null;
  try {
    const journal = JSON.parse(raw) as Partial<PerformanceAuditRollbackJournal>;
    const snapshot = journal.snapshot as Partial<PerformanceAuditUserSnapshot> | undefined;
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
    return journal as PerformanceAuditRollbackJournal;
  } catch {
    return null;
  }
}

export async function beginPerformanceAuditRollback(
  store: PerformanceAuditRollbackStore,
): Promise<PerformanceAuditUserSnapshot> {
  const stale = parseJournal(await AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY));
  if (stale) {
    await restoreSnapshot(store, stale.snapshot);
  }
  const snapshot = capturePerformanceAuditUserSnapshot(store.getState());
  const journal: PerformanceAuditRollbackJournal = {
    schemaVersion: ROLLBACK_SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    snapshot,
  };
  await AsyncStorage.setItem(PERFORMANCE_AUDIT_ROLLBACK_KEY, JSON.stringify(journal));
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
    });
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
  const deadline = Date.now() + PERSISTENCE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const stored = persistedSnapshot(await AsyncStorage.getItem(PERSISTED_STORE_KEY));
    if (stored && JSON.stringify(persistedComparable(stored)) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Performance audit state restoration was not durably persisted');
}

async function restoreSnapshot(
  store: PerformanceAuditRollbackStore,
  snapshot: PerformanceAuditUserSnapshot,
): Promise<void> {
  const restored = clone(snapshot);
  store.setState(restored);
  const actual = capturePerformanceAuditUserSnapshot(store.getState());
  if (performanceAuditSnapshotFingerprint(actual) !== performanceAuditSnapshotFingerprint(restored)) {
    throw new Error('Performance audit state restoration did not match the captured snapshot');
  }
  await waitForPersistence(restored);
}

export async function restorePerformanceAuditRollback(
  store: PerformanceAuditRollbackStore,
  fallback?: PerformanceAuditUserSnapshot,
): Promise<boolean> {
  const journal = parseJournal(await AsyncStorage.getItem(PERFORMANCE_AUDIT_ROLLBACK_KEY));
  const snapshot = journal?.snapshot ?? fallback ?? null;
  if (!snapshot) return false;
  await restoreSnapshot(store, snapshot);
  await AsyncStorage.removeItem(PERFORMANCE_AUDIT_ROLLBACK_KEY);
  return true;
}

export async function recoverInterruptedPerformanceAudit(
  store: PerformanceAuditRollbackStore,
): Promise<boolean> {
  return restorePerformanceAuditRollback(store);
}
