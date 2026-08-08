/**
 * Compact performance-audit log encodings so paste hosts never reject uploads
 * for size, while keeping fail/warn diagnostics and timing signal intact.
 */

const LONG_HEX = /\b[a-f0-9]{24,}\b/gi;

export function omitNullishDeep<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => omitNullishDeep(entry)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested == null) continue;
    out[key] = omitNullishDeep(nested);
  }
  return out as T;
}

/** Shorten long content hashes in readiness evidence without dropping the probe chain. */
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
    if (typeof nested === 'string') {
      const shortened = shortenAuditEvidenceText(nested);
      if (shortened.length === 0) continue;
      out[key] = shortened;
      continue;
    }
    out[key] = nested;
  }
  return out;
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
    const lag = check.metrics.maxEventLoopLagMs;
    const frame = check.metrics.maxFrameGapMs;
    const phase = check.metrics.iteration;
    if (phase != null) base.phase = phase;
    if (typeof lag === 'number') base.maxEventLoopLagMs = lag;
    if (typeof frame === 'number') base.maxFrameGapMs = frame;
    if (typeof check.metrics.reason === 'string') base.reason = check.metrics.reason;
    return base;
  }
  const metrics = compactAuditMetrics(check.metrics);
  if (metrics && Object.keys(metrics).length) base.metrics = metrics;
  if (check.error) base.error = shortenAuditEvidenceText(check.error);
  if (check.trace) base.trace = shortenAuditEvidenceText(check.trace);
  return base;
}

/**
 * Build a paste-friendly report body: full signal on fail/warn, skinny pass rows,
 * no null noise, truncated hashes. Full fidelity stays in the on-device sidecar.
 */
export function compactPerformanceAuditReportForLog(report: unknown): unknown {
  if (report == null || typeof report !== 'object' || Array.isArray(report)) {
    return report;
  }
  const source = report as Record<string, unknown>;
  const checks = Array.isArray(source.checks)
    ? source.checks.map((entry) => {
      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
      const check = entry as {
        id?: unknown;
        label?: unknown;
        kind?: unknown;
        status?: unknown;
        durationMs?: unknown;
        metrics?: unknown;
        error?: unknown;
        trace?: unknown;
      };
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

  const plan = source.plan;
  let compactPlan: unknown = plan;
  if (plan != null && typeof plan === 'object' && !Array.isArray(plan)) {
    const planRecord = plan as Record<string, unknown>;
    compactPlan = omitNullishDeep({
      schemaVersion: planRecord.schemaVersion,
      inputs: planRecord.inputs,
      passCount: Array.isArray(planRecord.passes) ? planRecord.passes.length : undefined,
      stepCount: Array.isArray(planRecord.passes)
        ? planRecord.passes.reduce((sum: number, pass) => {
          if (pass == null || typeof pass !== 'object' || Array.isArray(pass)) return sum;
          const steps = (pass as { steps?: unknown }).steps;
          return sum + (Array.isArray(steps) ? steps.length : 0);
        }, 0)
        : undefined,
    });
  }

  const knownKeys = new Set([
    'schemaVersion',
    'sessionId',
    'startedAt',
    'finishedAt',
    'durationMs',
    'partial',
    'app',
    'watchdog',
    'environment',
    'plan',
    'summary',
    'checks',
    'routeAggregates',
    'limitations',
  ]);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (knownKeys.has(key)) continue;
    if (typeof value === 'string') {
      if (value.length <= 2_048) extras[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      extras[key] = value;
    }
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
    limitations: Array.isArray(source.limitations)
      ? source.limitations.slice(0, 4)
      : source.limitations,
    ...extras,
  });
}

export function compactAuditLogJson(value: unknown): string {
  return JSON.stringify(omitNullishDeep(value), (_key, nested) => {
    if (typeof nested === 'string') return shortenAuditEvidenceText(nested);
    return nested;
  });
}
