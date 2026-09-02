import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { visibleAccountRows } from '../data/format';
import { resolveSectionRibbonStats } from '../data/ribbonStats';
import { excludeTokenDepositRates, rankFraction, sortRows } from '../data/selectors';
import { useStore } from '../data/store';
import { childrenFromScoped, rowsUnder } from '../data/taxonomy';
import { SECTION_ORDER } from '../constants';
import { usePerformanceAuditRunGate } from '../hooks/usePerformanceAuditRunGate';
import { getApkDownloadSnapshot } from '../lib/appUpdate';
import {
  CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
  type AppHealthAuditMode,
  type AppHealthDataSnapshot,
} from '../lib/appHealth';
import { readLiveAppHealthSnapshot } from '../lib/appHealthLiveSource';
import {
  installAppHealthTransportGuard,
  type AppHealthTransportGuard,
  type AuditTransportTarget,
} from '../lib/appHealthTransportGuard';
import { debugLog } from '../lib/debugLog';
import {
  buildDeepPerformanceAuditPlan,
  type DeepAuditStep,
} from '../lib/performanceAuditPlan';
import {
  MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
  maximumPerformanceAuditPrefs,
} from '../lib/performanceAuditProfile';
import {
  performanceAuditReadinessRegistry,
  PerformanceAuditReadinessTimeoutError,
  type PerformanceAuditReadinessKind,
  type PerformanceAuditReadinessSnapshot,
} from '../lib/performanceAuditReadiness';
import {
  beginPerformanceAuditRollback,
  retryPerformanceAuditRollback,
  tryRestorePerformanceAuditRollback,
} from '../lib/performanceAuditRollback';
import {
  aggregateRepeatedJourneys,
  buildPerformanceAuditJourneys,
  cancelPerformanceAudit,
  captureAuditTrace,
  completePerformanceAudit,
  failPerformanceAudit,
  flattenAuditLogText,
  ForegroundElapsed,
  formatAuditError,
  formatAuditErrorForLog,
  getPerformanceAuditPauseCount,
  getPerformanceAuditState,
  hasExplicitNonTimingFailure,
  isPerformanceAuditActive,
  markPerformanceAuditCheckStored,
  markPerformanceAuditCancelled,
  markPerformanceAuditRunning,
  measureAuditAction,
  pausePerformanceAudit,
  pathMatches,
  PERFORMANCE_AUDIT_LOG_TAG,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
  PerformanceAuditInactivityWatchdog,
  ResponsivenessMonitor,
  resolveAuditJourneyOptionalData,
  requiresPerformanceAuditRouteRecovery,
  resumePerformanceAudit,
  roundMetric,
  scoreLatency,
  subscribePerformanceAudit,
  summarizePerformanceAudit,
  updatePerformanceAuditProgress,
  worstStatus,
  type AuditCheck,
  type AuditCheckStatus,
  type AuditMetricValue,
  type AuditEnvironment,
  type AuditJourney,
  type AuditAppIdentity,
  type PerformanceAuditReport,
  type ResponsivenessMetrics,
} from '../lib/performanceAudit';
import {
  boundAuditCheckEvidence,
  compactAuditCheckForLog,
  compactAuditLogJson,
  omitNullishDeep,
} from '../lib/performanceAuditLog';
import { yieldToUi } from '../lib/yieldToUi';
import { buildIntegratedAppHealthReport } from '../lib/performanceAuditHealth';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

const AUDIT_HOME_PATH = '/performance-audit';
const ROUTE_TIMEOUT_MS = 8_000;
/** Floor for surface settle waits; hang prevention can extend this further. */
const DATA_SETTLE_TIMEOUT_MS = 30_000;
/** Graphic/list-heavy destinations may need longer than the historical 30s floor. */
const DATA_SETTLE_TIMEOUT_MAX_MS = 180_000;
const ROUTE_DWELL_MS = 350;
const READINESS_QUIET_WINDOW_MS = 650;
const RUNTIME_SAMPLE_MS = 1_250;
// Maximum-profile preparation, runtime, storage, filesystem, log I/O, payload,
// network, update readiness, and durable audit-state restoration.
const FIXED_BENCHMARK_CHECKS = 9;
const STORAGE_KEY_PREFIX = '@ar/performance-audit/';
const FILE_PAYLOAD_BYTES = 128 * 1024;
const STORAGE_PAYLOAD_BYTES = 64 * 1024;
const AUDIT_KEEP_AWAKE_TAG = 'performance-audit';
/** Teardown may read/write a full 2MB log and compact a large report off the JS thread budget. */
const FINALIZATION_STORE_TIMEOUT_MS = 120_000;
const FINALIZATION_FLUSH_TIMEOUT_MS = 30_000;
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

/**
 * Block at a step boundary while the app is backgrounded, and keep the hang
 * watchdog suspended for that whole time. Cancelling still works from the
 * paused state, so this can never trap a run.
 */
/**
 * Drop the readings that feed the report-wide maxima.
 *
 * summarizePerformanceAudit excludes skipped checks from the slowest-check
 * calculation but takes maxEventLoopLagMs and maxFrameGapMs across every check,
 * so an animation gap that merely spans a background pause — minutes, not
 * milliseconds — would otherwise be published as the app's worst frame gap.
 */
/**
 * Drop every elapsed-time metric from a check whose measurement spanned a
 * background pause.
 *
 * The rule is the `Ms` suffix rather than a list, because the report and the
 * local diagnostic log shows far more timings than the summary reads —
 * `backgroundSettleMs` and `actionMs` are rendered on the results screen, and a
 * check that says its timings are not reported must not still carry them.
 * AUDIT_LATENCY_METRIC_KEYS names the subset the summary consumes; a test
 * asserts this rule covers all of it.
 */
function contaminatedTimingsRemoved(
  metrics: Record<string, AuditMetricValue>,
): Record<string, AuditMetricValue> {
  const out = { ...metrics };
  for (const key of Object.keys(out)) {
    if (key.endsWith('Ms')) delete out[key];
  }
  return out;
}

async function waitWhilePaused(watchdog: PerformanceAuditInactivityWatchdog): Promise<void> {
  if (!getPerformanceAuditState().paused) return;
  while (getPerformanceAuditState().paused) {
    // Cancel must still escape a paused run.
    assertAuditActive();
    await delay(120);
  }
  assertSessionActive(watchdog);
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

async function awaitAuditWorkWithTimeout<T>(
  promise: Promise<T>,
  watchdog: PerformanceAuditInactivityWatchdog,
  label: string,
  timeoutMs: number,
): Promise<T> {
  assertSessionActive(watchdog);
  let timer: ReturnType<typeof setInterval> | null = null;
  // Spend only foreground time against the budget. A wall-clock timeout would
  // fire while the app sat in the background, failing the run for work the user
  // simply stepped away from — the same mistake the hang watchdog makes if it
  // is not suspended. Accruing on the pause and resume emissions as well as on
  // the poll keeps a JS thread suspended mid-interval from charging the
  // off-screen span once it resumes.
  const elapsed = new ForegroundElapsed();
  const unsubscribe = subscribePerformanceAudit(() => elapsed.accrue());
  const control = new Promise<never>((_resolve, reject) => {
    timer = setInterval(() => {
      elapsed.accrue();
      const stop = (error: unknown) => {
        if (timer) clearInterval(timer);
        timer = null;
        reject(error);
      };
      try {
        assertSessionActive(watchdog);
      } catch (error) {
        stop(error);
        return;
      }
      if (elapsed.foregroundMs >= timeoutMs) {
        stop(new Error(`${label} timed out after ${timeoutMs}ms`));
      }
    }, 50);
  });
  try {
    return await Promise.race([promise, control]);
  } catch (error) {
    rethrowAuditControl(error);
    if (error instanceof Error && error.message.includes('timed out after')) throw error;
    throw new Error(`${label} failed: ${formatAuditError(error)}`);
  } finally {
    if (timer) clearInterval(timer);
    unsubscribe();
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
    case 'moves.open': return '/rba-response' as Href;
    case 'outlook.open': return '/research' as Href;
    case 'saved.open': return '/watchlist' as Href;
    case 'profile.open': return '/profile' as Href;
    case 'settings.open': return '/settings' as Href;
    case 'terms.open': return '/terms' as Href;
    case 'debug-log.open': return '/debug-log' as Href;
    case 'not-found.open': return '/__audit-not-found__' as Href;
    case 'audit.pass.complete': return AUDIT_HOME_PATH as Href;
    case 'redirect.rba.verify': return '/rba' as Href;
    case 'redirect.root.verify': return '/' as Href;
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
        probe.fallbackCount == null ? '' : `fallback=${probe.fallbackCount}`,
        probe.visibleCount == null ? '' : `visible=${probe.visibleCount}`,
        probe.emptyStateRendered == null ? '' : `empty=${probe.emptyStateRendered ? 1 : 0}`,
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
  const execution = { attempted: false, invoked: false };
  const iteration: JourneyIteration = step.passId === 'first-pass' ? 'cold' : 'warm';
  const label = `${step.scenarioId}: ${step.semanticActionId} (${step.passId})`;
  if (step.skipReason) {
    return {
      id: `deep-${step.id}`,
      label,
      kind: 'journey',
      status: 'skipped',
      durationMs: null,
      metrics: {
        journeyId: `${step.scenarioId}.${step.semanticActionId}`,
        journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
        iteration,
        passId: step.passId,
        depth: step.depth,
        reason: step.skipReason,
        skipSafety: step.skipSafety.reason,
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'the planned action had no reachable safe target in the pinned dataset',
        executionAttempted: false,
        availabilityFailure: true,
      },
      error: `Planned audit facet could not run: ${step.skipReason}`,
      trace: captureAuditTrace(`deep step ${step.id} was unavailable before execution`),
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
      execution,
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
        routeStateInvalidated: true,
        executionAttempted: execution.attempted,
        actionInvoked: execution.invoked,
        actionCompleted: false,
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
  execution: { attempted: boolean; invoked: boolean },
): Promise<AuditCheck> {
  assertSessionActive(watchdog);
  assertDatasetRevision(datasetRevision);
  const logCursor = debugLog.getCursor();
  let actionSource = 'router';
  let actionRevisionBefore: number | null = null;
  let actionRevisionAfter: number | null = null;
  let renderRevisionBefore: string | null = null;
  let renderRevisionAfter: string | null = null;
  let completedActionName: string | null = null;
  const pathBeforeAction = currentPath();
  let expectedPath = step.expectedPath;
  let preActionWaitMs = 0;
  let measuredAction: {
    result: unknown;
    startedAt: number;
    durationMs: number;
    responsivenessAt: ReturnType<ResponsivenessMonitor['snapshot']>;
  };
  const href = routeEntryHref(step);
  if (href) {
    if (
      pathMatches(currentPath(), step.expectedPath) &&
      !step.semanticActionId.startsWith('redirect.')
    ) {
      router.replace(AUDIT_HOME_PATH as Href);
      await waitForPath(currentPath, AUDIT_HOME_PATH, `${label} route reset`, { watchdog });
      await settleUi();
      assertSessionActive(watchdog);
    }
    execution.attempted = true;
    measuredAction = await measureAuditAction(
      () => {
        execution.invoked = true;
        // A scenario entry is an independent sample, not a growing user back
        // stack. Compatibility redirects remain pushes because following the
        // redirect is the behaviour under test.
        if (step.semanticActionId.startsWith('redirect.')) router.push(href);
        else router.replace(href);
      },
      () => monitor.snapshot(),
      now,
    );
  } else {
    const preActionStarted = now();
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
    const sourceBefore = performanceAuditReadinessRegistry.snapshot().surfaces
      .find((surface) => surface.id === source.id);
    actionRevisionBefore = sourceBefore?.actionRevision ?? null;
    renderRevisionBefore = sourceBefore?.renderRevision ?? null;
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
    preActionWaitMs = now() - preActionStarted;
    execution.attempted = true;
    measuredAction = await measureAuditAction(
      () => {
        execution.invoked = true;
        return performanceAuditReadinessRegistry.invokeAction(
          source.id,
          step.semanticActionId,
          step.parameters,
        );
      },
      () => monitor.snapshot(),
      now,
    );
    const immediateCompletion = performanceAuditReadinessRegistry.snapshot().surfaces
      .find((surface) => surface.id === source.id);
    const durableImmediateCompletion = performanceAuditReadinessRegistry.actionCompletion(source.id);
    const authoritativeImmediateCompletion = durableImmediateCompletion ?? (
      immediateCompletion?.lastCompletedAction
        ? {
            actionRevision: immediateCompletion.actionRevision,
            actionName: immediateCompletion.lastCompletedAction,
          }
        : null
    );
    actionRevisionAfter = authoritativeImmediateCompletion?.actionRevision ?? null;
    renderRevisionAfter = immediateCompletion?.renderRevision ?? null;
    completedActionName = authoritativeImmediateCompletion?.actionName ?? null;
    const actionResult = measuredAction.result;
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
        durationMs: null,
        metrics: {
          journeyId: `${step.scenarioId}.${step.semanticActionId}`,
          journeyLabel: `${step.scenarioId}: ${step.semanticActionId}`,
          iteration,
          passId: step.passId,
          depth: step.depth,
          reason: actionResult.unavailableReason,
          skipSafety: step.skipSafety.reason,
          availabilityEvidence: 'mounted action terminal-unavailable result',
          skipClassification: 'terminal-availability',
          executionAttempted: true,
          actionInvoked: true,
          actionCompleted: false,
          actionMs: roundMetric(measuredAction.durationMs),
          availabilityFailure: true,
          routeStateInvalidated: false,
        },
        error: `Planned audit action was unavailable: ${actionResult.unavailableReason}`,
        trace: captureAuditTrace(`deep step ${step.id} returned unavailable`),
      };
    }
  }
  const actionMs = measuredAction.durationMs;
  const actionStarted = measuredAction.startedAt;
  const responsivenessAt = measuredAction.responsivenessAt;

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
  if (actionSource !== 'router') {
    const completedSurface = performanceAuditReadinessRegistry.snapshot().surfaces
      .find((surface) => surface.id === actionSource);
    const durableCompletion = performanceAuditReadinessRegistry.actionCompletion(actionSource);
    const authoritativeCompletion = durableCompletion ?? (
      completedSurface?.lastCompletedAction
        ? {
            actionRevision: completedSurface.actionRevision,
            actionName: completedSurface.lastCompletedAction,
          }
        : null
    );
    actionRevisionAfter = authoritativeCompletion?.actionRevision ?? actionRevisionAfter;
    renderRevisionAfter = completedSurface?.renderRevision ?? renderRevisionAfter;
    completedActionName = authoritativeCompletion?.actionName ?? completedActionName;
    if (
      actionRevisionBefore == null ||
      actionRevisionAfter == null ||
      actionRevisionAfter <= actionRevisionBefore ||
      completedActionName !== step.semanticActionId
    ) {
      throw new Error(
        `Mounted action execution was not proven for ${step.semanticActionId}; ` +
        `revision ${actionRevisionBefore ?? 'missing'} -> ${actionRevisionAfter ?? 'missing'}, ` +
        `last action ${completedActionName ?? 'none'}`,
      );
    }
    const pathChanged = !pathMatches(currentPath(), pathBeforeAction);
    const requiresChangedRender = step.safety.stateImpact !== 'none' &&
      !step.semanticActionId.includes('.scroll.');
    if (
      requiresChangedRender &&
      !pathChanged &&
      renderRevisionBefore === renderRevisionAfter
    ) {
      throw new Error(
        `Mounted action completed without an observable path or render-state change: ` +
        `${step.semanticActionId} (${renderRevisionBefore ?? 'no render revision'})`,
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
      measurementMode: 'semantic-action',
      executionAttempted: true,
      actionInvoked: true,
      actionCompleted: true,
      actionRevisionBefore,
      actionRevisionAfter,
      renderRevisionBefore,
      renderRevisionAfter,
      actionResultEvidence: measuredAction.result == null
        ? null
        : JSON.stringify(measuredAction.result).slice(0, 512),
      actionMs: roundMetric(actionMs),
      ...(actionSource === 'router' ? {} : { preActionWaitMs: roundMetric(preActionWaitMs) }),
      forwardMs: roundMetric(forwardMs),
      backgroundSettleMs: roundMetric(readinessMs),
      readinessQuietWindowMs: READINESS_QUIET_WINDOW_MS,
      runtimeErrors: errors.journey.length,
      runtimeErrorMessages: errors.journey.join(' | ') || null,
      incidentalRuntimeErrors: errors.incidental.length,
      incidentalRuntimeErrorMessages: errors.incidental.join(' | ') || null,
      // Errors the app itself logged. Unlike a latency score or a timeout,
      // these cannot be produced by the clock, so they survive an interruption.
      nonTimingFailure: errors.journey.length > 0,
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
    diagnosticsUploadEnabled: false,
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
): Record<string, AuditMetricValue> {
  const key = (name: string) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
  return {
    [key('eventLoopSamples')]: metrics.eventLoopSamples,
    [key('eventLoopMeasurementAvailable')]: metrics.eventLoopSamples > 0,
    [key('eventLoopP95Ms')]: metrics.eventLoopP95Ms,
    [key('maxEventLoopLagMs')]: metrics.maxEventLoopLagMs,
    [key('stallsOver100Ms')]: metrics.stallsOver100Ms,
    [key('frameSamples')]: metrics.frameSamples,
    [key('frameMeasurementAvailable')]: metrics.frameSamples > 0,
    [key('frameP95Ms')]: metrics.frameP95Ms,
    [key('maxFrameGapMs')]: metrics.maxFrameGapMs,
    [key('framesOver50Ms')]: metrics.framesOver50Ms,
  };
}

const EMPTY_RESPONSIVENESS: ResponsivenessMetrics = {
  eventLoopSamples: 0,
  eventLoopP95Ms: null,
  maxEventLoopLagMs: null,
  stallsOver100Ms: null,
  frameSamples: 0,
  frameP95Ms: null,
  maxFrameGapMs: null,
  framesOver50Ms: null,
};

function responsivenessStatus(metrics: ResponsivenessMetrics): AuditCheckStatus {
  const statuses: AuditCheckStatus[] = [];
  if (metrics.maxEventLoopLagMs != null) {
    statuses.push(scoreLatency(metrics.maxEventLoopLagMs, 100, 300));
  }
  if (metrics.maxFrameGapMs != null) {
    statuses.push(scoreLatency(metrics.maxFrameGapMs, 80, 250));
  }
  return statuses.length ? worstStatus(...statuses) : 'skipped';
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
    diagnosticsUploadEnabled: false,
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
  const measurementAvailable = metrics.eventLoopSamples > 0 && metrics.frameSamples > 0;
  return {
    id: 'runtime-responsiveness',
    label: 'Idle responsiveness baseline',
    kind: 'runtime',
    status: measurementAvailable ? responsivenessStatus(metrics) : 'skipped',
    durationMs: measurementAvailable ? roundMetric(now() - started) : null,
    metrics: {
      ...responsivenessRecord(metrics),
      executionAttempted: true,
      measurementAvailable,
      ...(measurementAvailable ? {} : {
        skipClassification: 'terminal-availability',
        availabilityFailure: true,
        availabilityEvidence: 'timer and animation callback samples were not both captured',
        reason: 'Responsiveness samples unavailable',
      }),
    },
  };
}

async function runMaximumCoverageProfileCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  auditMode: AppHealthAuditMode,
): Promise<AuditCheck> {
  const started = now();
  const responsiveAt = monitor.snapshot();
  const original = useStore.getState();
  const prefs = maximumPerformanceAuditPrefs(original.prefs);
  useStore.setState({ prefs, activeSection: prefs.defaultSection });
  await yieldToUi();

  // Audit only what is already cached. Preparing an absent optional asset would
  // make the audit mutate its subject and either violate local zero-network mode
  // or authenticate an asset from state that predates the live-source manifest.
  assertSessionActive(watchdog);

  const state = useStore.getState();
  const requiredAssets = {
    core: state.core != null,
    details: state.details != null,
    searchIndex: state.searchIndex != null,
    bankHistory: state.historyBanks != null,
    bankInsights: state.bankInsights != null,
    rbaCalendar: state.rbaCalendar != null,
    productHistory: state.productHistory != null,
  };
  const missingAssets = Object.entries(requiredAssets)
    .filter(([, available]) => !available)
    .map(([name]) => name);
  const dataErrors = [
    state.historyBanksError,
    state.bankInsightsError,
    state.rbaCalendarError,
    state.productHistoryError,
  ].filter((value): value is string => Boolean(value));
  const errors = [...dataErrors];
  const maximumSafeFeaturesEnabled =
    state.prefs.interests.length === SECTION_ORDER.length &&
    SECTION_ORDER.every((section) => state.prefs.interests.includes(section)) &&
    state.prefs.includeNonStandard &&
    state.prefs.enableDeepSearch &&
    state.prefs.showHistoryRibbon &&
    state.prefs.rateIntelligencePro &&
    state.prefs.onboarded &&
    state.prefs.depositRankMetric === 'max' &&
    state.prefs.mortgageRateMetric === 'comparison';
  const assetsUnavailableWithoutPreparation = missingAssets.length > 0 && errors.length === 0;
  const ok = maximumSafeFeaturesEnabled && missingAssets.length === 0 && errors.length === 0;
  const responsiveness = monitor.metricsSince(responsiveAt);
  return {
    id: 'maximum-coverage-profile',
    label: 'Maximum safe audit coverage preparation',
    kind: 'data',
    status: assetsUnavailableWithoutPreparation
      ? 'skipped'
      : ok
      ? worstStatus('pass', responsivenessStatus(responsiveness))
      : 'fail',
    durationMs: roundMetric(now() - started),
    metrics: {
      profile: MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
      maximumSafeFeaturesEnabled,
      enabledSections: state.prefs.interests.join(','),
      includeNonStandard: state.prefs.includeNonStandard,
      deepSearchEnabled: state.prefs.enableDeepSearch,
      historyExplorerEnabled: state.prefs.showHistoryRibbon,
      depositRankMetric: state.prefs.depositRankMetric,
      mortgageRateMetric: state.prefs.mortgageRateMetric,
      requiredAssets: Object.keys(requiredAssets).length,
      availableAssets: Object.values(requiredAssets).filter(Boolean).length,
      missingAssets: missingAssets.join(',') || null,
      localCacheOnly: auditMode === 'local',
      executionAttempted: true,
      measurementAvailable: !assetsUnavailableWithoutPreparation,
      ...(assetsUnavailableWithoutPreparation ? {
        skipClassification: 'terminal-availability',
        availabilityFailure: true,
        availabilityEvidence: `Optional assets are not cached: ${missingAssets.join(', ')}`,
        reason: 'Maximum coverage is unavailable because optional assets are not cached',
      } : {}),
      nonTimingFailure: !ok && !assetsUnavailableWithoutPreparation,
      ...responsivenessRecord(responsiveness),
    },
    ...(ok || assetsUnavailableWithoutPreparation ? {} : {
      error: errors.join(' | ') || `Missing maximum-coverage assets: ${missingAssets.join(', ')}`,
      trace: captureAuditTrace('maximum audit coverage preparation failed'),
    }),
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
  const maxWriteMs = writeTimes.length
    ? Math.max(...writeTimes)
    : null;
  const maxReadMs = readTimes.length
    ? Math.max(...readTimes)
    : null;
  const responsiveness = monitor.metricsSince(responsiveAt);
  return {
    id: 'async-storage',
    label: 'Preferences storage round-trip',
    kind: 'storage',
    status: error
      ? 'fail'
      : worstStatus(
          scoreLatency(maxWriteMs ?? 0, 50, 200),
          scoreLatency(maxReadMs ?? 0, 50, 200),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadBytes: payload.length,
      iterations: writeTimes.length,
      maxWriteMs: maxWriteMs == null ? null : roundMetric(maxWriteMs),
      maxReadMs: maxReadMs == null ? null : roundMetric(maxReadMs),
      averageWriteMs: writeTimes.length
        ? roundMetric(writeTimes.reduce((sum, value) => sum + value, 0) / writeTimes.length)
        : null,
      averageReadMs: readTimes.length
        ? roundMetric(readTimes.reduce((sum, value) => sum + value, 0) / readTimes.length)
        : null,
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
      durationMs: null,
      metrics: {
        reason: 'documentDirectory unavailable',
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'the runtime did not expose a writable app document directory',
        executionAttempted: false,
        availabilityFailure: true,
        ...responsivenessRecord(responsiveness),
      },
      error: 'Planned filesystem round trip could not run because documentDirectory is unavailable',
    };
  }
  const uri = `${FileSystem.documentDirectory}performance-audit-${sessionId}.tmp`;
  const payload = 'f'.repeat(FILE_PAYLOAD_BYTES);
  let writeMs: number | null = null;
  let readMs: number | null = null;
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
          scoreLatency(writeMs ?? 0, 80, 300),
          scoreLatency(readMs ?? 0, 80, 300),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      payloadBytes: payload.length,
      writeMs: writeMs == null ? null : roundMetric(writeMs),
      readMs: readMs == null ? null : roundMetric(readMs),
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
      durationMs: null,
      metrics: {
        reason: 'No active payload is loaded',
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'the pinned store had no active payload',
        availabilityFailure: true,
        executionAttempted: false,
      },
      error: 'Planned active-payload processing could not run because no payload is loaded',
    };
  }

  const responsiveAt = monitor.snapshot();
  let stringifyMs: number | null = null;
  let parseMs: number | null = null;
  let traversalMs: number | null = null;
  let payloadChars: number | null = null;
  let rateRows: number | null = null;
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
    rateRows = 0;
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
    scoreLatency(stringifyMs ?? 0, 250, 1_000),
    scoreLatency(parseMs ?? 0, 350, 1_500),
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
      stringifyMs: stringifyMs == null ? null : roundMetric(stringifyMs),
      parseMs: parseMs == null ? null : roundMetric(parseMs),
      traversalMs: traversalMs == null ? null : roundMetric(traversalMs),
      ...responsivenessRecord(responsiveness),
    },
    ...(error ? { error, trace: captureAuditTrace('active payload processing failed') } : {}),
  };
}

async function runNetworkCheck(
  monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
  mode: 'local' | 'live-source',
  guard: AppHealthTransportGuard,
  onSnapshot: (snapshot: AppHealthDataSnapshot) => void,
): Promise<AuditCheck> {
  assertSessionActive(watchdog);
  if (mode === 'live-source') {
    const started = now();
    const responsivenessAt = monitor.snapshot();
    try {
      const snapshot = await readLiveAppHealthSnapshot({
        guard,
        contract: CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
        appVersion: Application.nativeApplicationVersion ?? '0.0.0',
      });
      onSnapshot(snapshot);
      const responsiveness = monitor.metricsSince(responsivenessAt);
      return {
        id: 'manifest-network',
        label: 'Live-source publication validation',
        kind: 'network',
        status: responsivenessStatus(responsiveness),
        durationMs: roundMetric(now() - started),
        metrics: {
          executionAttempted: true,
          allowlistedSource: true,
          manifestValidated: true,
          datesIndexValidated: true,
          coreHashValidated: true,
          detailsHashValidated: true,
          ...responsivenessRecord(responsiveness),
        },
      };
    } catch (error) {
      return {
        id: 'manifest-network',
        label: 'Live-source manifest transport',
        kind: 'network',
        status: 'fail',
        durationMs: roundMetric(now() - started),
        metrics: { executionAttempted: true, allowlistedSource: true },
        error: formatAuditError(error),
        trace: captureAuditTrace('live-source manifest transport failed'),
      };
    }
  }
  return {
    id: 'manifest-network',
    label: 'Network transport',
    kind: 'network',
    status: 'skipped',
    durationMs: null,
    metrics: {
      executionAttempted: false,
      skipClassification: 'terminal-availability',
      availabilityEvidence: 'local app-health mode blocks fetch and XMLHttpRequest before transport',
      reason: 'Not run: local mode has a zero-network contract',
    },
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
      durationMs: null,
      metrics: {
        reason: 'Section data is unavailable',
        section,
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'the pinned payload did not contain this section model',
        availabilityFailure: true,
        executionAttempted: false,
      },
      error: `Planned ${section} section benchmark could not run because its data is unavailable`,
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
      rows: first?.rows ?? null,
      visibleRows: first?.visibleRows ?? null,
      childNodes: first?.childNodes ?? null,
      rankedRows: first?.rankedRows ?? null,
      statsCount: first?.statsCount ?? null,
      firstScopeMs: first == null ? null : roundMetric(first.scopeMs),
      firstFilterMs: first == null ? null : roundMetric(first.filterMs),
      firstHierarchyMs: first == null ? null : roundMetric(first.hierarchyMs),
      firstStatsMs: first == null ? null : roundMetric(first.statsMs),
      firstRankMs: first == null ? null : roundMetric(first.rankMs),
      repeatScopeMs: repeat == null ? null : roundMetric(repeat.scopeMs),
      repeatFilterMs: repeat == null ? null : roundMetric(repeat.filterMs),
      repeatHierarchyMs: repeat == null ? null : roundMetric(repeat.hierarchyMs),
      repeatStatsMs: repeat == null ? null : roundMetric(repeat.statsMs),
      repeatRankMs: repeat == null ? null : roundMetric(repeat.rankMs),
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
  let flushMs: number | null = null;
  let readMs: number | null = null;
  let bytes: number | null = null;
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
          scoreLatency(flushMs ?? 0, 100, 500),
          scoreLatency(readMs ?? 0, 100, 500),
          responsivenessStatus(responsiveness),
        ),
    durationMs: roundMetric(now() - started),
    metrics: {
      bytes,
      flushMs: flushMs == null ? null : roundMetric(flushMs),
      readMs: readMs == null ? null : roundMetric(readMs),
      ...responsivenessRecord(responsiveness),
    },
    ...(error ? { error, trace: captureAuditTrace('debug log persistence failed') } : {}),
  };
}

async function runUpdateReadinessCheck(
  app: AuditAppIdentity,
  _monitor: ResponsivenessMonitor,
  watchdog: PerformanceAuditInactivityWatchdog,
): Promise<AuditCheck> {
  const installed = { version: app.appVersion, buildNumber: app.buildVersion };
  const download = getApkDownloadSnapshot();
  assertSessionActive(watchdog);
  return {
    id: 'update-readiness',
    label: 'Android update state (local snapshot)',
    kind: 'update',
    status: 'skipped',
    durationMs: null,
    metrics: {
      executionAttempted: false,
      skipClassification: 'terminal-availability',
      availabilityEvidence: Platform.OS === 'android'
        ? 'the local download state was observed without checking the remote manifest'
        : 'the update mechanism is Android-only',
      reason: Platform.OS === 'android'
        ? 'Not run: remote update checks are outside the local audit contract'
        : 'Not run: Android-only',
      installedVersion: installed.version,
      installedBuild: installed.buildNumber,
      installedApplicationId: Application.applicationId ?? null,
      downloadPhase: download.phase,
      downloadedBytes: download.bytesWritten,
      downloadTotalBytes: download.totalBytes,
      cachedBuild: download.buildNumber,
      cachedReady: download.phase === 'ready' && !!download.localUri,
    },
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
  durationMs: number | null;
}> {
  // Give mounted effects a chance to claim their store work before inspecting
  // loading state. The subsequent poll keeps that cold work inside this
  // journey instead of letting it spill into later checks.
  await delay(100);
  assertSessionActive(watchdog);
  const requirements = journeyDataRequirements(journey, logCursor);
  const labels = [...new Set(requirements.map(({ label }) => label))];
  if (requirements.length === 0) return { labels, durationMs: null };

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

/** Measure a real route round trip independently from the stateful semantic
 * action plan. Every published back timing corresponds to router.back(). */
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
      durationMs: null,
      metrics: {
        measurementMode: 'route-round-trip',
        reason: journey.skipReason ?? 'Route unavailable',
        skipClassification: 'terminal-availability',
        availabilityEvidence: 'the pinned payload did not provide a safe target for this route',
        executionAttempted: false,
        availabilityFailure: true,
        journeyId: journey.id,
        journeyLabel: journey.label,
        iteration,
      },
      error: `Planned route round trip could not run: ${journey.skipReason ?? 'Route unavailable'}`,
    };
  }

  const responsivenessAt = monitor.snapshot();
  const logCursor = debugLog.getCursor();
  let forwardMs: number | null = null;
  let backgroundSettleMs: number | null = null;
  let destinationReadinessMs: number | null = null;
  let backgroundTasks: string[] = [];
  let backMs: number | null = null;
  let returnFallbackMs: number | null = null;
  let backDestination: string | null = null;
  let backReturnedToAudit = false;
  let backChangedPath = false;
  let returnNavigationKind:
    | 'none'
    | 'second-back'
    | 'replace-recovery'
    | 'second-back+replace-recovery' = 'none';
  let secondBackMs: number | null = null;
  let replaceRecoveryMs: number | null = null;
  let originReadinessMs: number | null = null;
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
    const destinationReadinessStarted = now();
    const destinationReadinessAbort = new AbortController();
    const destinationReadinessGuard = setInterval(() => {
      if (getPerformanceAuditState().cancelRequested || watchdog.isExpired()) {
        destinationReadinessAbort.abort();
      }
    }, 50);
    try {
      await performanceAuditReadinessRegistry.waitForReady({
        surfaceIds: [journey.expectedSurface],
        quietWindowMs: READINESS_QUIET_WINDOW_MS,
        timeoutMs: readinessTimeoutMs(watchdog),
        signal: destinationReadinessAbort.signal,
      });
      watchdog.touchProgress();
    } finally {
      clearInterval(destinationReadinessGuard);
    }
    assertSessionActive(watchdog);
    destinationReadinessMs = now() - destinationReadinessStarted;
    forwardMs = now() - at;
    forwardResponsiveness = monitor.metricsSince(forwardResponsivenessAt);
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
      backMs += secondBackMs;
      backDestination = currentPath();
      returnFallbackMs = secondBackMs;
      backResponsiveness = monitor.metricsSince(backResponsivenessAt);
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
      returnFallbackMs = (returnFallbackMs ?? 0) + replaceRecoveryMs;
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

  if (!routeError && backReturnedToAudit) {
    const originReadinessStarted = now();
    const originReadinessAbort = new AbortController();
    const originReadinessGuard = setInterval(() => {
      if (getPerformanceAuditState().cancelRequested || watchdog.isExpired()) {
        originReadinessAbort.abort();
      }
    }, 50);
    try {
      await performanceAuditReadinessRegistry.waitForReady({
        surfaceIds: ['audit.progress'],
        quietWindowMs: READINESS_QUIET_WINDOW_MS,
        timeoutMs: readinessTimeoutMs(watchdog),
        signal: originReadinessAbort.signal,
      });
      originReadinessMs = now() - originReadinessStarted;
    } catch (caught) {
      rethrowAuditControl(caught);
      assertSessionActive(watchdog);
      routeError = `Audit origin did not become ready after back navigation: ${formatAuditError(caught)}`;
    } finally {
      clearInterval(originReadinessGuard);
    }
  }

  const responsiveness = monitor.metricsSince(responsivenessAt);
  const errors = routeErrorMessages(logCursor);
  const backContractStatus =
    backReturnedToAudit && backChangedPath && backMs != null && backMs > 0 ? 'pass' : 'fail';
  const status = routeError || errors.journey.length
    ? 'fail'
    : worstStatus(
        scoreLatency(forwardMs ?? 0, 900, 2_500),
        scoreLatency(backgroundSettleMs ?? 0, 2_000, 10_000),
        scoreLatency(backMs ?? 0, 800, 2_000),
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
      measurementMode: 'route-round-trip',
      executionAttempted: true,
      actionInvoked: true,
      actionCompleted: routeError == null,
      journeyId: journey.id,
      journeyLabel: journey.label,
      iteration,
      expectedPath: journey.expectedPath,
      expectedSurface: journey.expectedSurface,
      navigationKind: journey.navigationKind,
      forwardMs: forwardMs == null ? null : roundMetric(forwardMs),
      backgroundSettleMs: backgroundSettleMs == null ? null : roundMetric(backgroundSettleMs),
      destinationReadinessMs:
        destinationReadinessMs == null ? null : roundMetric(destinationReadinessMs),
      backgroundTasks: backgroundTasks.join(', ') || null,
      backMs: backMs == null ? null : roundMetric(backMs),
      originReadinessMs: originReadinessMs == null ? null : roundMetric(originReadinessMs),
      backDestination,
      backChangedPath,
      backReturnedToAudit,
      returnNavigationKind,
      secondBackMs: secondBackMs == null ? null : roundMetric(secondBackMs),
      replaceRecoveryMs: replaceRecoveryMs == null ? null : roundMetric(replaceRecoveryMs),
      returnFallbackMs: returnFallbackMs == null ? null : roundMetric(returnFallbackMs),
      runtimeErrors: errors.journey.length,
      runtimeErrorMessages: errors.journey.join(' | ') || null,
      incidentalRuntimeErrors: errors.incidental.length,
      incidentalRuntimeErrorMessages: errors.incidental.join(' | ') || null,
      // routeError covers navigation timeouts, which a pause can manufacture;
      // only the app's own logged errors count as clock-independent evidence.
      nonTimingFailure: errors.journey.length > 0,
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
  const runGate = usePerformanceAuditRunGate();
  const { claim: claimRun, release: releaseRun, releaseCount } = runGate;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (state.status !== 'queued' || !state.sessionId || !state.startedAt) return;
    // Teardown outlives the previous audit's terminal state; releaseCount
    // re-runs this effect once that run lets go of the gate.
    if (!claimRun(state.sessionId)) return;

    const execute = async () => {
      const sessionId = state.sessionId!;
      const startedAt = state.startedAt!;
      const auditMode = state.auditMode;
      const startedMs = Date.now();
      // The report's duration is time the audit actually measured. A five-minute
      // pause is the user's, not the app's, and counting it would attribute the
      // wait to a run that was deliberately suspended for it.
      const runElapsed = new ForegroundElapsed();
      const unsubscribeRunElapsed = subscribePerformanceAudit(() => runElapsed.accrue());
      const activeDurationMs = () => {
        runElapsed.accrue();
        return roundMetric(runElapsed.foregroundMs);
      };
      const app = installedAuditIdentity();
      const watchdog = new PerformanceAuditInactivityWatchdog(state.hangTimeoutMs);
      // Mirror pauses onto the watchdog the instant they happen, not when the
      // loop next reaches a step boundary. A step already in flight when the
      // app backgrounds keeps polling isExpired() every 50ms, so a short hang
      // timeout plus a phone call would otherwise abort the run as hung.
      const mirrorPauseToWatchdog = () => {
        watchdog.setPaused(getPerformanceAuditState().paused);
      };
      // Seed from current state before subscribing: the run gate can hold a
      // queued audit until after it has already been paused, and a subscription
      // only sees later emissions. A watchdog that never learned it was paused
      // does not reset its deadline when the resume arrives.
      mirrorPauseToWatchdog();
      const unsubscribePause = subscribePerformanceAudit(mirrorPauseToWatchdog);
      const originalStore = useStore.getState();
      let plan = buildDeepPerformanceAuditPlan(originalStore.core);
      let navigationJourneys = buildPerformanceAuditJourneys(
        originalStore.core,
        SECTION_ORDER,
      );
      const platformBenchmarkChecks = FIXED_BENCHMARK_CHECKS - (Platform.OS === 'android' ? 0 : 1);
      let total = platformBenchmarkChecks + SECTION_ORDER.length +
        navigationJourneys.length * 2 +
        plan.passes.reduce((sum, pass) => sum + pass.steps.length, 0);
      const checks: AuditCheck[] = [];
      let liveSourceSnapshot: AppHealthDataSnapshot | null = null;
      const monitor = new ResponsivenessMonitor();
      let completed = 0;
      let lastStoredCheckAt: string | null = null;
      let rollbackSnapshot: Awaited<ReturnType<typeof beginPerformanceAuditRollback>> | null = null;
      let rollbackRestored = false;
      let rollbackAttempts = 0;
      let readinessCapture: ReturnType<typeof performanceAuditReadinessRegistry.beginCapture> | null = null;
      let auditEnvironment: AuditEnvironment | null = null;
      let activeDatasetRevision: AuditDatasetRevision | null = null;
      const transportGuard = installAppHealthTransportGuard({
        target: globalThis as unknown as AuditTransportTarget,
        mode: auditMode,
        contract: CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT,
      });

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

      const record = async (rawCheck: AuditCheck) => {
        assertSessionActive(watchdog);
        // Bound evidence at the one place every check enters the report. ~260
        // unbounded stacks and readiness dumps are what pushed the finished
        // report past the megabyte range and exhausted the heap in teardown.
        const check = boundAuditCheckEvidence(rawCheck);
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
        // Setup snapshots the store, plan and environment the whole run is
        // pinned to. Capturing that from a backgrounded process would pin the
        // report to state the user cannot see, so wait for the foreground here
        // too rather than only at the first measured check.
        await waitWhilePaused(watchdog);
        const initialStore = useStore.getState();
        plan = buildDeepPerformanceAuditPlan(initialStore.core);
        navigationJourneys = buildPerformanceAuditJourneys(
          initialStore.core,
          SECTION_ORDER,
        );
        total = platformBenchmarkChecks + SECTION_ORDER.length +
          navigationJourneys.length * 2 +
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

        // Resolves true when route recovery ran, so a caller can tell that the
        // screen was replaced under it.
        const recordContinuable = async (
          label: string,
          run: () => Promise<AuditCheck>,
        ): Promise<boolean> => {
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
          const checkStarted = now();
          const continuedFailureCheck = (caught: unknown): AuditCheck => ({
            id: `continued-failure-${completed + 1}`,
            label,
            kind: 'runtime',
            status: 'fail',
            durationMs: roundMetric(now() - checkStarted),
            metrics: {
              continuedAfterFailure: true,
              routeStateInvalidated: true,
              currentPath: pathnameRef.current,
              datasetRevision: datasetRevisionLabel(datasetRevision),
            },
            error: formatAuditError(caught),
            trace: captureAuditTrace(`${label} failed; audit continues`),
          });
          // Start only in the foreground, and retake once if the app left it
          // mid-step: a measurement spanning a pause times a process Android
          // stopped drawing, not the app.
          await waitWhilePaused(watchdog);
          let check: AuditCheck;
          const runOnce = async (): Promise<AuditCheck> => {
            try {
              return await run();
            } catch (caught) {
              rethrowAuditControl(caught);
              return continuedFailureCheck(caught);
            }
          };
          const startedPaused = getPerformanceAuditPauseCount();
          check = await runOnce();
          if (getPerformanceAuditPauseCount() !== startedPaused) {
            // Contaminated: the app left the foreground mid-measurement. Do not
            // replay the step. Most plan actions advance from current state —
            // the `*.next` cyclers and the `*.toggle` family — so a second
            // invocation would move the app twice, corrupting both this reading
            // and the state later steps expect. A replay would also record a
            // warmed attempt under the cold-pass label. Skipping keeps the
            // report honest, and aggregateRepeatedJourneys already ignores
            // skipped cold/warm pairs.
            //
            // A failure the check already observed is real and survives. Only
            // the timings are unusable; downgrading the status would hide a
            // genuine fault behind an interruption and could report the run
            // healthy.
            // Only a failure the check positively identified as clock-
            // independent survives. Latency scores are the obvious hazard, but
            // a recorded `error` is not evidence either: readiness waits, route
            // navigation and the manifest fetch all raise errors on wall-clock
            // timeouts a pause can trigger by itself. Anything short of an
            // explicit signal is recorded as skipped — with its error text
            // intact, so the evidence stays in the report even when it does not
            // count toward the diagnosis.
            const observedFailure = hasExplicitNonTimingFailure(check);
            debugLog.info(
              PERFORMANCE_AUDIT_LOG_TAG,
              `${label} was interrupted by the app leaving the foreground; recorded as ` +
              `${observedFailure ? 'a failure without timings' : 'skipped'}`,
            );
            check = {
              ...check,
              status: observedFailure ? 'fail' : 'skipped',
              // A duration spanning a pause must not become the slowest check.
              durationMs: null,
              metrics: {
                ...contaminatedTimingsRemoved(check.metrics),
                interruptedByBackground: true,
                reason: observedFailure
                  ? 'The app left the foreground during this check; the failure was observed before the interruption and timings are not reported'
                  : 'The app left the foreground during this check',
              },
            };
            await waitWhilePaused(watchdog);
          }
          try {
            // Durable check storage/logging failures remain fatal — only the step
            // body itself is continuable after a recorded fail.
            await record(check);
          } catch (caught) {
            rethrowAuditControl(caught);
            throw caught;
          }
          // An interrupted step may have left the app mid-navigation.
          if (requiresPerformanceAuditRouteRecovery(check)) {
            await recoverAfterFailure();
            return true;
          }
          return false;
        };

        updatePerformanceAuditProgress(completed, total, 'Preparing maximum safe feature coverage');
        const maximumProfileResult: { check: AuditCheck | null } = { check: null };
        await recordContinuable(
          'Preparing maximum safe feature coverage',
          async () => {
            maximumProfileResult.check = await runMaximumCoverageProfileCheck(
              monitor,
              watchdog,
              auditMode,
            );
            return maximumProfileResult.check;
          },
        );
        const maximumProfileState = useStore.getState();
        environment = {
          ...environment,
          detailsLoaded: maximumProfileState.details != null,
          historyLoaded: maximumProfileState.historyBanks != null,
          productHistoryLoaded: maximumProfileState.productHistory != null,
          auditCoverageProfile: MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
          maximumSafeFeaturesEnabled:
            maximumProfileResult.check != null &&
            maximumProfileResult.check.status !== 'fail' &&
            maximumProfileResult.check.status !== 'skipped',
        };

        updatePerformanceAuditProgress(completed, total, 'Sampling idle responsiveness');
        // Routed through recordContinuable so the responsiveness sample gets the
        // same foreground gate as every other check: it measures event-loop lag and
        // animation callback gaps, which are the readings least meaningful when
        // Android has stopped drawing.
        await recordContinuable(
          'Sampling idle responsiveness',
          () => runRuntimeCheck(monitor, watchdog),
        );

        // Deep semantic callbacks deliberately keep their screen mounted so a
        // scenario can continue. They cannot also be honest forward/back route
        // measurements. Run every steady-state destination as its own cold/warm
        // push -> readiness/data settle -> hardware-equivalent back round trip.
        for (const iteration of ['cold', 'warm'] as const) {
          for (const journey of navigationJourneys) {
            const label = `${journey.label} route round trip (${iteration})`;
            updatePerformanceAuditProgress(completed, total, label);
            await recordContinuable(
              label,
              () => runJourney(
                journey,
                iteration,
                () => pathnameRef.current,
                monitor,
                watchdog,
                datasetRevision,
              ),
            );
          }
        }

        for (const pass of plan.passes) {
          for (const step of pass.steps) {
            assertSessionActive(watchdog);
            assertDatasetRevision(datasetRevision);
            const label = `${pass.label}: depth ${step.depth} - ${step.semanticActionId}`;
            updatePerformanceAuditProgress(completed, total, label);
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
            const recovered = await recordContinuable(
              label,
              () => runDeepAuditStep(
                step,
                () => pathnameRef.current,
                monitor,
                watchdog,
                datasetRevision,
              ),
            );
            void recovered;
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
        updatePerformanceAuditProgress(
          completed,
          total,
          auditMode === 'live-source'
            ? 'Validating the current public publication'
            : 'Recording the local zero-network boundary',
        );
        await recordContinuable(
          auditMode === 'live-source'
            ? 'Validating the current public publication'
            : 'Recording the local-only network exclusion',
          () => runNetworkCheck(
            monitor,
            watchdog,
            auditMode,
            transportGuard,
            (snapshot) => { liveSourceSnapshot = snapshot; },
          ),
        );
        assertSessionActive(watchdog);
        assertDatasetRevision(datasetRevision);

        if (Platform.OS === 'android') {
          updatePerformanceAuditProgress(completed, total, 'Inspecting Android update readiness');
          await recordContinuable(
            'Inspecting Android update readiness',
            () => runUpdateReadinessCheck(app, monitor, watchdog),
          );
          assertSessionActive(watchdog);
          assertDatasetRevision(datasetRevision);
        }

        updatePerformanceAuditProgress(completed, total, 'Restoring settings and saved data exactly');
        // The last measured step, and the only one not routed through
        // recordContinuable. Start it in the foreground like the rest.
        await waitWhilePaused(watchdog);
        const restoreStarted = now();
        const restoreStartedPaused = getPerformanceAuditPauseCount();
        const rollbackResult = await retryPerformanceAuditRollback(
          async (attemptNumber) => {
            rollbackAttempts = attemptNumber;
            return await awaitAuditWorkWithTimeout(
              tryRestorePerformanceAuditRollback(useStore, rollbackSnapshot ?? undefined),
              watchdog,
              attemptNumber === 1
                ? 'Audit state restoration'
                : `Audit state restoration attempt ${attemptNumber}`,
              FINALIZATION_STORE_TIMEOUT_MS,
            );
          },
          3,
          async (attemptNumber) => {
            updatePerformanceAuditProgress(
              completed,
              total,
              attemptNumber === 2
                ? 'Retrying settings and saved data restoration'
                : 'Making a final settings and saved data restoration attempt',
            );
            await waitWhilePaused(watchdog);
            await yieldToUi();
          },
        );
        rollbackAttempts = rollbackResult.attempts;
        rollbackRestored = rollbackResult.restored;
        // The outcome is reported either way — the state either was restored or
        // was not — but a duration spanning a pause must not become the
        // report's slowest check.
        const restoreInterrupted = getPerformanceAuditPauseCount() !== restoreStartedPaused;
        await record({
          id: 'audit-state-restoration',
          label: 'Audit state rollback and durable verification',
          kind: 'storage',
          status: rollbackResult.restored ? 'pass' : 'fail',
          durationMs: restoreInterrupted ? null : roundMetric(now() - restoreStarted),
          metrics: {
            restored: rollbackResult.restored,
            attempts: rollbackAttempts,
            ...(restoreInterrupted
              ? {
                interruptedByBackground: true,
                reason: 'The app left the foreground during restoration; timing not reported',
              }
              : {}),
          },
          ...(rollbackResult.error ? {
            error: rollbackResult.error,
            trace: captureAuditTrace('audit state restoration failed'),
          } : {}),
        });
        if (!rollbackRestored) {
          throw rollbackResult.cause instanceof Error
            ? rollbackResult.cause
            : new Error(
              rollbackResult.error ||
              'Performance audit state was not durably restored after three attempts',
            );
        }
        watchdog.beginFinalization();
        // Publish the terminal state in the foreground. A terminal run cannot be
        // resumed, so completing while paused would leave the pause set with no
        // AppState listener left to clear it.
        await waitWhilePaused(watchdog);

        environment = {
          ...environment,
          detailsLoaded: useStore.getState().details != null,
          historyLoaded: useStore.getState().historyBanks != null,
          productHistoryLoaded: useStore.getState().productHistory != null,
        };
        auditEnvironment = environment;

        const finishedAt = new Date().toISOString();
        const performanceSummary = summarizePerformanceAudit(checks);
        const journeyChecks = checks.filter((check) => check.kind === 'journey');
        const justifiedSkippedJourneyChecks = journeyChecks.filter((check) =>
          check.status === 'skipped' &&
          (check.metrics.skipClassification === 'terminal-availability' ||
            check.metrics.availabilityEvidence != null)).length;
        const unexpectedSkippedJourneyChecks = journeyChecks.filter((check) =>
          check.status === 'skipped' &&
          check.metrics.skipClassification !== 'terminal-availability' &&
          check.metrics.availabilityEvidence == null).length;
        const unavailableJourneyChecks = journeyChecks.filter(
          (check) => check.metrics.availabilityFailure === true ||
            check.metrics.executionAttempted === false,
        ).length;
        const plannedJourneyChecks = navigationJourneys.length * 2 + plan.passes.reduce(
          (sum, pass) => sum + pass.steps.length,
          0,
        );
        const executedJourneyChecks = journeyChecks.filter(
          (check) => check.status !== 'skipped' &&
            check.metrics.availabilityFailure !== true &&
            check.metrics.executionAttempted === true &&
            check.metrics.actionInvoked === true &&
            check.metrics.actionCompleted === true,
        ).length;
        const plannedCheckIds = [
          'maximum-coverage-profile',
          'runtime-responsiveness',
          ...navigationJourneys.flatMap((journey) => [
            `journey-${journey.id}-cold`,
            `journey-${journey.id}-warm`,
          ]),
          ...plan.passes.flatMap((pass) => pass.steps.map((step) => `deep-${step.id}`)),
          ...SECTION_ORDER.map((section) => `section-model-${section.toLowerCase()}`),
          'async-storage',
          'file-system',
          'debug-log-io',
          'active-data',
          'manifest-network',
          ...(Platform.OS === 'android' ? ['update-readiness'] : []),
          'audit-state-restoration',
        ];
        const plannedIdSet = new Set(plannedCheckIds);
        const storedIdCounts = new Map<string, number>();
        for (const check of checks) {
          storedIdCounts.set(check.id, (storedIdCounts.get(check.id) ?? 0) + 1);
        }
        const missingPlannedCheckIds = plannedCheckIds.filter((id) => !storedIdCounts.has(id));
        const duplicateStoredCheckIds = [...storedIdCounts]
          .filter(([, count]) => count > 1)
          .map(([id]) => id);
        const unexpectedStoredCheckIds = [...storedIdCounts.keys()]
          .filter((id) => !plannedIdSet.has(id));
        const appHealth = buildIntegratedAppHealthReport({
          sessionId,
          mode: auditMode,
          startedAt,
          finishedAt,
          state: useStore.getState(),
          appVersion: app.appVersion,
          performanceChecks: checks,
          journeys: navigationJourneys,
          plan,
          network: transportGuard.snapshot(),
          dataSnapshot: auditMode === 'live-source'
            ? liveSourceSnapshot ?? {
              source: 'unavailable',
              core: null,
              manifest: null,
              appVersion: app.appVersion,
              datesIndex: null,
              details: null,
              assets: {},
              quarantine: null,
            }
            : undefined,
        });
        const healthExecuted = appHealth.summary.pass + appHealth.summary.warn + appHealth.summary.fail;
        const combinedExecuted = performanceSummary.executed + healthExecuted;
        const combinedTotal = checks.length + appHealth.summary.total;
        const summary = {
          ...performanceSummary,
          pass: performanceSummary.pass + appHealth.summary.pass,
          warn: performanceSummary.warn + appHealth.summary.warn,
          fail: performanceSummary.fail + appHealth.summary.fail,
          skipped: performanceSummary.skipped + appHealth.summary.notRun,
          unavailable: performanceSummary.unavailable + appHealth.summary.unavailable,
          executed: combinedExecuted,
          justifiedSkipped: performanceSummary.justifiedSkipped + appHealth.summary.notRun,
          coveragePercent: combinedTotal
            ? roundMetric((combinedExecuted / combinedTotal) * 100)
            : null,
          overall: appHealth.summary.overall === 'bottleneck'
            ? 'bottleneck' as const
            : appHealth.summary.overall === 'attention' && performanceSummary.overall === 'healthy'
              ? 'attention' as const
              : performanceSummary.overall,
        };
        const report: PerformanceAuditReport = {
          schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
          sessionId,
          startedAt,
          finishedAt,
          durationMs: activeDurationMs(),
          wallClockMs: Date.now() - startedMs,
          app,
          watchdog: {
            hangTimeoutMs: watchdog.hangTimeoutMs,
            storedCheckCount: watchdog.storedCheckCount,
            lastStoredCheckAt,
          },
          environment,
          plan,
          coverage: {
            plannedChecks: total,
            storedChecks: checks.length,
            plannedJourneyChecks,
            executedJourneyChecks,
            justifiedSkippedJourneyChecks,
            unexpectedSkippedJourneyChecks,
            unavailableJourneyChecks,
            coveragePercent: plannedJourneyChecks
              ? roundMetric(
                  (executedJourneyChecks / plannedJourneyChecks) * 100,
                )
              : null,
            attemptedPercent: total
              ? roundMetric(
                  (plannedCheckIds.filter((id) => storedIdCounts.has(id)).length / total) * 100,
                )
              : null,
            missingPlannedCheckIds,
            duplicateStoredCheckIds,
            unexpectedStoredCheckIds,
            excludedUnsafeFacetCount: plan.excludedUnsafeActions.length,
            complete:
              checks.length === total &&
              checks.every((check) => check.status !== 'skipped') &&
              checks.every((check) => check.metrics.availabilityFailure !== true) &&
              journeyChecks.every((check) =>
                check.metrics.executionAttempted === true &&
                check.metrics.actionInvoked === true &&
                check.metrics.actionCompleted === true,
              ) &&
              missingPlannedCheckIds.length === 0 &&
              duplicateStoredCheckIds.length === 0 &&
              unexpectedStoredCheckIds.length === 0 &&
              maximumProfileResult.check != null &&
              maximumProfileResult.check.status !== 'fail',
          },
          summary,
          checks,
          routeAggregates: aggregateRepeatedJourneys(checks),
          appHealth,
          limitations: [
            `This report applies exactly to app version ${app.appVersion}, build ${app.buildVersion}.`,
            'JavaScript can record its scheduling stack and errors, but a native CPU/GPU sampling profiler is still required for native-thread instruction stacks.',
            'Animation callback gaps are JavaScript requestAnimationFrame timing, not proof of native GPU frame drops.',
            'The first and repeat whole-app scenarios run linearly after maximum-profile asset preparation; they are not process-level or empty-cache cold starts. Every step waits for its exact mounted surface, all required data/list/logo/graphic/layout probes, and a 650ms stable quiet window before advancing.',
            'Every steady-state route also runs a separate push, exact destination settle, router back, and exact audit-origin recovery measurement in both passes. Semantic action checks never publish a synthetic back timing.',
            `The default ${MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID} profile temporarily enables every safe local feature and all three sections, evaluates already-cached assets, and is covered by the same durable rollback journal as saved data and scenarios. Missing optional assets are reported unavailable without downloading them. Privacy consent, permissions, authentication, app lock and destructive/external actions are not changed.`,
            'Failed journey or benchmark steps are recorded with error evidence; the runner recovers route/state when needed and continues the remaining plan. Cancel requests, hang-watchdog expiry, and mid-run dataset revision changes remain unrecoverable stops.',
            'In-page actions invoke the same registered callbacks as product searches, filters, calculator/projection field updates, optional disclosures, saved comparisons, settings, nested product/lender destinations and chart controls. Android installer, permissions, account, destructive cache, external link and financial-input.edit actions remain explicitly excluded for safety.',
            'Calculator and projection scenarios apply restorable canned parameter sets through registered UI callbacks; encrypted scenario values are restored with the audit rollback journal.',
            'Virtualized product lists prove the complete pinned source/model count and each deterministic viewport they visit; they do not mount every off-screen cell simultaneously.',
            'Section benchmarks time named selector, filter, hierarchy, statistics and ranking phases. Their deliberately synchronous work is recorded but excluded from responsiveness scoring; they do not provide native CPU instruction sampling or React component commit attribution.',
            auditMode === 'local'
              ? 'Local mode blocks fetch and XMLHttpRequest before transport. It records the existing Android download snapshot without contacting a host or launching the installer.'
              : 'Live-source mode permits only the configured public manifest, dates index and manifest-authenticated release assets. It never uploads diagnostics or launches the installer.',
            `The run is pinned to dataset revision ${datasetRevisionLabel(datasetRevision)} and stops only after ${watchdog.hangTimeoutMs}ms without storing another completed check.`,
            auditMode === 'local'
              ? 'The audit performs no network or clipboard action. The complete report and tracebacks remain local unless you later choose a separate export.'
              : 'The explicit live-source run may read allowlisted public payload files. It performs no upload or clipboard action, and the complete report remains local unless you later choose a separate export.',
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
          `executed=${summary.executed}`,
          `justified_skipped=${summary.justifiedSkipped}`,
          `unexpected_skipped=${summary.unexpectedSkipped}`,
          `unavailable=${summary.unavailable}`,
          `coverage_percent=${summary.coveragePercent}`,
          `slowest=${summary.slowestCheckId ?? 'none'}`,
          `slowest_ms=${summary.slowestCheckMs}`,
        ].join(' ');
        let completeReportStored = false;
        try {
          await awaitAuditWorkWithTimeout(
            // Surface each persistence stage and yield the JS thread between
            // them. Serializing and writing a report this size is several
            // hundred milliseconds of synchronous work per step; running them
            // back to back left the progress bar frozen at 100% with no way to
            // tell which step was responsible.
            debugLog.storePerformanceAudit(summaryMarker, report, async (stage) => {
              updatePerformanceAuditProgress(completed, total, stage);
              await yieldToUi();
            }),
            watchdog,
            'Performance report persistence',
            FINALIZATION_STORE_TIMEOUT_MS,
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
        updatePerformanceAuditProgress(completed, total, 'Returning to the audit screen');
        try {
          await timeoutAfter(
            recoverAuditRoute(() => pathnameRef.current),
            ROUTE_TIMEOUT_MS,
            'Audit home route recovery',
          );
        } catch (recoveryCaught) {
          debugLog.warn(
            PERFORMANCE_AUDIT_LOG_TAG,
            `post-complete route recovery failed: ${formatAuditErrorForLog(recoveryCaught)}`,
          );
        }
        assertSessionActive(watchdog);
        // Persistence and route recovery above are both slow enough for the
        // user to leave, so re-check here rather than trusting the gate taken
        // before them.
        await waitWhilePaused(watchdog);
        // Publish as soon as the report is durable.
        // The remaining local log flush must not hide a complete result if it
        // fails.
        completePerformanceAudit(report);
        await yieldToUi();

        try {
          logAuditEvent(app, {
            kind: 'report',
            schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
            sessionId,
            summary,
            routeAggregates: report.routeAggregates,
            completeReportStored,
          });
          debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, summaryMarker);
          await awaitAuditWorkWithTimeout(
            debugLog.flushToFile(),
            watchdog,
            'Final audit log flush',
            FINALIZATION_FLUSH_TIMEOUT_MS,
          );
        } catch (postPublishCaught) {
          debugLog.warn(
            PERFORMANCE_AUDIT_LOG_TAG,
            `post-publish report logging failed: ${formatAuditErrorForLog(postPublishCaught)}`,
          );
        }

      } catch (caught) {
        let recoveryError: string | null = null;
        try {
          await recoverAuditRoute(() => pathnameRef.current);
        } catch (recoveryCaught) {
          recoveryError = formatAuditError(recoveryCaught);
        }
        // Finish the last rollback attempt before publishing any terminal UI
        // state. A retry from finally could otherwise overwrite edits made
        // after the audit overlay disappears.
        if (!rollbackRestored && rollbackSnapshot && rollbackAttempts < 3) {
          try {
            rollbackAttempts += 1;
            const rollbackRetry = await timeoutAfter(
              tryRestorePerformanceAuditRollback(useStore, rollbackSnapshot),
              5_000,
              'Pre-terminal audit rollback',
            );
            rollbackRestored = rollbackRetry.restored;
            if (rollbackRetry.error) {
              debugLog.error(
                PERFORMANCE_AUDIT_LOG_TAG,
                `audit rollback retained for launch recovery: ${flattenAuditLogText(rollbackRetry.error)}`,
              );
              await timeoutAfter(debugLog.flushToFile(), 5_000, 'Rollback error log flush').catch(() => {});
            }
          } catch (rollbackError) {
            debugLog.error(
              PERFORMANCE_AUDIT_LOG_TAG,
              `audit rollback retained for launch recovery: ${formatAuditErrorForLog(rollbackError)}`,
            );
            await timeoutAfter(debugLog.flushToFile(), 5_000, 'Rollback error log flush').catch(() => {});
          }
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
          const failedCheck: AuditCheck = boundAuditCheckEvidence({
            id: `fatal-${completed + 1}`,
            label: getPerformanceAuditState().progress.label || 'Performance audit fatal error',
            kind: 'runtime',
            status: 'fail',
            durationMs: null,
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
          });
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
            durationMs: activeDurationMs(),
            wallClockMs: Date.now() - startedMs,
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
              `This is a structured partial schema-v${PERFORMANCE_AUDIT_SCHEMA_VERSION} report for an unrecoverable stop (cancel, hang watchdog, dataset revision change, or setup/teardown failure). Per-step journey failures no longer abort the plan; those produce a complete report with aggregated fail/warn checks.`,
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
        transportGuard.restore();
        unsubscribePause();
        unsubscribeRunElapsed();
        if (readinessCapture) performanceAuditReadinessRegistry.endCapture(readinessCapture);
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
        releaseRun();
      }
    };

    void execute();
  }, [
    claimRun,
    dimensions.fontScale,
    dimensions.height,
    dimensions.width,
    releaseCount,
    releaseRun,
    state.hangTimeoutMs,
    state.sessionId,
    state.startedAt,
    state.auditMode,
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
    const tracking = state.status === 'queued' || state.status === 'running';
    if (!tracking) return;
    // Leaving the app suspends the run rather than discarding it. Route timing,
    // mounted-surface readiness and animation callback gaps do not exist once
    // Android stops committing frames, so the audit waits for the foreground
    // instead of recording a backgrounded process.
    const applyAppState = (nextState: string) => {
      if (nextState === 'active') {
        if (getPerformanceAuditState().paused) {
          debugLog.info(PERFORMANCE_AUDIT_LOG_TAG, 'audit resumed on returning to the foreground');
        }
        resumePerformanceAudit();
        return;
      }
      if (!getPerformanceAuditState().paused) {
        debugLog.info(
          PERFORMANCE_AUDIT_LOG_TAG,
          `audit paused because app state changed to ${nextState}`,
        );
      }
      pausePerformanceAudit();
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      applyAppState(nextState);
    });
    // The app may already have backgrounded between the audit state update
    // and this effect subscribing, in which case no future transition fires.
    if (AppState.currentState != null) applyAppState(AppState.currentState);
    return () => {
      subscription.remove();
      // Never leave a pause set with no listener to clear it. A dependency
      // change re-subscribes immediately and re-applies the current state.
      resumePerformanceAudit();
    };
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
            App health audit
          </AppText>
          <AppText variant="small" weight="700" color="primary">
            {percent}%
          </AppText>
        </Row>
        <AppText variant="small" color="textMuted" numberOfLines={2}>
          {state.paused ? 'Paused — the audit continues when you return' : state.progress.label}
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="App health audit progress"
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
