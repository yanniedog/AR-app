import { Platform } from 'react-native';
import type { TargetSizeSampleInput } from './uxFrictionFluidityAudit';

const MAX_CAPTURED_TARGETS = 500;

let collectionActive = false;
const capturedTargets = new Map<string, TargetSizeSampleInput>();
const mountedTargets = new Map<string, TargetSizeSampleInput>();

export function startAuditTargetCollection(): void {
  capturedTargets.clear();
  for (const [id, sample] of mountedTargets) {
    if (capturedTargets.size >= MAX_CAPTURED_TARGETS) break;
    capturedTargets.set(id, sample);
  }
  collectionActive = true;
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
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const normalizedId = typeof id === 'string' && id.trim().length > 0
    ? id.trim().slice(0, 120)
    : `target-${Math.round(width)}x${Math.round(height)}`;
  const platform: TargetSizeSampleInput['platform'] =
    Platform.OS === 'ios' ? 'ios-hig' : Platform.OS === 'web' ? 'web-wcag-aa' : 'android';
  const roundedW = Math.round(width * 10) / 10;
  const roundedH = Math.round(height * 10) / 10;
  const sample: TargetSizeSampleInput = { id: normalizedId, width: roundedW, height: roundedH, platform };
  if (mountedTargets.has(normalizedId) || mountedTargets.size < MAX_CAPTURED_TARGETS) {
    mountedTargets.set(normalizedId, sample);
  }
  if (!collectionActive) return;
  if (!capturedTargets.has(normalizedId) && capturedTargets.size >= MAX_CAPTURED_TARGETS) return;
  const existing = capturedTargets.get(normalizedId);
  if (existing && Math.min(existing.width, existing.height) <= Math.min(roundedW, roundedH)) {
    return;
  }
  capturedTargets.set(normalizedId, sample);
}

export function stopAuditTargetCollection(): TargetSizeSampleInput[] {
  collectionActive = false;
  const samples = [...capturedTargets.values()];
  capturedTargets.clear();
  return samples;
}
