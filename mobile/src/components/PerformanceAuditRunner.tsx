import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  BackHandler,
  InteractionManager,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MANIFEST_URL } from '../config';
import { useStore } from '../data/store';
import { debugLog } from '../lib/debugLog';
import {
  buildPerformanceAuditJourneys,
  cancelPerformanceAudit,
  captureAuditTrace,
  completePerformanceAudit,
  failPerformanceAudit,
  formatAuditError,
  getPerformanceAuditState,
  markPerformanceAuditCancelled,
  markPerformanceAuditRunning,
  pathMatches,
  PERFORMANCE_AUDIT_LOG_TAG,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  ResponsivenessMonitor,
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
const DATA_SETTLE_TIMEOUT_MS = 60_000;
const NETWORK_TIMEOUT_MS = 12_000;
const ROUTE_DWELL_MS = 350;
const RUNTIME_SAMPLE_MS = 1_250;
const BENCHMARK_CHECKS = 5;
const STORAGE_KEY_PREFIX = '@ar/performance-audit/';
const FILE_PAYLOAD_BYTES = 128 * 1024;
const STORAGE_PAYLOAD_BYTES = 64 * 1024;

class AuditCancelledError extends Error {
  constructor() {
    super('Performance audit cancelled');
    this.name = 'AuditCancelledError';
  }
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

function rethrowAuditCancellation(error: unknown): void {
  if (error instanceof AuditCancelledError || getPerformanceAuditState().cancelRequested) {
    throw error instanceof AuditCancelledError ? error : new AuditCancelledError();
  }
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

async function settleUi(): Promise<void> {
  await timeoutAfter(
    new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    }),
    3_000,
    'UI settle',
  ).catch(() => {});
  await nextFrame();
  await nextFrame();
  assertAuditActive();
}

function logAuditEvent(event: Record<string, unknown>): void {
  debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, JSON.stringify(event));
}

function logAuditCheck(sessionId: string, check: AuditCheck): void {
  logAuditEvent({ kind: 'check', sessionId, check });
}

function responsivenessRecord(
  metrics: ResponsivenessMetrics,
): Record<string, number> {
  return {
    eventLoopSamples: metrics.eventLoopSamples,
    eventLoopP95Ms: metrics.eventLoopP95Ms,
    maxEventLoopLagMs: metrics.maxEventLoopLagMs,
    stallsOver100Ms: metrics.stallsOver100Ms,
    frameSamples: metrics.frameSamples,
    frameP95Ms: metrics.frameP95Ms,
    maxFrameGapMs: metrics.maxFrameGapMs,
    framesOver50Ms: metrics.framesOver50Ms,
  };
}

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
    diagnosticsUploadEnabled: store.prefs.diagnosticsEnabled,
    networkType: network?.type != null ? String(network.type) : null,
    networkConnected: network?.isConnected ?? null,
    networkInternetReachable: network?.isInternetReachable ?? null,
  };
}

async function runRuntimeCheck(
  monitor: ResponsivenessMonitor,
): Promise<AuditCheck> {
  const trace = captureAuditTrace('runtime responsiveness baseline');
  const started = now();
  const snapshot = monitor.snapshot();
  await delay(RUNTIME_SAMPLE_MS);
  assertAuditActive();
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

async function runStorageCheck(sessionId: string): Promise<AuditCheck> {
  const trace = captureAuditTrace('AsyncStorage write read remove');
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
  const payload = JSON.stringify({
    schema: 1,
    sessionId,
    body: 's'.repeat(STORAGE_PAYLOAD_BYTES),
  });
  const started = now();
  const writeTimes: number[] = [];
  const readTimes: number[] = [];
  let error: string | undefined;
  let temporaryKeyDeleted = false;
  try {
    for (let index = 0; index < 3; index += 1) {
      assertAuditActive();
      let at = now();
      await AsyncStorage.setItem(key, payload);
      writeTimes.push(now() - at);
      at = now();
      const restored = await AsyncStorage.getItem(key);
      readTimes.push(now() - at);
      if (restored !== payload) throw new Error('AsyncStorage readback did not match the test payload');
    }
    assertAuditActive();
  } catch (caught) {
    rethrowAuditCancellation(caught);
    error = formatAuditError(caught);
  } finally {
    try {
      await AsyncStorage.removeItem(key);
      temporaryKeyDeleted = true;
    } catch (caught) {
      error ??= formatAuditError(caught);
    }
  }
  const maxWriteMs = Math.max(0, ...writeTimes);
  const maxReadMs = Math.max(0, ...readTimes);
  return {
    id: 'async-storage',
    label: 'Preferences storage round-trip',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(maxWriteMs, 50, 200),
          scoreLatency(maxReadMs, 50, 200),
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
    },
    trace,
    ...(error ? { error } : {}),
  };
}

async function runFileSystemCheck(sessionId: string): Promise<AuditCheck> {
  const trace = captureAuditTrace('filesystem write read remove');
  const started = now();
  if (!FileSystem.documentDirectory) {
    return {
      id: 'file-system',
      label: 'Log filesystem round-trip',
      kind: 'storage',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: { reason: 'documentDirectory unavailable' },
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
    assertAuditActive();
    let at = now();
    await FileSystem.writeAsStringAsync(uri, payload);
    writeMs = now() - at;
    at = now();
    const restored = await FileSystem.readAsStringAsync(uri);
    readMs = now() - at;
    if (restored.length !== payload.length) {
      throw new Error(`Filesystem readback length ${restored.length} did not match ${payload.length}`);
    }
    assertAuditActive();
  } catch (caught) {
    rethrowAuditCancellation(caught);
    error = formatAuditError(caught);
  } finally {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      temporaryFileDeleted = true;
    } catch (caught) {
      error ??= formatAuditError(caught);
    }
  }
  return {
    id: 'file-system',
    label: 'Log filesystem round-trip',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(writeMs, 80, 300),
          scoreLatency(readMs, 80, 300),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadBytes: payload.length,
      writeMs: roundMetric(writeMs),
      readMs: roundMetric(readMs),
      temporaryFileDeleted,
    },
    trace,
    ...(error ? { error } : {}),
  };
}

async function runDataCheck(
  monitor: ResponsivenessMonitor,
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
    assertAuditActive();
    let at = now();
    const serialized = JSON.stringify(core);
    stringifyMs = now() - at;
    payloadChars = serialized.length;
    at = now();
    const parsed = JSON.parse(serialized) as typeof core;
    parseMs = now() - at;
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
    await delay(0);
    assertAuditActive();
  } catch (caught) {
    rethrowAuditCancellation(caught);
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

async function runNetworkCheck(): Promise<AuditCheck> {
  const trace = captureAuditTrace('manifest network request and JSON parse');
  const started = now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), NETWORK_TIMEOUT_MS);
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
    assertAuditActive();
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
    const parseStarted = now();
    JSON.parse(body);
    parseMs = now() - parseStarted;
    if (!response.ok) throw new Error(`Manifest request returned HTTP ${response.status}`);
    assertAuditActive();
  } catch (caught) {
    if (getPerformanceAuditState().cancelRequested) throw new AuditCancelledError();
    error = formatAuditError(caught);
  } finally {
    clearTimeout(timer);
    clearInterval(cancelTimer);
  }
  const durationMs = now() - started;
  return {
    id: 'manifest-network',
    label: 'Live manifest network round-trip',
    kind: 'network',
    status: error ? 'fail' : scoreLatency(durationMs, 1_500, 5_000),
    durationMs: roundMetric(durationMs),
    metrics: {
      statusCode,
      responseChars,
      headersMs: roundMetric(headersMs),
      bodyMs: roundMetric(bodyMs),
      parseMs: roundMetric(parseMs),
      timeoutMs: NETWORK_TIMEOUT_MS,
    },
    trace,
    ...(error ? { error } : {}),
  };
}

function routeErrorMessages(logCursor: number): string[] {
  return debugLog
    .getEntriesAfter(logCursor)
    .filter((entry) => entry.level === 'error' && entry.tag !== PERFORMANCE_AUDIT_LOG_TAG)
    .map((entry) => `${entry.tag}: ${entry.message}`);
}

type JourneyDataState = 'pending' | 'ready' | 'failed';

interface JourneyDataRequirement {
  label: string;
  state: () => JourneyDataState;
  error: () => string | null;
}

function journeyDataRequirements(
  journey: AuditJourney,
  logCursor: number,
): JourneyDataRequirement[] {
  const initial = useStore.getState();
  const { prefs, manifest, source } = initial;
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
      (state) => !state.detailsLoading,
      () => null,
    );
  }

  if (journey.id === 'search') {
    add(
      'Product details',
      (state) => !!state.details && !state.detailsLoading,
      (state) =>
        !state.detailsLoading && !state.details
          ? 'Product details did not load'
          : null,
    );
    if (prefs.rateIntelligencePro && prefs.enableDeepSearch && manifest?.files.search_index) {
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

  const bankInsightsEnabled = prefs.rateIntelligencePro;
  if (
    bankInsightsEnabled &&
    ['response', 'outlook', 'rba-redirect', 'product', 'lender'].includes(journey.id)
  ) {
    add(
      'Bank response analysis',
      (state) => !!state.bankInsights,
      (state) => state.bankInsightsError,
    );
  }

  const historyEnabled = prefs.rateIntelligencePro && prefs.showHistoryRibbon;
  if (historyEnabled && ['outlook', 'rba-redirect', 'product'].includes(journey.id)) {
    add(
      'Bank history',
      (state) => !!state.historyBanks,
      (state) => state.historyBanksError,
    );
  }
  if (historyEnabled && ['product', 'lender'].includes(journey.id)) {
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
): Promise<{
  labels: string[];
  durationMs: number;
}> {
  // Give mounted effects a chance to claim their store work before inspecting
  // loading state. The subsequent poll keeps that cold work inside this
  // journey instead of letting it spill into later checks.
  await delay(100);
  assertAuditActive();
  const requirements = journeyDataRequirements(journey, logCursor);
  const labels = [...new Set(requirements.map(({ label }) => label))];
  if (requirements.length === 0) return { labels, durationMs: 0 };

  const started = now();
  while (true) {
    assertAuditActive();
    const failed = requirements.find((requirement) => requirement.state() === 'failed');
    if (failed) {
      throw new Error(`${failed.label} failed to settle: ${failed.error() ?? 'unknown error'}`);
    }
    if (requirements.every((requirement) => requirement.state() === 'ready')) {
      return { labels, durationMs: now() - started };
    }
    if (now() - started > DATA_SETTLE_TIMEOUT_MS) {
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
  let routeError: string | undefined;

  const waitForPath = async (expected: string, label: string): Promise<void> => {
    const waitStarted = now();
    while (!pathMatches(currentPath(), expected)) {
      assertAuditActive();
      if (now() - waitStarted > ROUTE_TIMEOUT_MS) {
        throw new Error(
          `${label} did not reach ${expected}; current path is ${currentPath()}`,
        );
      }
      await delay(25);
    }
  };

  try {
    assertAuditActive();
    let at = now();
    router.push(journey.href);
    await waitForPath(journey.expectedPath, `${journey.label} forward navigation`);
    await settleUi();
    forwardMs = now() - at;
    if (
      journey.expectedSection &&
      useStore.getState().activeSection !== journey.expectedSection
    ) {
      throw new Error(
        `${journey.label} rendered ${useStore.getState().activeSection} instead of ${journey.expectedSection}`,
      );
    }
    const background = await waitForJourneyData(journey, logCursor);
    backgroundSettleMs = background.durationMs;
    backgroundTasks = background.labels;
    // Keep the destination mounted long enough to expose deferred work,
    // subscriptions, and JS stalls without charging the deliberate dwell to
    // the forward-navigation latency.
    await delay(ROUTE_DWELL_MS);
    assertAuditActive();

    const pathBeforeBack = currentPath();
    at = now();
    router.back();
    // Tabs own their own history and commonly back to Home rather than the
    // root-stack audit screen. Measure the real back transition first, then
    // restore the runner explicitly instead of charging an 8s path timeout.
    await settleUi();
    backMs = now() - at;
    backDestination = currentPath();
    backReturnedToAudit = pathMatches(backDestination, AUDIT_HOME_PATH);
    backChangedPath = !pathMatches(backDestination, pathBeforeBack);

    if (!backReturnedToAudit) {
      const fallbackStarted = now();
      router.replace(AUDIT_HOME_PATH);
      await waitForPath(AUDIT_HOME_PATH, `${journey.label} return fallback`);
      await settleUi();
      returnFallbackMs = now() - fallbackStarted;
    }
  } catch (caught) {
    routeError = formatAuditError(caught);
    if (!(caught instanceof AuditCancelledError) && !pathMatches(currentPath(), AUDIT_HOME_PATH)) {
      router.replace(AUDIT_HOME_PATH);
      await delay(100);
    }
    if (caught instanceof AuditCancelledError) throw caught;
  }

  const responsiveness = monitor.metricsSince(responsivenessAt);
  const errors = routeErrorMessages(logCursor);
  const backContractStatus =
    journey.navigationKind === 'stack' && !backReturnedToAudit ? 'warn' : 'pass';
  const status = routeError || errors.length
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
      returnFallbackMs: roundMetric(returnFallbackMs),
      runtimeErrors: errors.length,
      runtimeErrorMessages: errors.join(' | ') || null,
      ...responsivenessRecord(responsiveness),
    },
    trace,
    ...(routeError ? { error: routeError } : {}),
  };
}

function usePerformanceAuditState() {
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
      const initialStore = useStore.getState();
      const originalActiveSection = initialStore.activeSection;
      const originalProfileFilters = JSON.parse(
        JSON.stringify(initialStore.prefs.profileFilters),
      ) as typeof initialStore.prefs.profileFilters;
      const journeys = buildPerformanceAuditJourneys(
        initialStore.core,
        initialStore.prefs.interests,
      );
      const total = BENCHMARK_CHECKS + journeys.length;
      const checks: AuditCheck[] = [];
      const monitor = new ResponsivenessMonitor();
      let completed = 0;

      const record = (check: AuditCheck) => {
        checks.push(check);
        logAuditCheck(sessionId, check);
        completed += 1;
        updatePerformanceAuditProgress(completed, total, check.label);
      };

      markPerformanceAuditRunning(total);
      monitor.start();
      logAuditEvent({
        kind: 'start',
        schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
        sessionId,
        startedAt,
        plannedChecks: total,
        trace: captureAuditTrace('performance audit start'),
      });

      try {
        const environment = await collectEnvironment(
          dimensions.width,
          dimensions.height,
          dimensions.fontScale,
        );
        assertAuditActive();

        updatePerformanceAuditProgress(completed, total, 'Sampling idle responsiveness');
        record(await runRuntimeCheck(monitor));

        for (const journey of journeys) {
          assertAuditActive();
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
          record(await runJourney(journey, () => pathnameRef.current, monitor));
        }

        updatePerformanceAuditProgress(completed, total, 'Testing preferences storage');
        record(await runStorageCheck(sessionId));

        updatePerformanceAuditProgress(completed, total, 'Testing log file storage');
        record(await runFileSystemCheck(sessionId));

        updatePerformanceAuditProgress(completed, total, 'Processing the active rates payload');
        await nextFrame();
        record(await runDataCheck(monitor));

        updatePerformanceAuditProgress(completed, total, 'Timing the live manifest request');
        record(await runNetworkCheck());

        const finishedAt = new Date().toISOString();
        const report: PerformanceAuditReport = {
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          startedAt,
          finishedAt,
          durationMs: Date.now() - startedMs,
          environment,
          summary: summarizePerformanceAudit(checks),
          checks,
          limitations: [
            'JavaScript can record its scheduling stack and errors, but a native CPU/GPU sampling profiler is still required for native-thread instruction stacks.',
            'The journey exercises every steady-state app destination plus forward/back navigation; it does not submit forms, change preferences, or mutate favourites.',
            'No report is uploaded automatically. The complete structured report and tracebacks are appended to the local debug log for explicit export.',
          ],
        };
        logAuditEvent({ kind: 'report', sessionId, report });
        await debugLog.flushToFile();
        completePerformanceAudit(report);
      } catch (caught) {
        if (!pathMatches(pathnameRef.current, AUDIT_HOME_PATH)) {
          router.replace(AUDIT_HOME_PATH);
          await delay(100);
        }
        if (caught instanceof AuditCancelledError) {
          logAuditEvent({
            kind: 'cancelled',
            sessionId,
            completed,
            total,
            trace: formatAuditError(caught),
          });
          await debugLog.flushToFile();
          markPerformanceAuditCancelled();
        } else {
          const error = formatAuditError(caught);
          debugLog.error(
            PERFORMANCE_AUDIT_LOG_TAG,
            JSON.stringify({ kind: 'fatal', sessionId, error }),
          );
          await debugLog.flushToFile();
          failPerformanceAudit(error);
        }
      } finally {
        useStore.setState((current) => ({
          activeSection: originalActiveSection,
          prefs: {
            ...current.prefs,
            profileFilters: originalProfileFilters,
          },
        }));
        monitor.stop();
        runningRef.current = false;
      }
    };

    void execute();
  }, [
    dimensions.fontScale,
    dimensions.height,
    dimensions.width,
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
