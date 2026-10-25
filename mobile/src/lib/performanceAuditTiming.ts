/** Every foreground check shares one budget across all of its sub-operations. */
export const PERFORMANCE_AUDIT_STEP_LIMIT_MS = 10_000;

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
  remainingMinMs: number;
  remainingMaxMs: number;
  basis: 'initial' | 'observed' | 'finalizing';
}

/** An adaptive range, not a countdown promise. Include storage and setup overhead. */
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
      remainingMinMs: Math.max(0, 5_000 - spent),
      remainingMaxMs: Math.max(5_000, 30_000 - spent),
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
  const remainingMs = foregroundRemaining * perForegroundCheck + remainingLinks * perLink;
  return {
    elapsedMs: input.elapsedMs,
    remainingMinMs: remainingMs * 0.6 + 5_000,
    remainingMaxMs: remainingMs * 1.6 + 30_000,
    basis: input.completed < 5 ? 'initial' : 'observed',
  };
}

export function formatPerformanceAuditEstimate(
  estimate: PerformanceAuditEstimate | null | undefined,
  paused: boolean,
): string {
  if (!estimate) return paused ? 'ETA paused until you return' : 'ETA: estimating the audit plan…';
  const range = (ms: number) => ms >= 60_000
    ? `${Math.max(1, Math.ceil(ms / 60_000))} min`
    : `${Math.max(5, Math.ceil(ms / 5_000) * 5)} sec`;
  const low = range(estimate.remainingMinMs);
  const high = range(estimate.remainingMaxMs);
  const remaining = low === high ? `about ${high}` : `about ${low}–${high}`;
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
