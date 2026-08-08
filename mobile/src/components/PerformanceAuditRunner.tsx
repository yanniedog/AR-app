import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import { router, usePathname, type Href } from 'expo-router';
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
import { visibleAccountRows } from '../data/format';
import { resolveSectionRibbonStats } from '../data/ribbonStats';
import { excludeTokenDepositRates, rankFraction, sortRows } from '../data/selectors';
import { useStore } from '../data/store';
import { childrenFromScoped, rowsUnder } from '../data/taxonomy';
import { SECTION_ORDER } from '../constants';
import { checkForAppUpdate, getApkDownloadSnapshot } from '../lib/appUpdate';
import { debugLog, formatVersionedLogExport, uploadDebugLog } from '../lib/debugLog';
import { reportPerformanceAudit } from '../lib/observability';
import {
  buildDeepPerformanceAuditPlan,
  type DeepAuditStep,
} from '../lib/performanceAuditPlan';
import {
  performanceAuditReadinessRegistry,
  PerformanceAuditReadinessTimeoutError,
  type PerformanceAuditReadinessKind,
  type PerformanceAuditReadinessSnapshot,
} from '../lib/performanceAuditReadiness';
import {
  beginPerformanceAuditRollback,
  restorePerformanceAuditRollback,
} from '../lib/performanceAuditRollback';
import {
  aggregateRepeatedJourneys,
  cancelPerformanceAudit,
  captureAuditTrace,
  completePerformanceAudit,
  failPerformanceAudit,
  flattenAuditLogText,
  formatAuditError,
  formatAuditErrorForLog,
  getPerformanceAuditState,
  isPerformanceAuditActive,
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
  type AuditAppIdentity,
  type PerformanceAuditReport,
  type ResponsivenessMetrics,
} from '../lib/performanceAudit';
import {
  compactAuditCheckForLog,
  compactAuditLogJson,
  omitNullishDeep,
} from '../lib/performanceAuditLog';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

const AUDIT_HOME_PATH = '/performance-audit';
const ROUTE_TIMEOUT_MS = 8_000;
/** Floor for surface settle waits; hang prevention can extend this further. */
const DATA_SETTLE_TIMEOUT_MS = 30_000;
/** Graphic/list-heavy destinations may need longer than the historical 30s floor. */
const DATA_SETTLE_TIMEOUT_MAX_MS = 180_000;
const NETWORK_TIMEOUT_MS = 12_000;
const ROUTE_DWELL_MS = 350;
const READINESS_QUIET_WINDOW_MS = 650;
const RUNTIME_SAMPLE_MS = 1_250;
// Runtime, storage, filesystem, log I/O, payload, network, update readiness,
// and durable audit-state restoration.
const FIXED_BENCHMARK_CHECKS = 8;
const STORAGE_KEY_PREFIX = '@ar/performance-audit/';
const FILE_PAYLOAD_BYTES = 128 * 1024;
const STORAGE_PAYLOAD_BYTES = 64 * 1024;
const AUDIT_KEEP_AWAKE_TAG = 'performance-audit';
type JourneyIteration = 'cold' | 'warm';

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
  await timeoutAfter(
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    1_000,
    'Animation frame',
  );
}

async function awaitAuditWork<T>(
  promise: Promise<T>,
  watchdog: PerformanceAuditInactivityWatchdog,
  label: string,
): Promise<T> {
  assertSessionActive(watchdog);
  let timer: ReturnType<typeof setInterval> | null = null;
  const control = new Promise<never>((_resolve, reject) => {
    timer = setInterval(() => {
      try {
        assertSessionActive(watchdog);
      } catch (error) {
        if (timer) clearInterval(timer);
        timer = null;
        reject(error);
      }
    }, 50);
  });
  try {
    return await Promise.race([promise, control]);
  } catch (error) {
    rethrowAuditControl(error);
    throw new Error(`${label} failed: ${formatAuditError(error)}`);
  } finally {
    if (timer) clearInterval(timer);
  }
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
  router.replace(AUDIT_HOME_PATH as Href);
  await waitForPath(currentPath, AUDIT_HOME_PATH, 'Performance audit route recovery', {
    checkAuditState: false,
  });
  await settleUiUnchecked();
}

function stringParameter(step: DeepAuditStep, name: string): string | null {
  const value = step.parameters[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberParameter(step: DeepAuditStep, name: string): number | null {
  const value = step.parameters[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayParameter(step: DeepAuditStep, name: string): string[] {
  const value = step.parameters[name];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Resolve only route-entry and compatibility actions here. Every in-page
 * action must be registered by the mounted UI so the audit exercises the same
 * callback as a real press, selection, search, scroll, or chart gesture. */
function routeEntryHref(step: DeepAuditStep): Href | null {
  const section = stringParameter(step, 'section');
  const productKey = stringParameter(step, 'productKey');
  const rateIndex = numberParameter(step, 'rateIndex');
  const selectionTokens = stringArrayParameter(step, 'selectionTokens');
  switch (step.semanticActionId) {
    case 'onboarding.open': return '/onboarding' as Href;
    case 'today.open': return '/(tabs)' as Href;
    case 'browse.open': return '/browse' as Href;
    case 'search.open':
      return {
        pathname: '/search',
        params: section ? { section } : {},
      } as unknown as Href;
    case 'compare.open':
      return {
        pathname: '/compare',
        params: { keys: JSON.stringify(selectionTokens) },
      } as unknown as Href;
    case 'product.open':
      return productKey
        ? ({
            pathname: '/product/[key]',
            params: {
              key: productKey,
              ...(rateIndex == null ? {} : { ri: String(rateIndex) }),
            },
          } as unknown as Href)
        : null;
    case 'receipt.open':
      return productKey
        ? ({
            pathname: '/rate-receipt',
            params: {
              key: productKey,
              ...(rateIndex == null ? {} : { ri: String(rateIndex) }),
            },
          } as unknown as Href)
        : null;
    case 'lenders.open': return '/banks' as Href;
    case 'calculator.open': return '/calculator' as Href;
    case 'projections.open':
      return {
        pathname: '/projections',
        params: section ? { section } : {},
      } as unknown as Href;
    case 'moves.open': return '/passthrough' as Href;
    case 'outlook.open': return '/trends' as Href;
    case 'saved.open': return '/watchlist' as Href;
    case 'profile.open': return '/profile' as Href;
    case 'settings.open': return '/settings' as Href;
    case 'terms.open': return '/terms' as Href;
    case 'debug-log.open': return '/debug-log' as Href;
    case 'not-found.open': return '/__audit-not-found__' as Href;
    case 'audit.pass.complete': return AUDIT_HOME_PATH as Href;
    case 'redirect.rba.verify': return '/rba' as Href;
    case 'redirect.node.verify': {
      const taxonomyPath = stringArrayParameter(step, 'taxonomyPath');
      return {
        pathname: '/node',
        params: {
          ...(section ? { section } : {}),
          ...(taxonomyPath.length ? { path: taxonomyPath.join('.') } : {}),
        },
      } as unknown as Href;
    }
  }
  return null;
}

function readinessMetrics(snapshot: PerformanceAuditReadinessSnapshot): Record<string, string | number> {
  return {
    readinessSurfaces: snapshot.surfaces.map((surface) => surface.id).join(', '),
    readinessProbeCount: snapshot.totalProbes,
    readinessRequiredProbeCount: snapshot.requiredProbes,
    readinessPendingRequiredProbeCount: snapshot.pendingRequiredProbes,
    readinessEvidence: snapshot.surfaces
      .flatMap((surface) => surface.probes.map((probe) => [
        surface.id,
        probe.id,
        probe.kind,
        probe.status,
        probe.actualCount == null ? '' : `${probe.actualCount}/${probe.expectedCount ?? probe.actualCount}`,
        // Keep revision identity without dumping full sha256 blobs into every row.
        typeof probe.datasetRevision === 'string' && probe.datasetRevision.length > 16
          ? `${probe.datasetRevision.slice(0, 12)}…`
          : probe.datasetRevision ?? '',
        typeof probe.renderRevision === 'string' && probe.renderRevision.length > 80
          ? `${probe.renderRevision.slice(0, 80)}…`
          : probe.renderRevision ?? '',
      ].join(':')))
      .join(' | '),
    readinessActionEvidence: snapshot.surfaces
      .map((surface) => `${surface.id}:${surface.lastCompletedAction ?? 'none'}:${surface.actionRevision}`)
      .join(' | '),
  };
}

function requiredProbeKinds(step: DeepAuditStep): PerformanceAuditReadinessKind[] {
  const kinds = new Set<PerformanceAuditReadinessKind>();
  for (const category of step.readiness) {
    if (category === 'graphics') kinds.add('graphic');
    else if (category === 'logos') kinds.add('logo');
    else if (category === 'list') kinds.add('list');
  }
  return [...kinds];
}

const PRE_ACTION_READINESS_KINDS: PerformanceAuditReadinessKind[] = ['data', 'layout'];

function inferMountedActionEntryRoute(semanticActionId: string): string | null {
  const root = semanticActionId.split('.')[0];
  switch (root) {
    case 'calculator': return '/calculator';
    case 'search': return '/search';
    case 'browse': return '/browse';
    case 'projections': return '/projections';
    case 'lenders': return '/banks';
    case 'saved': return '/watchlist';
    case 'settings': return '/settings';
    case 'onboarding': return '/onboarding';
    case 'today': return '/';
    default: return null;
  }
}

/** Bound readiness waits by hang remaining so long audits outlive slow chart settles. */
function readinessTimeoutMs(watchdog: PerformanceAuditInactivityWatchdog): number {
  const hangBudget = Math.max(0, watchdog.remainingMs() - 5_000);
  const desired = Math.max(
    DATA_SETTLE_TIMEOUT_MS,
    Math.min(DATA_SETTLE_TIMEOUT_MAX_MS, Math.floor(watchdog.hangTimeoutMs / 10)),
  );
  return Math.max(1_000, Math.min(desired, hangBudget || desired));
}

async function runDeepAuditStep(
  step: DeepAuditStep,
  currentPath: () => string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  datasetRevision: AuditDatasetRevision,
): Promise<AuditCheck> {
  const started = now();
  const iteration: JourneyIteration = step.passId === 'first-pass' ? 'cold' : 'warm';
  const label = `${step.scenarioId}: ${step.semanticActionId} (${step.passId})`;
  if (step.skipReason) {
    return {
      id: `deep-${step.id}`,
      label,
      kind: 'journey',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: {
        journeyId: `${step.scenarioId}.${step.semanticActionId}`,
        journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
        iteration,
        passId: step.passId,
        depth: step.depth,
        reason: step.skipReason,
        skipSafety: step.skipSafety.reason,
      },
    };
  }

  try {
    return await runDeepAuditStepBody(
      step,
      currentPath,
      monitor,
      watchdog,
      datasetRevision,
      started,
      iteration,
      label,
    );
  } catch (caught) {
    // Cancel / hang / dataset-revision changes remain unrecoverable. Every other
    // step failure is recorded so the remaining plan can still run.
    rethrowAuditControl(caught);
    const readiness = caught instanceof PerformanceAuditReadinessTimeoutError
      ? caught.snapshot
      : performanceAuditReadinessRegistry.snapshot(
        [step.expectedSurface],
        requiredProbeKinds(step),
      );
    return {
      id: `deep-${step.id}`,
      label,
      kind: 'journey',
      status: 'fail',
      durationMs: roundMetric(now() - started),
      metrics: {
        journeyId: `${step.scenarioId}.${step.semanticActionId}`,
        journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
        iteration,
        passId: step.passId,
        scenarioId: step.scenarioId,
        semanticActionId: step.semanticActionId,
        depth: step.depth,
        plannedExpectedPath: step.expectedPath,
        expectedPath: step.expectedPath,
        expectedSurface: step.expectedSurface,
        continuedAfterFailure: true,
        optional: step.optional,
        optionalReadinessTimeout:
          step.optional && caught instanceof PerformanceAuditReadinessTimeoutError,
        skipSafety: step.skipSafety.reason,
        ...readinessMetrics(readiness),
      },
      error: formatAuditError(caught),
      trace: captureAuditTrace(`deep step ${step.id} failed; audit continues`),
    };
  }
}

async function runDeepAuditStepBody(
  step: DeepAuditStep,
  currentPath: () => string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  datasetRevision: AuditDatasetRevision,
  started: number,
  iteration: JourneyIteration,
  label: string,
): Promise<AuditCheck> {
  assertSessionActive(watchdog);
  assertDatasetRevision(datasetRevision);
  const responsivenessAt = monitor.snapshot();
  const logCursor = debugLog.getCursor();
  const actionStarted = now();
  let actionSource = 'router';
  let expectedPath = step.expectedPath;
  const href = routeEntryHref(step);
  if (href) {
    if (!pathMatches(currentPath(), step.expectedPath) || step.semanticActionId.startsWith('redirect.')) {
      router.push(href);
    }
  } else if (step.semanticActionId === 'redirect.root.verify') {
    // The preceding not-found recovery action must already have reached Home.
    actionSource = 'route-contract';
  } else {
    await ensureMountedActionRoute(
      step.semanticActionId,
      currentPath,
      watchdog,
      label,
    );
    const source = resolveMountedActionSurface(
      step.semanticActionId,
      step.expectedSurface,
      currentPath(),
    );
    if (!source) throw new Error(
      `${step.optional ? 'Optional' : 'Required'} mounted action is unavailable without ` +
      `terminal availability evidence: ${step.semanticActionId}`,
    );
    actionSource = source.id;
    // Settle interactable readiness before invoking — exclude logo/list/graphic
    // decoration so stale off-screen asset probes cannot block unrelated taps.
    const preActionAbort = new AbortController();
    const preActionGuard = setInterval(() => {
      if (getPerformanceAuditState().cancelRequested || watchdog.isExpired()) {
        preActionAbort.abort();
      }
    }, 50);
    try {
      await performanceAuditReadinessRegistry.waitForReady({
        surfaceIds: [source.id],
        onlyKinds: PRE_ACTION_READINESS_KINDS,
        quietWindowMs: READINESS_QUIET_WINDOW_MS,
        timeoutMs: readinessTimeoutMs(watchdog),
        signal: preActionAbort.signal,
      });
      watchdog.touchProgress();
    } finally {
      clearInterval(preActionGuard);
    }
    assertSessionActive(watchdog);
    const actionResult = await performanceAuditReadinessRegistry.invokeAction(
      source.id,
      step.semanticActionId,
      step.parameters,
    );
    if (
      actionResult != null &&
      typeof actionResult === 'object' &&
      'expectedPath' in actionResult &&
      typeof actionResult.expectedPath === 'string' &&
      actionResult.expectedPath.startsWith('/')
    ) {
      expectedPath = actionResult.expectedPath;
    }
    if (
      actionResult != null &&
      typeof actionResult === 'object' &&
      'unavailableReason' in actionResult &&
      typeof actionResult.unavailableReason === 'string' &&
      actionResult.unavailableReason.trim()
    ) {
      if (!step.optional || !step.skipSafety.maySkip) {
        throw new Error(
          `Required action reported unavailable: ${step.semanticActionId}: ${actionResult.unavailableReason}`,
        );
      }
      return {
        id: `deep-${step.id}`,
        label,
        kind: 'journey',
        status: 'skipped',
        durationMs: roundMetric(now() - started),
        metrics: {
          journeyId: `${step.scenarioId}.${step.semanticActionId}`,
          journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
          iteration,
          passId: step.passId,
          depth: step.depth,
          reason: actionResult.unavailableReason,
          skipSafety: step.skipSafety.reason,
          availabilityEvidence: 'mounted action terminal-unavailable result',
        },
      };
    }
  }
  const actionMs = now() - actionStarted;

  await waitForPath(currentPath, expectedPath, label, { watchdog });
  assertDatasetRevision(datasetRevision);
  const readinessStarted = now();
  const readinessAbort = new AbortController();
  let lastReadinessFingerprint: string | null = null;
  const readinessGuard = setInterval(() => {
    if (getPerformanceAuditState().cancelRequested || watchdog.isExpired()) {
      readinessAbort.abort();
      return;
    }
    // Keep hang prevention alive while readiness is still progressing so a
    // long chart settle cannot look like a hung audit mid-check.
    const snapshot = performanceAuditReadinessRegistry.snapshot(
      [step.expectedSurface],
      requiredProbeKinds(step),
    );
    if (snapshot.fingerprint !== lastReadinessFingerprint) {
      lastReadinessFingerprint = snapshot.fingerprint;
      watchdog.touchProgress();
    }
  }, 250);
  let readiness: PerformanceAuditReadinessSnapshot;
  try {
    readiness = await performanceAuditReadinessRegistry.waitForReady({
      surfaceIds: [step.expectedSurface],
      requiredKinds: requiredProbeKinds(step),
      quietWindowMs: READINESS_QUIET_WINDOW_MS,
      timeoutMs: readinessTimeoutMs(watchdog),
      signal: readinessAbort.signal,
    });
    watchdog.touchProgress();
  } finally {
    clearInterval(readinessGuard);
  }
  assertSessionActive(watchdog);
  const readinessMs = now() - readinessStarted;
  if (actionSource === step.expectedSurface) {
    const completedAction = readiness.surfaces.find((surface) => surface.id === actionSource)
      ?.lastCompletedAction;
    if (completedAction !== step.semanticActionId) {
      throw new Error(
        `Mounted action completion was not observed for ${step.semanticActionId}; ` +
        `last completed action was ${completedAction ?? 'none'}`,
      );
    }
  }
  await settleUi();
  assertDatasetRevision(datasetRevision);
  const responsiveness = monitor.metricsSince(responsivenessAt);
  const errors = routeErrorMessages(logCursor);
  const forwardMs = now() - actionStarted;
  const status = errors.journey.length
    ? 'fail'
    : worstStatus(
        scoreLatency(actionMs, 900, 2_500),
        scoreLatency(readinessMs, 2_000, 10_000),
        responsivenessStatus(responsiveness),
      );
  return {
    id: `deep-${step.id}`,
    label,
    kind: 'journey',
    status,
    durationMs: roundMetric(now() - started),
    metrics: {
      journeyId: `${step.scenarioId}.${step.semanticActionId}`,
      journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
      iteration,
      passId: step.passId,
      scenarioId: step.scenarioId,
      semanticActionId: step.semanticActionId,
      depth: step.depth,
      plannedExpectedPath: step.expectedPath,
      expectedPath,
      expectedSurface: step.expectedSurface,
      actionSource,
      actionMs: roundMetric(actionMs),
      forwardMs: roundMetric(forwardMs),
      backgroundSettleMs: roundMetric(readinessMs),
      backMs: 0,
      readinessQuietWindowMs: READINESS_QUIET_WINDOW_MS,
      runtimeErrors: errors.journey.length,
      runtimeErrorMessages: errors.journey.join(' | ') || null,
      incidentalRuntimeErrors: errors.incidental.length,
      incidentalRuntimeErrorMessages: errors.incidental.join(' | ') || null,
      ...readinessMetrics(readiness),
      ...responsivenessRecord(responsiveness),
    },
    ...(errors.journey.length
      ? {
          error: errors.journey.join('\n'),
          trace: captureAuditTrace(`deep audit step ${step.id} emitted runtime errors`),
        }
      : {}),
  };
}

function installedAuditIdentity(): AuditAppIdentity {
  return {
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    buildVersion: Application.nativeBuildVersion ?? 'unknown',
  };
}

function fallbackEnvironment(
  app: AuditAppIdentity,
  width: number,
  height: number,
  fontScale: number,
): AuditEnvironment {
  const store = useStore.getState();
  return {
    appVersion: app.appVersion,
    buildVersion: app.buildVersion,
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
    networkType: null,
    networkConnected: null,
    networkInternetReachable: null,
  };
}

function logAuditEvent(
  app: AuditAppIdentity,
  event: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
  options: { includeApp?: boolean } = {},
): void {
  const includeApp = options.includeApp === true || event.kind === 'start';
  const line = compactAuditLogJson(includeApp ? { ...event, app } : event);
  if (level === 'error') debugLog.error(PERFORMANCE_AUDIT_LOG_TAG, line);
  else if (level === 'warn') debugLog.warn(PERFORMANCE_AUDIT_LOG_TAG, line);
  else debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, line);
}

function logAuditCheck(app: AuditAppIdentity, sessionId: string, check: AuditCheck): void {
  const level = check.status === 'fail' ? 'error' : check.status === 'warn' ? 'warn' : 'info';
  const payload = level === 'info'
    ? compactAuditCheckForLog(check)
    : compactAuditCheckForLog({
      ...check,
      error: check.error ? flattenAuditLogText(check.error) : null,
      trace: check.trace ? flattenAuditLogText(check.trace) : null,
    });
  logAuditEvent(app, { kind: 'check', sessionId, check: payload }, level);
}

function resolveMountedActionSurface(
  semanticActionId: string,
  expectedSurface: string,
  currentPath: string,
): { id: string } | null {
  const matches = performanceAuditReadinessRegistry.snapshot().surfaces
    .filter((surface) => surface.actions.includes(semanticActionId));
  if (!matches.length) return null;
  const onRoute = matches.filter((surface) => {
    const routeKey = surface.routeKey;
    if (!routeKey) return false;
    if (!routeKey.includes('[')) return pathMatches(currentPath, routeKey);
    const root = `/${routeKey.split('/').filter(Boolean)[0] ?? ''}`;
    return currentPath === root || currentPath.startsWith(`${root}/`);
  });
  return onRoute.find((s) => s.id !== expectedSurface)
    ?? onRoute[0]
    ?? null;
}

async function ensureMountedActionRoute(
  semanticActionId: string,
  currentPath: () => string,
  watchdog: PerformanceAuditInactivityWatchdog,
  label: string,
): Promise<void> {
  if (resolveMountedActionSurface(semanticActionId, '', currentPath())) return;
  const entryRoute = inferMountedActionEntryRoute(semanticActionId);
  if (!entryRoute || pathMatches(currentPath(), entryRoute)) return;
  router.push(entryRoute as Href);
  await waitForPath(currentPath, entryRoute, label, { watchdog });
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
  app: AuditAppIdentity,
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
    appVersion: app.appVersion,
    buildVersion: app.buildVersion,
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
  };
}

async function runStorageCheck(
  sessionId: string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
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
      await awaitAuditWork(AsyncStorage.setItem(key, payload), watchdog, 'AsyncStorage write');
      assertSessionActive(watchdog);
      writeTimes.push(now() - at);
      at = now();
      const restored = await awaitAuditWork(AsyncStorage.getItem(key), watchdog, 'AsyncStorage read');
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
      await awaitAuditWork(AsyncStorage.removeItem(key), watchdog, 'AsyncStorage cleanup');
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
    ...(error ? { error, trace: captureAuditTrace('AsyncStorage write read remove failed') } : {}),
  };
}

async function runFileSystemCheck(
  sessionId: string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
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
    await awaitAuditWork(FileSystem.writeAsStringAsync(uri, payload), watchdog, 'Filesystem write');
    assertSessionActive(watchdog);
    writeMs = now() - at;
    at = now();
    const restored = await awaitAuditWork(FileSystem.readAsStringAsync(uri), watchdog, 'Filesystem read');
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
      await awaitAuditWork(
        FileSystem.deleteAsync(uri, { idempotent: true }),
        watchdog,
        'Filesystem cleanup',
      );
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
    ...(error ? { error, trace: captureAuditTrace('filesystem write read remove failed') } : {}),
  };
}

async function runDataCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
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
    ...(error ? { error, trace: captureAuditTrace('active payload processing failed') } : {}),
  };
}

async function runNetworkCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
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
    ...(error ? { error, trace: captureAuditTrace('manifest network request failed') } : {}),
  };
}

async function runSectionModelCheck(
  section: (typeof SECTION_ORDER)[number],
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const state = useStore.getState();
  const sectionData = state.core?.sections[section];
  const rows = sectionData?.rates;
  const started = now();
  if (!sectionData || !rows) {
    return {
      id: `section-model-${section.toLowerCase()}`,
      label: `${section} section model`,
      kind: 'data',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: { reason: 'Section data is unavailable', section },
    };
  }

  const responsivenessAt = monitor.snapshot();
  const details = state.details?.products ?? null;
  const { includeNonStandard, depositRankMetric, mortgageRateMetric } = state.prefs;
  const runModel = () => {
    let at = now();
    const scoped = rowsUnder(rows, section, []);
    const scopeMs = now() - at;
    at = now();
    const visible = excludeTokenDepositRates(
      visibleAccountRows(scoped, includeNonStandard, details),
      section,
    );
    const filterMs = now() - at;
    const fractionOf = (row: (typeof visible)[number]) =>
      rankFraction(row, section, depositRankMetric, mortgageRateMetric);
    at = now();
    const children = childrenFromScoped(visible, section, [], fractionOf);
    const hierarchyMs = now() - at;
    at = now();
    const stats = resolveSectionRibbonStats(
      sectionData,
      scoped,
      includeNonStandard,
      section,
      details,
      depositRankMetric,
      mortgageRateMetric,
    );
    const statsMs = now() - at;
    at = now();
    const ranked = sortRows(
      visible,
      'rate',
      section,
      depositRankMetric,
      mortgageRateMetric,
    ).slice(0, 25);
    const rankMs = now() - at;
    return {
      scopeMs,
      filterMs,
      hierarchyMs,
      statsMs,
      rankMs,
      rows: rows.length,
      visibleRows: visible.length,
      childNodes: children.length,
      rankedRows: ranked.length,
      statsCount: stats.count,
    };
  };

  let error: string | undefined;
  let first: ReturnType<typeof runModel> | null = null;
  let repeat: ReturnType<typeof runModel> | null = null;
  try {
    assertSessionActive(watchdog);
    first = runModel();
    await nextFrame();
    assertSessionActive(watchdog);
    repeat = runModel();
    await nextFrame();
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  }
  const responsiveness = monitor.metricsSince(responsivenessAt);
  const phaseMaximum = Math.max(
    0,
    ...[first, repeat].flatMap((sample) => sample
      ? [sample.scopeMs, sample.filterMs, sample.hierarchyMs, sample.statsMs, sample.rankMs]
      : []),
  );
  return {
    id: `section-model-${section.toLowerCase()}`,
    label: `${section} selector and hierarchy model`,
    kind: 'data',
    status: error
      ? 'fail'
      : scoreLatency(phaseMaximum, 100, 500),
    durationMs: roundMetric(now() - started),
    metrics: {
      section,
      rows: first?.rows ?? 0,
      visibleRows: first?.visibleRows ?? 0,
      childNodes: first?.childNodes ?? 0,
      rankedRows: first?.rankedRows ?? 0,
      statsCount: first?.statsCount ?? 0,
      firstScopeMs: roundMetric(first?.scopeMs ?? 0),
      firstFilterMs: roundMetric(first?.filterMs ?? 0),
      firstHierarchyMs: roundMetric(first?.hierarchyMs ?? 0),
      firstStatsMs: roundMetric(first?.statsMs ?? 0),
      firstRankMs: roundMetric(first?.rankMs ?? 0),
      repeatScopeMs: roundMetric(repeat?.scopeMs ?? 0),
      repeatFilterMs: roundMetric(repeat?.filterMs ?? 0),
      repeatHierarchyMs: roundMetric(repeat?.hierarchyMs ?? 0),
      repeatStatsMs: roundMetric(repeat?.statsMs ?? 0),
      repeatRankMs: roundMetric(repeat?.rankMs ?? 0),
      responsivenessClassification: 'recorded-not-scored-benchmark-self-work',
      ...responsivenessRecord(responsiveness),
    },
    ...(error ? { error, trace: captureAuditTrace(`${section} section model failed`) } : {}),
  };
}

async function runLogIoCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const started = now();
  const responsivenessAt = monitor.snapshot();
  let flushMs = 0;
  let readMs = 0;
  let bytes = 0;
  let error: string | undefined;
  try {
    assertSessionActive(watchdog);
    let at = now();
    await awaitAuditWork(debugLog.flushToFile(), watchdog, 'Debug-log benchmark flush');
    flushMs = now() - at;
    assertSessionActive(watchdog);
    at = now();
    const complete = await awaitAuditWork(
      debugLog.readCompleteText(),
      watchdog,
      'Debug-log benchmark read',
    );
    readMs = now() - at;
    bytes = new TextEncoder().encode(complete).length;
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  }
  const responsiveness = monitor.metricsSince(responsivenessAt);
  return {
    id: 'debug-log-io',
    label: 'Complete debug-log persistence',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(flushMs, 100, 500),
          scoreLatency(readMs, 100, 500),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      bytes,
      flushMs: roundMetric(flushMs),
      readMs: roundMetric(readMs),
      ...responsivenessRecord(responsiveness),
    },
    ...(error ? { error, trace: captureAuditTrace('debug log persistence failed') } : {}),
  };
}

async function runUpdateReadinessCheck(
  app: AuditAppIdentity,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const started = now();
  const responsivenessAt = monitor.snapshot();
  const installed = { version: app.appVersion, buildNumber: app.buildVersion };
  const download = getApkDownloadSnapshot();
  if (Platform.OS !== 'android') {
    return {
      id: 'update-readiness',
      label: 'Android update readiness',
      kind: 'update',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: { reason: 'Android-only', installedVersion: installed.version, installedBuild: installed.buildNumber },
    };
  }
  let result: Awaited<ReturnType<typeof checkForAppUpdate>> | null = null;
  let error: string | undefined;
  try {
    assertSessionActive(watchdog);
    result = await timeoutAfter(checkForAppUpdate(), NETWORK_TIMEOUT_MS, 'Update manifest check');
    assertSessionActive(watchdog);
    if (result.status === 'error') error = result.message;
  } catch (caught) {
    rethrowAuditControl(caught);
    error = formatAuditError(caught);
  }
  const durationMs = now() - started;
  const responsiveness = monitor.metricsSince(responsivenessAt);
  const remote = result && result.status !== 'error' ? result.remote : null;
  const compatibilityStatus: AuditCheckStatus = result?.status === 'incompatible' ? 'warn' : 'pass';
  const manifestContentStatus: AuditCheckStatus = remote &&
    remote.package_name === Application.applicationId &&
    !!remote.sha256 &&
    (remote.bytes ?? 0) > 0
    ? 'pass'
    : 'fail';
  return {
    id: 'update-readiness',
    label: 'Android update manifest and local readiness',
    kind: 'update',
    status: error
      ? 'fail'
      : worstStatus(compatibilityStatus, manifestContentStatus),
    durationMs: roundMetric(durationMs),
    metrics: {
      installedVersion: installed.version,
      installedBuild: installed.buildNumber,
      checkStatus: result?.status ?? 'unknown',
      compatibilityMessage: result?.status === 'incompatible' ? result.message : null,
      remoteVersion: remote?.version ?? null,
      remoteBuild: remote?.build_number ?? null,
      manifestBytes: remote?.bytes ?? null,
      manifestHasSha256: !!remote?.sha256,
      installedApplicationId: Application.applicationId ?? null,
      manifestPackageMatches: remote?.package_name === Application.applicationId,
      durationMayUseTtlCache: true,
      durationScoredAsNetworkLatency: false,
      downloadPhase: download.phase,
      downloadedBytes: download.bytesWritten,
      downloadTotalBytes: download.totalBytes,
      cachedBuild: download.buildNumber,
      cachedReady: download.phase === 'ready' && !!download.localUri,
      ...responsivenessRecord(responsiveness),
    },
    ...(error ? { error, trace: captureAuditTrace('Android update readiness failed') } : {}),
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

/** Retained as a compatibility test seam for schema-v3 route timing fixtures.
 * Schema v4 runs the readiness-gated deep plan above. */
export async function runJourney(
  journey: AuditJourney,
  iteration: JourneyIteration,
  currentPath: () => string,
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  datasetRevision: AuditDatasetRevision,
): Promise<AuditCheck> {
  const started = now();
  if (!journey.href) {
    return {
      id: `journey-${journey.id}-${iteration}`,
      label: `${journey.label} (${iteration})`,
      kind: 'journey',
      status: 'skipped',
      durationMs: roundMetric(now() - started),
      metrics: {
        reason: journey.skipReason ?? 'Route unavailable',
        journeyId: journey.id,
        journeyLabel: journey.label,
        iteration,
      },
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
      router.replace(AUDIT_HOME_PATH as Href);
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
    id: `journey-${journey.id}-${iteration}`,
    label: `${journey.label} (${iteration})`,
    kind: 'journey',
    status,
    durationMs: roundMetric(now() - started),
    metrics: {
      journeyId: journey.id,
      journeyLabel: journey.label,
      iteration,
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
    ...(routeError
      ? { error: routeError, trace: captureAuditTrace(`route journey ${journey.id} ${iteration} failed`) }
      : {}),
  };
}

export function usePerformanceAuditState() {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    getPerformanceAuditState,
    getPerformanceAuditState,
  );
}

/** Root navigation only needs the primitive active flag. Returning a stable
 * boolean prevents every audit progress/check update from rerendering the
 * complete root navigator while measured pages are mounted. */
export function usePerformanceAuditActiveState(): boolean {
  return useSyncExternalStore(
    subscribePerformanceAudit,
    isPerformanceAuditActive,
    isPerformanceAuditActive,
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
      const app = installedAuditIdentity();
      const watchdog = new PerformanceAuditInactivityWatchdog(state.hangTimeoutMs);
      const originalStore = useStore.getState();
      let plan = buildDeepPerformanceAuditPlan(originalStore.core);
      let total = FIXED_BENCHMARK_CHECKS + SECTION_ORDER.length +
        plan.passes.reduce((sum, pass) => sum + pass.steps.length, 0);
      const checks: AuditCheck[] = [];
      const monitor = new ResponsivenessMonitor();
      let completed = 0;
      let lastStoredCheckAt: string | null = null;
      let rollbackSnapshot: Awaited<ReturnType<typeof beginPerformanceAuditRollback>> | null = null;
      let rollbackRestored = false;
      let readinessCapture: ReturnType<typeof performanceAuditReadinessRegistry.beginCapture> | null = null;
      let auditEnvironment: AuditEnvironment | null = null;
      let activeDatasetRevision: AuditDatasetRevision | null = null;

      const awaitStoredCheckFlush = async (): Promise<void> => {
        let settled = false;
        let failure: unknown;
        const flush = debugLog.flushToFile(Platform.OS !== 'web').then(
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
        logAuditCheck(app, sessionId, check);
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
        await awaitAuditWork(
          activateKeepAwakeAsync(AUDIT_KEEP_AWAKE_TAG),
          watchdog,
          'Keep-awake activation',
        );
        monitor.start();
        rollbackSnapshot = await awaitAuditWork(
          beginPerformanceAuditRollback(useStore),
          watchdog,
          'Rollback journal creation',
        );
        readinessCapture = performanceAuditReadinessRegistry.beginCapture(sessionId);
        updatePerformanceAuditProgress(
          completed,
          total,
          'Waiting for active payload work to finish',
        );
        await waitForRefreshWork(watchdog);
        const initialStore = useStore.getState();
        plan = buildDeepPerformanceAuditPlan(initialStore.core);
        total = FIXED_BENCHMARK_CHECKS + SECTION_ORDER.length +
          plan.passes.reduce((sum, pass) => sum + pass.steps.length, 0);
        const datasetRevision = captureDatasetRevision();
        activeDatasetRevision = datasetRevision;
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(
          completed,
          total,
          'Capturing device and app state',
        );
        logAuditEvent(app, {
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
        });
        // Keep start logging outside the first measured phase.
        await awaitAuditWork(debugLog.flushToFile(), watchdog, 'Audit start log flush');

        let environment = await awaitAuditWork(collectEnvironment(
          app,
          dimensions.width,
          dimensions.height,
          dimensions.fontScale,
        ), watchdog, 'Audit environment capture');
        auditEnvironment = environment;
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        updatePerformanceAuditProgress(completed, total, 'Sampling idle responsiveness');
        await record(await runRuntimeCheck(monitor, watchdog));

        const recordContinuable = async (
          label: string,
          run: () => Promise<AuditCheck>,
        ): Promise<void> => {
          const recoverAfterFailure = async () => {
            try {
              await recoverAuditRoute(() => pathnameRef.current);
            } catch (recoveryCaught) {
              debugLog.warn(
                PERFORMANCE_AUDIT_LOG_TAG,
                `post-failure route recovery failed after ${label}: ${formatAuditErrorForLog(recoveryCaught)}`,
              );
            }
          };
          const continuedFailureCheck = (caught: unknown): AuditCheck => ({
            id: `continued-failure-${completed + 1}`,
            label,
            kind: 'runtime',
            status: 'fail',
            durationMs: 0,
            metrics: {
              continuedAfterFailure: true,
              currentPath: pathnameRef.current,
              datasetRevision: datasetRevisionLabel(datasetRevision),
            },
            error: formatAuditError(caught),
            trace: captureAuditTrace(`${label} failed; audit continues`),
          });
          let check: AuditCheck;
          try {
            check = await run();
          } catch (caught) {
            rethrowAuditControl(caught);
            check = continuedFailureCheck(caught);
          }
          try {
            // Durable check storage/logging failures remain fatal — only the step
            // body itself is continuable after a recorded fail.
            await record(check);
          } catch (caught) {
            rethrowAuditControl(caught);
            throw caught;
          }
          if (check.status === 'fail') await recoverAfterFailure();
        };

        for (const pass of plan.passes) {
          for (const step of pass.steps) {
            assertSessionActive(watchdog);
            assertDatasetRevision(datasetRevision);
            updatePerformanceAuditProgress(
              completed,
              total,
              `${pass.label}: depth ${step.depth} - ${step.semanticActionId}`,
            );
            logAuditEvent(app, {
              kind: 'deep-step-start',
              sessionId,
              stepId: step.id,
              passId: step.passId,
              scenarioId: step.scenarioId,
              semanticActionId: step.semanticActionId,
              depth: step.depth,
              expectedPath: step.expectedPath,
              expectedSurface: step.expectedSurface,
            });
            await awaitAuditWork(debugLog.flushToFile(), watchdog, 'Deep-step marker flush');
            await recordContinuable(
              `${pass.label}: depth ${step.depth} - ${step.semanticActionId}`,
              () => runDeepAuditStep(
                step,
                () => pathnameRef.current,
                monitor,
                watchdog,
                datasetRevision,
              ),
            );
          }
        }

        for (const section of SECTION_ORDER) {
          assertSessionActive(watchdog);
          assertDatasetRevision(datasetRevision);
          updatePerformanceAuditProgress(completed, total, `Benchmarking ${section} data models`);
          await recordContinuable(
            `Benchmarking ${section} data models`,
            () => runSectionModelCheck(section, monitor, watchdog),
          );
        }

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Testing preferences storage');
        await recordContinuable(
          'Testing preferences storage',
          () => runStorageCheck(sessionId, monitor, watchdog),
        );

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Testing log file storage');
        await recordContinuable(
          'Testing log file storage',
          () => runFileSystemCheck(sessionId, monitor, watchdog),
        );

        assertSessionActive(watchdog);
        updatePerformanceAuditProgress(completed, total, 'Reading the complete diagnostic log');
        await recordContinuable(
          'Reading the complete diagnostic log',
          () => runLogIoCheck(monitor, watchdog),
        );

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Processing the active rates payload');
        await nextFrame();
        await recordContinuable(
          'Processing the active rates payload',
          () => runDataCheck(monitor, watchdog),
        );

        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);
        updatePerformanceAuditProgress(completed, total, 'Timing the live manifest request');
        await recordContinuable(
          'Timing the live manifest request',
          () => runNetworkCheck(monitor, watchdog),
        );
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        updatePerformanceAuditProgress(completed, total, 'Inspecting Android update readiness');
        await recordContinuable(
          'Inspecting Android update readiness',
          () => runUpdateReadinessCheck(app, monitor, watchdog),
        );
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        updatePerformanceAuditProgress(completed, total, 'Restoring settings and saved data exactly');
        const restoreStarted = now();
        await awaitAuditWork(
          restorePerformanceAuditRollback(useStore, rollbackSnapshot),
          watchdog,
          'Audit state restoration',
        );
        rollbackRestored = true;
        await record({
          id: 'audit-state-restoration',
          label: 'Audit state rollback and durable verification',
          kind: 'storage',
          status: 'pass',
          durationMs: roundMetric(now() - restoreStarted),
          metrics: {
            restored: true,
            journalClearedAfterPersistence: true,
          },
        });

        environment = {
          ...environment,
          detailsLoaded: useStore.getState().details != null,
          historyLoaded: useStore.getState().historyBanks != null,
          productHistoryLoaded: useStore.getState().productHistory != null,
        };
        auditEnvironment = environment;

        const finishedAt = new Date().toISOString();
        const summary = summarizePerformanceAudit(checks);
        const report: PerformanceAuditReport = {
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          startedAt,
          finishedAt,
          durationMs: Date.now() - startedMs,
          app,
          watchdog: {
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
          },
          environment,
          plan,
          summary,
          checks,
          routeAggregates: aggregateRepeatedJourneys(checks),
          limitations: [
            `This report applies exactly to app version ${app.appVersion}, build ${app.buildVersion}.`,
            'JavaScript can record its scheduling stack and errors, but a native CPU/GPU sampling profiler is still required for native-thread instruction stacks.',
            'Animation callback gaps are JavaScript requestAnimationFrame timing, not proof of native GPU frame drops.',
            'The first-pass and repeat whole-app scenarios run linearly. Every step waits for its exact mounted surface, all required data/list/logo/graphic/layout probes, and a 650ms stable quiet window before advancing.',
            'Failed journey or benchmark steps are recorded with error evidence; the runner recovers route/state when needed and continues the remaining plan. Cancel requests, hang-watchdog expiry, and mid-run dataset revision changes remain unrecoverable stops.',
            'In-page actions invoke the same registered callbacks as product searches, filters, calculator/projection field updates, optional disclosures, saved comparisons, settings, nested product/lender destinations and chart controls. Android installer, permissions, account, destructive cache, external link and financial-input.edit actions remain explicitly excluded for safety.',
            'Calculator and projection scenarios apply restorable canned parameter sets through registered UI callbacks; encrypted scenario values are restored with the audit rollback journal.',
            'Virtualized product lists prove the complete pinned source/model count and each deterministic viewport they visit; they do not mount every off-screen cell simultaneously.',
            'Section benchmarks time named selector, filter, hierarchy, statistics and ranking phases. Their deliberately synchronous work is recorded but excluded from responsiveness scoring; they do not provide native CPU instruction sampling or React component commit attribution.',
            'Update readiness validates manifest content/compatibility and observes existing download state; it never downloads an APK or launches the Android installer. Its duration may come from the one-minute update-check cache and is not classified as network latency.',
            `The run is pinned to dataset revision ${datasetRevisionLabel(datasetRevision)} and stops only after ${watchdog.hangTimeoutMs}ms without storing another completed check.`,
            environment.diagnosticsUploadEnabled
              ? 'A bounded, deidentified summary is submitted through Crashlytics. The complete report and tracebacks remain only in the local debug log unless explicitly exported.'
              : 'Automatic submission is disabled. The complete report and tracebacks remain in the local debug log unless explicitly exported.',
          ],
        };
        const summaryMarker = [
          'PERFORMANCE_AUDIT_SUMMARY',
          `schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION}`,
          `session=${sessionId}`,
          `app_version=${app.appVersion}`,
          `build_version=${app.buildVersion}`,
          `overall=${summary.overall}`,
          `checks=${checks.length}`,
          `pass=${summary.pass}`,
          `warn=${summary.warn}`,
          `fail=${summary.fail}`,
          `slowest=${summary.slowestCheckId ?? 'none'}`,
          `slowest_ms=${summary.slowestCheckMs}`,
        ].join(' ');
        let completeReportStored = false;
        try {
          await awaitAuditWork(
            debugLog.storePerformanceAudit(summaryMarker, report),
            watchdog,
            'Performance report persistence',
          );
          completeReportStored = true;
        } catch (storeError) {
          const message = formatAuditErrorForLog(storeError);
          debugLog.warn(
            PERFORMANCE_AUDIT_LOG_TAG,
            `complete report persistence verification failed: ${message}`,
          );
          logAuditEvent(app, {
            kind: 'report-fallback',
            schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
            sessionId,
            report,
            storeError: message,
          }, 'warn');
        }
        logAuditEvent(app, {
          kind: 'report',
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          summary,
          routeAggregates: report.routeAggregates,
          completeReportStored,
        });
        debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, summaryMarker);
        reportPerformanceAudit(report);
        await awaitAuditWork(debugLog.flushToFile(), watchdog, 'Final audit log flush');
        updatePerformanceAuditProgress(completed, total, 'Uploading log and copying link');
        let upload: { url?: string; provider?: string; error?: string } = {};
        try {
          const completeLog = await awaitAuditWork(
            debugLog.readCompleteText(),
            watchdog,
            'Complete audit log read',
          );
          const result = await awaitAuditWork(uploadDebugLog(
            formatVersionedLogExport(
              completeLog,
              environment.appVersion,
              environment.buildVersion,
              { audit_session: sessionId },
            ),
          ), watchdog, 'Audit log upload');
          if (result.truncated || result.clientTruncated) {
            throw new Error('The upload service did not accept the complete log.');
          }
          await awaitAuditWork(
            Clipboard.setStringAsync(result.url),
            watchdog,
            'Audit link clipboard write',
          );
          upload = { url: result.url, provider: result.provider };
          debugLog.info(
            PERFORMANCE_AUDIT_LOG_TAG,
            `complete log uploaded provider=${result.provider} linkCopied=true`,
          );
        } catch (uploadCaught) {
          const message = formatAuditError(uploadCaught);
          upload = { error: message };
          debugLog.warn(
            PERFORMANCE_AUDIT_LOG_TAG,
            `automatic log upload failed: ${formatAuditErrorForLog(uploadCaught)}`,
          );
        }
        await awaitAuditWork(debugLog.flushToFile(), watchdog, 'Upload-result log flush');
        assertSessionActive(watchdog);
        completePerformanceAudit(report, upload);
      } catch (caught) {
        let recoveryError: string | null = null;
        try {
          await recoverAuditRoute(() => pathnameRef.current);
        } catch (recoveryCaught) {
          recoveryError = formatAuditError(recoveryCaught);
        }
        if (caught instanceof AuditCancelledError || getPerformanceAuditState().cancelRequested) {
          logAuditEvent(app, {
            kind: 'cancelled',
            sessionId,
            completed,
            total,
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
            trace: formatAuditErrorForLog(caught),
            recoveryError: recoveryError ? flattenAuditLogText(recoveryError) : null,
          }, 'warn');
          await timeoutAfter(debugLog.flushToFile(), 5_000, 'Cancellation log flush').catch(() => {});
          markPerformanceAuditCancelled();
        } else {
          const error = [
            formatAuditError(caught),
            ...(recoveryError ? [`Route recovery failed: ${recoveryError}`] : []),
          ].join('\n');
          const readinessSnapshot = performanceAuditReadinessRegistry.snapshot();
          const failedCheck: AuditCheck = {
            id: `fatal-${completed + 1}`,
            label: getPerformanceAuditState().progress.label || 'Performance audit fatal error',
            kind: 'runtime',
            status: 'fail',
            durationMs: 0,
            metrics: {
              completedBeforeFailure: completed,
              plannedChecks: total,
              currentPath: pathnameRef.current,
              datasetRevision: activeDatasetRevision
                ? datasetRevisionLabel(activeDatasetRevision)
                : null,
              readinessBlockers: readinessSnapshot.blockers
                .map((blocker) => blocker.message)
                .join(' | ') || null,
            },
            error,
            trace: captureAuditTrace('performance audit stopped before later steps'),
          };
          checks.push(failedCheck);
          logAuditCheck(app, sessionId, failedCheck);
          debugLog.error(
            PERFORMANCE_AUDIT_LOG_TAG,
            [
              'PERFORMANCE_AUDIT_FAILURE',
              `session=${sessionId}`,
              `completed=${completed}`,
              `planned=${total}`,
              `path=${flattenAuditLogText(pathnameRef.current)}`,
              `error=${formatAuditErrorForLog(caught)}`,
              `recoveryError=${recoveryError ? flattenAuditLogText(recoveryError) : ''}`,
              `captureTrace=${flattenAuditLogText(failedCheck.trace ?? '')}`,
            ].join(' '),
          );
          logAuditEvent(app, {
            kind: 'fatal',
            sessionId,
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
            error: flattenAuditLogText(error),
            failedCheck: compactAuditCheckForLog({
              ...failedCheck,
              error: failedCheck.error ? flattenAuditLogText(failedCheck.error) : null,
              trace: failedCheck.trace ? flattenAuditLogText(failedCheck.trace) : null,
            }),
            readiness: {
              ready: readinessSnapshot.ready,
              blockers: readinessSnapshot.blockers.map((blocker) => omitNullishDeep({
                code: blocker.code,
                surfaceId: blocker.surfaceId,
                probeId: blocker.probeId,
                message: blocker.message,
              })),
              surfaces: readinessSnapshot.surfaces.map((surface) => ({
                id: surface.id,
                routeKey: surface.routeKey,
                lastCompletedAction: surface.lastCompletedAction,
                actionRevision: surface.actionRevision,
                actions: surface.actions,
                pendingProbes: surface.probes
                  .filter((probe) => probe.status !== 'ready')
                  .map((probe) => `${probe.id}:${probe.status}`),
              })),
            },
            // Ids + timing only — full metrics already logged per check line.
            priorFailures: checks
              .filter((entry) => (
                entry !== failedCheck &&
                (entry.status === 'fail' || entry.status === 'warn')
              ))
              .map((entry) => ({
                id: entry.id,
                status: entry.status,
                durationMs: entry.durationMs,
                maxEventLoopLagMs: entry.metrics.maxEventLoopLagMs ?? undefined,
                maxFrameGapMs: entry.metrics.maxFrameGapMs ?? undefined,
              })),
          }, 'error');
          const partialSummary = summarizePerformanceAudit(checks);
          const partialReport: PerformanceAuditReport = {
            schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
            sessionId,
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - startedMs,
            app,
            watchdog: {
              hangTimeoutMs: watchdog.hangTimeoutMs,
              storedCheckCount: watchdog.storedCheckCount,
              lastStoredCheckAt,
            },
            environment: auditEnvironment ?? fallbackEnvironment(
              app,
              dimensions.width,
              dimensions.height,
              dimensions.fontScale,
            ),
            plan,
            summary: partialSummary,
            checks,
            routeAggregates: aggregateRepeatedJourneys(checks),
            limitations: [
              'This is a structured partial schema-v4 report for an unrecoverable stop (cancel, hang watchdog, dataset revision change, or setup/teardown failure). Per-step journey failures no longer abort the plan; those produce a complete report with aggregated fail/warn checks.',
              `Unrecoverable failure occurred after ${completed} of ${total} planned durable checks.`,
              `The report applies to app version ${app.appVersion}, build ${app.buildVersion}.`,
            ],
          };
          const partialMarker = [
            'PERFORMANCE_AUDIT_SUMMARY',
            `schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION}`,
            `session=${sessionId}`,
            `app_version=${app.appVersion}`,
            `build_version=${app.buildVersion}`,
            'partial=true',
            `overall=${partialSummary.overall}`,
            `checks=${checks.length}`,
            `pass=${partialSummary.pass}`,
            `warn=${partialSummary.warn}`,
            `fail=${partialSummary.fail}`,
            `slowest=${partialSummary.slowestCheckId ?? 'none'}`,
            `slowest_ms=${partialSummary.slowestCheckMs}`,
          ].join(' ');
          let partialStoreError: string | null = null;
          try {
            await timeoutAfter(
              debugLog.storePerformanceAudit(partialMarker, partialReport),
              10_000,
              'Partial report persistence',
            );
            reportPerformanceAudit(partialReport);
          } catch (partialCaught) {
            partialStoreError = formatAuditError(partialCaught);
            debugLog.error(
              PERFORMANCE_AUDIT_LOG_TAG,
              `partial report persistence failed: ${formatAuditErrorForLog(partialCaught)}`,
            );
          }
          await timeoutAfter(debugLog.flushToFile(), 5_000, 'Fatal log flush').catch(() => {});
          failPerformanceAudit([
            error,
            ...(partialStoreError ? [`Partial report storage failed: ${partialStoreError}`] : []),
          ].join('\n'));
        }
      } finally {
        if (readinessCapture) performanceAuditReadinessRegistry.endCapture(readinessCapture);
        if (!rollbackRestored && rollbackSnapshot) {
          try {
            await timeoutAfter(
              restorePerformanceAuditRollback(useStore, rollbackSnapshot),
              5_000,
              'Final audit rollback',
            );
          } catch (rollbackError) {
            debugLog.error(
              PERFORMANCE_AUDIT_LOG_TAG,
              `audit rollback retained for launch recovery: ${formatAuditErrorForLog(rollbackError)}`,
            );
            await timeoutAfter(debugLog.flushToFile(), 5_000, 'Rollback error log flush').catch(() => {});
          }
        }
        try {
          monitor.stop();
        } catch {
          // Best effort; always continue to native keep-awake cleanup.
        }
        try {
          await timeoutAfter(
            deactivateKeepAwake(AUDIT_KEEP_AWAKE_TAG),
            5_000,
            'Keep-awake release',
          );
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
