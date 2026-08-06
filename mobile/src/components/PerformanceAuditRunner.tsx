import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  BackHandler,
  AppState,
  InteractionManager,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MANIFEST_URL } from '../config';
import { useStore } from '../data/store';
import { debugLog, formatLogUploadBody, uploadDebugLog } from '../lib/debugLog';
import { reportPerformanceAudit } from '../lib/observability';
import {
  buildPerformanceAuditJourneys,
  cancelPerformanceAudit,
  captureAuditTrace,
  completePerformanceAudit,
  failPerformanceAudit,
  formatAuditError,
  getPerformanceAuditState,
  markPerformanceAuditCheckStored,
  markPerformanceAuditCancelled,
  markPerformanceAuditRunning,
  pathMatches,
  PERFORMANCE_AUDIT_LOG_TAG,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  PerformanceAuditInactivityWatchdog,
  ResponsivenessMonitor,
  resolveAuditJourneyOptionalData,
  roundMetric,
  scoreLatency,
  subscribePerformanceAudit,
  summarizePerformanceAudit,
  updatePerformanceAuditProgress,
  worstStatus,
  type AuditCheck,
  type AuditCheckStatus,
  type AuditEnvironment,
  type AuditJourney,
  type PerformanceAuditReport,
  type ResponsivenessMetrics,
} from '../lib/performanceAudit';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

const AUDIT_HOME_PATH = '/performance-audit';
const ROUTE_TIMEOUT_MS = 8_000;
const DATA_SETTLE_TIMEOUT_MS = 30_000;
const NETWORK_TIMEOUT_MS = 12_000;
const ROUTE_DWELL_MS = 350;
const RUNTIME_SAMPLE_MS = 1_250;
const BENCHMARK_CHECKS = 5;
const STORAGE_KEY_PREFIX = '@ar/performance-audit/';
const FILE_PAYLOAD_BYTES = 128 * 1024;
const STORAGE_PAYLOAD_BYTES = 64 * 1024;
const AUDIT_KEEP_AWAKE_TAG = 'performance-audit';

class AuditCancelledError extends Error {
  constructor() {
    super('Performance audit cancelled');
    this.name = 'AuditCancelledError';
  }
}

class AuditInactivityError extends Error {
  constructor(watchdog: PerformanceAuditInactivityWatchdog) {
    super(
      `Performance audit stored no completed check for ${watchdog.hangTimeoutMs}ms ` +
        `(stored checks: ${watchdog.storedCheckCount})`,
    );
    this.name = 'AuditInactivityError';
  }
}

class AuditDatasetChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditDatasetChangedError';
  }
}

interface AuditDatasetRevision {
  runDate: string | null;
  manifestRunDate: string | null;
  coreSha: string | null;
  detailsSha: string | null;
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertAuditActive(): void {
  if (getPerformanceAuditState().cancelRequested) throw new AuditCancelledError();
}

function assertSessionActive(watchdog: PerformanceAuditInactivityWatchdog): void {
  assertAuditActive();
  if (watchdog.isExpired()) throw new AuditInactivityError(watchdog);
}

function rethrowAuditControl(error: unknown): void {
  if (error instanceof AuditCancelledError || getPerformanceAuditState().cancelRequested) {
    throw error instanceof AuditCancelledError ? error : new AuditCancelledError();
  }
  if (error instanceof AuditInactivityError) throw error;
  if (error instanceof AuditDatasetChangedError) throw error;
}

function timeoutAfter<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') {
    await delay(17);
    return;
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function settleUiUnchecked(): Promise<void> {
  await timeoutAfter(
    new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    }),
    3_000,
    'UI settle',
  ).catch(() => {});
  await nextFrame();
  await nextFrame();
}

async function settleUi(): Promise<void> {
  await settleUiUnchecked();
  assertAuditActive();
}

function captureDatasetRevision(): AuditDatasetRevision {
  const state = useStore.getState();
  return {
    runDate: state.core?.run_date ?? null,
    manifestRunDate: state.manifest?.run_date ?? null,
    coreSha: state.manifest?.files.core.sha256 ?? null,
    detailsSha: state.manifest?.files.details.sha256 ?? null,
  };
}

function datasetRevisionLabel(revision: AuditDatasetRevision): string {
  return [
    revision.runDate ?? 'no-core',
    revision.manifestRunDate ?? 'no-manifest',
    revision.coreSha ?? 'no-core-sha',
    revision.detailsSha ?? 'no-details-sha',
  ].join('|');
}

function assertDatasetRevision(expected: AuditDatasetRevision): void {
  const state = useStore.getState();
  if (state.refreshing || state.postRefreshWarming) {
    throw new AuditDatasetChangedError('Dataset refresh started during the performance audit');
  }
  const actual = captureDatasetRevision();
  if (datasetRevisionLabel(actual) !== datasetRevisionLabel(expected)) {
    throw new AuditDatasetChangedError(
      `Dataset revision changed during the performance audit: expected ${datasetRevisionLabel(expected)}, received ${datasetRevisionLabel(actual)}`,
    );
  }
}

async function waitForRefreshWork(watchdog: PerformanceAuditInactivityWatchdog): Promise<void> {
  while (true) {
    assertSessionActive(watchdog);
    const state = useStore.getState();
    if (!state.refreshing && !state.postRefreshWarming) {
      // Require a short quiet window so the refresh finally block cannot move
      // into post-warm between the check and the audit snapshot.
      await delay(150);
      assertSessionActive(watchdog);
      const settled = useStore.getState();
      if (!settled.refreshing && !settled.postRefreshWarming) return;
    }
    await delay(50);
  }
}

async function waitForPath(
  currentPath: () => string,
  expected: string,
  label: string,
  options: {
    watchdog?: PerformanceAuditInactivityWatchdog;
    checkAuditState?: boolean;
  } = {},
): Promise<void> {
  const routeDeadlineMs = now() + ROUTE_TIMEOUT_MS;
  while (!pathMatches(currentPath(), expected)) {
    if (options.checkAuditState !== false) {
      if (options.watchdog) {
        assertSessionActive(options.watchdog);
      } else {
        assertAuditActive();
      }
    }
    if (now() >= routeDeadlineMs) {
      throw new Error(`${label} did not reach ${expected}; current path is ${currentPath()}`);
    }
    await delay(25);
  }
}

async function recoverAuditRoute(currentPath: () => string): Promise<void> {
  if (pathMatches(currentPath(), AUDIT_HOME_PATH)) return;
  router.replace(AUDIT_HOME_PATH);
  await waitForPath(currentPath, AUDIT_HOME_PATH, 'Performance audit route recovery', {
    checkAuditState: false,
  });
  await settleUiUnchecked();
}

function logAuditEvent(event: Record<string, unknown>): void {
  debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, JSON.stringify(event));
}

function logAuditCheck(sessionId: string, check: AuditCheck): void {
  logAuditEvent({ kind: 'check', sessionId, check });
}

function responsivenessRecord(
  metrics: ResponsivenessMetrics,
  prefix = '',
): Record<string, number> {
  const key = (name: string) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
  return {
    [key('eventLoopSamples')]: metrics.eventLoopSamples,
    [key('eventLoopP95Ms')]: metrics.eventLoopP95Ms,
    [key('maxEventLoopLagMs')]: metrics.maxEventLoopLagMs,
    [key('stallsOver100Ms')]: metrics.stallsOver100Ms,
    [key('frameSamples')]: metrics.frameSamples,
    [key('frameP95Ms')]: metrics.frameP95Ms,
    [key('maxFrameGapMs')]: metrics.maxFrameGapMs,
    [key('framesOver50Ms')]: metrics.framesOver50Ms,
  };
}

const EMPTY_RESPONSIVENESS: ResponsivenessMetrics = {
  eventLoopSamples: 0,
  eventLoopP95Ms: 0,
  maxEventLoopLagMs: 0,
  stallsOver100Ms: 0,
  frameSamples: 0,
  frameP95Ms: 0,
  maxFrameGapMs: 0,
  framesOver50Ms: 0,
};

function responsivenessStatus(metrics: ResponsivenessMetrics): AuditCheckStatus {
  return worstStatus(
    scoreLatency(metrics.maxEventLoopLagMs, 100, 300),
    scoreLatency(metrics.maxFrameGapMs, 80, 250),
  );
}

function loadedProductCount(core: ReturnType<typeof useStore.getState>['core']): number {
  if (!core) return 0;
  const keys = new Set<string>();
  for (const section of Object.values(core.sections)) {
    for (const row of section.rates ?? []) keys.add(row.product_key);
  }
  return keys.size;
}

function jsEngineName(): string {
  const target = global as typeof global & {
    HermesInternal?: unknown;
    navigator?: { userAgent?: string };
  };
  if (target.HermesInternal) return 'Hermes';
  const userAgent = target.navigator?.userAgent ?? '';
  if (/firefox/i.test(userAgent)) return 'SpiderMonkey';
  if (/(chrome|chromium|crios|edg)/i.test(userAgent)) return 'V8';
  if (/safari/i.test(userAgent)) return 'JavaScriptCore';
  return Platform.OS === 'ios' ? 'JavaScriptCore' : 'unknown';
}

async function collectEnvironment(
  width: number,
  height: number,
  fontScale: number,
): Promise<AuditEnvironment> {
  const store = useStore.getState();
  const network = await timeoutAfter(
    Network.getNetworkStateAsync(),
    3_000,
    'Network state',
  ).catch(() => null);
  return {
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    buildVersion: Application.nativeBuildVersion ?? 'unknown',
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    manufacturer: Device.manufacturer ?? null,
    brand: Device.brand ?? null,
    model: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    totalMemoryBytes: Device.totalMemory ?? null,
    jsEngine: jsEngineName(),
    developmentBuild: __DEV__,
    viewportWidth: roundMetric(width),
    viewportHeight: roundMetric(height),
    fontScale: roundMetric(fontScale),
    payloadSource: store.source,
    payloadRunDate: store.core?.run_date ?? null,
    payloadProducts: loadedProductCount(store.core),
    payloadProviders: Object.keys(store.core?.brands ?? {}).length,
    detailsLoaded: store.details != null,
    historyLoaded: store.historyBanks != null,
    productHistoryLoaded: store.productHistory != null,
    diagnosticsUploadEnabled: store.prefs.crashReportsEnabled,
    networkType: network?.type != null ? String(network.type) : null,
    networkConnected: network?.isConnected ?? null,
    networkInternetReachable: network?.isInternetReachable ?? null,
  };
}

async function runRuntimeCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('runtime responsiveness baseline');
  const started = now();
  const snapshot = monitor.snapshot();
  await delay(RUNTIME_SAMPLE_MS);
  assertSessionActive(watchdog);
  const metrics = monitor.metricsSince(snapshot);
  return {
    id: 'runtime-responsiveness',
    label: 'Idle responsiveness baseline',
    kind: 'runtime',
    status: responsivenessStatus(metrics),
    durationMs: roundMetric(now() - started),
    metrics: responsivenessRecord(metrics),
    trace,
  };
}

async function runStorageCheck(
  sessionId: string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('AsyncStorage write read remove');
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
  const payload = JSON.stringify({
    schema: 1,
    sessionId,
    body: 's'.repeat(STORAGE_PAYLOAD_BYTES),
  });
  const started = now();
  const responsiveAt = monitor.snapshot();
  const writeTimes: number[] = [];
  const readTimes: number[] = [];
  let error: string | undefined;
  let temporaryKeyDeleted = false;
  try {
    for (let index = 0; index < 3; index += 1) {
      assertSessionActive(watchdog);
      let at = now();
      await AsyncStorage.setItem(key, payload);
      assertSessionActive(watchdog);
      writeTimes.push(now() - at);
      at = now();
      const restored = await AsyncStorage.getItem(key);
      assertSessionActive(watchdog);
      readTimes.push(now() - at);
      if (restored !== payload) throw new Error('AsyncStorage readback did not match the test payload');
    }
    assertSessionActive(watchdog);
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  } finally {
    try {
      await AsyncStorage.removeItem(key);
      temporaryKeyDeleted = true;
    } catch (caught) {
      error ??= formatAuditError(caught);
    }
  }
  const maxWriteMs = writeTimes.reduce((maximum, value) => Math.max(maximum, value), 0);
  const maxReadMs = readTimes.reduce((maximum, value) => Math.max(maximum, value), 0);
  const responsiveness = monitor.metricsSince(responsiveAt);
  return {
    id: 'async-storage',
    label: 'Preferences storage round-trip',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(maxWriteMs, 50, 200),
          scoreLatency(maxReadMs, 50, 200),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadBytes: payload.length,
      iterations: writeTimes.length,
      maxWriteMs: roundMetric(maxWriteMs),
      maxReadMs: roundMetric(maxReadMs),
      averageWriteMs: roundMetric(
        writeTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, writeTimes.length),
      ),
      averageReadMs: roundMetric(
        readTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, readTimes.length),
      ),
      temporaryKeyDeleted,
      ...responsivenessRecord(responsiveness),
    },
    trace,
    ...(error ? { error } : {}),
  };
}

async function runFileSystemCheck(
  sessionId: string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('filesystem write read remove');
  const started = now();
  const responsiveAt = monitor.snapshot();
  if (!FileSystem.documentDirectory) {
    const responsiveness = monitor.metricsSince(responsiveAt);
    return {
      id: 'file-system',
      label: 'Log filesystem round-trip',
      kind: 'storage',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: {
        reason: 'documentDirectory unavailable',
        ...responsivenessRecord(responsiveness),
      },
      trace,
    };
  }
  const uri = `${FileSystem.documentDirectory}performance-audit-${sessionId}.tmp`;
  const payload = 'f'.repeat(FILE_PAYLOAD_BYTES);
  let writeMs = 0;
  let readMs = 0;
  let error: string | undefined;
  let temporaryFileDeleted = false;
  try {
    assertSessionActive(watchdog);
    let at = now();
    await FileSystem.writeAsStringAsync(uri, payload);
    assertSessionActive(watchdog);
    writeMs = now() - at;
    at = now();
    const restored = await FileSystem.readAsStringAsync(uri);
    assertSessionActive(watchdog);
    readMs = now() - at;
    if (restored.length !== payload.length) {
      throw new Error(`Filesystem readback length ${restored.length} did not match ${payload.length}`);
    }
    assertSessionActive(watchdog);
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  } finally {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      temporaryFileDeleted = true;
    } catch (caught) {
      error ??= formatAuditError(caught);
    }
  }
  const responsiveness = monitor.metricsSince(responsiveAt);
  return {
    id: 'file-system',
    label: 'Log filesystem round-trip',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(writeMs, 80, 300),
          scoreLatency(readMs, 80, 300),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadBytes: payload.length,
      writeMs: roundMetric(writeMs),
      readMs: roundMetric(readMs),
      temporaryFileDeleted,
      ...responsivenessRecord(responsiveness),
    },
    trace,
    ...(error ? { error } : {}),
  };
}

async function runDataCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('active payload serialize parse filter sort');
  const core = useStore.getState().core;
  const started = now();
  if (!core) {
    return {
      id: 'active-data',
      label: 'Active payload processing',
      kind: 'data',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: { reason: 'No active payload is loaded' },
      trace,
    };
  }

  const responsiveAt = monitor.snapshot();
  let stringifyMs = 0;
  let parseMs = 0;
  let traversalMs = 0;
  let payloadChars = 0;
  let rateRows = 0;
  let error: string | undefined;
  try {
    assertSessionActive(watchdog);
    let at = now();
    const serialized = JSON.stringify(core);
    stringifyMs = now() - at;
    payloadChars = serialized.length;
    // This is a capacity benchmark, not a production cache transaction. Yield
    // between its deliberately heavy phases so the audit itself does not create
    // one long JS-thread freeze and then attribute that freeze to the app.
    await nextFrame();
    assertSessionActive(watchdog);
    at = now();
    const parsed = JSON.parse(serialized) as typeof core;
    parseMs = now() - at;
    await nextFrame();
    assertSessionActive(watchdog);
    at = now();
    for (const section of Object.values(parsed.sections)) {
      const rates = [...(section.rates ?? [])];
      rateRows += rates.length;
      rates
        .filter((row) => Number.isFinite(Number(row.rate)))
        .sort((left, right) => Number(left.rate) - Number(right.rate))
        .slice(0, 25);
    }
    traversalMs = now() - at;
    await nextFrame();
    assertSessionActive(watchdog);
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  }
  const responsiveness = monitor.metricsSince(responsiveAt);
  const processingStatus = worstStatus(
    scoreLatency(stringifyMs, 250, 1_000),
    scoreLatency(parseMs, 350, 1_500),
    responsivenessStatus(responsiveness),
  );
  return {
    id: 'active-data',
    label: 'Active payload processing',
    kind: 'data',
    status: error ? 'fail' : processingStatus,
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadChars,
      rateRows,
      stringifyMs: roundMetric(stringifyMs),
      parseMs: roundMetric(parseMs),
      traversalMs: roundMetric(traversalMs),
      ...responsivenessRecord(responsiveness),
    },
    trace,
    ...(error ? { error } : {}),
  };
}

async function runNetworkCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('manifest network request and JSON parse');
  const started = now();
  const responsiveAt = monitor.snapshot();
  assertSessionActive(watchdog);
  const abort = new AbortController();
  const timeoutMs = Math.max(
    1,
    Math.min(NETWORK_TIMEOUT_MS, Math.floor(watchdog.remainingMs())),
  );
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const cancelTimer = setInterval(() => {
    if (getPerformanceAuditState().cancelRequested) abort.abort();
  }, 50);
  let headersMs = 0;
  let bodyMs = 0;
  let parseMs = 0;
  let statusCode = 0;
  let responseChars = 0;
  let error: string | undefined;
  try {
    assertSessionActive(watchdog);
    const response = await fetch(MANIFEST_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: abort.signal,
    });
    headersMs = now() - started;
    statusCode = response.status;
    const bodyStarted = now();
    const body = await response.text();
    bodyMs = now() - bodyStarted;
    responseChars = body.length;
    if (!response.ok) throw new Error(`Manifest request returned HTTP ${response.status}`);
    const parseStarted = now();
    JSON.parse(body);
    parseMs = now() - parseStarted;
    assertSessionActive(watchdog);
  } catch (caught) {
    if (getPerformanceAuditState().cancelRequested) throw new AuditCancelledError();
    if (watchdog.isExpired()) throw new AuditInactivityError(watchdog);
    error = formatAuditError(caught);
  } finally {
    clearTimeout(timer);
    clearInterval(cancelTimer);
  }
  const durationMs = now() - started;
  const responsiveness = monitor.metricsSince(responsiveAt);
  return {
    id: 'manifest-network',
    label: 'Live manifest network round-trip',
    kind: 'network',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(durationMs, 1_500, 5_000),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(durationMs),
    metrics: {
      statusCode,
      responseChars,
      headersMs: roundMetric(headersMs),
      bodyMs: roundMetric(bodyMs),
      parseMs: roundMetric(parseMs),
      timeoutMs,
      ...responsivenessRecord(responsiveness),
    },
    trace,
    ...(error ? { error } : {}),
  };
}

const JOURNEY_ERROR_TAGS = new Set([
  'app',
  'global',
  'store',
  'payload',
  'bankInsights',
  'historySelectors',
  'historyPayload',
  'BankTrendChart',
  'ProductHistoryChart',
  'RateHeatCalendar',
  'LenderRaceChart',
  'SwitcherEdgeChart',
  'MarketSeismograph',
]);

function routeErrorMessages(logCursor: number): {
  journey: string[];
  incidental: string[];
} {
  const messages = debugLog
    .getEntriesAfter(logCursor)
    .filter((entry) => entry.level === 'error' && entry.tag !== PERFORMANCE_AUDIT_LOG_TAG)
    .map((entry) => ({
      tag: entry.tag,
      message: `${entry.tag}: ${entry.message}`,
    }));
  return {
    journey: messages
      .filter(({ tag }) => JOURNEY_ERROR_TAGS.has(tag))
      .map(({ message }) => message),
    incidental: messages
      .filter(({ tag }) => !JOURNEY_ERROR_TAGS.has(tag))
      .map(({ message }) => message),
  };
}

type JourneyDataState = 'pending' | 'ready' | 'failed';

interface JourneyDataRequirement {
  label: string;
  state: () => JourneyDataState;
  error: () => string | null;
}

function detailsPayloadMatches(state: ReturnType<typeof useStore.getState>): boolean {
  return !!state.core && state.details?.run_date === state.core.run_date;
}

function journeyDataRequirements(
  journey: AuditJourney,
  logCursor: number,
): JourneyDataRequirement[] {
  const initial = useStore.getState();
  const { prefs, manifest, source } = initial;
  const optionalData = resolveAuditJourneyOptionalData(
    journey.id,
    prefs,
    !!manifest?.files.search_index,
  );
  const requirements: JourneyDataRequirement[] = [];
  const add = (
    label: string,
    ready: (state: ReturnType<typeof useStore.getState>) => boolean,
    failed: (state: ReturnType<typeof useStore.getState>) => string | null,
  ) => {
    requirements.push({
      label,
      state: () => {
        const state = useStore.getState();
        if (ready(state)) return 'ready';
        return failed(state) ? 'failed' : 'pending';
      },
      error: () => failed(useStore.getState()),
    });
  };

  // A destination that starts details processing must finish it before the
  // runner leaves, even if that destination did not require details up front.
  if (initial.detailsLoading) {
    add(
      'Product details',
      (state) => !state.detailsLoading && detailsPayloadMatches(state),
      (state) =>
        !state.detailsLoading && !detailsPayloadMatches(state)
          ? 'Product details finished without a payload matching the active rates date'
          : null,
    );
  }

  if (journey.id === 'search') {
    add(
      'Product details',
      (state) => !state.detailsLoading && detailsPayloadMatches(state),
      (state) =>
        !state.detailsLoading && !detailsPayloadMatches(state)
          ? 'Product details did not load for the active rates date'
          : null,
    );
    if (optionalData.deepSearch) {
      add(
        'Deep-search index',
        (state) => !!state.searchIndex,
        () => {
          const failure = [...debugLog.getEntriesAfter(logCursor)]
            .reverse()
            .find(
              (entry) =>
                entry.tag === 'store' &&
                entry.message.startsWith('ensureSearchIndex failed:'),
            );
          return failure?.message ?? null;
        },
      );
    }
  }

  const needsRbaCalendar =
    source === 'remote' &&
    !!manifest?.files.rba_calendar &&
    ['response', 'outlook', 'rba-redirect'].includes(journey.id);
  if (needsRbaCalendar) {
    add(
      'RBA calendar',
      (state) => !!state.rbaCalendar,
      (state) => state.rbaCalendarError,
    );
  }

  if (optionalData.bankInsights) {
    add(
      'Bank response analysis',
      (state) => !!state.bankInsights,
      (state) => state.bankInsightsError,
    );
  }

  if (optionalData.bankHistory) {
    add(
      'Bank history',
      (state) => !!state.historyBanks,
      (state) => state.historyBanksError,
    );
  }
  if (optionalData.productHistory) {
    add(
      'Product history',
      (state) => !!state.productHistory,
      (state) => state.productHistoryError,
    );
  }

  return requirements;
}

async function waitForJourneyData(
  journey: AuditJourney,
  logCursor: number,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<{
  labels: string[];
  durationMs: number;
}> {
  // Give mounted effects a chance to claim their store work before inspecting
  // loading state. The subsequent poll keeps that cold work inside this
  // journey instead of letting it spill into later checks.
  await delay(100);
  assertSessionActive(watchdog);
  const requirements = journeyDataRequirements(journey, logCursor);
  const labels = [...new Set(requirements.map(({ label }) => label))];
  if (requirements.length === 0) return { labels, durationMs: 0 };

  const started = now();
  const settleDeadlineMs = started + DATA_SETTLE_TIMEOUT_MS;
  while (true) {
    assertSessionActive(watchdog);
    const failed = requirements.find((requirement) => requirement.state() === 'failed');
    if (failed) {
      throw new Error(`${failed.label} failed to settle: ${failed.error() ?? 'unknown error'}`);
    }
    if (requirements.every((requirement) => requirement.state() === 'ready')) {
      return { labels, durationMs: now() - started };
    }
    if (now() >= settleDeadlineMs) {
      const pending = requirements
        .filter((requirement) => requirement.state() === 'pending')
        .map(({ label }) => label);
      throw new Error(
        `Background work did not settle after ${DATA_SETTLE_TIMEOUT_MS}ms: ${pending.join(', ')}`,
      );
    }
    await delay(50);
  }
}

async function runJourney(
  journey: AuditJourney,
  currentPath: () => string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  datasetRevision: AuditDatasetRevision,
): Promise<AuditCheck> {
  const trace = captureAuditTrace(`route journey ${journey.id}`);
  const started = now();
  if (!journey.href) {
    return {
      id: `journey-${journey.id}`,
      label: journey.label,
      kind: 'journey',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: { reason: journey.skipReason ?? 'Route unavailable' },
      trace,
    };
  }

  const responsivenessAt = monitor.snapshot();
  const logCursor = debugLog.getCursor();
  let forwardMs = 0;
  let backgroundSettleMs = 0;
  let backgroundTasks: string[] = [];
  let backMs = 0;
  let returnFallbackMs = 0;
  let backDestination: string | null = null;
  let backReturnedToAudit = false;
  let backChangedPath = false;
  let returnNavigationKind:
    | 'none'
    | 'second-back'
    | 'replace-recovery'
    | 'second-back+replace-recovery' = 'none';
  let secondBackMs = 0;
  let replaceRecoveryMs = 0;
  let forwardResponsiveness = EMPTY_RESPONSIVENESS;
  let backgroundResponsiveness = EMPTY_RESPONSIVENESS;
  let backResponsiveness = EMPTY_RESPONSIVENESS;
  let routeError: string | undefined;

  try {
    assertSessionActive(watchdog);
    assertDatasetRevision(datasetRevision);
    let at = now();
    const forwardResponsivenessAt = monitor.snapshot();
    router.push(journey.href);
    await waitForPath(
      currentPath,
      journey.expectedPath,
      `${journey.label} forward navigation`,
      { watchdog },
    );
    await settleUi();
    assertSessionActive(watchdog);
    assertDatasetRevision(datasetRevision);
    forwardMs = now() - at;
    forwardResponsiveness = monitor.metricsSince(forwardResponsivenessAt);
    if (
      journey.expectedSection &&
      useStore.getState().activeSection !== journey.expectedSection
    ) {
      throw new Error(
        `${journey.label} rendered ${useStore.getState().activeSection} instead of ${journey.expectedSection}`,
      );
    }
    const backgroundResponsivenessAt = monitor.snapshot();
    const background = await waitForJourneyData(
      journey,
      logCursor,
      watchdog,
    );
    backgroundSettleMs = background.durationMs;
    backgroundTasks = background.labels;
    assertDatasetRevision(datasetRevision);
    // Keep the destination mounted long enough to expose deferred work,
    // subscriptions, and JS stalls without charging the deliberate dwell to
    // the forward-navigation latency.
    await delay(ROUTE_DWELL_MS);
    backgroundResponsiveness = monitor.metricsSince(backgroundResponsivenessAt);
    assertSessionActive(watchdog);
    assertDatasetRevision(datasetRevision);

    const pathBeforeBack = currentPath();
    at = now();
    const backResponsivenessAt = monitor.snapshot();
    router.back();
    // Tabs own their own history and commonly back to Home rather than the
    // root-stack audit screen. Measure the real back transition first, then
    // restore the runner explicitly instead of charging an 8s path timeout.
    await settleUi();
    assertSessionActive(watchdog);
    assertDatasetRevision(datasetRevision);
    backMs = now() - at;
    backResponsiveness = monitor.metricsSince(backResponsivenessAt);
    backDestination = currentPath();
    backReturnedToAudit = pathMatches(backDestination, AUDIT_HOME_PATH);
    backChangedPath = !pathMatches(backDestination, pathBeforeBack);

    if (
      !backReturnedToAudit &&
      journey.navigationKind === 'tab' &&
      pathMatches(backDestination, '/')
    ) {
      returnNavigationKind = 'second-back';
      const secondBackStarted = now();
      router.back();
      await settleUi();
      backReturnedToAudit = pathMatches(currentPath(), AUDIT_HOME_PATH);
      secondBackMs = now() - secondBackStarted;
      returnFallbackMs += secondBackMs;
    }

    if (!backReturnedToAudit) {
      returnNavigationKind =
        returnNavigationKind === 'second-back'
          ? 'second-back+replace-recovery'
          : 'replace-recovery';
      const fallbackStarted = now();
      router.replace(AUDIT_HOME_PATH);
      await waitForPath(
        currentPath,
        AUDIT_HOME_PATH,
        `${journey.label} return fallback`,
        { watchdog },
      );
      await settleUi();
      assertSessionActive(watchdog);
      replaceRecoveryMs = now() - fallbackStarted;
      returnFallbackMs += replaceRecoveryMs;
    }
  } catch (caught) {
    rethrowAuditControl(caught);
    routeError = formatAuditError(caught);
    if (!pathMatches(currentPath(), AUDIT_HOME_PATH)) {
      try {
        await recoverAuditRoute(currentPath);
      } catch (recoveryCaught) {
        throw new Error(
          `${routeError}\nRoute recovery failed: ${formatAuditError(recoveryCaught)}`,
        );
      }
    }
  }

  const responsiveness = monitor.metricsSince(responsivenessAt);
  const errors = routeErrorMessages(logCursor);
  const backContractStatus =
    journey.navigationKind === 'stack' && !backReturnedToAudit ? 'warn' : 'pass';
  const status = routeError || errors.journey.length
    ? 'fail'
    : worstStatus(
        scoreLatency(forwardMs, 900, 2_500),
        scoreLatency(backgroundSettleMs, 2_000, 10_000),
        scoreLatency(backMs, 800, 2_000),
        responsivenessStatus(responsiveness),
        backContractStatus,
      );
  return {
    id: `journey-${journey.id}`,
    label: journey.label,
    kind: 'journey',
    status,
    durationMs: roundMetric(now() - started),
    metrics: {
      expectedPath: journey.expectedPath,
      navigationKind: journey.navigationKind,
      forwardMs: roundMetric(forwardMs),
      backgroundSettleMs: roundMetric(backgroundSettleMs),
      backgroundTasks: backgroundTasks.join(', ') || null,
      backMs: roundMetric(backMs),
      backDestination,
      backChangedPath,
      backReturnedToAudit,
      returnNavigationKind,
      secondBackMs: roundMetric(secondBackMs),
      replaceRecoveryMs: roundMetric(replaceRecoveryMs),
      returnFallbackMs: roundMetric(returnFallbackMs),
      runtimeErrors: errors.journey.length,
      runtimeErrorMessages: errors.journey.join(' | ') || null,
      incidentalRuntimeErrors: errors.incidental.length,
      incidentalRuntimeErrorMessages: errors.incidental.join(' | ') || null,
      ...responsivenessRecord(responsiveness),
      ...responsivenessRecord(forwardResponsiveness, 'forward'),
      ...responsivenessRecord(backgroundResponsiveness, 'background'),
      ...responsivenessRecord(backResponsiveness, 'back'),
    },
    trace,
    ...(routeError ? { error: routeError } : {}),
  };
}

export function usePerformanceAuditState() {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
}

export function PerformanceAuditRunner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const pathname = usePathname();
  const state = usePerformanceAuditState();
  const runningRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (state.status !== 'queued' || runningRef.current || !state.sessionId || !state.startedAt) return;
    runningRef.current = true;

    const execute = async () => {
      const sessionId = state.sessionId!;
      const startedAt = state.startedAt!;
      const startedMs = Date.now();
      const watchdog = new PerformanceAuditInactivityWatchdog(state.hangTimeoutMs);
      const originalStore = useStore.getState();
      const originalActiveSection = originalStore.activeSection;
      const originalProfileFilters = JSON.parse(
        JSON.stringify(originalStore.prefs.profileFilters),
      ) as typeof originalStore.prefs.profileFilters;
      let journeys = buildPerformanceAuditJourneys(
        originalStore.core,
        originalStore.prefs.interests,
      );
      let total = BENCHMARK_CHECKS + journeys.length;
      const checks: AuditCheck[] = [];
      const monitor = new ResponsivenessMonitor();
      let completed = 0;
      let lastStoredCheckAt: string | null = null;

      const awaitStoredCheckFlush = async (): Promise<void> => {
        let settled = false;
        let failure: unknown;
        const flush = debugLog.flushToFile().then(
          () => {
            settled = true;
          },
          (error: unknown) => {
            failure = error;
            settled = true;
          },
        );
        while (!settled) {
          assertSessionActive(watchdog);
          await delay(Math.min(50, Math.max(1, watchdog.remainingMs())));
        }
        await flush;
        assertSessionActive(watchdog);
        if (failure) throw failure;
      };

      const record = async (check: AuditCheck) => {
        assertSessionActive(watchdog);
        checks.push(check);
        logAuditCheck(sessionId, check);
        // Only durable completed-check progress keeps the hang watchdog alive.
        await awaitStoredCheckFlush();
        watchdog.recordStoredCheck();
        lastStoredCheckAt = new Date().toISOString();
        completed += 1;
        markPerformanceAuditCheckStored(completed, total, check.label, lastStoredCheckAt);
      };

      markPerformanceAuditRunning(total);

      try {
        // Setup belongs inside the protected region so an unexpected native
        // keep-awake or monitor failure cannot leave the global running flag
        // latched forever.
        await activateKeepAwakeAsync(AUDIT_KEEP_AWAKE_TAG);
        monitor.start();
        updatePerformanceAuditProgress(
          completed,
          total,
          'Waiting for active payload work to finish',
        );
        await waitForRefreshWork(watchdog);
        const initialStore = useStore.getState();
        journeys = buildPerformanceAuditJourneys(
          initialStore.core,
          initialStore.prefs.interests,
        );
        total = BENCHMARK_CHECKS + journeys.length;
        const datasetRevision = captureDatasetRevision();
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(
          completed,
          total,
          'Capturing device and app state',
        );
        logAuditEvent({
          kind: 'start',
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          startedAt,
          plannedChecks: total,
          hangTimeoutMs: watchdog.hangTimeoutMs,
          watchdogMode: 'stored-check-inactivity',
          storedCheckCount: watchdog.storedCheckCount,
          lastStoredCheckAt,
          datasetRevision,
          trace: captureAuditTrace('performance audit start'),
        });

        const environment = await collectEnvironment(
          dimensions.width,
          dimensions.height,
          dimensions.fontScale,
        );
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        updatePerformanceAuditProgress(completed, total, 'Sampling idle responsiveness');
        await record(await runRuntimeCheck(monitor, watchdog));

        for (const journey of journeys) {
          assertSessionActive(watchdog);
          assertDatasetRevision(datasetRevision);
          updatePerformanceAuditProgress(
            completed,
            total,
            `Opening ${journey.label}, then going back`,
          );
          logAuditEvent({
            kind: 'journey-start',
            sessionId,
            id: journey.id,
            label: journey.label,
            trace: captureAuditTrace(`journey start ${journey.id}`),
          });
          await record(
            await runJourney(
              journey,
              () => pathnameRef.current,
              monitor,
              watchdog,
              datasetRevision,
            ),
          );
        }

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Testing preferences storage');
        await record(await runStorageCheck(sessionId, monitor, watchdog));

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Testing log file storage');
        await record(await runFileSystemCheck(sessionId, monitor, watchdog));

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Processing the active rates payload');
        await nextFrame();
        await record(await runDataCheck(monitor, watchdog));

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Timing the live manifest request');
        await record(await runNetworkCheck(monitor, watchdog));
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        const finishedAt = new Date().toISOString();
        const report: PerformanceAuditReport = {
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          startedAt,
          finishedAt,
          durationMs: Date.now() - startedMs,
          watchdog: {
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
          },
          environment,
          summary: summarizePerformanceAudit(checks),
          checks,
          limitations: [
            'JavaScript can record its scheduling stack and errors, but a native CPU/GPU sampling profiler is still required for native-thread instruction stacks.',
            'Animation callback gaps are JavaScript requestAnimationFrame timing, not proof of native GPU frame drops.',
            'The journey exercises every steady-state app destination plus forward/back navigation; it does not submit forms, change preferences, or mutate favourites.',
            `The run is pinned to dataset revision ${datasetRevisionLabel(datasetRevision)} and stops only after ${watchdog.hangTimeoutMs}ms without storing another completed check.`,
            environment.diagnosticsUploadEnabled
              ? 'A bounded, deidentified summary is submitted through Crashlytics. The complete report and tracebacks remain only in the local debug log unless explicitly exported.'
              : 'Automatic submission is disabled. The complete report and tracebacks remain in the local debug log unless explicitly exported.',
          ],
        };
        logAuditEvent({ kind: 'report', sessionId, report });
        reportPerformanceAudit(report);
        await debugLog.flushToFile();
        updatePerformanceAuditProgress(completed, total, 'Uploading log and copying link');
        let upload: { url?: string; provider?: string; error?: string } = {};
        try {
          const completeLog = await debugLog.readCompleteText();
          const result = await uploadDebugLog(
            formatLogUploadBody(completeLog, {
              app_version: environment.appVersion,
              build_version: environment.buildVersion,
              audit_session: sessionId,
            }),
          );
          if (result.truncated || result.clientTruncated) {
            throw new Error('The upload service did not accept the complete log.');
          }
          await Clipboard.setStringAsync(result.url);
          upload = { url: result.url, provider: result.provider };
          debugLog.info(
            PERFORMANCE_AUDIT_LOG_TAG,
            `complete log uploaded provider=${result.provider} linkCopied=true`,
          );
        } catch (uploadCaught) {
          const message = formatAuditError(uploadCaught);
          upload = { error: message };
          debugLog.warn(PERFORMANCE_AUDIT_LOG_TAG, `automatic log upload failed: ${message}`);
        }
        await debugLog.flushToFile();
        completePerformanceAudit(report, upload);
      } catch (caught) {
        let recoveryError: string | null = null;
        try {
          await recoverAuditRoute(() => pathnameRef.current);
        } catch (recoveryCaught) {
          recoveryError = formatAuditError(recoveryCaught);
        }
        if (caught instanceof AuditCancelledError) {
          logAuditEvent({
            kind: 'cancelled',
            sessionId,
            completed,
            total,
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
            trace: formatAuditError(caught),
            recoveryError,
          });
          await debugLog.flushToFile();
          markPerformanceAuditCancelled();
        } else {
          const error = [
            formatAuditError(caught),
            ...(recoveryError ? [`Route recovery failed: ${recoveryError}`] : []),
          ].join('\n');
          debugLog.error(
            PERFORMANCE_AUDIT_LOG_TAG,
            JSON.stringify({
              kind: 'fatal',
              sessionId,
              error,
              hangTimeoutMs: watchdog.hangTimeoutMs,
              storedCheckCount: watchdog.storedCheckCount,
              lastStoredCheckAt,
            }),
          );
          await debugLog.flushToFile();
          failPerformanceAudit(error);
        }
      } finally {
        // Each cleanup is isolated so one native/module failure cannot prevent
        // the remaining state from being restored.
        try {
          useStore.setState((current) => ({
            activeSection: originalActiveSection,
            prefs: {
              ...current.prefs,
              profileFilters: originalProfileFilters,
            },
          }));
        } catch {
          // Best effort; the audit result has already been recorded.
        }
        try {
          monitor.stop();
        } catch {
          // Best effort; always continue to native keep-awake cleanup.
        }
        try {
          await deactivateKeepAwake(AUDIT_KEEP_AWAKE_TAG);
        } catch {
          // Best effort; always release the JS running guard below.
        }
        runningRef.current = false;
      }
    };

    void execute();
  }, [
    dimensions.fontScale,
    dimensions.height,
    dimensions.width,
    state.hangTimeoutMs,
    state.sessionId,
    state.startedAt,
    state.status,
  ]);

  useEffect(() => {
    if (state.status !== 'queued' && state.status !== 'running') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelPerformanceAudit();
      return true;
    });
    return () => subscription.remove();
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'queued' && state.status !== 'running') return;
    const cancelForInactiveState = (nextState: string) => {
      if (nextState === 'active') return;
      debugLog.info(
        PERFORMANCE_AUDIT_LOG_TAG,
        `audit cancelled safely because app state changed to ${nextState}`,
      );
      cancelPerformanceAudit();
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      cancelForInactiveState(nextState);
    });
    // The app may already have backgrounded between the audit state update
    // and this effect subscribing, in which case no future transition fires.
    if (AppState.currentState != null) cancelForInactiveState(AppState.currentState);
    return () => subscription.remove();
  }, [state.status]);

  if (state.status !== 'queued' && state.status !== 'running') return null;

  const total = Math.max(1, state.progress.total);
  const fraction = Math.max(0, Math.min(1, state.progress.completed / total));
  const percent = Math.round(fraction * 100);

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        elevation: 500,
        backgroundColor: 'rgba(3, 10, 18, 0.42)',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: Math.max(16, insets.bottom + 12),
      }}
    >
      <Card style={{ gap: 12, borderWidth: 1, borderColor: theme.colors.border }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="body" weight="700">
            Performance audit
          </AppText>
          <AppText variant="small" weight="700" color="primary">
            {percent}%
          </AppText>
        </Row>
        <AppText variant="small" color="textMuted" numberOfLines={2}>
          {state.progress.label}
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Performance audit progress"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={{
            height: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.chip,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${percent}%`,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
            }}
          />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="tiny" color="textFaint">
            {state.progress.completed} of {state.progress.total || '...'} checks
          </AppText>
          <Button
            title={state.cancelRequested ? 'Cancelling...' : 'Cancel audit'}
            icon="close"
            variant="ghost"
            disabled={state.cancelRequested}
            onPress={cancelPerformanceAudit}
            style={{ paddingVertical: 8 }}
          />
        </Row>
      </Card>
    </View>
  );
}
