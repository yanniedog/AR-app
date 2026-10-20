import type { PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';
import { publicAuditDiagnostic, publicAuditError } from './performanceAuditDiagnostic';

// Only source-authored enum values are public text. Runtime text is opaque even
// when it has no recognizable personal-data prefix or shape.
const FIXED_TEXT = new Set(('pass warn fail skipped unavailable runtime journey setup storage network filesystem data list logo graphic layout pending ready error android ios web Android iOS Hermes hermes jsc remote local bundled cache unknown cold warm deep-first-pass deep-repeat foreground background complete partial start route pre-action action path readiness settle back recovery origin-readiness check Error TypeError RangeError AuditDatasetChangedError PerformanceAuditReadinessTimeoutError PerformanceAuditReadinessProbeError PerformanceAuditStepTimeoutError PerformanceAuditPendingMutationError frame').split(' '));

/** Keep the canonical diagnostic report, replacing private inputs rather than
 * replacing the report with a summary. Opaque aliases retain equality evidence. */
export function fullAuditDiagnosticLog(report: PerformanceAuditReport, safeCheckId: (value: string) => string | null): unknown {
  const aliases = new Map<string, string>();
  const aliasNames = new Set<string>();
  const alias = (value: unknown) => {
    const key = JSON.stringify(value);
    let name = aliases.get(key);
    if (name === undefined) { name = `~private${aliases.size}`; aliases.set(key, name); aliasNames.add(name); }
    return name;
  };
  const privateField = /^(?:sessionId|startedAt|finishedAt|lastStoredCheckAt|manufacturer|brand|model|networkType|label|journeyLabel|slowestCheckLabel|query|searchQuery|parameters|inputs|profile|profileFilters|scenario|accountBalance|balance|loanBalance|loanAmount|propertyValue|currentRate|lvr|productKey|product_key|provider|selectionTokens?|actionResultEvidence|readinessEvidence|graphicEvidence|readinessActionEvidence|limitations|generationId|bundleSha|coreSha|payloadRevision|privateText)$/i;
  const visit = (value: unknown, key = ''): unknown => {
    if (value == null) return value;
    if (typeof value === 'string' && /CheckIds?$/.test(key)) return safeCheckId(value) ?? alias(value);
    if (privateField.test(key) || key === 'account' || key === 'totalMemoryBytes' || /(?:password|secret|authorization|credential|privateKey|api[_-]?key|token|accountNumber|accountId|customerId|borrower|email|balance|amount|lvr)/i.test(key) ||
      typeof value === 'string' && /(?:revision|path|url)/i.test(key)) return alias(value);
    if (typeof value === 'string') {
      if (aliasNames.has(value)) return value;
      if (/^(?:appVersion|buildVersion|platformVersion|osVersion)$/.test(key) && /^\d+(?:\.\d+){0,3}$/.test(value) && value.length <= 32) return value;
      if (['id', 'surface', 'probe', 'actions', 'lastCompletedAction', 'code'].includes(key)) {
        const roleKey = key === 'code' ? 'code' : 'id';
        const fixed = publicAuditDiagnostic({ [roleKey]: value }) as Record<string, unknown>;
        if (fixed[roleKey] === value || key === 'id' && safeCheckId(value) === value) return value;
      }
      return FIXED_TEXT.has(value) && !['error', 'trace', 'message'].includes(key) ? value : alias(value);
    }
    if (Array.isArray(value)) return value.map(item => visit(item, key));
    if (typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'networkViolations')
      .map(([name, child]) => [name, visit(child, name)]));
  };
  return visit({ ...report, checks: report.checks.map(check => ({ ...check, id: safeCheckId(check.id) ?? alias(check.id),
    errorDetails: publicAuditError(check.error, check.trace) })),
    environment: { ...report.environment, appVersion: report.app.appVersion, buildVersion: report.app.buildVersion },
    appHealth: report.appHealth ? toPublicAppHealthReport(report.appHealth) : null });
}
