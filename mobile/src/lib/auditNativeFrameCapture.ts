import type { AuditNativeFrameMetricsResult } from '../../modules/audit-frame-metrics';

/** Retain foreground samples without treating interrupted capture as a full-run trace. */
export function createAuditNativeFrameCapture(
  start: () => boolean,
  stop: () => AuditNativeFrameMetricsResult | null,
) {
  let paused: boolean | null = null;
  let active = false;
  let started = false;
  let interrupted = false;
  let finalized = false;
  let attempted = 0;
  let observed = 0;
  let frames = 0;
  let droppedFrames: number | undefined = 0;
  let deadlineFrames: number | undefined = 0;
  let summary: AuditNativeFrameMetricsResult | null = null;

  const closeSegment = () => {
    if (!active) return;
    active = false;
    const capture = stop();
    const samples = capture?.totalFrameCount ?? capture?.totalFrames;
    if (capture == null || samples == null || !Number.isSafeInteger(samples) || samples <= 0) return;
    summary = capture;
    observed += 1;
    frames += samples;
    const drops = capture.droppedFrameCallbackCount;
    droppedFrames = droppedFrames != null && drops != null && Number.isSafeInteger(drops) && drops >= 0
      ? droppedFrames + drops : undefined;
    const deadlines = capture.frameDeadlineCount;
    deadlineFrames = deadlineFrames != null && deadlines != null && Number.isSafeInteger(deadlines)
      && deadlines >= 0 && deadlines <= samples ? deadlineFrames + deadlines : undefined;
  };

  return {
    setPaused(next: boolean) {
      if (finalized || next === paused) return;
      paused = next;
      if (next) {
        interrupted = true;
        closeSegment();
      } else {
        attempted += 1;
        active = start();
        started ||= active;
      }
    },
    finish() {
      if (!finalized) {
        finalized = true;
        closeSegment();
      }
      const complete = !interrupted && attempted === 1 && observed === 1 && droppedFrames === 0;
      const androidFrameCapture = interrupted ? 'interrupted'
        : observed === 0 ? (attempted > 0 && started ? 'no-samples' : 'start-unavailable')
          : droppedFrames === undefined ? 'drop-count-unavailable'
            : droppedFrames > 0 ? 'dropped-callbacks' : 'collected';
      return {
        androidFrameCapture,
        androidFrameSegments: {
          attempted, observed, frames,
          ...(observed > 0 && droppedFrames !== undefined ? { droppedFrames } : {}),
          ...(observed > 0 && deadlineFrames !== undefined ? { deadlineFrames } : {}),
        },
        ...(complete && summary ? { androidFluidity: summary } : {}),
      } as const;
    },
  };
}
