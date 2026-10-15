/** This action needs a session/deadline and temporary transport capability, so
 * its measured owner runs after generic first/repeat journeys, never inside them. */
export const ANDROID_UPDATE_READINESS_AUDIT = Object.freeze({
  checkId: 'update-readiness',
  semanticActionId: 'settings.update.check',
  expectedSurface: 'settings.app-update',
  expectedPath: '/settings',
  kind: 'update',
  platform: 'android',
  executionMode: 'live-source',
  phase: 'after-journeys',
  transportScope: 'app-update-metadata',
} as const);

export const PERFORMANCE_AUDIT_DEDICATED_CHECKS = Object.freeze([ANDROID_UPDATE_READINESS_AUDIT] as const);
export type DedicatedPerformanceAuditCheck = (typeof PERFORMANCE_AUDIT_DEDICATED_CHECKS)[number];

export function dedicatedPerformanceAuditChecks(platform: string): readonly DedicatedPerformanceAuditCheck[] {
  return PERFORMANCE_AUDIT_DEDICATED_CHECKS.filter(check => check.platform === platform);
}
