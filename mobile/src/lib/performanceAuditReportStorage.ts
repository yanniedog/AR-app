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
  await writes.catch(() => {});
  let report: PerformanceAuditReport;
  if ((await FileSystem.getInfoAsync(FILE)).exists) {
    report = JSON.parse(await FileSystem.readAsStringAsync(FILE));
  } else {
    // Recover audits completed before the dedicated recovery file was added.
    const previous = `${FileSystem.documentDirectory}logs/ar-performance-audit-latest.json`;
    if (!(await FileSystem.getInfoAsync(previous)).exists) return null;
    const stored = JSON.parse(await FileSystem.readAsStringAsync(previous));
    if (typeof stored.summaryMarker !== 'string' || stored.summaryMarker.includes('partial=true') ||
        typeof stored.reportJson !== 'string') return null;
    report = JSON.parse(stored.reportJson);
  }
  if (report.schemaVersion !== PERFORMANCE_AUDIT_SCHEMA_VERSION || typeof report.sessionId !== 'string' ||
      !report.app || !report.environment || !report.summary || !report.watchdog ||
      !Array.isArray(report.checks) || !report.checks.every(check => check && typeof check.id === 'string' && check.metrics)) {
    throw new Error('The saved completed audit is invalid.');
  }
  return report;
}
