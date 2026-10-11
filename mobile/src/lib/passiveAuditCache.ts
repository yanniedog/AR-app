import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { APP_HEALTH_DATA_CHECKS } from './appHealth/dataQuality';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from './appHealth/sourceContract';
import { APP_HEALTH_SCHEMA_VERSION, type AppHealthCheck, type AppHealthDataSnapshot } from './appHealth/types';

export const PASSIVE_AUDIT_SCHEMA = 1;
export const PASSIVE_AUDIT_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
// The OS may defer a wake beyond the reuse window. Keep resumable inputs longer
// than result freshness; old publication evidence can never match a new payload.
export const PASSIVE_AUDIT_INPUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const PASSIVE_AUDIT_MAX_STORAGE_CHARS = 256 * 1024;
export interface PassiveAuditEntry {
  inputKey: string;
  checkedAt: number;
  durationMs: number;
  check: AppHealthCheck;
}

/** Bind each check only to what it actually reads. Loading an optional history
 * asset or temporarily widening audit filters must not discard core evidence. */
export function passiveAuditCheckKey(snapshot: AppHealthDataSnapshot, appBuild: string, code: AppHealthCheck['code']): string {
  const core = snapshot.core;
  const rowIdentity = { sha: snapshot.manifest?.files?.core?.sha256, schema: core?.schema_version,
    runDate: core?.run_date, coverage: core?.coverage,
    sections: Object.fromEntries(Object.entries(core?.sections ?? {}).map(([key, section]) =>
      [key, { count: section.rates.length, ribbon: section.ribbon }])), quarantine: snapshot.quarantine };
  let observation: unknown;
  switch (code) {
    case 'data-source-state': observation = [snapshot.source, Boolean(core)]; break;
    case 'manifest-contract': observation = [snapshot.manifest, snapshot.appVersion, snapshot.source]; break;
    case 'core-schema': observation = [Boolean(core), core?.schema_version]; break;
    case 'asset-descriptors': observation = [snapshot.manifest?.files, snapshot.source]; break;
    case 'payload-run-identity': observation = [core?.run_date, snapshot.manifest?.run_date, snapshot.details?.runDate, snapshot.datesIndex]; break;
    case 'quarantine-impact': observation = snapshot.quarantine; break;
    case 'freshness-window': observation = snapshot.manifest?.schedule; break;
    case 'asset-availability': observation = [core?.run_date, snapshot.details, snapshot.assets]; break;
    case 'details-completeness': observation = [rowIdentity, snapshot.details, snapshot.manifest?.files.details?.sha256]; break;
    case 'catalogue-identity-coverage': observation = [rowIdentity, snapshot.catalogue]; break;
    default: observation = rowIdentity;
  }
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify({ schema: PASSIVE_AUDIT_SCHEMA,
    healthSchema: APP_HEALTH_SCHEMA_VERSION, appBuild, code, observation }))));
}
export interface PassiveAuditRecord {
  schema: number;
  appBuild: string;
  key: string;
  inputAt: number;
  /** Only small public metadata; never rates, product details, or user preferences. */
  metadata: AppHealthDataSnapshot;
  entries: Record<string, PassiveAuditEntry>;
  cursor?: number;
}

/** Content-addressed publication plus all observations consumed by quality checks.
 * Loaded core rows are verified by the existing payload loader. Their immutable
 * manifest SHA binds them without rehashing the full payload on the UI thread. */
export function passiveAuditKey(snapshot: AppHealthDataSnapshot, appBuild: string): string | null {
  if (!snapshot.core || !snapshot.manifest?.files?.core?.sha256) return null;
  const sections = Object.fromEntries(Object.entries(snapshot.core.sections).map(([key, section]) => [key, {
    rows: section.rates.length, ribbon: section.ribbon,
  }]));
  const identity = { schema: PASSIVE_AUDIT_SCHEMA, healthSchema: APP_HEALTH_SCHEMA_VERSION,
    appBuild, ...snapshot, core: { schema_version: snapshot.core.schema_version,
      run_date: snapshot.core.run_date, coverage: snapshot.core.coverage, sections } };
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(identity))));
}

function metadataOnly(snapshot: AppHealthDataSnapshot): AppHealthDataSnapshot {
  return { source: snapshot.source, manifest: snapshot.manifest, appVersion: snapshot.appVersion,
    core: snapshot.core ? { schema_version: snapshot.core.schema_version,
      run_date: snapshot.core.run_date, sections: {} as NonNullable<AppHealthDataSnapshot['core']>['sections'],
      brands: {}, rba: [] } : null,
    details: snapshot.details, assets: snapshot.assets, quarantine: snapshot.quarantine,
    datesIndex: snapshot.datesIndex };
}

export function newPassiveAuditRecord(snapshot: AppHealthDataSnapshot, appBuild: string, now: number): PassiveAuditRecord | null {
  const key = passiveAuditKey(snapshot, appBuild);
  return key ? { schema: PASSIVE_AUDIT_SCHEMA, appBuild, key, inputAt: now,
    metadata: metadataOnly(snapshot), entries: {} } : null;
}

export function passiveAuditRecordFresh(record: PassiveAuditRecord, now: number): boolean {
  return Number.isFinite(record.inputAt) && record.inputAt <= now && now - record.inputAt < PASSIVE_AUDIT_INPUT_MAX_AGE_MS;
}

export function parsePassiveAuditRecord(raw: string | null, appBuild: string, now: number): PassiveAuditRecord | null {
  if (!raw || raw.length > PASSIVE_AUDIT_MAX_STORAGE_CHARS) return null;
  try {
    const value = JSON.parse(raw) as PassiveAuditRecord;
    if (value.schema !== PASSIVE_AUDIT_SCHEMA || value.appBuild !== appBuild ||
      !/^[a-f0-9]{64}$/.test(value.key) || !passiveAuditRecordFresh(value, now) ||
      !value.metadata?.core || !value.metadata.manifest || !value.entries || typeof value.entries !== 'object') return null;
    const entries: PassiveAuditRecord['entries'] = {};
    for (const job of APP_HEALTH_DATA_CHECKS) {
      const entry = value.entries[job.code];
      if (!entry || entry.check?.code !== job.code || entry.check.id !== job.code ||
        typeof entry.inputKey !== 'string' || !/^[a-f0-9]{64}$/.test(entry.inputKey) ||
        !['pass', 'warn', 'fail', 'unavailable', 'not-run'].includes(entry.check.status) ||
        !entry.check.metrics || typeof entry.check.metrics !== 'object' ||
        !Number.isFinite(entry.checkedAt) || entry.checkedAt > now || now - entry.checkedAt >= PASSIVE_AUDIT_MAX_AGE_MS ||
        !Number.isFinite(entry.durationMs) || entry.durationMs < 0) continue;
      // Catalogue breakdown is intentionally not persisted; regenerate it in memory.
      if (job.code === 'catalogue-identity-coverage') continue;
      entries[job.code] = entry;
    }
    return { ...value, entries };
  } catch { return null; }
}

export function serializePassiveAuditRecord(record: PassiveAuditRecord): string | null {
  const entries = Object.fromEntries(Object.entries(record.entries).map(([key, entry]) => {
    const { localEvidence: _local, ...check } = entry.check;
    return [key, { ...entry, check }];
  }));
  const raw = JSON.stringify({ ...record, entries });
  return raw.length <= PASSIVE_AUDIT_MAX_STORAGE_CHARS ? raw : null;
}

/** One genuine check, no transport or store writes. A cold OS wake can execute
 * metadata jobs; row jobs wait for already-loaded data rather than loading MBs. */
export function runPassiveAuditCheck(record: PassiveAuditRecord, snapshot: AppHealthDataSnapshot | null,
  clock: () => number = Date.now): boolean {
  const now = clock();
  const cursor = Number.isInteger(record.cursor) && record.cursor! >= 0 && record.cursor! < APP_HEALTH_DATA_CHECKS.length ? record.cursor! : 0;
  const ordered = [...APP_HEALTH_DATA_CHECKS.slice(cursor), ...APP_HEALTH_DATA_CHECKS.slice(0, cursor)];
  const job = ordered.find(item => (!record.entries[item.code] ||
    now - record.entries[item.code].checkedAt >= PASSIVE_AUDIT_MAX_AGE_MS) && (snapshot || item.backgroundMetadataOnly) &&
    (item.code !== 'catalogue-identity-coverage' || snapshot?.catalogue != null));
  if (!job) return false;
  const result = evaluateTimedDataCheck(job, snapshot ?? record.metadata, clock);
  record.entries[job.code] = { inputKey: passiveAuditCheckKey(snapshot ?? record.metadata, record.appBuild, job.code), ...result };
  record.cursor = (APP_HEALTH_DATA_CHECKS.indexOf(job) + 1) % APP_HEALTH_DATA_CHECKS.length;
  return true;
}

function evaluateTimedDataCheck(job: (typeof APP_HEALTH_DATA_CHECKS)[number], snapshot: AppHealthDataSnapshot,
  clock: () => number, observedAt?: number): Omit<PassiveAuditEntry, 'inputKey'> {
  const started = clock();
  let check: AppHealthCheck;
  try {
    check = job.evaluate(snapshot, CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT, observedAt ?? started);
  } catch {
    check = { id: job.code, code: job.code, label: 'Background data check', domain: 'data-integrity',
      status: 'fail', metrics: { evaluationFailed: true }, summary: 'This data check could not complete.' };
  }
  const checkedAt = clock();
  const durationMs = Math.max(0, checkedAt - started);
  if (durationMs > 10_000) check = { ...check, status: 'fail',
    metrics: { ...check.metrics, stepExceededTenSeconds: true },
    summary: 'This data check exceeded the 10-second step limit.' };
  return { checkedAt, durationMs, check };
}

export function reusePassiveAuditChecks(record: PassiveAuditRecord | null, snapshot: AppHealthDataSnapshot,
  appBuild: string, now = Date.now()): { checks: AppHealthCheck[]; reused: number } {
  const matches = record && passiveAuditRecordFresh(record, now) && record.appBuild === appBuild;
  let reused = 0;
  const checks = APP_HEALTH_DATA_CHECKS.map(job => {
    const entry = matches ? record.entries[job.code] : undefined;
    // Freshness is clock dependent, and must always describe the current audit.
    if (entry && entry.checkedAt <= now && now - entry.checkedAt < PASSIVE_AUDIT_MAX_AGE_MS &&
      entry.inputKey === passiveAuditCheckKey(snapshot, appBuild, job.code) && job.code !== 'freshness-window') {
      reused++;
      return { ...entry.check, metrics: { ...entry.check.metrics, preloaded: true,
        preloadedAgeMs: Math.max(0, now - entry.checkedAt), backgroundDurationMs: entry.durationMs } };
    }
    const timed = evaluateTimedDataCheck(job, snapshot, Date.now, now);
    return { ...timed.check, metrics: { ...timed.check.metrics, foregroundDurationMs: timed.durationMs } };
  });
  return { checks, reused };
}
