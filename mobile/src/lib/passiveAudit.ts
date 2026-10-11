import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState as NativeAppState, Platform } from 'react-native';
import type { AppState } from '../data/storeTypes';
import { getSuitabilityIndex } from '../data/suitabilityIndex';
import { getSuitabilityRevision, isSuitabilityFilterReady } from '../data/suitabilityGate';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';
import { APP_HEALTH_DATA_CHECKS } from './appHealth/dataQuality';
import type { AppHealthDataSnapshot } from './appHealth/types';
import { hasAppHealthFetchGuard } from './appHealthTransportGuard';
import { appHealthDataSnapshot } from './performanceAuditDataSnapshot';
import { flushPassiveLinks, passiveLinkProgress, preloadPassiveLinks, preloadedPassiveLink } from './passiveAuditLinks';
import type { TrustedExternalUrlRequest } from './trustedExternalUrl';
import {
  newPassiveAuditRecord, parsePassiveAuditRecord, passiveAuditRecordFresh, passiveAuditCheckKey, runPassiveAuditCheck,
  serializePassiveAuditRecord, reusePassiveAuditChecks, PASSIVE_AUDIT_MAX_AGE_MS, type PassiveAuditRecord,
} from './passiveAuditCache';

export const PASSIVE_AUDIT_TASK = 'ar-rates-passive-quality';
const STORAGE_KEY = 'ar-passive-audit-v1';
const IDLE_INTERVAL_MS = 5_000;
export interface PassiveAuditStatus {
  completed: number;
  total: number;
  updatedAt: string | null;
  nativeStatus: 'unknown' | 'registered' | 'restricted' | 'unavailable';
  busy: boolean;
  linksCompleted: number;
  linksTotal: number;
  linksPreparing: boolean;
  linksCapped: boolean;
  lastError: string | null;
}
const listeners = new Set<() => void>();
let status: PassiveAuditStatus = { completed: 0, total: APP_HEALTH_DATA_CHECKS.length,
  updatedAt: null, nativeStatus: 'unknown', busy: false, linksCompleted: 0, linksTotal: 0, linksPreparing: false, linksCapped: false, lastError: null };
let record: PassiveAuditRecord | null = null;
let recordDirty = false;
let snapshot: AppHealthDataSnapshot | null = null;
let references: unknown[] = [];
let paused = false;
let loaded = false;
let inFlight: Promise<boolean> | null = null;
let getState: (() => AppState) | null = null;

export const passiveAuditAppBuild = (): string =>
  `${Application.nativeApplicationVersion ?? 'unknown'}:${Application.nativeBuildVersion ?? 'unknown'}`;
export const getPassiveAuditStatus = (): PassiveAuditStatus => status;
export function subscribePassiveAudit(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emit(patch: Partial<PassiveAuditStatus> = {}): void {
  const links = passiveLinkProgress();
  status = { ...status, ...patch, completed: Object.values(record?.entries ?? {}).filter(entry =>
    Date.now() >= entry.checkedAt && Date.now() - entry.checkedAt < PASSIVE_AUDIT_MAX_AGE_MS).length,
    linksCompleted: links.completed, linksTotal: links.total, linksPreparing: links.preparing, linksCapped: links.capped,
    updatedAt: record ? new Date(Math.max(record.inputAt,
      ...Object.values(record.entries).map(entry => entry.checkedAt))).toISOString() : null };
  for (const listener of listeners) listener();
}
function reportPassiveFailure(): void {
  // Storage/native error strings may contain private paths or input. Keep the
  // user-visible status generic while retaining dirty work for the next slice.
  emit({ lastError: 'Background checks could not prepare or save progress. Automatic retry is pending.' });
}
export function setPassiveAuditPaused(value: boolean): void { paused = value; }
const blocked = () => paused || hasAppHealthFetchGuard();

/** Installed at module scope by the store, so headless task entry has a getter
 * without importing the store here (or invoking bootstrap/network work). */
export function configurePassiveAuditState(readState: () => AppState): void { getState = readState; }

function stateBusy(state: AppState): boolean {
  return Boolean(state.refreshing || state.postRefreshWarming || state.detailsLoading || state.bankRateHistoryLoading);
}
function prepareLoadedState(state: AppState): void {
  const next = [state.core, state.manifest, state.coreIntegrity, state.source,
    state.details, state.searchIndex, state.searchIndexStatus, state.historyBanks, state.historyBanksError,
    state.bankInsights, state.bankInsightsError, state.bankSpreadHistory, state.bankSpreadHistoryError,
    state.rbaCalendar, state.rbaCalendarError, state.prefs.profileFilters, state.prefs.interests,
    state.prefs.includeNonStandard, getSuitabilityIndex(), getSuitabilityRevision(), getMandatoryEligibilityRevision()];
  if (record && passiveAuditRecordFresh(record, Date.now()) &&
    next.length === references.length && next.every((value, i) => value === references[i])) return;
  // A cold standard-only catalogue would invoke expensive fallback classifiers.
  // Wait for the app's ordinary suitability warm-up; never load/install it here.
  const includeCatalogue = state.prefs.includeNonStandard || getSuitabilityIndex() !== null || !isSuitabilityFilterReady(false);
  const nextSnapshot = appHealthDataSnapshot(state, Application.nativeApplicationVersion ?? 'unknown', includeCatalogue);
  const candidate = newPassiveAuditRecord(nextSnapshot, passiveAuditAppBuild(), Date.now());
  // A new object for the same signed publication can still change normalized
  // rows in memory. Keep only metadata entries in that case; recheck row jobs.
  if (record && candidate?.key === record.key && passiveAuditRecordFresh(record, Date.now())) {
    if (references.length && next[0] !== references[0]) {
      for (const job of APP_HEALTH_DATA_CHECKS) if (!job.backgroundMetadataOnly) delete record.entries[job.code];
    }
  } else {
    if (candidate && record && passiveAuditRecordFresh(record, Date.now())) {
      for (const job of APP_HEALTH_DATA_CHECKS) {
        const entry = record.entries[job.code];
        if (entry && entry.inputKey === passiveAuditCheckKey(nextSnapshot, passiveAuditAppBuild(), job.code) &&
          (job.backgroundMetadataOnly || !references.length || next[0] === references[0])) {
          candidate.entries[job.code] = entry;
        }
      }
    }
    record = candidate;
  }
  snapshot = nextSnapshot;
  references = next;
}

async function load(): Promise<void> {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  record = parsePassiveAuditRecord(raw, passiveAuditAppBuild(), Date.now());
  loaded = true;
  emit();
}

/** A single serialized, bounded slice. The native task never loads the core or
 * history: it uses an already-loaded snapshot, or persisted compact metadata. */
export function runPassiveAuditSlice(native = false): Promise<boolean> {
  if (inFlight) return inFlight;
  if (blocked()) return Promise.resolve(true);
  const run = async () => {
    await load();
    if (blocked()) return true;
    const state = getState?.();
    if (state && stateBusy(state)) return true;
    const previousRecord = record;
    const previousCount = Object.keys(record?.entries ?? {}).length;
    const start = Date.now();
    let didWork = false;
    if (state?.core) prepareLoadedState(state);
    else snapshot = null;
    if (record && !passiveAuditRecordFresh(record, Date.now())) record = null;
    emit({ busy: true });
    // Slow foreground preloading: one check every five seconds, after idle.
    // OS wake: at most sixteen checks / 250ms, preserving progress each slice.
    for (let count = 0; record && count < (native ? 16 : 1) && !blocked() && Date.now() - start < 250; count++) {
      if (!runPassiveAuditCheck(record, snapshot)) break;
      didWork = true;
      if (Date.now() - start >= 250) break;
      if (native) await new Promise<void>(resolve => setTimeout(resolve, 5));
    }
    const changed = didWork || record !== previousRecord || Object.keys(record?.entries ?? {}).length !== previousCount;
    recordDirty = recordDirty || changed;
    const raw = record && recordDirty ? serializePassiveAuditRecord(record) : null;
    if (record && recordDirty && !raw) throw new Error('Passive data checkpoint exceeds its storage budget.');
    if (raw) {
      await AsyncStorage.setItem(STORAGE_KEY, raw);
      recordDirty = false;
    }
    if (!blocked()) await preloadPassiveLinks({ appBuild: passiveAuditAppBuild(),
      revision: linkRevision(state), details: state?.details ?? null, platform: Platform.OS, stopped: blocked });
    emit({ lastError: null });
    return true;
  };
  inFlight = run().catch(() => {
    // Persistence or native availability must never interrupt normal browsing.
    reportPassiveFailure();
    return false;
  }).finally(() => { inFlight = null; emit({ busy: false }); });
  return inFlight;
}

export function passiveAuditDataChecks(input: AppHealthDataSnapshot) {
  return reusePassiveAuditChecks(record, input, passiveAuditAppBuild());
}
function linkRevision(state: AppState | undefined): string | null {
  const manifest = state?.manifest;
  return manifest?.files?.core?.sha256 && manifest.files.details?.sha256
    ? `${manifest.run_date}:${manifest.files.core.sha256}:${manifest.files.details.sha256}` : null;
}
export function getPreloadedExternalLink(request: TrustedExternalUrlRequest) {
  return preloadedPassiveLink(request, passiveAuditAppBuild(), linkRevision(getState?.()));
}

/** No interval runs while the app is backgrounded; the native OS worker owns
 * that lifecycle. Idle callbacks have no timeout that could force busy UI work. */
export function startPassiveAuditPreloading(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let idle: number | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    if (idle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
    timer = null; idle = null;
  };
  const schedule = () => {
    cancel();
    if (stopped || NativeAppState.currentState !== 'active') return;
    timer = setTimeout(() => {
      const work = () => {
        idle = null;
        if (stopped || NativeAppState.currentState !== 'active') return;
        void runPassiveAuditSlice().finally(schedule);
      };
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(work);
      else work();
    }, IDLE_INTERVAL_MS);
  };
  const subscription = NativeAppState.addEventListener('change', () => {
    if (NativeAppState.currentState !== 'active') void flushPassiveLinks().catch(reportPassiveFailure);
    schedule();
  });
  schedule();
  return () => { stopped = true; cancel(); subscription.remove(); };
}

export async function registerPassiveAuditBackground(): Promise<boolean> {
  if (Platform.OS === 'web') { emit({ nativeStatus: 'unavailable' }); return false; }
  try {
    const available = await BackgroundTask.getStatusAsync();
    if (available !== BackgroundTask.BackgroundTaskStatus.Available) {
      emit({ nativeStatus: 'restricted' }); return false;
    }
    // Expo shares one worker; match the existing refresh interval so registering
    // passive audit does not increase the app's network/battery refresh cadence.
    await BackgroundTask.registerTaskAsync(PASSIVE_AUDIT_TASK, { minimumInterval: 60 * 6 });
    const registered = await TaskManager.isTaskRegisteredAsync(PASSIVE_AUDIT_TASK);
    emit({ nativeStatus: registered ? 'registered' : 'unavailable' });
    return registered;
  } catch { emit({ nativeStatus: 'unavailable' }); return false; }
}

try {
  if (typeof TaskManager.isTaskDefined === 'function' && !TaskManager.isTaskDefined(PASSIVE_AUDIT_TASK)) {
    TaskManager.defineTask(PASSIVE_AUDIT_TASK, async () => {
      const succeeded = await runPassiveAuditSlice(true);
      try {
        await flushPassiveLinks();
        return succeeded ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
      } catch {
        reportPassiveFailure();
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  }
} catch { /* Web/native-unavailable runtimes retain passive foreground work. */ }
