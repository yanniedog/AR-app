import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const input = process.argv[2];
if (!input) {
  throw new Error('Usage: node mobile/scripts/replay-audit-export.mjs <local-envelope.json|->');
}
const envelope = JSON.parse(readFileSync(input === '-' ? 0 : input, 'utf8').replace(/^\uFEFF/, ''));
let report = envelope;
if (envelope.format != null) {
  if (envelope.format !== 'ar-audit-gzip-v1' || typeof envelope.gzip_base64 !== 'string'
    || !/^[a-f0-9]{64}$/i.test(envelope.sha256) || envelope.gzip_base64.length > 3 * 1024 * 1024) {
    throw new Error('Invalid diagnostic envelope');
  }
  const bytes = gunzipSync(Buffer.from(envelope.gzip_base64, 'base64'), { maxOutputLength: 32 * 1024 * 1024 });
  if (bytes.length !== envelope.bytes || createHash('sha256').update(bytes).digest('hex') !== envelope.sha256.toLowerCase()) {
    throw new Error('Diagnostic checksum or length mismatch');
  }
  report = JSON.parse(bytes.toString('utf8'));
}
const { completion, checks, appHealth, diagnostics, metricAnalysis } = report;
const performance = checks.length;
const healthChecks = appHealth?.checks ?? [];
const health = healthChecks.length;
const failures = completion.failurePositions;
const timings = failures.filter(item => item.category === 'timing').length;
const gapCounts = Object.create(null);
for (const item of completion.gapPositions) {
  gapCounts[item.reason] = (gapCounts[item.reason] ?? 0) + 1;
}
const populations = { performance: checks, health: healthChecks };
const independentlyFailed = Object.entries(populations).flatMap(([source, records]) =>
  records.flatMap((item, index) => item.status === 'fail' ? [`${source}:${index + 1}`] : []));
const failureKeys = new Set(failures.map(({ source, position }) => `${source}:${position}`));
for (const entry of [...failures, ...completion.gapPositions]) {
  const record = Object.hasOwn(populations, entry.source) && Number.isSafeInteger(entry.position)
    ? populations[entry.source][entry.position - 1] : undefined;
  const checkId = entry.source === 'health' ? record?.code : record?.id;
  if (!record || (entry.checkId != null && checkId != null && entry.checkId !== checkId)) {
    throw new Error('Diagnostic position does not match a recorded check');
  }
}
if (completion.performanceCheckCount !== performance || completion.healthCheckCount !== health
  || failures.length !== failureKeys.size || failureKeys.size !== independentlyFailed.length
  || independentlyFailed.some(key => !failureKeys.has(key)) || envelope.audit && (envelope.audit.failureCount !== failures.length
    || envelope.audit.timingFailureCount !== timings)) {
  throw new Error('Completion, envelope, and recorded checks disagree');
}
const exceptionGroups = new Map();
const exceptions = checks.flatMap(({ id, kind, status, failureCode, diagnostic }, index) => {
  if (status === 'pass') return [];
  const key = [kind, status, failureCode ?? 'unclassified'].join(' / ');
  exceptionGroups.set(key, (exceptionGroups.get(key) ?? 0) + 1);
  return [{ id, kind, status, failureCode, stage: diagnostic?.stage ?? null, position: index + 1 }];
});
process.stdout.write(JSON.stringify({
  auditId: completion.auditId,
  app: report.app,
  performance, health, failures: failures.length, timings,
  plannedPerformanceChecks: diagnostics.plannedChecks,
  wallClockMs: diagnostics.wallClockMs,
  gapCounts, gaps: completion.gaps, exceptionCounts: Object.fromEntries(exceptionGroups),
  failurePositions: failures,
  gapPositions: completion.gapPositions,
  nonPassingPerformanceChecks: exceptions,
  nonPassingHealthChecks: healthChecks.filter(check => check.status !== 'pass').map(({ code, status }) => ({ code, status })),
  uxFindings: metricAnalysis?.uxAudit?.findings ?? null,
}, null, 2) + '\n');
