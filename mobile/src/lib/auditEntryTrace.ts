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
 * - forwardWorkMs: screen requested -> controls laid out and usable
 * - entryFirstCallbackMs: press -> first JS animation callback
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
  screenOpenedAt: Mark;
  screenMountedAt: Mark;
  screenLayoutAt: Mark;
  preferencesReadyAt: Mark;
  admissionReadyAt: Mark;
  screenReadyAt: Mark;
  startPressedAt: Mark;
  startFeedbackAt: Mark;
  startQueuedAt: Mark;
  runningAt: Mark;
  /** Last real Audit settings open in this visit, when the person opened it. */
  settingsOpenMs: Mark;
  screenInterrupted: boolean;
  /** The app left the foreground between the press and the running runner. */
  startInterrupted: boolean;
}

export const AUDIT_ENTRY_SETTINGS_TIMEOUT_MS = 10_000;
let screenOpenPressedAt: Mark = null;
const empty = (): EntryTrace => ({
  screenOpenedAt: null, screenMountedAt: null, screenLayoutAt: null,
  preferencesReadyAt: null, admissionReadyAt: null, screenReadyAt: null,
  startPressedAt: null, startFeedbackAt: null,
  startQueuedAt: null, runningAt: null, settingsOpenMs: null, screenInterrupted: false, startInterrupted: false,
});
let trace = empty();
let pressedVisit: EntryTrace | null = null;
export type AuditEntrySettingsProbeResult = number | null | 'interrupted' | 'timed-out';
type SettingsProbeResult = AuditEntrySettingsProbeResult;
let settingsProbe: (() => Promise<SettingsProbeResult>) | null = null;

/** The audit's monotonic clock; callers timing a phase must use the same one. */
export function auditEntryClock(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}
const clock = auditEntryClock;
const rounded = (value: number) => Math.round(value * 10) / 10;
const span = (from: Mark, to: Mark): number | null =>
  from != null && to != null && Number.isFinite(from) && Number.isFinite(to) && to >= from ? rounded(to - from) : null;

/** Start before the router dispatch, so deferred route loading is included. */
export function markAuditEntryScreenOpenPressed(): void {
  screenOpenPressedAt = clock();
}

/** A remount is a new visit for the screen and its settings. Marks of a press
 * whose run has not yet recorded its entry checks belong to that run and stay. */
export function markAuditEntryScreenMounted(): void {
  const mountedAt = clock();
  trace = {
    ...trace,
    screenOpenedAt: screenOpenPressedAt ?? mountedAt,
    screenMountedAt: mountedAt,
    screenLayoutAt: null,
    preferencesReadyAt: null,
    admissionReadyAt: null,
    screenReadyAt: null,
    settingsOpenMs: null,
    screenInterrupted: false,
  };
  screenOpenPressedAt = null;
}

export function markAuditEntryInterrupted(): void {
  screenOpenPressedAt = null;
  if (trace.screenMountedAt != null && trace.screenReadyAt == null) trace.screenInterrupted = true;
  if (trace.startPressedAt != null && trace.runningAt == null) trace.startInterrupted = true;
}

export function markAuditEntryScreenPhase(phase: 'screenLayoutAt' | 'preferencesReadyAt' | 'admissionReadyAt'): void {
  if (trace.screenMountedAt != null && trace[phase] == null) trace[phase] = clock();
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
  pressedVisit = { ...trace };
  trace.startPressedAt = pressedAt;
  trace.startFeedbackAt = null;
  trace.startQueuedAt = null;
  trace.runningAt = null;
  trace.startInterrupted = false;
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
export function setAuditEntrySettingsProbe(probe: (() => Promise<SettingsProbeResult>) | null): void {
  settingsProbe = probe;
}

export function resetAuditEntryTraceForTests(): void {
  trace = empty();
  pressedVisit = null;
  screenOpenPressedAt = null;
  settingsProbe = null;
}

function unavailable(id: string, label: string,
  entryMeasurementStatus: 'not-observed' | 'interrupted' | 'probe-failed'): AuditCheck {
  return {
    id, label, kind: 'runtime', status: 'skipped', durationMs: null,
    metrics: {
      executionAttempted: false,
      measurementAvailable: false,
      availabilityFailure: true,
      skipClassification: 'terminal-availability',
      entryMeasurementStatus,
    },
  };
}

function measured(id: string, label: string, durationMs: number, status: AuditCheckStatus,
  metrics: {
    forwardWorkMs?: number;
    actionMs?: number;
    entryFeedbackObserved?: boolean;
    entryFirstCallbackMs?: number;
    entryRouteMountMs?: number | null;
    entryLayoutMs?: number | null;
    entryPreferencesMs?: number | null;
    entryAdmissionMs?: number | null;
  }): AuditCheck {
  return {
    id, label, kind: 'runtime', status, durationMs,
    metrics: { ...metrics, executionAttempted: true, measurementAvailable: true, nonTimingFailure: false },
  };
}

async function measureSettingsOpen(ownObservation: Mark): Promise<SettingsProbeResult | 'timed-out' | 'probe-failed'> {
  const probe = settingsProbe;
  // The person's own open is the measurement. A probe reopens an already
  // rendered panel, so it only fills in when no real open was recorded.
  if (!probe || ownObservation != null) return ownObservation;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      probe(),
      new Promise<'timed-out'>(resolve => {
        timer = setTimeout(() => resolve('timed-out'), AUDIT_ENTRY_SETTINGS_TIMEOUT_MS);
      }),
    ]);
    if (typeof value !== 'number') return value;
    return Number.isFinite(value) && value >= 0 ? rounded(value) : 'probe-failed';
  } catch {
    return 'probe-failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One check per planned id, in AUDIT_ENTRY_CHECK_IDS order. Never throws: a
 * phase without marks (for example a run requested without the screen) is a
 * declared-unavailable measurement, not a failure.
 */
export function takeAuditEntryChecks(): readonly (() => Promise<AuditCheck>)[] {
  const [screenId, settingsId, startId] = AUDIT_ENTRY_CHECK_IDS;
  const screenLabel = 'Audit screen open', settingsLabel = 'Audit settings open', startLabel = 'Audit start response';
  const snapshot = { ...trace };
  const visit = pressedVisit ?? snapshot;
  // Press marks belong to exactly one run.
  pressedVisit = null;
  trace = { ...trace, startPressedAt: null, startFeedbackAt: null, startQueuedAt: null, runningAt: null, startInterrupted: false };

  const openMs = span(visit.screenOpenedAt, visit.screenReadyAt);
  const screen = openMs == null || visit.screenInterrupted
    ? unavailable(screenId, screenLabel, visit.screenInterrupted ? 'interrupted' : 'not-observed')
    : measured(screenId, screenLabel, openMs,
      scoreAuditLatency(openMs, AUDIT_FORWARD_WARN_MS, AUDIT_FORWARD_FAIL_MS), {
        forwardWorkMs: openMs,
        entryRouteMountMs: span(visit.screenOpenedAt, visit.screenMountedAt),
        entryLayoutMs: span(visit.screenMountedAt, visit.screenLayoutAt),
        entryPreferencesMs: span(visit.screenMountedAt, visit.preferencesReadyAt),
        entryAdmissionMs: span(visit.screenMountedAt, visit.admissionReadyAt),
      });

  const settings = async (): Promise<AuditCheck> => {
    const settingsMs = await measureSettingsOpen(visit.settingsOpenMs);
    if (typeof settingsMs === 'number') {
      return measured(settingsId, settingsLabel, settingsMs,
        scoreAuditLatency(settingsMs, AUDIT_FRAME_WARN_MS, AUDIT_FRAME_FAIL_MS), { entryFirstCallbackMs: settingsMs });
    }
    if (settingsMs === 'timed-out') {
      return {
        id: settingsId, label: settingsLabel, kind: 'runtime', status: 'fail', durationMs: AUDIT_ENTRY_SETTINGS_TIMEOUT_MS,
        metrics: {
          executionAttempted: true, measurementAvailable: false, nonTimingFailure: false,
          stepLimitExceeded: true, stepLimitMs: AUDIT_ENTRY_SETTINGS_TIMEOUT_MS,
          entryMeasurementStatus: 'timed-out',
        },
      };
    }
    return unavailable(settingsId, settingsLabel, settingsMs ?? 'not-observed');
  };

  const feedbackMs = span(snapshot.startPressedAt, snapshot.startFeedbackAt);
  const queuedMs = span(snapshot.startPressedAt, snapshot.startQueuedAt);
  const runningMs = span(snapshot.startPressedAt, snapshot.runningAt);
  const start = queuedMs == null || runningMs == null || snapshot.startInterrupted
    ? unavailable(startId, startLabel, snapshot.startInterrupted ? 'interrupted' : 'not-observed')
    : measured(startId, startLabel, runningMs, worstUserVisibleLatency(
      scoreAuditLatency(queuedMs, AUDIT_ACTION_WARN_MS, AUDIT_ACTION_FAIL_MS),
      scoreAuditLatency(runningMs, AUDIT_FORWARD_WARN_MS, AUDIT_FORWARD_FAIL_MS),
      feedbackMs == null ? 'warn' : scoreAuditLatency(feedbackMs, AUDIT_FRAME_WARN_MS, AUDIT_FRAME_FAIL_MS),
    ), { actionMs: queuedMs, forwardWorkMs: runningMs, entryFeedbackObserved: feedbackMs != null,
      ...(feedbackMs == null ? {} : { entryFirstCallbackMs: feedbackMs }) });

  return [async () => screen, settings, async () => start];
}

export async function buildAuditEntryChecks(): Promise<AuditCheck[]> {
  return Promise.all(takeAuditEntryChecks().map(measure => measure()));
}
