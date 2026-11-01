import * as FileSystem from 'expo-file-system/legacy';
import { mergeAuditMetricRuns, parseAuditMetricHistory, type AuditMetricRun } from './auditMetricHistory';

const FILE = `${FileSystem.documentDirectory ?? ''}logs/ar-audit-metric-history.json`;
const TEMP = `${FILE}.tmp`;

// Callers serialize reads/writes/clear with the completed-report transaction.
export async function readAuditMetricHistory(): Promise<AuditMetricRun[]> {
  if (!FileSystem.documentDirectory) return [];
  let rows: AuditMetricRun[] = [];
  let found = false;
  let failure: unknown;
  for (const file of [FILE, TEMP]) {
    try {
      if (!(await FileSystem.getInfoAsync(file)).exists) continue;
      rows = mergeAuditMetricRuns(rows, parseAuditMetricHistory(await FileSystem.readAsStringAsync(file)));
      found = true;
    } catch (error) { failure = error; }
  }
  if (!found && failure) throw failure;
  return rows;
}

export async function appendAuditMetricHistory(additions: AuditMetricRun[]): Promise<void> {
  const runs = mergeAuditMetricRuns(await readAuditMetricHistory(), additions);
  await FileSystem.writeAsStringAsync(TEMP, JSON.stringify({ schemaVersion: 1, runs }));
  await FileSystem.moveAsync({ from: TEMP, to: FILE });
}

export async function deleteAuditMetricHistory(): Promise<void> {
  await FileSystem.deleteAsync(FILE, { idempotent: true });
  await FileSystem.deleteAsync(TEMP, { idempotent: true });
}
