import { Platform } from 'react-native';
import type { TargetSizeSampleInput } from './uxFrictionFluidityAudit';

// Repeated mounts are equivalent only when control identity, state, platform,
// role and measured geometry match. Retain every distinct geometry, including failures.
const MAX_CAPTURED_TARGETS = 4_096;

let collectionActive = false;
let capacityReached = false;
let auditStartControlsMeasured = false;
const capturedTargets = new Map<string, TargetSizeSampleInput>();
const mountedTargets = new Map<string, TargetSizeSampleInput>();

function retain(sample: TargetSizeSampleInput): void {
  const key = sample.id!;
  const previous = capturedTargets.get(key);
  if (previous) {
    previous.layoutObservations = (previous.layoutObservations ?? 1) + 1;
  } else if (capturedTargets.size < MAX_CAPTURED_TARGETS) {
    capturedTargets.set(key, { ...sample, layoutObservations: 1 });
  } else {
    capacityReached = true;
  }
}

export function startAuditTargetCollection(): void {
  capturedTargets.clear();
  capacityReached = false;
  auditStartControlsMeasured = false;
  for (const sample of mountedTargets.values()) retain(sample);
  collectionActive = true;
}

export function getAuditTargetCapture(): { capacityReached: boolean; auditStartControlsMeasured: boolean; aggregation: 'control-state-geometry' } {
  return { capacityReached, auditStartControlsMeasured, aggregation: 'control-state-geometry' };
}

export function isAuditTargetCollectionActive(): boolean {
  return collectionActive;
}

export function unregisterAuditTargetLayout(id: string): void {
  mountedTargets.delete(id);
}

export function recordAuditTargetLayout(
  id: string | null | undefined,
  width: number,
  height: number,
  role?: string,
  state: string = 'default',
  controlIdentity?: string,
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const normalizedId = typeof id === 'string' && id.trim().length > 0
    ? id.trim().slice(0, 120)
    : `target-${Math.round(width)}x${Math.round(height)}`;
  const platform: TargetSizeSampleInput['platform'] =
    Platform.OS === 'ios' ? 'ios-hig' : Platform.OS === 'web' ? 'web-wcag-aa' : 'android';
  const roundedW = Math.round(width * 10) / 10;
  const roundedH = Math.round(height * 10) / 10;
  // The instance key remains the mounted-map owner so unmounting one of two
  // equivalent controls cannot unregister the other. It is not retained evidence.
  const semantic = controlIdentity ?? (/^target#\d+$/.test(normalizedId) ? normalizedId : normalizedId.replace(/#\d+$/, ''));
  const sample: TargetSizeSampleInput = {
    id: `${semantic}#${platform}:${role ?? 'unclassified'}:${state}:${roundedW}x${roundedH}`,
    width: roundedW, height: roundedH, platform, role,
  };
  mountedTargets.set(normalizedId, sample);
  if (collectionActive) retain(sample);
}

export function stopAuditTargetCollection(): TargetSizeSampleInput[] {
  collectionActive = false;
  const samples = [...capturedTargets.values()];
  auditStartControlsMeasured = samples.some(sample => sample.id?.startsWith('audit-start-local#'))
    && samples.some(sample => sample.id?.startsWith('audit-start-live#'));
  capturedTargets.clear();
  return samples;
}
