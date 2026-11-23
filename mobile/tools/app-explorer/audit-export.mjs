import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// Bound the expansion of an externally hosted diagnostic export.
const MAX_REPORT_BYTES = 128 * 1024 * 1024;
const OUTCOMES = new Set(['successful', 'warning', 'failed', 'incomplete']);

export function decodeAuditExport(body) {
  const envelope = JSON.parse(body);
  if (!envelope || typeof envelope !== 'object') throw new Error('Invalid audit export');
  let report = envelope;
  if (envelope.format === 'ar-audit-gzip-v1') {
    if (!Number.isSafeInteger(envelope.bytes) || envelope.bytes < 1 || envelope.bytes > MAX_REPORT_BYTES
      || typeof envelope.gzip_base64 !== 'string' || typeof envelope.sha256 !== 'string') {
      throw new Error('Invalid audit export envelope');
    }
    const unpacked = gunzipSync(Buffer.from(envelope.gzip_base64, 'base64'), { maxOutputLength: envelope.bytes });
    if (unpacked.length !== envelope.bytes || createHash('sha256').update(unpacked).digest('hex') !== envelope.sha256) {
      throw new Error('Audit export integrity check failed');
    }
    report = JSON.parse(unpacked.toString('utf8'));
  }
  if (!Array.isArray(report?.checks)) throw new Error('Audit export has no check results');
  return report;
}

export function auditCompletion(report) {
  const completion = report?.completion;
  if (!OUTCOMES.has(completion?.outcome)) return null;
  return {
    outcome: completion.outcome,
    collectionComplete: completion.collectionComplete,
    coverageComplete: completion.coverageComplete,
    detailsComplete: completion.detailsComplete,
  };
}

export function auditOutcomeLine(audit) {
  const outcome = audit.completion?.outcome ?? 'unverified';
  const runner = audit.outcome ? ` | runner: ${audit.outcome}` : '';
  return `Audit ${audit.kind}: outcome ${outcome}${runner} | ${Math.round(audit.elapsedMs / 1000)} s`;
}
