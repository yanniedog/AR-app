import type { AndroidFrameSegmentCoverage, UxFrictionFluidityTelemetryOptions } from './uxFrictionFluidityAudit';

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function validAndroidFrameSegments(input: AndroidFrameSegmentCoverage | undefined): AndroidFrameSegmentCoverage | undefined {
  if (!input || !count(input.attempted) || !count(input.observed) || !count(input.frames)
      || input.observed > input.attempted || input.observed > input.frames) return undefined;
  const { attempted, observed, frames, droppedFrames, deadlineFrames } = input;
  return { attempted, observed, frames, ...(count(droppedFrames) ? { droppedFrames } : {}),
    ...(count(deadlineFrames) && deadlineFrames <= frames ? { deadlineFrames } : {}) };
}

export function hasCompleteAndroidFrameCapture(telemetry: UxFrictionFluidityTelemetryOptions | undefined): boolean {
  const segments = validAndroidFrameSegments(telemetry?.androidFrameSegments);
  const native = telemetry?.androidFluidity;
  return telemetry?.androidFrameCapture === 'collected' && native !== undefined && segments !== undefined && segments.observed > 0
    && segments.observed === segments.attempted && segments.droppedFrames === 0 && segments.frames === native.totalFrameCount
    && typeof native.refreshRateHz === 'number' && Number.isFinite(native.refreshRateHz) && native.refreshRateHz > 0
    && typeof native.frameOverrunP95Ms === 'number' && Number.isFinite(native.frameOverrunP95Ms)
    && typeof native.jankPercent === 'number' && native.jankPercent >= 0 && native.jankPercent <= 100;
}

/** Checks the declared PressFeedback sample and both critical audit entry controls. */
export function hasCompleteAuditTargetSampleCapture(telemetry: UxFrictionFluidityTelemetryOptions | undefined): boolean {
  const samples = telemetry?.targetSamples;
  if (telemetry?.targetCapture?.capacityReached !== false || telemetry.targetCapture.auditStartControlsMeasured !== true
    || !Array.isArray(samples) || samples.length < 2) return false;
  const ids = new Set<string>();
  let local = false;
  let live = false;
  for (const sample of samples) {
    if (!sample || typeof sample.id !== 'string' || sample.id.length === 0 || ids.has(sample.id)
      || !Number.isFinite(sample.width) || sample.width <= 0 || !Number.isFinite(sample.height) || sample.height <= 0
      || !['android', 'ios-hig', 'web-wcag-aa'].includes(sample.platform)) return false;
    ids.add(sample.id);
    local ||= sample.id.startsWith('audit-start-local#');
    live ||= sample.id.startsWith('audit-start-live#');
  }
  return local && live;
}
