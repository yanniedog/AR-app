import { APP_HEALTH_CHECK_CODES } from './appHealth';
import { buildAuditMetricAnalysis } from './auditMetricAnalysis';
import type { PerformanceAuditReport } from './performanceAudit';
import { publicAuditDiagnostic } from './performanceAuditDiagnostic';
import { buildUxFrictionFluidityAudit, type UxFrictionFluidityTelemetryOptions } from './uxFrictionFluidityAudit';

const HEALTH_CODES: ReadonlySet<string> = new Set(Object.values(APP_HEALTH_CHECK_CODES));
function publicRole(value: string | undefined): string | null {
  if (value === undefined) return null;
  return (publicAuditDiagnostic({ id: value }) as { id: string | null }).id;
}

/** Recompute from canonical checks; never trust a saved metricAnalysis field.
 * Observation indexes preserve contributor identity even when a private check,
 * surface or probe identifier cannot cross the public diagnostics boundary. */
export function publicAuditMetricAnalysis(report: PerformanceAuditReport,
  safeCheckId: (value: string) => string | null,
  uxTelemetry?: Omit<UxFrictionFluidityTelemetryOptions, 'safeCheckId'>) {
  const analysis = buildAuditMetricAnalysis(report, undefined, uxTelemetry);
  return {
    ...analysis,
    uxAudit: buildUxFrictionFluidityAudit(report, undefined, { ...uxTelemetry, safeCheckId }),
    observations: analysis.observations.map(observation => ({
      ...observation,
      ...(observation.checkId === undefined ? {} : { checkId: observation.source === 'health'
        ? HEALTH_CODES.has(observation.checkId) ? observation.checkId : null
        : safeCheckId(observation.checkId) }),
      ...(observation.surfaceId === undefined ? {} : { surfaceId: publicRole(observation.surfaceId) }),
      ...(observation.probeId === undefined ? {} : { probeId: publicRole(observation.probeId) }),
    })),
  };
}
