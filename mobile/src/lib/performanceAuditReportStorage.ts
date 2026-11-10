import * as FileSystem from 'expo-file-system/legacy';
import { PERFORMANCE_AUDIT_SCHEMA_VERSION } from './performanceAuditSchema';
import type { PerformanceAuditReport } from './performanceAudit';
import { measureAuditEvidence } from './auditEvidenceCapacity';
import { auditMetricRun, mergeAuditMetricRuns, type AuditMetricRun } from './auditMetricHistory';
import { appendAuditMetricHistory, deleteAuditMetricHistory, readAuditMetricHistory } from './auditMetricHistoryStorage';

const FILE = `${FileSystem.documentDirectory ?? ''}logs/ar-performance-audit-completed.json`;
const TEMP_FILE = `${FILE}.tmp`;
let writes: Promise<void> = Promise.resolve();
let epoch = 0;
let clearing = 0;

/** Separate from the runner's latest sidecar: a cancelled later run cannot
 * overwrite the last completed diagnosis. No part of this local file is public. */
export function saveCompletedPerformanceAudit(report: PerformanceAuditReport): Promise<void> {
  if (clearing) return Promise.resolve();
  const startedEpoch = epoch;
  const write = writes.catch(() => {}).then(async () => {
    if (!FileSystem.documentDirectory || startedEpoch !== epoch) return;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}logs`, { intermediates: true });
    if (startedEpoch !== epoch) return;
    measureAuditEvidence(report);
    // Preserve both pre-upgrade and interrupted completed runs before replacing
    // either recovery file. A failed read/write must leave those copies intact.
    const additions: AuditMetricRun[] = [];
    for (const file of [FILE, TEMP_FILE]) {
      if (!(await FileSystem.getInfoAsync(file)).exists) continue;
      const text = await FileSystem.readAsStringAsync(file);
      try { additions.push(auditMetricRun(validateCompletedReport(JSON.parse(text)))); }
      catch { /* Malformed bytes cannot supply a measured run; valid recovery can still repair them. */ }
    }
    additions.push(auditMetricRun(report));
    if (startedEpoch !== epoch) return;
    await appendAuditMetricHistory(additions);
    if (startedEpoch !== epoch) return;
    await FileSystem.writeAsStringAsync(TEMP_FILE, JSON.stringify(report));
    if (startedEpoch !== epoch) return;
    // Android renames within the same directory. Keep the complete staged copy
    // recoverable on platforms whose move replaces a destination in two steps.
    await FileSystem.moveAsync({ from: TEMP_FILE, to: FILE });
  });
  writes = write;
  return write;
}

/** A log Clear waits out pending recovery writes before deleting their file. */
export function clearCompletedPerformanceAudit(clearOtherDiagnostics?: () => Promise<void>): Promise<void> {
  epoch += 1;
  clearing += 1;
  const clear = writes.catch(() => {}).then(async () => {
    if (FileSystem.documentDirectory) {
      await FileSystem.deleteAsync(FILE, { idempotent: true });
      await FileSystem.deleteAsync(TEMP_FILE, { idempotent: true });
      await deleteAuditMetricHistory();
    }
    await clearOtherDiagnostics?.();
  }).finally(() => { clearing -= 1; });
  writes = clear;
  return clear;
}

/** A report already in memory is the latest run; reading and parsing the
 * multi-megabyte completed file again would only block the screen. */
export async function loadPerformanceAuditHistory(known?: PerformanceAuditReport | null): Promise<AuditMetricRun[]> {
  const startedEpoch = epoch;
  const latest = known ?? await loadCompletedPerformanceAudit().catch(() => null);
  await writes.catch(() => {});
  const rows = await readAuditMetricHistory();
  if (startedEpoch !== epoch || clearing) return [];
  return mergeAuditMetricRuns(rows, latest ? [auditMetricRun(latest)] : []);
}

let inFlightLoad: { epoch: number; writes: Promise<void>; result: Promise<PerformanceAuditReport | null> } | null = null;

/** Callers mounting in the same turn (the screen and its history card) share
 * one read and one parse. Nothing is retained after it settles, so a later
 * call always observes the files as they are then. */
export function loadCompletedPerformanceAudit(): Promise<PerformanceAuditReport | null> {
  const shared = inFlightLoad;
  if (shared && shared.epoch === epoch && shared.writes === writes) return shared.result;
  const entry = { epoch, writes, result: readCompletedPerformanceAudit() };
  inFlightLoad = entry;
  const release = () => { if (inFlightLoad === entry) inFlightLoad = null; };
  void entry.result.then(release, release);
  return entry.result;
}

const modifiedAt = (info: unknown): number | null => {
  const value = (info as { modificationTime?: unknown } | null)?.modificationTime;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

async function readCompletedPerformanceAudit(): Promise<PerformanceAuditReport | null> {
  if (!FileSystem.documentDirectory) return null;
  const startedEpoch = epoch;
  const startedWrites = writes;
  const stillCurrent = () => startedEpoch === epoch && startedWrites === writes;
  await startedWrites.catch(() => {});
  if (!stillCurrent()) return null;
  let primaryError: unknown;
  let primary: PerformanceAuditReport | null = null;
  let repairPrimary = false;
  let primaryModifiedAt: number | null = null;
  for (const file of [FILE, TEMP_FILE]) {
    try {
      const info = await FileSystem.getInfoAsync(file);
      if (info.exists) {
        const candidate = validateCompletedReport(JSON.parse(await FileSystem.readAsStringAsync(file)));
        if (!primary || Date.parse(candidate.finishedAt) > Date.parse(primary.finishedAt)) {
          primary = candidate;
          primaryModifiedAt = modifiedAt(info);
          repairPrimary = file === TEMP_FILE || candidate.schemaVersion !== PERFORMANCE_AUDIT_SCHEMA_VERSION;
        }
      }
    } catch (error) { primaryError = error; }
  }
  if (!stillCurrent()) return null;
  // Recover pre-upgrade reports and interrupted writes from the canonical sidecar.
  const previous = `${FileSystem.documentDirectory}logs/ar-performance-audit-latest.json`;
  let recovered: PerformanceAuditReport | null = null;
  try {
    const previousInfo = await FileSystem.getInfoAsync(previous);
    const previousModifiedAt = modifiedAt(previousInfo);
    // The runner writes the sidecar before this completed copy. A sidecar that
    // is not newer than a valid completed copy cannot hold a later run, so its
    // two large parses are skipped. Unknown times keep the full comparison.
    const sidecarCannotBeNewer = primary != null && !repairPrimary && primaryModifiedAt != null &&
      previousModifiedAt != null && previousModifiedAt <= primaryModifiedAt;
    if (previousInfo.exists && !sidecarCannotBeNewer) {
      const stored = JSON.parse(await FileSystem.readAsStringAsync(previous));
      if (typeof stored.summaryMarker === 'string' && !stored.summaryMarker.includes('partial=true') &&
          typeof stored.reportJson === 'string') {
        const candidate = validateCompletedReport(JSON.parse(stored.reportJson));
        const candidateTime = Date.parse(candidate.finishedAt);
        const primaryTime = primary ? Date.parse(primary.finishedAt) : NaN;
        // A process can stop after canonical finalization but before the
        // dedicated write begins, leaving an older, otherwise valid copy.
        if (!primary || (Number.isFinite(candidateTime) &&
            (!Number.isFinite(primaryTime) || candidateTime > primaryTime))) recovered = candidate;
      }
    }
  } catch (error) { if (!primary) primaryError = error; }
  if (!stillCurrent()) return null;
  if (recovered || (primary && repairPrimary)) {
    // Repair before a later partial run replaces the canonical sidecar. A write
    // failure must not hide the diagnosis which can still be reviewed in memory.
    const selected = { ...(recovered ?? primary!), schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION };
    const repair = saveCompletedPerformanceAudit(selected);
    await repair.catch(() => {});
    return startedEpoch === epoch && writes === repair ? selected : null;
  }
  if (primary) return primary;
  if (primaryError) throw primaryError;
  return null;
}

function validateCompletedReport(value: unknown): PerformanceAuditReport {
  if (!value || typeof value !== 'object') throw new Error('The saved completed audit is invalid.');
  const report = value as PerformanceAuditReport;
  const app = report.app as unknown as Record<string, unknown>;
  const summary = report.summary as unknown as Record<string, unknown>;
  const environment = report.environment as unknown as Record<string, unknown>;
  const object = (entry: unknown): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry);
  const finite = (entry: unknown) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0;
  const date = (entry: unknown) => typeof entry === 'string' && Number.isFinite(Date.parse(entry));
  const nullableNumber = (entry: unknown) => entry === null || finite(entry);
  const nullableText = (entry: unknown) => entry === null || typeof entry === 'string';
  const count = (entry: unknown) => finite(entry) && Number.isInteger(entry);
  if (![6, PERFORMANCE_AUDIT_SCHEMA_VERSION].includes(report.schemaVersion) || typeof report.sessionId !== 'string' || !report.sessionId ||
      !report.app || !report.environment || !report.summary || !report.watchdog ||
      !date(report.startedAt) || !date(report.finishedAt) || !finite(report.durationMs) ||
      !object(report.app) || !['appVersion', 'buildVersion'].every(key => typeof app[key] === 'string') ||
      !object(report.summary) || !['healthy', 'attention', 'bottleneck'].includes(report.summary.overall) ||
      !['pass', 'warn', 'fail', 'skipped', 'unavailable', 'executed', 'justifiedSkipped', 'unexpectedSkipped'].every(key => count(summary[key])) ||
      !['coveragePercent', 'slowestCheckMs', 'maxEventLoopLagMs', 'maxFrameGapMs'].every(key => nullableNumber(summary[key])) ||
      !['slowestCheckId', 'slowestCheckLabel'].every(key => nullableText(summary[key])) ||
      !finite(report.watchdog.hangTimeoutMs) || !count(report.watchdog.storedCheckCount) ||
      !(report.watchdog.lastStoredCheckAt === null || date(report.watchdog.lastStoredCheckAt)) ||
      !object(report.environment) || !['appVersion', 'buildVersion', 'platform', 'platformVersion', 'jsEngine', 'payloadSource'].every(key => typeof environment[key] === 'string') ||
      !['manufacturer', 'brand', 'model', 'osName', 'osVersion', 'payloadRunDate', 'networkType'].every(key => nullableText(environment[key])) ||
      !['viewportWidth', 'viewportHeight', 'fontScale', 'payloadProducts', 'payloadProviders'].every(key => finite(environment[key])) ||
      !nullableNumber(report.environment.totalMemoryBytes) ||
      !['developmentBuild', 'detailsLoaded', 'historyLoaded', 'productHistoryLoaded', 'diagnosticsUploadEnabled'].every(key => typeof environment[key] === 'boolean') ||
      !['networkConnected', 'networkInternetReachable'].every(key => environment[key] === null || typeof environment[key] === 'boolean') ||
      !Array.isArray(report.routeAggregates) || !report.routeAggregates.every(route => object(route) && typeof route.journeyId === 'string' && typeof route.label === 'string' &&
        ['coldStatus', 'warmStatus'].every(key => ['pass', 'warn', 'fail', 'skipped'].includes(String(route[key]))) &&
        ['coldForwardMs', 'warmForwardMs', 'coldBackMs', 'warmBackMs', 'forwardChangeMs', 'backChangeMs'].every(key => typeof route[key] === 'number' && Number.isFinite(route[key]))) ||
      !Array.isArray(report.limitations) || !report.limitations.every(item => typeof item === 'string') ||
      !Array.isArray(report.checks) || !report.checks.every(check => object(check) && typeof check.id === 'string' && typeof check.label === 'string' &&
        ['pass', 'warn', 'fail', 'skipped'].includes(check.status) && ['journey', 'runtime', 'storage', 'network', 'data', 'update'].includes(check.kind) &&
        nullableNumber(check.durationMs) && object(check.metrics) && Object.values(check.metrics).every(metric => metric === null ||
          ['string', 'boolean'].includes(typeof metric) || (typeof metric === 'number' && Number.isFinite(metric))))) {
    throw new Error('The saved completed audit is invalid.');
  }
  return report;
}
