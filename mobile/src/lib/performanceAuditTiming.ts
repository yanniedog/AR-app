/** Every foreground check shares one budget across all of its sub-operations. */
export const PERFORMANCE_AUDIT_STEP_LIMIT_MS = 10_000;

/** Freeze run boundaries before report aggregation/export adds its own CPU work. */
export function captureAuditRunTiming(startedAt: string, activeDurationMs: () => number, clock = Date.now) {
  const finishedMs = clock();
  return {
    finishedAt: new Date(finishedMs).toISOString(),
    durationMs: activeDurationMs(),
    wallClockMs: Math.max(0, finishedMs - Date.parse(startedAt)),
  };
}

export class PerformanceAuditStepTimeoutError extends Error {
  constructor(readonly label: string, readonly elapsedMs: number) {
    super(`${label} exceeded the 10-second step limit (${Math.round(elapsedMs)}ms foreground time)`);
    this.name = 'PerformanceAuditStepTimeoutError';
  }
}

export class PerformanceAuditPendingMutationError extends Error {
  constructor(label: string) {
    super(`${label} did not settle before its deadline. Further audit mutations have stopped.`);
    this.name = 'PerformanceAuditPendingMutationError';
  }
}

/** Native writes cannot be cancelled by racing a Promise. Drain before rollback. */
export class PerformanceAuditMutationBarrier {
  private readonly pending = new Set<Promise<unknown>>();

  get hasPending(): boolean { return this.pending.size > 0; }

  track<T>(operation: Promise<T>): Promise<T> {
    this.pending.add(operation);
    void operation.then(() => this.pending.delete(operation), () => this.pending.delete(operation));
    return operation;
  }

  async drain(timeoutMs = PERFORMANCE_AUDIT_STEP_LIMIT_MS): Promise<boolean> {
    if (!this.pending.size) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.allSettled([...this.pending]).then(() => true),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
}

export interface PerformanceAuditEstimate {
  elapsedMs: number;
  /** One adaptive value. It includes storage, setup and finalization overhead. */
  remainingMs: number;
  basis: 'initial' | 'observed' | 'finalizing';
}

/** Shown before a first run, when no earlier duration exists. A full local run
 * on the reference Android device measured 525 seconds (build 316). */
export const PERFORMANCE_AUDIT_TYPICAL_DURATION_MS = 9 * 60_000;

/** Overhead outside measured checks: setup, durable storage and the final flush. */
const ESTIMATE_OVERHEAD_MS = 15_000;

/** A single adaptive estimate, not a countdown promise. */
export function estimatePerformanceAuditTime(input: {
  elapsedMs: number;
  completed: number;
  total: number;
  finalizing: boolean;
  finalizationElapsedMs?: number;
  links?: { total: number; completed: number; elapsedMs: number };
}): PerformanceAuditEstimate {
  if (input.finalizing) {
    const spent = input.finalizationElapsedMs ?? 0;
    return {
      elapsedMs: input.elapsedMs,
      remainingMs: Math.max(1_000, ESTIMATE_OVERHEAD_MS - spent),
      basis: 'finalizing',
    };
  }
  const links = input.links ?? { total: 0, completed: 0, elapsedMs: 0 };
  const foregroundCompleted = Math.max(0, input.completed - links.completed);
  const foregroundRemaining = Math.max(0, input.total - links.total - foregroundCompleted);
  const remainingLinks = Math.max(0, links.total - links.completed);
  // Keep the cheap, often preloaded link phase separate from mounted routes.
  // Otherwise discovering 2,000 links near the end predicts hours of UI work.
  const perForegroundCheck = Math.min(PERFORMANCE_AUDIT_STEP_LIMIT_MS,
    (Math.max(0, input.elapsedMs - links.elapsedMs) + 10 * 1_500) / (foregroundCompleted + 10));
  const perLink = Math.min(PERFORMANCE_AUDIT_STEP_LIMIT_MS,
    (links.elapsedMs + 20 * 100) / (links.completed + 20));
  return {
    elapsedMs: input.elapsedMs,
    remainingMs: foregroundRemaining * perForegroundCheck + remainingLinks * perLink + ESTIMATE_OVERHEAD_MS,
    basis: input.completed < 5 ? 'initial' : 'observed',
  };
}

/** Round up once before splitting so 59.1 seconds is 01:00, never 00:60. */
export function performanceAuditEstimateParts(remainingMs: number): { minutes: number; seconds: number } {
  const ms = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const seconds = Math.ceil(ms / 1_000);
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

export function formatPerformanceAuditEstimate(
  estimate: PerformanceAuditEstimate | null | undefined,
  paused: boolean,
): string {
  if (!estimate) return paused ? 'ETA paused until you return' : 'ETA: estimating the audit plan…';
  const { minutes, seconds } = performanceAuditEstimateParts(estimate.remainingMs);
  const remaining = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return paused
    ? `ETA paused · ${remaining} of foreground work remains`
    : `ETA: ${remaining} remaining${estimate.basis === 'initial' ? ' · initial estimate' : ''}`;
}

/** Work the user waits for. These are the existing score thresholds. */
export const AUDIT_ACTION_WARN_MS = 900;
export const AUDIT_ACTION_FAIL_MS = 2_500;
export const AUDIT_FORWARD_WARN_MS = 900;
export const AUDIT_FORWARD_FAIL_MS = 2_500;
export const AUDIT_BACK_WARN_MS = 800;
export const AUDIT_BACK_FAIL_MS = 2_000;
export const AUDIT_EVENT_LOOP_WARN_MS = 100;
export const AUDIT_EVENT_LOOP_FAIL_MS = 300;
export const AUDIT_FRAME_WARN_MS = 80;
export const AUDIT_FRAME_FAIL_MS = 250;

export type UserVisibleLatencyStatus = 'pass' | 'warn' | 'fail';

function finiteMs(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function scoreAuditLatency(
  valueMs: number,
  warnAboveMs: number,
  failAboveMs: number,
): UserVisibleLatencyStatus {
  if (valueMs > failAboveMs) return 'fail';
  if (valueMs > warnAboveMs) return 'warn';
  return 'pass';
}

export function worstUserVisibleLatency(
  ...statuses: UserVisibleLatencyStatus[]
): UserVisibleLatencyStatus {
  const rank: Record<UserVisibleLatencyStatus, number> = { pass: 0, warn: 1, fail: 2 };
  return statuses.reduce(
    (worst, status) => (rank[status] > rank[worst] ? status : worst),
    'pass',
  );
}

/** Navigation commit plus the first ready frame. Quiet-window padding is excluded. */
export function userVisibleForwardMs(input: {
  navigationCommitMs?: number | null;
  firstReadyFrameMs?: number | null;
}): number {
  return Math.max(0, (finiteMs(input.navigationCommitMs) ?? 0) + (finiteMs(input.firstReadyFrameMs) ?? 0));
}

export interface UserVisibleJourneyScoreInput {
  actionMs?: number | null;
  navigationCommitMs?: number | null;
  firstReadyFrameMs?: number | null;
  backMs?: number | null;
  maxEventLoopLagMs?: number | null;
  maxFrameGapMs?: number | null;
}

/**
 * Score the tap, the navigation commit, the first ready frame, the return,
 * and stalls inside that window. Background settle is not an input.
 */
export function scoreUserVisibleJourney(
  input: UserVisibleJourneyScoreInput,
): UserVisibleLatencyStatus {
  const statuses: UserVisibleLatencyStatus[] = [];
  const action = finiteMs(input.actionMs);
  if (action != null) statuses.push(scoreAuditLatency(action, AUDIT_ACTION_WARN_MS, AUDIT_ACTION_FAIL_MS));
  if (finiteMs(input.navigationCommitMs) != null || finiteMs(input.firstReadyFrameMs) != null) {
    statuses.push(scoreAuditLatency(
      userVisibleForwardMs(input),
      AUDIT_FORWARD_WARN_MS,
      AUDIT_FORWARD_FAIL_MS,
    ));
  }
  const back = finiteMs(input.backMs);
  if (back != null) statuses.push(scoreAuditLatency(back, AUDIT_BACK_WARN_MS, AUDIT_BACK_FAIL_MS));
  const lag = finiteMs(input.maxEventLoopLagMs);
  if (lag != null) statuses.push(scoreAuditLatency(lag, AUDIT_EVENT_LOOP_WARN_MS, AUDIT_EVENT_LOOP_FAIL_MS));
  const frame = finiteMs(input.maxFrameGapMs);
  if (frame != null) statuses.push(scoreAuditLatency(frame, AUDIT_FRAME_WARN_MS, AUDIT_FRAME_FAIL_MS));
  return statuses.length ? worstUserVisibleLatency(...statuses) : 'pass';
}

export function userVisibleLatencyOverBudget(metrics: {
  actionMs?: unknown;
  forwardMs?: unknown;
  forwardWorkMs?: unknown;
  backMs?: unknown;
  maxEventLoopLagMs?: unknown;
  maxFrameGapMs?: unknown;
}): boolean {
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const action = number(metrics.actionMs);
  if (action != null && action > AUDIT_ACTION_FAIL_MS) return true;
  const forward = number(metrics.forwardWorkMs) ?? number(metrics.forwardMs);
  if (forward != null && forward > AUDIT_FORWARD_FAIL_MS) return true;
  const back = number(metrics.backMs);
  if (back != null && back > AUDIT_BACK_FAIL_MS) return true;
  const lag = number(metrics.maxEventLoopLagMs);
  if (lag != null && lag > AUDIT_EVENT_LOOP_FAIL_MS) return true;
  const frame = number(metrics.maxFrameGapMs);
  if (frame != null && frame > AUDIT_FRAME_FAIL_MS) return true;
  return false;
}
