import { setTimeout as delay } from 'node:timers/promises';

export function actionRequiredRunIds(runs) {
  return (Array.isArray(runs) ? runs : [])
    .filter((run) => run?.conclusion === 'action_required')
    .map((run) => Number(run.databaseId))
    .filter(Number.isFinite);
}

export async function approveActionRequiredRuns({
  listRuns,
  approveRun,
  seenRunIds = new Set(),
}) {
  const runIds = actionRequiredRunIds(await listRuns()).filter((runId) => !seenRunIds.has(runId));
  for (const runId of runIds) {
    await approveRun(runId);
    seenRunIds.add(runId);
  }
  return runIds;
}

export async function waitForPullRequestMerge({
  readState,
  beforeRead = async () => {},
  sleep = delay,
  attempts = 90,
  intervalMs = 10_000,
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await beforeRead(attempt);
    const state = String(await readState()).trim().toUpperCase();
    if (state === 'MERGED') return true;
    if (state === 'CLOSED') {
      throw new Error('generated pull request closed without merging');
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new Error('generated pull request did not merge before the timeout');
}
