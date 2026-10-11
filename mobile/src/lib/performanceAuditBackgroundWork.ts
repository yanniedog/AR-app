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
    `${job.label}${job.runDate ? ` (${job.runDate})` : ''}: ${job.stage} — ${(job.stageElapsedMs / 1000).toFixed(1)}s in stage, ${(job.elapsedMs / 1000).toFixed(1)}s total`);
  return `Background work: ${(wait.elapsedMs / 1000).toFixed(1)}s waiting.\n${detail.join('\n') ||
    (wait.payloadWork.activeWork.length ? `${wait.payloadWork.activeWork.join(', ')} (stage unavailable)` : 'Work settled')}`;
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
