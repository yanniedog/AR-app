import type { AuditCheck, AuditCheckStatus } from './performanceAudit';
import {
  AUDIT_ACTION_FAIL_MS, AUDIT_ACTION_WARN_MS, AUDIT_FORWARD_FAIL_MS, AUDIT_FORWARD_WARN_MS,
  AUDIT_FRAME_FAIL_MS, AUDIT_FRAME_WARN_MS, scoreAuditLatency, worstUserVisibleLatency,
} from './performanceAuditTiming';

/**
 * The path a person takes to start an audit: open the audit screen, optionally
 * open Audit settings, press a start control. These marks are taken from the
 * real interaction that started the current run, so the report can show how
 * long the audit itself took to become usable and to respond.
 *
 * Only existing public metric names are written, so the diagnostic schema and
 * its allowlist are unchanged:
 * - forwardWorkMs: screen mounted -> controls laid out and usable
 * - maxFrameGapMs: press -> next painted frame (visible feedback)
 * - actionMs: press -> audit request accepted
 * - durationMs: press -> runner started (start response), or the measured phase
 */
export const AUDIT_ENTRY_CHECK_IDS = [
  'audit-entry-screen-open',
  'audit-entry-settings-open',
  'audit-entry-start-response',
] as const;

type Mark = number | null;
interface EntryTrace {
  screenMountedAt: Mark;
  screenReadyAt: Mark;
  startPressedAt: Mark;
  startFeedbackAt: Mark;
  startQueuedAt: Mark;
  runningAt: Mark;
  /** Last real Audit settings open in this visit, when the person opened it. */
  settingsOpenMs: Mark;
}

const SETTINGS_PROBE_TIMEOUT_MS = 2_000;
const empty = (): EntryTrace => ({
  screenMountedAt: null, screenReadyAt: null, startPressedAt: null, startFeedbackAt: null,
  startQueuedAt: null, runningAt: null, settingsOpenMs: null,
});
let trace = empty();
let settingsProbe: (() => Promise<number | null>) | null = null;

/** The audit's monotonic clock; callers timing a phase must use the same one. */
export function auditEntryClock(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}
const clock = auditEntryClock;
const rounded = (value: number) => Math.round(value * 10) / 10;
const span = (from: Mark, to: Mark): number | null =>
  from != null && to != null && Number.isFinite(from) && Number.isFinite(to) && to >= from ? rounded(to - from) : null;

/** A remount is a new visit: earlier screen and press marks no longer apply. */
export function markAuditEntryScreenMounted(): void {
  trace = { ...empty(), screenMountedAt: clock() };
}

/** First usable layout only; later layout passes are not another open. */
export function markAuditEntryScreenReady(): void {
  if (trace.screenMountedAt != null && trace.screenReadyAt == null) trace.screenReadyAt = clock();
}

export function markAuditEntrySettingsOpened(elapsedMs: number): void {
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) trace.settingsOpenMs = rounded(elapsedMs);
}

/** Call synchronously from the press handler, before any awaited preflight. */
export function markAuditEntryStartPressed(): void {
  const pressedAt = clock();
  trace.startPressedAt = pressedAt;
  trace.startFeedbackAt = null;
  trace.startQueuedAt = null;
  trace.runningAt = null;
  const frame = (globalThis as { requestAnimationFrame?: (callback: () => void) => unknown }).requestAnimationFrame;
  if (typeof frame !== 'function') return;
  frame(() => {
    // A later press owns its own frame; never credit this one to it.
    if (trace.startPressedAt === pressedAt && trace.startFeedbackAt == null) trace.startFeedbackAt = clock();
  });
}

export function markAuditEntryStartQueued(): void {
  if (trace.startPressedAt != null && trace.startQueuedAt == null) trace.startQueuedAt = clock();
}

export function markAuditEntryRunning(): void {
  if (trace.startPressedAt != null && trace.runningAt == null) trace.runningAt = clock();
}

/** The mounted audit screen owns the only control that can open its settings. */
export function setAuditEntrySettingsProbe(probe: (() => Promise<number | null>) | null): void {
  settingsProbe = probe;
}

export function resetAuditEntryTraceForTests(): void {
  trace = empty();
  settingsProbe = null;
}

function unavailable(id: string, label: string): AuditCheck {
  return {
    id, label, kind: 'runtime', status: 'skipped', durationMs: null,
    metrics: {
      executionAttempted: false,
      measurementAvailable: false,
      availabilityFailure: true,
      skipClassification: 'terminal-availability',
    },
  };
}

function measured(id: string, label: string, durationMs: number, status: AuditCheckStatus,
  metrics: Record<string, number>): AuditCheck {
  return {
    id, label, kind: 'runtime', status, durationMs,
    metrics: { ...metrics, executionAttempted: true, measurementAvailable: true, nonTimingFailure: false },
  };
}

async function measureSettingsOpen(): Promise<number | null> {
  const probe = settingsProbe;
  if (!probe) return trace.settingsOpenMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      probe(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), SETTINGS_PROBE_TIMEOUT_MS); }),
    ]);
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? rounded(value) : trace.settingsOpenMs;
  } catch {
    return trace.settingsOpenMs;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One check per planned id, in AUDIT_ENTRY_CHECK_IDS order. Never throws: a
 * phase without marks (for example a run requested without the screen) is a
 * declared-unavailable measurement, not a failure.
 */
export async function buildAuditEntryChecks(): Promise<AuditCheck[]> {
  const [screenId, settingsId, startId] = AUDIT_ENTRY_CHECK_IDS;
  const screenLabel = 'Audit screen open', settingsLabel = 'Audit settings open', startLabel = 'Audit start response';
  const snapshot = { ...trace };

  const openMs = span(snapshot.screenMountedAt, snapshot.screenReadyAt);
  const screen = openMs == null ? unavailable(screenId, screenLabel)
    : measured(screenId, screenLabel, openMs,
      scoreAuditLatency(openMs, AUDIT_FORWARD_WARN_MS, AUDIT_FORWARD_FAIL_MS), { forwardWorkMs: openMs });

  const settingsMs = await measureSettingsOpen();
  const settings = settingsMs == null ? unavailable(settingsId, settingsLabel)
    : measured(settingsId, settingsLabel, settingsMs,
      scoreAuditLatency(settingsMs, AUDIT_FRAME_WARN_MS, AUDIT_FRAME_FAIL_MS), { maxFrameGapMs: settingsMs });

  const feedbackMs = span(snapshot.startPressedAt, snapshot.startFeedbackAt);
  const queuedMs = span(snapshot.startPressedAt, snapshot.startQueuedAt);
  const runningMs = span(snapshot.startPressedAt, snapshot.runningAt);
  const start = queuedMs == null || runningMs == null ? unavailable(startId, startLabel)
    : measured(startId, startLabel, runningMs, worstUserVisibleLatency(
      scoreAuditLatency(queuedMs, AUDIT_ACTION_WARN_MS, AUDIT_ACTION_FAIL_MS),
      scoreAuditLatency(runningMs, AUDIT_FORWARD_WARN_MS, AUDIT_FORWARD_FAIL_MS),
      feedbackMs == null ? 'pass' : scoreAuditLatency(feedbackMs, AUDIT_FRAME_WARN_MS, AUDIT_FRAME_FAIL_MS),
    ), { actionMs: queuedMs, forwardWorkMs: runningMs, ...(feedbackMs == null ? {} : { maxFrameGapMs: feedbackMs }) });

  return [screen, settings, start];
}
