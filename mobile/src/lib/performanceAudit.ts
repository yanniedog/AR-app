import type { Href } from 'expo-router';

import { SECTIONS, SECTION_ORDER } from '../constants';
import type { Prefs } from '../data/storeTypes';
import type { CorePayload, RateRow, SectionKey } from '../types';
import { buildBrowseRouteParams } from './browseRoute';
import { effectiveBankInsights, effectiveDeepSearch, effectiveHistoryRibbon } from './proAccess';
import type { DeepPerformanceAuditPlan } from './performanceAuditPlan';

export { PERFORMANCE_AUDIT_SCHEMA_VERSION } from './performanceAuditSchema';

export const PERFORMANCE_AUDIT_LOG_TAG = 'perf-audit';
export const DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS = 300_000;
export const MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS = 30;
export const MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS = 3_600;
export const PERFORMANCE_AUDIT_HANG_TIMEOUT_STORAGE_KEY =
  '@ar/performance-audit/hang-timeout-seconds';

export type PerformanceAuditStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'complete'
  | 'cancelled'
  | 'failed';

export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export type AuditMetricValue = string | number | boolean | null;

export interface AuditCheck {
  id: string;
  label: string;
  kind: 'journey' | 'runtime' | 'storage' | 'network' | 'data' | 'update';
  status: AuditCheckStatus;
  /** Null means the check was interrupted before a trustworthy duration existed. */
  durationMs: number | null;
  metrics: Record<string, AuditMetricValue>;
  /** Full stacks are retained only for errors so the audit does not profile its own logging. */
  trace?: string;
  error?: string;
}

export interface AuditAppIdentity {
  appVersion: string;
  buildVersion: string;
}

export interface AuditEnvironment {
  appVersion: string;
  buildVersion: string;
  platform: string;
  platformVersion: string;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  osName: string | null;
  osVersion: string | null;
  totalMemoryBytes: number | null;
  jsEngine: string;
  developmentBuild: boolean;
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  payloadSource: string;
  payloadRunDate: string | null;
  payloadProducts: number;
  payloadProviders: number;
  detailsLoaded: boolean;
  historyLoaded: boolean;
  productHistoryLoaded: boolean;
  diagnosticsUploadEnabled: boolean;
  networkType: string | null;
  networkConnected: boolean | null;
  networkInternetReachable: boolean | null;
  auditCoverageProfile?: string;
  maximumSafeFeaturesEnabled?: boolean;
}

export interface PerformanceAuditSummary {
  overall: 'healthy' | 'attention' | 'bottleneck';
  pass: number;
  warn: number;
  fail: number;
  skipped: number;
  unavailable: number;
  executed: number;
  justifiedSkipped: number;
  unexpectedSkipped: number;
  /** Null when no checks ran; zero is reserved for a measured zero-percent result. */
  coveragePercent: number | null;
  slowestCheckId: string | null;
  slowestCheckLabel: string | null;
  slowestCheckMs: number | null;
  maxEventLoopLagMs: number | null;
  maxFrameGapMs: number | null;
}

export interface PerformanceAuditReport {
  schemaVersion: number;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  /** Time the audit spent measuring. Excludes any interval the app was off screen. */
  durationMs: number;
  /** Wall-clock time the user waited, including pauses. Absent before schema 4. */
  wallClockMs?: number;
  app: AuditAppIdentity;
  watchdog: PerformanceAuditWatchdogDiagnostics;
  environment: AuditEnvironment;
  plan?: DeepPerformanceAuditPlan;
  coverage?: PerformanceAuditCoverage;
  summary: PerformanceAuditSummary;
  checks: AuditCheck[];
  routeAggregates: AuditRouteAggregate[];
  limitations: string[];
}

export interface PerformanceAuditCoverage {
  plannedChecks: number;
  storedChecks: number;
  plannedJourneyChecks: number;
  executedJourneyChecks: number;
  justifiedSkippedJourneyChecks: number;
  unexpectedSkippedJourneyChecks: number;
  unavailableJourneyChecks: number;
  /** Checks that actually ran. Availability-only skips never count here. */
  coveragePercent: number | null;
  /** Planned checks whose result was durably stored, including failures. */
  attemptedPercent: number | null;
  missingPlannedCheckIds: string[];
  duplicateStoredCheckIds: string[];
  unexpectedStoredCheckIds: string[];
  excludedUnsafeFacetCount: number;
  complete: boolean;
}

export interface AuditRouteAggregate {
  journeyId: string;
  label: string;
  coldStatus: AuditCheckStatus;
  warmStatus: AuditCheckStatus;
  coldForwardMs: number;
  warmForwardMs: number;
  coldBackMs: number;
  warmBackMs: number;
  forwardChangeMs: number;
  backChangeMs: number;
}

export interface PerformanceAuditWatchdogDiagnostics {
  hangTimeoutMs: number;
  storedCheckCount: number;
  lastStoredCheckAt: string | null;
}

export interface PerformanceAuditProgress {
  completed: number;
  total: number;
  label: string;
}

export interface PerformanceAuditState {
  status: PerformanceAuditStatus;
  sessionId: string | null;
  startedAt: string | null;
  hangTimeoutMs: number;
  storedCheckCount: number;
  lastStoredCheckAt: string | null;
  progress: PerformanceAuditProgress;
  cancelRequested: boolean;
  /** The run is suspended because the app left the foreground. */
  paused: boolean;
  report: PerformanceAuditReport | null;
  error: string | null;
}

export interface AuditJourney {
  id: string;
  label: string;
  href?: Href;
  expectedPath: string;
  expectedSurface: string;
  expectedSection?: SectionKey;
  navigationKind: 'tab' | 'stack';
  skipReason?: string;
}

export interface AuditJourneyOptionalData {
  deepSearch: boolean;
  bankInsights: boolean;
  bankHistory: boolean;
  productHistory: boolean;
}

export interface PerformanceAuditPreferenceRestoration {
  setPrefs: (prefs: Partial<Prefs>) => void;
  ensureSearchIndex: () => Promise<unknown>;
  ensureHistoryBanks: () => Promise<unknown>;
  ensureBankInsights: () => Promise<unknown>;
}

/** Restore preferences atomically, then await all enabled assets concurrently. */
export async function restorePerformanceAuditPreferences(
  snapshot: Prefs,
  restoration: PerformanceAuditPreferenceRestoration,
): Promise<void> {
  restoration.setPrefs(snapshot);
  await Promise.all([
    snapshot.enableDeepSearch ? restoration.ensureSearchIndex() : Promise.resolve(),
    snapshot.showHistoryRibbon ? restoration.ensureHistoryBanks() : Promise.resolve(),
    snapshot.showHistoryRibbon ? restoration.ensureBankInsights() : Promise.resolve(),
  ]);
}

/** Keep audit waiting rules aligned with the same free-beta access helpers used by screens. */
export function resolveAuditJourneyOptionalData(
  journeyId: string,
  prefs: Pick<
    Prefs,
    | 'enableDeepSearch'
    | 'showHistoryRibbon'
    | 'rateIntelligencePro'
    | 'includeNonStandard'
  >,
  hasSearchIndex: boolean,
): AuditJourneyOptionalData {
  const historyEnabled = effectiveHistoryRibbon(prefs);
  return {
    deepSearch: journeyId === 'search' && hasSearchIndex && effectiveDeepSearch(prefs),
    bankInsights:
      effectiveBankInsights() &&
      ['response', 'outlook', 'rba-redirect', 'product', 'lender'].includes(journeyId),
    // Product and lender screens intentionally suppress their deferred history
    // fan-out while an audit is active. Waiting for that suppressed work caused
    // deterministic 30-second false failures on a cold product-history cache.
    bankHistory:
      historyEnabled &&
      prefs.includeNonStandard &&
      ['outlook', 'rba-redirect'].includes(journeyId),
    productHistory: false,
  };
}

type Listener = () => void;

const listeners = new Set<Listener>();

const IDLE_STATE: PerformanceAuditState = {
  status: 'idle',
  sessionId: null,
  startedAt: null,
  hangTimeoutMs: DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
  storedCheckCount: 0,
  lastStoredCheckAt: null,
  progress: { completed: 0, total: 0, label: 'Ready' },
  cancelRequested: false,
  paused: false,
  report: null,
  error: null,
};

let auditState: PerformanceAuditState = IDLE_STATE;
let pauseCount = 0;

function emit(next: PerformanceAuditState): void {
  auditState = next;
  for (const listener of listeners) listener();
}

function makeSessionId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `pa-${Date.now().toString(36)}-${random}`;
}

export function subscribePerformanceAudit(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPerformanceAuditState(): PerformanceAuditState {
  return auditState;
}

/**
 * Optional data maintenance must not start from a route that the audit opens.
 *
 * The audit measures route work. Starting a multi-day history rebuild from one
 * journey lets that rebuild escape into every later journey and makes the
 * report describe audit interference rather than the destination being tested.
 * Existing cached history remains available to the route while the audit runs;
 * normal maintenance resumes the next time the user opens the destination.
 */
export function isPerformanceAuditActive(): boolean {
  return auditState.status === 'queued' || auditState.status === 'running';
}

export interface RequestPerformanceAuditOptions {
  hangTimeoutMs?: number;
}

export function parsePerformanceAuditHangTimeoutSeconds(
  value: string | null | undefined,
): number | null {
  const trimmed = value?.trim() ?? '';
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number(trimmed);
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS ||
    seconds > MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS
  ) {
    return null;
  }
  return seconds;
}

export function resolvePerformanceAuditHangTimeoutMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS;
  }
  const rounded = Math.round(value);
  const minimum = MIN_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS * 1_000;
  const maximum = MAX_PERFORMANCE_AUDIT_HANG_TIMEOUT_SECONDS * 1_000;
  return Math.max(minimum, Math.min(maximum, rounded));
}

type MonotonicClock = () => number;

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Accumulates only the time the audit spent in the foreground, for budgets that
 * must not be spent by an app the user simply stepped away from.
 *
 * Each interval is classified by the state that held *during* it rather than the
 * state at its end. Android suspends the JS thread in the background, so a
 * poller can miss every tick of a pause and then run for the first time once
 * `paused` is already false — charging the whole off-screen span. Calling
 * `accrue` on the pause and resume transitions themselves closes the span at the
 * transition, so no interval can straddle one.
 */
export class ForegroundElapsed {
  private elapsedMs = 0;
  private lastAccrualAt: number;
  private paused: boolean;

  // Wall-clock time can jump forward or back under automatic time correction,
  // which would either blow a budget instantly or postpone it indefinitely.
  constructor(private readonly clock: MonotonicClock = monotonicNow) {
    this.lastAccrualAt = clock();
    this.paused = getPerformanceAuditState().paused;
  }

  accrue(): void {
    const at = this.clock();
    if (!this.paused) this.elapsedMs += at - this.lastAccrualAt;
    this.lastAccrualAt = at;
    this.paused = getPerformanceAuditState().paused;
  }

  get foregroundMs(): number {
    return this.elapsedMs;
  }
}

export class PerformanceAuditInactivityWatchdog {
  readonly hangTimeoutMs: number;
  private lastStoredProgressMs: number;
  private storedChecks = 0;
  /** Report persistence no longer stores checks; hang prevention must not abort teardown. */
  private finalizing = false;
  /** Time spent backgrounded is the user's, not a hang. */
  private paused = false;

  constructor(
    hangTimeoutMs = DEFAULT_PERFORMANCE_AUDIT_HANG_TIMEOUT_MS,
    private readonly clock: MonotonicClock = monotonicNow,
  ) {
    this.hangTimeoutMs = resolvePerformanceAuditHangTimeoutMs(hangTimeoutMs);
    this.lastStoredProgressMs = this.clock();
  }

  get storedCheckCount(): number {
    return this.storedChecks;
  }

  get deadlineMs(): number {
    return this.lastStoredProgressMs + this.hangTimeoutMs;
  }

  remainingMs(): number {
    return Math.max(0, this.deadlineMs - this.clock());
  }

  isExpired(): boolean {
    if (this.finalizing || this.paused) return false;
    return this.remainingMs() <= 0;
  }

  /**
   * A backgrounded audit is waiting on the user, not hung. Suspend expiry while
   * paused and restart the window on resume, so time spent in another app is
   * never counted against the hang timeout.
   */
  setPaused(paused: boolean): void {
    if (this.paused && !paused) this.touchProgress();
    this.paused = paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Suspend stored-check inactivity once planned checks finish; teardown may exceed one hang window. */
  beginFinalization(): void {
    this.finalizing = true;
    this.touchProgress();
  }

  get isFinalizing(): boolean {
    return this.finalizing;
  }

  /** Reset the hang timer without counting a durable check (readiness progress). */
  touchProgress(): void {
    this.lastStoredProgressMs = this.clock();
  }

  recordStoredCheck(): void {
    this.lastStoredProgressMs = this.clock();
    this.storedChecks += 1;
  }
}

export function requestPerformanceAudit(options: RequestPerformanceAuditOptions = {}): string {
  if (auditState.status === 'queued' || auditState.status === 'running') {
    return auditState.sessionId ?? 'active';
  }
  const sessionId = makeSessionId();
  const hangTimeoutMs = resolvePerformanceAuditHangTimeoutMs(options.hangTimeoutMs);
  emit({
    status: 'queued',
    sessionId,
    startedAt: new Date().toISOString(),
    hangTimeoutMs,
    storedCheckCount: 0,
    lastStoredCheckAt: null,
    progress: { completed: 0, total: 0, label: 'Preparing audit' },
    cancelRequested: false,
    paused: false,
    report: null,
    error: null,
  });
  return sessionId;
}

export function markPerformanceAuditRunning(total: number): void {
  emit({
    ...auditState,
    status: 'running',
    progress: { completed: 0, total, label: 'Capturing device and app state' },
  });
}

export function updatePerformanceAuditProgress(
  completed: number,
  total: number,
  label: string,
): void {
  emit({
    ...auditState,
    status: 'running',
    progress: { completed, total, label },
  });
}

export function markPerformanceAuditCheckStored(
  completed: number,
  total: number,
  label: string,
  storedAt: string,
): void {
  emit({
    ...auditState,
    status: 'running',
    storedCheckCount: completed,
    lastStoredCheckAt: storedAt,
    progress: { completed, total, label },
  });
}

/**
 * Suspend a run that left the foreground instead of discarding it.
 *
 * Most of the audit measures the UI — route timing, mounted-surface readiness,
 * animation callback gaps — and none of that exists once Android stops
 * committing frames. Continuing would record numbers that describe a
 * backgrounded process rather than the app. Pausing keeps the completed work
 * and lets the run continue when the user comes back.
 */
function pauseTrackingApplies(): boolean {
  return auditState.status === 'queued' || auditState.status === 'running';
}

export function pausePerformanceAudit(): void {
  if (!pauseTrackingApplies()) return;
  if (auditState.paused || auditState.cancelRequested) return;
  pauseCount += 1;
  emit({ ...auditState, paused: true });
}

/** Increments on every pause so a step can tell whether it spanned one. */
export function getPerformanceAuditPauseCount(): number {
  return pauseCount;
}

export function resumePerformanceAudit(): void {
  if (!auditState.paused) return;
  emit({ ...auditState, paused: false });
}

export function cancelPerformanceAudit(): void {
  if (auditState.status !== 'queued' && auditState.status !== 'running') return;
  emit({
    ...auditState,
    cancelRequested: true,
    progress: { ...auditState.progress, label: 'Cancelling safely' },
  });
}

/** Publish the finished report locally. Sharing is a separate user action. */
export function completePerformanceAudit(report: PerformanceAuditReport): void {
  emit({
    ...auditState,
    status: 'complete',
    progress: {
      completed: auditState.progress.total,
      total: auditState.progress.total,
      label: 'Audit complete',
    },
    cancelRequested: false,
    paused: false,
    report,
    error: null,
  });
}

export function markPerformanceAuditCancelled(): void {
  emit({
    ...auditState,
    status: 'cancelled',
    cancelRequested: false,
    // A terminal run is not paused. resumePerformanceAudit refuses terminal
    // states, so a pause left set here could never be cleared, and every
    // foreground budget created afterwards would accrue nothing.
    paused: false,
    progress: { ...auditState.progress, label: 'Audit cancelled' },
  });
}

export function failPerformanceAudit(error: string): void {
  emit({
    ...auditState,
    status: 'failed',
    cancelRequested: false,
    paused: false,
    progress: { ...auditState.progress, label: 'Audit failed' },
    error,
  });
}

/** Page size used by the results screen. The selector returns every check in
 * diagnostic order; the screen progressively mounts pages so no finding is
 * hidden and report teardown is not forced to render hundreds of cards at once. */
export const MAX_REPORTED_AUDIT_CHECKS = 80;

export function selectReportedAuditChecks(checks: AuditCheck[]): AuditCheck[] {
  const notable = checks.filter((check) => check.status !== 'pass');
  const passes = checks
    .filter((check) => check.status === 'pass')
    .sort((a, b) => (b.durationMs ?? -1) - (a.durationMs ?? -1));
  return [...notable, ...passes];
}

export function resetPerformanceAuditForTests(): void {
  auditState = IDLE_STATE;
  listeners.clear();
}

export function captureAuditTrace(label: string): string {
  const error = new Error(`Performance audit trace: ${label}`);
  return error.stack ?? `${error.name}: ${error.message}`;
}

export function formatAuditError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  try {
    return typeof error === 'string'
      ? error
      : JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Keep multi-line audit errors/stacks on one physical debug-log line so file
 * parsers and exports retain every frame instead of orphaning traceback text.
 */
export function flattenAuditLogText(text: string): string {
  return text.replace(/\r/g, '').replace(/\n/g, String.raw`\n`);
}

/** Same detail as formatAuditError, encoded for a single logfile line. */
export function formatAuditErrorForLog(error: unknown): string {
  return flattenAuditLogText(formatAuditError(error));
}

function firstComparableRows(core: CorePayload | null): RateRow[] {
  if (!core) return [];
  for (const section of SECTION_ORDER) {
    const seen = new Set<string>();
    const rows: RateRow[] = [];
    for (const row of core.sections[section]?.rates ?? []) {
      if (seen.has(row.product_key)) continue;
      seen.add(row.product_key);
      rows.push(row);
      if (rows.length >= 2) return rows;
    }
  }
  return [];
}

function browseJourney(section: SectionKey, interests: SectionKey[]): AuditJourney {
  const enabled = interests.includes(section);
  return {
    id: `browse-${section.toLowerCase()}`,
    label: `Browse: ${SECTIONS[section].title}`,
    href: enabled
      ? ({
          pathname: '/browse',
          params: buildBrowseRouteParams(section),
        } as unknown as Href)
      : undefined,
    expectedPath: '/browse',
    expectedSurface: 'browse.hierarchy',
    expectedSection: section,
    navigationKind: 'tab',
    skipReason: enabled ? undefined : `${SECTIONS[section].title} is disabled in interests`,
  };
}

/**
 * Every steady-state user-facing destination is exercised from the audit
 * screen and then backed out of. Redirect aliases and first-run onboarding are
 * excluded because they do not represent separate steady-state UI.
 */
export function buildPerformanceAuditJourneys(
  core: CorePayload | null,
  interests: SectionKey[] = SECTION_ORDER,
): AuditJourney[] {
  const rows = firstComparableRows(core);
  const first = rows[0];
  const second = rows[1];
  const provider = first?.provider ?? Object.keys(core?.brands ?? {})[0];

  return [
    {
      id: 'home',
      label: 'Home',
      href: '/(tabs)' as Href,
      expectedPath: '/',
      expectedSurface: 'today.hero',
      navigationKind: 'tab',
    },
    ...SECTION_ORDER.map((section) => browseJourney(section, interests)),
    {
      id: 'response',
      label: 'Bank response',
      href: '/rba-response' as Href,
      expectedPath: '/rba-response',
      expectedSurface: 'moves.response-chart',
      navigationKind: 'stack',
    },
    {
      id: 'outlook',
      label: 'Outlook',
      href: '/trends' as Href,
      expectedPath: '/trends',
      expectedSurface: 'outlook.dashboard',
      navigationKind: 'tab',
    },
    {
      id: 'rba-redirect',
      label: 'Why rates move',
      href: '/rba' as Href,
      expectedPath: '/trends',
      expectedSurface: 'outlook.rba-response',
      navigationKind: 'tab',
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      href: '/watchlist' as Href,
      expectedPath: '/watchlist',
      expectedSurface: 'saved.list',
      navigationKind: 'tab',
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings' as Href,
      expectedPath: '/settings',
      expectedSurface: 'settings.sections',
      navigationKind: 'tab',
    },
    {
      id: 'search',
      label: 'Product search',
      href: {
        pathname: '/search',
        params: { section: 'Mortgage' },
      } as unknown as Href,
      expectedPath: '/search',
      expectedSurface: 'search.results',
      navigationKind: 'stack',
    },
    {
      id: 'calculator',
      label: 'Switch and save calculator',
      href: '/calculator' as Href,
      expectedPath: '/calculator',
      expectedSurface: 'calculator.results',
      navigationKind: 'stack',
    },
    {
      id: 'projections',
      label: 'Lifecycle projections',
      href: {
        pathname: '/projections',
        params: { section: 'Mortgage' },
      } as unknown as Href,
      expectedPath: '/projections',
      expectedSurface: 'projections.lifecycle-chart',
      navigationKind: 'stack',
    },
    {
      id: 'lenders',
      label: 'Lenders',
      href: '/banks' as Href,
      expectedPath: '/banks',
      expectedSurface: 'lenders.list',
      navigationKind: 'stack',
    },
    {
      id: 'profile',
      label: 'Product profile',
      href: '/profile' as Href,
      expectedPath: '/profile',
      expectedSurface: 'profile.filters',
      navigationKind: 'stack',
    },
    {
      id: 'product',
      label: 'Product details',
      href: first
        ? ({
            pathname: '/product/[key]',
            params: {
              key: first.product_key,
              ...(first.rate_index != null ? { ri: String(first.rate_index) } : {}),
            },
          } as unknown as Href)
        : undefined,
      expectedPath: first ? `/product/${encodeURIComponent(first.product_key)}` : '/product',
      expectedSurface: 'product.details',
      navigationKind: 'stack',
      skipReason: first ? undefined : 'No product is loaded',
    },
    {
      id: 'rate-receipt',
      label: 'Rate receipt',
      href: first
        ? ({
            pathname: '/rate-receipt',
            params: {
              key: first.product_key,
              ...(first.rate_index != null ? { ri: String(first.rate_index) } : {}),
            },
          } as unknown as Href)
        : undefined,
      expectedPath: '/rate-receipt',
      expectedSurface: 'receipt.evidence',
      navigationKind: 'stack',
      skipReason: first ? undefined : 'No product is loaded',
    },
    {
      id: 'lender',
      label: 'Lender details',
      href: provider
        ? ({
            pathname: '/bank/[provider]',
            params: { provider },
          } as unknown as Href)
        : undefined,
      expectedPath: provider ? `/bank/${encodeURIComponent(provider)}` : '/bank',
      expectedSurface: 'lender.details',
      navigationKind: 'stack',
      skipReason: provider ? undefined : 'No lender is loaded',
    },
    {
      id: 'compare',
      label: 'Product comparison',
      href:
        first && second
          ? ({
              pathname: '/compare',
              params: { keys: JSON.stringify([first.product_key, second.product_key]) },
            } as unknown as Href)
          : undefined,
      expectedPath: '/compare',
      expectedSurface: 'compare.table',
      navigationKind: 'stack',
      skipReason: first && second ? undefined : 'Fewer than two products are loaded',
    },
    {
      id: 'terms',
      label: 'Terms and notices',
      href: '/terms' as Href,
      expectedPath: '/terms',
      expectedSurface: 'terms.notices',
      navigationKind: 'stack',
    },
    {
      id: 'debug-log',
      label: 'Debug log',
      href: '/debug-log' as Href,
      expectedPath: '/debug-log',
      expectedSurface: 'debug-log.entries',
      navigationKind: 'stack',
    },
  ];
}

export function pathMatches(actual: string, expected: string): boolean {
  const normalize = (value: string) => {
    const path = value.split('?')[0]?.replace(/\/+$/, '') || '/';
    return path === '/(tabs)' || path === '/(tabs)/index' ? '/' : path;
  };
  const a = normalize(actual);
  const e = normalize(expected);
  if (a === e) return true;
  // Expo Router exposes decoded dynamic route params from usePathname.
  try {
    return decodeURIComponent(a) === decodeURIComponent(e);
  } catch {
    return false;
  }
}

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index] ?? 0;
}

export interface ResponsivenessSnapshot {
  lagIndex: number;
  frameIndex: number;
  capturedAt: number;
}

interface TimedSample {
  value: number;
  startsAt: number;
  endsAt: number;
}

export interface ResponsivenessMetrics {
  eventLoopSamples: number;
  eventLoopP95Ms: number | null;
  maxEventLoopLagMs: number | null;
  stallsOver100Ms: number | null;
  frameSamples: number;
  frameP95Ms: number | null;
  maxFrameGapMs: number | null;
  framesOver50Ms: number | null;
}

export class ResponsivenessMonitor {
  private readonly timerIntervalMs = 25;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame: number | null = null;
  private lastTimerAt = 0;
  private lastFrameAt = 0;
  private running = false;
  private readonly lagSamples: TimedSample[] = [];
  private readonly frameSamples: TimedSample[] = [];

  private now(): number {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimerAt = this.now();
    this.lastFrameAt = 0;
    this.scheduleTimer();
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.frame != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frame);
    }
    this.frame = null;
  }

  snapshot(): ResponsivenessSnapshot {
    return {
      lagIndex: this.lagSamples.length,
      frameIndex: this.frameSamples.length,
      capturedAt: this.now(),
    };
  }

  metricsSince(snapshot: ResponsivenessSnapshot): ResponsivenessMetrics {
    const samplesSince = (samples: TimedSample[], index: number): number[] =>
      samples
        .slice(index)
        .filter((sample) => sample.endsAt > snapshot.capturedAt)
        .map((sample) =>
          sample.startsAt < snapshot.capturedAt
            ? sample.endsAt - snapshot.capturedAt
            : sample.value,
        );
    return summarizeResponsiveness(
      samplesSince(this.lagSamples, snapshot.lagIndex),
      samplesSince(this.frameSamples, snapshot.frameIndex),
    );
  }

  metrics(): ResponsivenessMetrics {
    return summarizeResponsiveness(
      this.lagSamples.map((sample) => sample.value),
      this.frameSamples.map((sample) => sample.value),
    );
  }

  private scheduleTimer(): void {
    this.timer = setTimeout(() => {
      if (!this.running) return;
      const now = this.now();
      const deadlineAt = this.lastTimerAt + this.timerIntervalMs;
      this.lagSamples.push({
        value: Math.max(0, now - deadlineAt),
        startsAt: deadlineAt,
        endsAt: now,
      });
      this.lastTimerAt = now;
      this.scheduleTimer();
    }, this.timerIntervalMs);
  }

  private scheduleFrame(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    this.frame = requestAnimationFrame(() => {
      if (!this.running) return;
      // RAF timestamps use the performance time origin even where this.now()
      // must fall back to Date.now(). Sample with one clock throughout so
      // snapshots and partial frame windows remain comparable on every host.
      const timestamp = this.now();
      if (this.lastFrameAt > 0) {
        this.frameSamples.push({
          value: Math.max(0, timestamp - this.lastFrameAt),
          startsAt: this.lastFrameAt,
          endsAt: timestamp,
        });
      }
      this.lastFrameAt = timestamp;
      this.scheduleFrame();
    });
  }
}

export interface MeasuredAuditAction<T, TSnapshot> {
  result: T;
  startedAt: number;
  durationMs: number;
  responsivenessAt: TSnapshot;
}

/**
 * Measure only the user-equivalent action. Callers deliberately finish route
 * recovery and readiness guards before invoking this helper so audit-only
 * preflight work cannot be reported as tap latency or responsiveness.
 */
export async function measureAuditAction<T, TSnapshot>(
  action: () => T | Promise<T>,
  snapshotResponsiveness: () => TSnapshot,
  clock: () => number = () => globalThis.performance?.now?.() ?? Date.now(),
): Promise<MeasuredAuditAction<T, TSnapshot>> {
  const responsivenessAt = snapshotResponsiveness();
  const startedAt = clock();
  const result = await action();
  return {
    result,
    startedAt,
    durationMs: clock() - startedAt,
    responsivenessAt,
  };
}

export function summarizeResponsiveness(
  lagSamples: number[],
  frameSamples: number[],
): ResponsivenessMetrics {
  const maximum = (values: number[]) => {
    let result = 0;
    for (const value of values) {
      if (value > result) result = value;
    }
    return result;
  };
  return {
    eventLoopSamples: lagSamples.length,
    eventLoopP95Ms: lagSamples.length ? roundMetric(percentile(lagSamples, 0.95)) : null,
    maxEventLoopLagMs: lagSamples.length ? roundMetric(maximum(lagSamples)) : null,
    stallsOver100Ms: lagSamples.length ? lagSamples.filter((value) => value > 100).length : null,
    frameSamples: frameSamples.length,
    frameP95Ms: frameSamples.length ? roundMetric(percentile(frameSamples, 0.95)) : null,
    maxFrameGapMs: frameSamples.length ? roundMetric(maximum(frameSamples)) : null,
    framesOver50Ms: frameSamples.length ? frameSamples.filter((value) => value > 50).length : null,
  };
}

export function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scoreLatency(
  valueMs: number,
  warnAboveMs: number,
  failAboveMs: number,
): AuditCheckStatus {
  if (valueMs > failAboveMs) return 'fail';
  if (valueMs > warnAboveMs) return 'warn';
  return 'pass';
}

export function worstStatus(...statuses: AuditCheckStatus[]): AuditCheckStatus {
  const rank: Record<AuditCheckStatus, number> = {
    skipped: -1,
    pass: 0,
    warn: 1,
    fail: 2,
  };
  return statuses.reduce<AuditCheckStatus>(
    (worst, status) => (rank[status] > rank[worst] ? status : worst),
    'skipped',
  );
}

/**
 * A check interrupted by Android backgrounding may keep a failure only when
 * the check explicitly recorded evidence that does not depend on elapsed time
 * or a timeout. Generic errors are not sufficient: inner wall-clock guards can
 * expire while the JavaScript thread is suspended.
 */
export function hasExplicitNonTimingFailure(check: AuditCheck): boolean {
  return check.status === 'fail' && check.metrics.nonTimingFailure === true;
}

/**
 * A slow, successfully completed interaction is still valid route state. Only
 * journey failures that explicitly invalidate that state may unmount the
 * screen and suppress dependent actions.
 */
export function requiresPerformanceAuditRouteRecovery(check: AuditCheck): boolean {
  if (check.kind !== 'journey') return false;
  if (check.metrics.interruptedByBackground === true) return true;
  if (check.status !== 'fail') return false;
  // A mounted optional control can prove that it is absent without corrupting
  // the route. Keep the screen mounted so independent controls in that
  // scenario can still be exercised.
  if (check.metrics.routeStateInvalidated === false) return false;
  return check.metrics.routeStateInvalidated === true ||
    check.metrics.nonTimingFailure === true ||
    Boolean(check.error);
}

/**
 * Every metric `summarizePerformanceAudit` can read as a check's representative
 * latency, plus the two report-wide maxima.
 *
 * A check whose measurement spanned a background pause times a process Android
 * had stopped drawing. Where such a check still has to be reported — a failure
 * observed before the interruption is real and must not be downgraded — these
 * keys are stripped so the unusable timing cannot become the report's slowest
 * check or its worst lag.
 */
export const AUDIT_LATENCY_METRIC_KEYS = [
  'forwardMs',
  'backMs',
  'maxEventLoopLagMs',
  'maxFrameGapMs',
  'stringifyMs',
  'parseMs',
  'traversalMs',
  'maxWriteMs',
  'maxReadMs',
  'writeMs',
  'readMs',
] as const;

export function summarizePerformanceAudit(checks: AuditCheck[]): PerformanceAuditSummary {
  const pass = checks.filter((check) => check.status === 'pass').length;
  const warn = checks.filter((check) => check.status === 'warn').length;
  const fail = checks.filter((check) => check.status === 'fail').length;
  const skipped = checks.filter((check) => check.status === 'skipped').length;
  const unavailable = checks.filter(
    (check) => check.metrics.availabilityFailure === true ||
      check.metrics.executionAttempted === false,
  ).length;
  const justifiedSkipped = checks.filter(
    (check) => check.status === 'skipped' &&
      (check.metrics.skipClassification === 'terminal-availability' ||
        check.metrics.availabilityEvidence != null),
  ).length;
  const unexpectedSkipped = skipped - justifiedSkipped;
  const executed = checks.filter((check) => {
    if (check.status === 'skipped' || check.metrics.availabilityFailure === true) return false;
    // Benchmarks do not invoke UI actions. Journey coverage is stricter: only
    // explicit attempted + invoked + completed proof counts.
    if (check.kind !== 'journey') return check.metrics.executionAttempted !== false;
    return check.metrics.executionAttempted === true &&
      check.metrics.actionInvoked === true &&
      check.metrics.actionCompleted === true;
  }).length;
  // Coverage means execution. A declared reason can make an unavailable facet
  // understandable, but it cannot turn work that did not run into coverage.
  const coveragePercent = checks.length
    ? roundMetric((executed / checks.length) * 100)
    : null;
  const completed = checks.filter((check) =>
    check.status !== 'skipped' &&
    check.metrics.executionAttempted !== false &&
    check.metrics.availabilityFailure !== true);
  // Keep AUDIT_LATENCY_METRIC_KEYS in step with every key read below.
  const representativeLatency = (check: AuditCheck): number | null => {
    const zeroIsProven = check.metrics.executionAttempted === true ||
      check.metrics.measurementAvailable === true;
    const numeric = (...keys: string[]) =>
      keys
        .map((key) => check.metrics[key])
        .filter((value): value is number => (
          typeof value === 'number' && Number.isFinite(value) && (value !== 0 || zeroIsProven)
        ));
    const maximum = (values: number[]) => values.length ? Math.max(...values) : null;
    if (check.kind === 'journey') {
      return maximum(numeric('forwardMs', 'backMs'));
    }
    if (check.id === 'runtime-responsiveness') {
      return maximum(numeric('maxEventLoopLagMs', 'maxFrameGapMs'));
    }
    if (check.id === 'active-data') {
      return maximum(numeric('stringifyMs', 'parseMs', 'traversalMs', 'maxEventLoopLagMs'));
    }
    if (check.id === 'async-storage') {
      return maximum(numeric('maxWriteMs', 'maxReadMs'));
    }
    if (check.id === 'file-system') {
      return maximum(numeric('writeMs', 'readMs'));
    }
    if (check.durationMs == null) return null;
    if (check.durationMs !== 0) return check.durationMs;
    return zeroIsProven ? 0 : null;
  };
  const slowest = completed.reduce<{ check: AuditCheck; latencyMs: number } | null>(
    (current, check) => {
      const latencyMs = representativeLatency(check);
      if (latencyMs == null) return current;
      return !current || latencyMs > current.latencyMs ? { check, latencyMs } : current;
    },
    null,
  );
  const measuredResponsiveness = (
    metricKey: 'maxEventLoopLagMs' | 'maxFrameGapMs',
    sampleKey: 'eventLoopSamples' | 'frameSamples',
  ): number | null => {
    const values = checks.flatMap((check) => {
      const value = check.metrics[metricKey];
      if (typeof value !== 'number' || !Number.isFinite(value)) return [];
      if (value === 0) {
        const samples = check.metrics[sampleKey];
        if (typeof samples !== 'number' || samples <= 0) return [];
      }
      return [value];
    });
    return values.length ? Math.max(...values) : null;
  };
  const maxEventLoopLagMs = measuredResponsiveness('maxEventLoopLagMs', 'eventLoopSamples');
  const maxFrameGapMs = measuredResponsiveness('maxFrameGapMs', 'frameSamples');

  return {
    overall: checks.length === 0
      ? 'attention'
      : fail > 0 || unexpectedSkipped > 0
      ? 'bottleneck'
      : warn > 0 || justifiedSkipped > 0
        ? 'attention'
        : 'healthy',
    pass,
    warn,
    fail,
    skipped,
    unavailable,
    executed,
    justifiedSkipped,
    unexpectedSkipped,
    coveragePercent,
    slowestCheckId: slowest?.check.id ?? null,
    slowestCheckLabel: slowest?.check.label ?? null,
    slowestCheckMs: slowest ? roundMetric(slowest.latencyMs) : null,
    maxEventLoopLagMs: maxEventLoopLagMs == null ? null : roundMetric(maxEventLoopLagMs),
    maxFrameGapMs: maxFrameGapMs == null ? null : roundMetric(maxFrameGapMs),
  };
}

/** Pair cold/warm route checks into a compact comparison for the result UI and export. */
export function aggregateRepeatedJourneys(checks: AuditCheck[]): AuditRouteAggregate[] {
  const byJourney = new Map<string, Partial<Record<'cold' | 'warm', AuditCheck>>>();
  for (const check of checks) {
    if (check.kind !== 'journey') continue;
    const iteration = check.metrics.iteration;
    const journeyId = check.metrics.journeyId;
    if ((iteration !== 'cold' && iteration !== 'warm') || typeof journeyId !== 'string') continue;
    const pair = byJourney.get(journeyId) ?? {};
    pair[iteration] = check;
    byJourney.set(journeyId, pair);
  }
  const measuredNumber = (check: AuditCheck, key: string): number | null => {
    const value = check.metrics[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const aggregates: AuditRouteAggregate[] = [];
  for (const [journeyId, pair] of byJourney) {
    if (!pair.cold || !pair.warm) continue;
    if (pair.cold.status === 'skipped' || pair.warm.status === 'skipped') continue;
    // An interrupted check keeps its status but loses its timings, so aggregating
    // it would publish a comparison against a zero it never measured.
    if (
      pair.cold.metrics.interruptedByBackground === true ||
      pair.warm.metrics.interruptedByBackground === true
    ) continue;
    const coldForwardMs = measuredNumber(pair.cold, 'forwardMs');
    const warmForwardMs = measuredNumber(pair.warm, 'forwardMs');
    const coldBackMs = measuredNumber(pair.cold, 'backMs');
    const warmBackMs = measuredNumber(pair.warm, 'backMs');
    // Route aggregates are specifically forward/back round trips. Semantic
    // actions have a different timing contract and must never be coerced into
    // fabricated zero-duration back navigation.
    if (
      coldForwardMs == null || warmForwardMs == null ||
      coldBackMs == null || warmBackMs == null
    ) continue;
    aggregates.push({
      journeyId,
      label: String(pair.cold.metrics.journeyLabel ?? journeyId),
      coldStatus: pair.cold.status,
      warmStatus: pair.warm.status,
      coldForwardMs,
      warmForwardMs,
      coldBackMs,
      warmBackMs,
      forwardChangeMs: roundMetric(warmForwardMs - coldForwardMs),
      backChangeMs: roundMetric(warmBackMs - coldBackMs),
    });
  }
  return aggregates;
}
