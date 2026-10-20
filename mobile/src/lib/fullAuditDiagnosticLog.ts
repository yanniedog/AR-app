import type { PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';

/** Keep the canonical diagnostic report, replacing private inputs rather than
 * replacing the report with a summary. Opaque aliases retain equality evidence. */
export function fullAuditDiagnosticLog(report: PerformanceAuditReport, safeCheckId: (value: string) => string | null): unknown {
  const aliases = new Map<string, string>();
  const alias = (value: unknown) => {
    const key = JSON.stringify(value);
    let name = aliases.get(key);
    if (name === undefined) { name = `~private${aliases.size}`; aliases.set(key, name); }
    return name;
  };
  const privateField = /^(?:sessionId|startedAt|finishedAt|lastStoredCheckAt|manufacturer|brand|model|networkType|label|journeyLabel|slowestCheckLabel|query|searchQuery|parameters|inputs|profile|profileFilters|scenario|accountBalance|balance|loanBalance|loanAmount|propertyValue|currentRate|lvr|productKey|product_key|provider|selectionTokens?|actionResultEvidence|readinessEvidence|graphicEvidence|readinessActionEvidence|limitations|generationId|bundleSha|coreSha|payloadRevision|privateText)$/i;
  const cleanText = (text: string) => (text.includes('@')
    ? text.replace(/\b[A-Z0-9._%+-]{1,128}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}\b/gi, '[email]') : text)
    .replace(/\bBearer\s+\S+/gi, 'Bearer [secret]')
    .replace(/\b(?:authorization|api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?[^\s,;"']+["']?/gi, '[secret]')
    .replace(/\b(?:uid|user[_-]?id|subscription[_-]?id|account[_-]?(?:id|number))\s*[:=]\s*[^\s,;]+/gi, '[identifier]')
    .replace(/https?:\/\/[^\s)'"\\]+/gi, '[url]')
    .replace(/\b[A-Z]:[\\/][^\s)]+/gi, '[path]')
    .replace(/\/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/g, '[path]')
    .replace(/\b(?:private[-_ ]*)?(?:account|balance|loan[-_ ]?amount|lvr|property[-_ ]?value|current[-_ ]?rate)[\s:=#-]*\$?\d[\w.,%/-]*/gi, '[private value]');
  const visit = (value: unknown, key = ''): unknown => {
    if (value == null) return value;
    if (typeof value === 'string' && /CheckIds?$/.test(key)) return safeCheckId(value) ?? alias(value);
    if (privateField.test(key) || key === 'account' || key === 'totalMemoryBytes' || /(?:password|secret|authorization|credential|privateKey|api[_-]?key|token|accountNumber|accountId|customerId|borrower|email|balance|amount|lvr)/i.test(key) ||
      typeof value === 'string' && /(?:revision|path|url)/i.test(key)) return alias(value);
    if (typeof value === 'string') return cleanText(value);
    if (Array.isArray(value)) return value.map(item => visit(item, key));
    if (typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'networkViolations')
      .map(([name, child]) => [name, visit(child, name)]));
  };
  return visit({ ...report, checks: report.checks.map(check => ({ ...check, id: safeCheckId(check.id) ?? alias(check.id) })),
    environment: { ...report.environment, appVersion: report.app.appVersion, buildVersion: report.app.buildVersion },
    appHealth: report.appHealth ? toPublicAppHealthReport(report.appHealth) : null });
}
