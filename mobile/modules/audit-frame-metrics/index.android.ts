import { requireOptionalNativeModule } from 'expo-modules-core';
import type { AuditNativeFrameMetricsResult } from './index';

interface NativeAuditFrameMetricsModule {
  startFrameMetrics(): boolean;
  stopFrameMetrics(): AuditNativeFrameMetricsResult | null;
}

const nativeModule = requireOptionalNativeModule<NativeAuditFrameMetricsModule>('ArAuditFrameMetrics');

export type { AuditNativeFrameMetricsResult };

export function startAuditNativeFrameMetrics(): boolean {
  try {
    return nativeModule?.startFrameMetrics() === true;
  } catch {
    return false;
  }
}

export function stopAuditNativeFrameMetrics(): AuditNativeFrameMetricsResult | null {
  try {
    return nativeModule?.stopFrameMetrics() ?? null;
  } catch {
    return null;
  }
}
