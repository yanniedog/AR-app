/** Compact perf-audit encodings for paste-sized uploads; full report stays in the sidecar. */

const LONG_HEX = /\b[a-f0-9]{24,}\b/gi;

export function omitNullishDeep<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => omitNullishDeep(entry)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested == null) continue;
    out[key] = omitNullishDeep(nested);
  }
  return out as T;
}

export function shortenAuditEvidenceText(value: string): string {
  return value.replace(LONG_HEX, (match) => `${match.slice(0, 12)}…`);
}

export function compactAuditMetrics(
  metrics: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!metrics) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(metrics)) {
    if (nested == null) continue;
    out[key] = typeof nested === 'string' ? shortenAuditEvidenceText(nested) : nested;
  }
  return Object.keys(out).length ? out : undefined;
}

export function compactAuditCheckForLog(check: {
  id: string;
  label: string;
  kind: string;
  status: string;
  durationMs: number;
  metrics: Record<string, unknown>;
  error?: string | null;
  trace?: string | null;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: check.id,
    label: check.label,
    kind: check.kind,
    status: check.status,
    durationMs: check.durationMs,
  };
  if (check.status === 'pass' || check.status === 'skipped') {
    if (check.metrics.iteration != null) base.phase = check.metrics.iteration;
    if (typeof check.metrics.maxEventLoopLagMs === 'number') {
      base.maxEventLoopLagMs = check.metrics.maxEventLoopLagMs;
    }
    if (typeof check.metrics.maxFrameGapMs === 'number') {
      base.maxFrameGapMs = check.metrics.maxFrameGapMs;
    }
    if (typeof check.metrics.reason === 'string') base.reason = check.metrics.reason;
    return base;
  }
  const metrics = compactAuditMetrics(check.metrics);
  if (metrics) base.metrics = metrics;
  if (check.error) base.error = shortenAuditEvidenceText(check.error);
  if (check.trace) base.trace = shortenAuditEvidenceText(check.trace);
  return base;
}

export function compactPerformanceAuditReportForLog(report: unknown): unknown {
  if (report == null || typeof report !== 'object' || Array.isArray(report)) return report;
  const source = report as Record<string, unknown>;
  const checks = Array.isArray(source.checks)
    ? source.checks.map((entry) => {
      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
      const check = entry as Record<string, unknown>;
      if (
        typeof check.id !== 'string' ||
        typeof check.label !== 'string' ||
        typeof check.kind !== 'string' ||
        typeof check.status !== 'string' ||
        typeof check.durationMs !== 'number' ||
        check.metrics == null ||
        typeof check.metrics !== 'object' ||
        Array.isArray(check.metrics)
      ) {
        return omitNullishDeep(entry);
      }
      return compactAuditCheckForLog({
        id: check.id,
        label: check.label,
        kind: check.kind,
        status: check.status,
        durationMs: check.durationMs,
        metrics: check.metrics as Record<string, unknown>,
        error: typeof check.error === 'string' ? check.error : null,
        trace: typeof check.trace === 'string' ? check.trace : null,
      });
    })
    : source.checks;

  let compactPlan: unknown = source.plan;
  if (source.plan != null && typeof source.plan === 'object' && !Array.isArray(source.plan)) {
    const plan = source.plan as Record<string, unknown>;
    const passes = Array.isArray(plan.passes) ? plan.passes : null;
    compactPlan = omitNullishDeep({
      schemaVersion: plan.schemaVersion,
      inputs: plan.inputs,
      passCount: passes?.length,
      stepCount: passes?.reduce((sum: number, pass) => {
        if (pass == null || typeof pass !== 'object' || Array.isArray(pass)) return sum;
        const steps = (pass as { steps?: unknown }).steps;
        return sum + (Array.isArray(steps) ? steps.length : 0);
      }, 0),
    });
  }

  const kept = new Set([
    'schemaVersion', 'sessionId', 'startedAt', 'finishedAt', 'durationMs', 'partial',
    'app', 'watchdog', 'environment', 'plan', 'summary', 'checks', 'routeAggregates', 'limitations',
  ]);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (kept.has(key)) continue;
    if (typeof value === 'string' && value.length <= 2048) extras[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') extras[key] = value;
  }

  return omitNullishDeep({
    schemaVersion: source.schemaVersion,
    sessionId: source.sessionId,
    startedAt: source.startedAt,
    finishedAt: source.finishedAt,
    durationMs: source.durationMs,
    partial: source.partial,
    app: source.app,
    watchdog: source.watchdog,
    environment: source.environment,
    plan: compactPlan,
    summary: source.summary,
    checks,
    routeAggregates: source.routeAggregates,
    limitations: Array.isArray(source.limitations) ? source.limitations.slice(0, 4) : source.limitations,
    ...extras,
  });
}

export function compactAuditLogJson(value: unknown): string {
  return JSON.stringify(omitNullishDeep(value), (_key, nested) => (
    typeof nested === 'string' ? shortenAuditEvidenceText(nested) : nested
  ));
}
