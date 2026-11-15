export interface AuditNativeFrameMetricsResult {
  refreshRateHz: number;
  frameOverrunP95Ms: number;
  jankPercent: number;
  frozenFrameCount: number;
  maxFrozenFrameMs?: number;
  totalFrames?: number;
}

export function startAuditNativeFrameMetrics(): boolean {
  return false;
}

export function stopAuditNativeFrameMetrics(): AuditNativeFrameMetricsResult | null {
  return null;
}
