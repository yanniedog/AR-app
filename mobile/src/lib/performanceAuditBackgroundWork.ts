import { backgroundPayloadWork, type BackgroundWorkSnapshot } from './backgroundPayloadWork';
import { captureAuditPayloadWork } from './performanceAuditPayloadWork';

export interface AuditBackgroundWorkWait {
  startedAt: string;
  capturedAt: string;
  elapsedMs: number;
  status: 'waiting' | 'settled' | 'interrupted';
  payloadWork: ReturnType<typeof captureAuditPayloadWork>;
  jobs: BackgroundWorkSnapshot[];
}

export function captureAuditBackgroundWorkWait(
  startedMs: number, state: Parameters<typeof captureAuditPayloadWork>[0],
  status: AuditBackgroundWorkWait['status'], now = Date.now(),
): AuditBackgroundWorkWait {
  const capturedAt = new Date(now).toISOString();
  return { startedAt: new Date(startedMs).toISOString(), capturedAt,
    elapsedMs: Math.max(0, now - startedMs), status,
    payloadWork: captureAuditPayloadWork(state, capturedAt),
    jobs: backgroundPayloadWork.snapshot(startedMs) };
}

export function describeAuditBackgroundWork(wait: AuditBackgroundWorkWait): string {
  const active = wait.jobs.filter(job => job.outcome === null);
  const detail = active.map(job =>
    `${job.label}${job.runDate ? ` (${job.runDate})` : ''}: ${job.stage} — ${(job.stageElapsedMs / 1000).toFixed(1)}s in stage, ${(job.elapsedMs / 1000).toFixed(1)}s total` +
    (job.lastCheckpointAgeMs != null ? `; ${job.processingCheckpoints} processing checkpoints, last ${(job.lastCheckpointAgeMs / 1000).toFixed(1)}s ago` : '; no processing checkpoint recorded'));
  return `Background work: ${(wait.elapsedMs / 1000).toFixed(1)}s waiting.\n${detail.join('\n') ||
    (wait.payloadWork.activeWork.length ? `${wait.payloadWork.activeWork.join(', ')} (stage unavailable)` : 'Work settled')}`;
}

export type JourneyBackgroundRequirementState = 'pending' | 'ready' | 'failed';

/**
 * A destination that has not claimed its load yet is still pending.
 * Failure is an explicit finished load that does not match, not the first look.
 */
export function journeyDetailsRequirementState(input: {
  loading: boolean;
  matches: boolean;
  claimed: boolean;
}): JourneyBackgroundRequirementState {
  if (!input.loading && input.matches) return 'ready';
  if (input.loading) return 'pending';
  return input.claimed ? 'failed' : 'pending';
}

export type JourneyBackgroundObservation = 'continue' | 'settled' | 'unsettled' | 'failed';

/**
 * A settle deadline records unsettled background work. It does not fail the journey.
 * Requirements that never claim their load stop after the claim window.
 */
export function classifyJourneyBackgroundObservation(input: {
  states: readonly JourneyBackgroundRequirementState[];
  elapsedMs: number;
  deadlineMs: number;
  /** True when every still-pending requirement has not claimed its load. */
  unclaimedPending?: boolean;
  claimWindowMs?: number;
}): JourneyBackgroundObservation {
  if (input.states.includes('failed')) return 'failed';
  if (input.states.length > 0 && input.states.every((state) => state === 'ready')) return 'settled';
  const claimWindowMs = input.claimWindowMs ?? 1_000;
  if (input.unclaimedPending && input.elapsedMs >= claimWindowMs) return 'unsettled';
  if (input.elapsedMs >= input.deadlineMs) return 'unsettled';
  return 'continue';
}

/** Explicit product-data failure. A quiet timeout is not one of these. */
export class JourneyBackgroundDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JourneyBackgroundDataError';
  }
}

/** Observe setup independently of executed-check coverage and the hang watchdog.
 * Finally captures the exact interruption-time worker state before recovery. */
export async function waitForAuditBackgroundWork(options: {
  getState: () => Parameters<typeof captureAuditPayloadWork>[0];
  assertActive: () => void;
  observe: (wait: AuditBackgroundWorkWait) => void;
  delay: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<void> {
  const clock = options.clock ?? Date.now;
  const startedMs = clock();
  let lastObservedMs = -Infinity;
  let settled = false;
  const capture = (status: AuditBackgroundWorkWait['status']) =>
    options.observe(captureAuditBackgroundWorkWait(startedMs, options.getState(), status, clock()));
  const busy = () => {
    const state = options.getState();
    return state.refreshing || state.postRefreshWarming || state.bankRateHistoryLoading || state.detailsLoading ||
      backgroundPayloadWork.hasActiveWork();
  };
  try {
    while (true) {
      if (clock() - lastObservedMs >= 1_000) {
        capture('waiting');
        lastObservedMs = clock();
      }
      options.assertActive();
      if (!busy()) {
        // Refresh can move into warming in its finally block. Require quiet.
        await options.delay(150);
        options.assertActive();
        if (!busy()) { settled = true; return; }
      }
      await options.delay(50);
    }
  } finally {
    capture(settled ? 'settled' : 'interrupted');
  }
}
