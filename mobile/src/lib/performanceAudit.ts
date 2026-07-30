import type { Href } from 'expo-router';

import { SECTIONS, SECTION_ORDER } from '../constants';
import type { CorePayload, RateRow, SectionKey } from '../types';

export const PERFORMANCE_AUDIT_SCHEMA_VERSION = 1;
export const PERFORMANCE_AUDIT_LOG_TAG = 'perf-audit';

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
  kind: 'journey' | 'runtime' | 'storage' | 'network' | 'data';
  status: AuditCheckStatus;
  durationMs: number;
  metrics: Record<string, AuditMetricValue>;
  trace: string;
  error?: string;
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
  diagnosticsUploadEnabled: boolean;
  networkType: string | null;
  networkConnected: boolean | null;
  networkInternetReachable: boolean | null;
}

export interface PerformanceAuditSummary {
  overall: 'healthy' | 'attention' | 'bottleneck';
  pass: number;
  warn: number;
  fail: number;
  skipped: number;
  slowestCheckId: string | null;
  slowestCheckLabel: string | null;
  slowestCheckMs: number;
  maxEventLoopLagMs: number;
  maxFrameGapMs: number;
}

export interface PerformanceAuditReport {
  schemaVersion: number;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  environment: AuditEnvironment;
  summary: PerformanceAuditSummary;
  checks: AuditCheck[];
  limitations: string[];
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
  progress: PerformanceAuditProgress;
  cancelRequested: boolean;
  report: PerformanceAuditReport | null;
  error: string | null;
}

export interface AuditJourney {
  id: string;
  label: string;
  href?: Href;
  expectedPath: string;
  navigationKind: 'tab' | 'stack';
  skipReason?: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const IDLE_STATE: PerformanceAuditState = {
  status: 'idle',
  sessionId: null,
  startedAt: null,
  progress: { completed: 0, total: 0, label: 'Ready' },
  cancelRequested: false,
  report: null,
  error: null,
};

let auditState: PerformanceAuditState = IDLE_STATE;

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

export function requestPerformanceAudit(): string {
  if (auditState.status === 'queued' || auditState.status === 'running') {
    return auditState.sessionId ?? 'active';
  }
  const sessionId = makeSessionId();
  emit({
    status: 'queued',
    sessionId,
    startedAt: new Date().toISOString(),
    progress: { completed: 0, total: 0, label: 'Preparing audit' },
    cancelRequested: false,
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

export function cancelPerformanceAudit(): void {
  if (auditState.status !== 'queued' && auditState.status !== 'running') return;
  emit({
    ...auditState,
    cancelRequested: true,
    progress: { ...auditState.progress, label: 'Cancelling safely' },
  });
}

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
    report,
    error: null,
  });
}

export function markPerformanceAuditCancelled(): void {
  emit({
    ...auditState,
    status: 'cancelled',
    cancelRequested: false,
    progress: { ...auditState.progress, label: 'Audit cancelled' },
  });
}

export function failPerformanceAudit(error: string): void {
  emit({
    ...auditState,
    status: 'failed',
    cancelRequested: false,
    progress: { ...auditState.progress, label: 'Audit failed' },
    error,
  });
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

function firstRows(core: CorePayload | null): RateRow[] {
  if (!core) return [];
  const seen = new Set<string>();
  const rows: RateRow[] = [];
  for (const section of SECTION_ORDER) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (seen.has(row.product_key)) continue;
      seen.add(row.product_key);
      rows.push(row);
      if (rows.length >= 2) return rows;
    }
  }
  return rows;
}

function browseJourney(section: SectionKey): AuditJourney {
  return {
    id: `browse-${section.toLowerCase()}`,
    label: `Browse: ${SECTIONS[section].title}`,
    href: {
      pathname: '/browse',
      params: { section: SECTIONS[section].slug },
    } as unknown as Href,
    expectedPath: '/browse',
    navigationKind: 'tab',
  };
}

/**
 * Every steady-state user-facing destination is exercised from the audit
 * screen and then backed out of. Redirect aliases and first-run onboarding are
 * excluded because they do not represent separate steady-state UI.
 */
export function buildPerformanceAuditJourneys(core: CorePayload | null): AuditJourney[] {
  const rows = firstRows(core);
  const first = rows[0];
  const second = rows[1];
  const provider = first?.provider ?? Object.keys(core?.brands ?? {})[0];

  return [
    {
      id: 'home',
      label: 'Home',
      href: '/(tabs)' as Href,
      expectedPath: '/',
      navigationKind: 'tab',
    },
    ...SECTION_ORDER.map(browseJourney),
    {
      id: 'response',
      label: 'Bank response',
      href: '/passthrough' as Href,
      expectedPath: '/passthrough',
      navigationKind: 'tab',
    },
    {
      id: 'outlook',
      label: 'Outlook',
      href: '/trends' as Href,
      expectedPath: '/trends',
      navigationKind: 'tab',
    },
    {
      id: 'rba-redirect',
      label: 'Why rates move',
      href: '/rba' as Href,
      expectedPath: '/trends',
      navigationKind: 'tab',
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      href: '/watchlist' as Href,
      expectedPath: '/watchlist',
      navigationKind: 'tab',
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings' as Href,
      expectedPath: '/settings',
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
      navigationKind: 'stack',
    },
    {
      id: 'calculator',
      label: 'Switch and save calculator',
      href: '/calculator' as Href,
      expectedPath: '/calculator',
      navigationKind: 'stack',
    },
    {
      id: 'lenders',
      label: 'Lenders',
      href: '/banks' as Href,
      expectedPath: '/banks',
      navigationKind: 'stack',
    },
    {
      id: 'profile',
      label: 'Product profile',
      href: '/profile' as Href,
      expectedPath: '/profile',
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
      navigationKind: 'stack',
      skipReason: first && second ? undefined : 'Fewer than two products are loaded',
    },
    {
      id: 'terms',
      label: 'Terms and notices',
      href: '/terms' as Href,
      expectedPath: '/terms',
      navigationKind: 'stack',
    },
    {
      id: 'debug-log',
      label: 'Debug log',
      href: '/debug-log' as Href,
      expectedPath: '/debug-log',
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
}

export interface ResponsivenessMetrics {
  eventLoopSamples: number;
  eventLoopP95Ms: number;
  maxEventLoopLagMs: number;
  stallsOver100Ms: number;
  frameSamples: number;
  frameP95Ms: number;
  maxFrameGapMs: number;
  framesOver50Ms: number;
}

export class ResponsivenessMonitor {
  private readonly timerIntervalMs = 25;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame: number | null = null;
  private lastTimerAt = 0;
  private lastFrameAt = 0;
  private running = false;
  private readonly lagSamples: number[] = [];
  private readonly frameSamples: number[] = [];

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
    };
  }

  metricsSince(snapshot: ResponsivenessSnapshot): ResponsivenessMetrics {
    return summarizeResponsiveness(
      this.lagSamples.slice(snapshot.lagIndex),
      this.frameSamples.slice(snapshot.frameIndex),
    );
  }

  metrics(): ResponsivenessMetrics {
    return summarizeResponsiveness(this.lagSamples, this.frameSamples);
  }

  private scheduleTimer(): void {
    this.timer = setTimeout(() => {
      if (!this.running) return;
      const now = this.now();
      this.lagSamples.push(Math.max(0, now - this.lastTimerAt - this.timerIntervalMs));
      this.lastTimerAt = now;
      this.scheduleTimer();
    }, this.timerIntervalMs);
  }

  private scheduleFrame(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    this.frame = requestAnimationFrame((timestamp) => {
      if (!this.running) return;
      if (this.lastFrameAt > 0) {
        this.frameSamples.push(Math.max(0, timestamp - this.lastFrameAt));
      }
      this.lastFrameAt = timestamp;
      this.scheduleFrame();
    });
  }
}

export function summarizeResponsiveness(
  lagSamples: number[],
  frameSamples: number[],
): ResponsivenessMetrics {
  return {
    eventLoopSamples: lagSamples.length,
    eventLoopP95Ms: roundMetric(percentile(lagSamples, 0.95)),
    maxEventLoopLagMs: roundMetric(Math.max(0, ...lagSamples)),
    stallsOver100Ms: lagSamples.filter((value) => value > 100).length,
    frameSamples: frameSamples.length,
    frameP95Ms: roundMetric(percentile(frameSamples, 0.95)),
    maxFrameGapMs: roundMetric(Math.max(0, ...frameSamples)),
    framesOver50Ms: frameSamples.filter((value) => value > 50).length,
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

export function summarizePerformanceAudit(checks: AuditCheck[]): PerformanceAuditSummary {
  const pass = checks.filter((check) => check.status === 'pass').length;
  const warn = checks.filter((check) => check.status === 'warn').length;
  const fail = checks.filter((check) => check.status === 'fail').length;
  const skipped = checks.filter((check) => check.status === 'skipped').length;
  const completed = checks.filter((check) => check.status !== 'skipped');
  const representativeLatency = (check: AuditCheck): number => {
    const numeric = (...keys: string[]) =>
      keys.map((key) => Number(check.metrics[key] ?? 0)).filter(Number.isFinite);
    if (check.kind === 'journey') {
      return Math.max(0, ...numeric('forwardMs', 'backMs'));
    }
    if (check.id === 'runtime-responsiveness') {
      return Math.max(0, ...numeric('maxEventLoopLagMs', 'maxFrameGapMs'));
    }
    if (check.id === 'active-data') {
      return Math.max(0, ...numeric('stringifyMs', 'parseMs', 'traversalMs', 'maxEventLoopLagMs'));
    }
    if (check.id === 'async-storage') {
      return Math.max(0, ...numeric('maxWriteMs', 'maxReadMs'));
    }
    if (check.id === 'file-system') {
      return Math.max(0, ...numeric('writeMs', 'readMs'));
    }
    return check.durationMs;
  };
  const slowest = completed.reduce<{ check: AuditCheck; latencyMs: number } | null>(
    (current, check) => {
      const latencyMs = representativeLatency(check);
      return !current || latencyMs > current.latencyMs ? { check, latencyMs } : current;
    },
    null,
  );
  const maxEventLoopLagMs = Math.max(
    0,
    ...checks.map((check) => Number(check.metrics.maxEventLoopLagMs ?? 0)),
  );
  const maxFrameGapMs = Math.max(
    0,
    ...checks.map((check) => Number(check.metrics.maxFrameGapMs ?? 0)),
  );

  return {
    overall: fail > 0 ? 'bottleneck' : warn > 0 ? 'attention' : 'healthy',
    pass,
    warn,
    fail,
    skipped,
    slowestCheckId: slowest?.check.id ?? null,
    slowestCheckLabel: slowest?.check.label ?? null,
    slowestCheckMs: roundMetric(slowest?.latencyMs ?? 0),
    maxEventLoopLagMs: roundMetric(maxEventLoopLagMs),
    maxFrameGapMs: roundMetric(maxFrameGapMs),
  };
}
