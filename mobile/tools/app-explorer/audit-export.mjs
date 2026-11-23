import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// Match the public uploader's limits in compactDiagnosticJson.ts.
const MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_BYTES = 32 * 1024 * 1024;
const OUTCOMES = new Set(['successful', 'warning', 'failed', 'incomplete']);

export function decodeAuditExport(body) {
  if (Buffer.byteLength(body) > MAX_ENVELOPE_BYTES) throw new Error('Audit export exceeds upload limit');
  const envelope = JSON.parse(body);
  if (envelope?.format !== 'ar-audit-gzip-v1') throw new Error('Unsupported audit export format');
  if (!Number.isSafeInteger(envelope.bytes) || envelope.bytes < 1 || envelope.bytes > MAX_REPORT_BYTES
    || typeof envelope.gzip_base64 !== 'string' || typeof envelope.sha256 !== 'string') {
    throw new Error('Invalid audit export envelope');
  }
  const unpacked = gunzipSync(Buffer.from(envelope.gzip_base64, 'base64'), { maxOutputLength: envelope.bytes });
  if (unpacked.length !== envelope.bytes || createHash('sha256').update(unpacked).digest('hex') !== envelope.sha256) {
    throw new Error('Audit export integrity check failed');
  }
  const report = JSON.parse(unpacked.toString('utf8'));
  if (!Array.isArray(report?.checks)) throw new Error('Audit export has no check results');
  return report;
}

export function auditCompletion(report) {
  const completion = report?.completion;
  if (!OUTCOMES.has(completion?.outcome)) return null;
  const { collectionComplete, coverageComplete, detailsComplete } = completion;
  const complete = collectionComplete === true && coverageComplete === true && detailsComplete === true;
  const outcome = completion.outcome !== 'failed' && !complete ? 'incomplete' : completion.outcome;
  return { outcome, collectionComplete, coverageComplete, detailsComplete };
}

export function auditOutcomeLine(audit) {
  const outcome = audit.completion?.outcome ?? 'unverified';
  const runner = audit.outcome ? ` | runner: ${audit.outcome}` : '';
  return `Audit ${audit.kind}: outcome ${outcome}${runner} | ${Math.round(audit.elapsedMs / 1000)} s`;
}
