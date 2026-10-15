import * as FileSystem from 'expo-file-system/legacy';
import { PERFORMANCE_AUDIT_SCHEMA_VERSION } from './performanceAuditSchema';
import type { PerformanceAuditReport } from './performanceAudit';

const FILE = `${FileSystem.documentDirectory ?? ''}logs/ar-performance-audit-completed.json`;
let writes: Promise<void> = Promise.resolve();
let epoch = 0;

/** Separate from the runner's latest sidecar: a cancelled later run cannot
 * overwrite the last completed diagnosis. No part of this local file is public. */
export function saveCompletedPerformanceAudit(report: PerformanceAuditReport): Promise<void> {
  const startedEpoch = epoch;
  const write = writes.catch(() => {}).then(async () => {
    if (!FileSystem.documentDirectory || startedEpoch !== epoch) return;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}logs`, { intermediates: true });
    if (startedEpoch !== epoch) return;
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(report));
  });
  writes = write;
  return write;
}

/** A log Clear waits out pending recovery writes before deleting their file. */
export async function clearCompletedPerformanceAudit(): Promise<void> {
  epoch += 1;
  await writes.catch(() => {});
  if (FileSystem.documentDirectory) await FileSystem.deleteAsync(FILE, { idempotent: true });
}

export async function loadCompletedPerformanceAudit(): Promise<PerformanceAuditReport | null> {
  if (!FileSystem.documentDirectory) return null;
  const startedEpoch = epoch;
  const startedWrites = writes;
  const stillCurrent = () => startedEpoch === epoch && startedWrites === writes;
  await startedWrites.catch(() => {});
  if (!stillCurrent()) return null;
  let primaryError: unknown;
  let primary: PerformanceAuditReport | null = null;
  try {
    if ((await FileSystem.getInfoAsync(FILE)).exists) {
      primary = validateCompletedReport(JSON.parse(await FileSystem.readAsStringAsync(FILE)));
    }
  } catch (error) { primaryError = error; }
  if (!stillCurrent()) return null;
  // Recover pre-upgrade reports and interrupted writes from the canonical sidecar.
  const previous = `${FileSystem.documentDirectory}logs/ar-performance-audit-latest.json`;
  let recovered: PerformanceAuditReport | null = null;
  try {
    if ((await FileSystem.getInfoAsync(previous)).exists) {
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
  if (recovered) {
    // Repair before a later partial run replaces the canonical sidecar. A write
    // failure must not hide the diagnosis which can still be reviewed in memory.
    const repair = saveCompletedPerformanceAudit(recovered);
    await repair.catch(() => {});
    return startedEpoch === epoch && writes === repair ? recovered : null;
  }
  if (primary) return primary;
  if (primaryError) throw primaryError;
  return null;
}

function validateCompletedReport(value: unknown): PerformanceAuditReport {
  if (!value || typeof value !== 'object') throw new Error('The saved completed audit is invalid.');
  const report = value as PerformanceAuditReport;
  if (report.schemaVersion !== PERFORMANCE_AUDIT_SCHEMA_VERSION || typeof report.sessionId !== 'string' ||
      !report.app || !report.environment || !report.summary || !report.watchdog ||
      !Array.isArray(report.checks) || !report.checks.every(check => check && typeof check.id === 'string' && check.metrics)) {
    throw new Error('The saved completed audit is invalid.');
  }
  return report;
}
