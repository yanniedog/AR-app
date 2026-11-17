import { Platform } from 'react-native';
import type { TargetSizeSampleInput } from './uxFrictionFluidityAudit';

// Virtualized rows generate new control instances over a whole-app run.
// Bound retained geometry while allowing more than the initial route's controls.
const MAX_CAPTURED_TARGETS = 4_096;

let collectionActive = false;
let capacityReached = false;
let auditStartControlsMeasured = false;
const capturedTargets = new Map<string, TargetSizeSampleInput>();
const mountedTargets = new Map<string, TargetSizeSampleInput>();

export function startAuditTargetCollection(): void {
  capturedTargets.clear();
  capacityReached = mountedTargets.size > MAX_CAPTURED_TARGETS;
  auditStartControlsMeasured = false;
  for (const [id, sample] of mountedTargets) {
    if (capturedTargets.size >= MAX_CAPTURED_TARGETS) break;
    capturedTargets.set(id, sample);
  }
  collectionActive = true;
}

export function getAuditTargetCapture(): { capacityReached: boolean; auditStartControlsMeasured: boolean } {
  return { capacityReached, auditStartControlsMeasured };
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
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const normalizedId = typeof id === 'string' && id.trim().length > 0
    ? id.trim().slice(0, 120)
    : `target-${Math.round(width)}x${Math.round(height)}`;
  const platform: TargetSizeSampleInput['platform'] =
    Platform.OS === 'ios' ? 'ios-hig' : Platform.OS === 'web' ? 'web-wcag-aa' : 'android';
  const roundedW = Math.round(width * 10) / 10;
  const roundedH = Math.round(height * 10) / 10;
  const sample: TargetSizeSampleInput = { id: normalizedId, width: roundedW, height: roundedH, platform, role };
  mountedTargets.set(normalizedId, sample);
  if (!collectionActive) return;
  if (!capturedTargets.has(normalizedId) && capturedTargets.size >= MAX_CAPTURED_TARGETS) {
    capacityReached = true;
    return;
  }
  const existing = capturedTargets.get(normalizedId);
  if (existing && Math.min(existing.width, existing.height) <= Math.min(roundedW, roundedH)) {
    return;
  }
  capturedTargets.set(normalizedId, sample);
}

export function stopAuditTargetCollection(): TargetSizeSampleInput[] {
  collectionActive = false;
  const samples = [...capturedTargets.values()];
  auditStartControlsMeasured = samples.some(sample => sample.id?.startsWith('audit-start-local#'))
    && samples.some(sample => sample.id?.startsWith('audit-start-live#'));
  capturedTargets.clear();
  return samples;
}
