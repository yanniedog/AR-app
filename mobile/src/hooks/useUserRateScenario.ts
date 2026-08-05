import { useEffect, useSyncExternalStore } from 'react';

import {
  loadUserRateScenario,
  normalizeUserRateScenario,
  saveUserRateScenario,
  type UserRateScenario,
} from '../data/userRateScenario';

export type ScenarioStorageStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ScenarioSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UserRateScenarioSnapshot {
  scenario: UserRateScenario;
  storageStatus: ScenarioStorageStatus;
  saveStatus: ScenarioSaveStatus;
  error: string | null;
}

const listeners = new Set<() => void>();
let snapshot: UserRateScenarioSnapshot = {
  scenario: normalizeUserRateScenario(undefined),
  storageStatus: 'idle',
  saveStatus: 'idle',
  error: null,
};
let loadPromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let revision = 0;
let enqueuedRevision = 0;
let persistedRevision = 0;

function emit(next: Partial<UserRateScenarioSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): UserRateScenarioSnapshot {
  return snapshot;
}

export function ensureUserRateScenarioLoaded(): Promise<void> {
  if (snapshot.storageStatus === 'ready') return Promise.resolve();
  if (loadPromise) return loadPromise;
  emit({ storageStatus: 'loading', error: null });
  loadPromise = loadUserRateScenario()
    .then((scenario) => {
      revision = 0;
      enqueuedRevision = 0;
      persistedRevision = 0;
      emit({ scenario, storageStatus: 'ready', saveStatus: 'idle', error: null });
    })
    .catch((error) => {
      enqueuedRevision = persistedRevision;
      emit({
        storageStatus: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

function enqueueLatestScenario(): Promise<void> {
  if (revision <= enqueuedRevision || snapshot.storageStatus !== 'ready') return writeChain;
  const queuedRevision = revision;
  const queuedScenario = snapshot.scenario;
  enqueuedRevision = queuedRevision;
  emit({ saveStatus: 'saving', error: null });
  writeChain = writeChain
    .catch(() => undefined)
    .then(() => saveUserRateScenario(queuedScenario))
    .then(() => {
      persistedRevision = Math.max(persistedRevision, queuedRevision);
      if (persistedRevision === revision) emit({ saveStatus: 'saved', error: null });
    })
    .catch((error) => {
      enqueuedRevision = persistedRevision;
      emit({
        saveStatus: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return writeChain;
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void enqueueLatestScenario();
  }, 400);
}

export function updateUserRateScenario(
  updater: (current: UserRateScenario) => UserRateScenario,
): boolean {
  if (snapshot.storageStatus !== 'ready') return false;
  revision += 1;
  emit({
    scenario: normalizeUserRateScenario(updater(snapshot.scenario)),
    saveStatus: 'idle',
    error: null,
  });
  scheduleSave();
  return true;
}

export async function flushUserRateScenario(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await enqueueLatestScenario();
  return persistedRevision === revision && snapshot.saveStatus !== 'error';
}

export function useUserRateScenario(): UserRateScenarioSnapshot & {
  update: typeof updateUserRateScenario;
  flush: typeof flushUserRateScenario;
  retryLoad: typeof ensureUserRateScenarioLoaded;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void ensureUserRateScenarioLoaded();
    return () => { void flushUserRateScenario(); };
  }, []);
  return {
    ...current,
    update: updateUserRateScenario,
    flush: flushUserRateScenario,
    retryLoad: ensureUserRateScenarioLoaded,
  };
}

export function resetUserRateScenarioStoreForTests(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  writeChain = Promise.resolve();
  loadPromise = null;
  revision = 0;
  enqueuedRevision = 0;
  persistedRevision = 0;
  snapshot = {
    scenario: normalizeUserRateScenario(undefined),
    storageStatus: 'idle',
    saveStatus: 'idle',
    error: null,
  };
  listeners.clear();
}

export function getUserRateScenarioSnapshotForTests(): UserRateScenarioSnapshot {
  return snapshot;
}
