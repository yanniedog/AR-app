/** Compressed startup core ceiling; history remains detached and independently bounded. */
export const MAX_STARTUP_CORE_BYTES = 1024 * 1024;

export function withinStartupCoreBudget(bytes: unknown): bytes is number {
  return typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_STARTUP_CORE_BYTES;
}

/** 0.5 Mbps transfer allowance plus connection startup; always a finite deadline. */
export function payloadDownloadTimeoutMs(expectedBytes: unknown): number {
  if (typeof expectedBytes !== 'number' || !Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) return 30000;
  return Math.min(180000, Math.max(30000, Math.ceil(15000 + expectedBytes * 8 / 500000 * 1000)));
}
