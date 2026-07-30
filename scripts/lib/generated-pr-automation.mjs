import { setTimeout as delay } from 'node:timers/promises';

export function createHeadScopedRunTracker({ fallbackAttempt = 4 } = {}) {
  let headSha = '';
  let attemptsForHead = 0;
  let fallbackChecked = false;
  const seenRunIds = new Set();

  return {
    observe(nextHeadSha) {
      const normalizedHeadSha = String(nextHeadSha || '').trim();
      if (!normalizedHeadSha) throw new Error('generated pull request head SHA is required');
      const headChanged = Boolean(headSha) && normalizedHeadSha !== headSha;
      if (normalizedHeadSha !== headSha) {
        headSha = normalizedHeadSha;
        attemptsForHead = 0;
        fallbackChecked = false;
        seenRunIds.clear();
      }
      attemptsForHead += 1;
      return {
        headSha,
        headChanged,
        seenRunIds,
        shouldCheckFallback: !fallbackChecked && attemptsForHead >= fallbackAttempt,
      };
    },
    markFallbackChecked() {
      fallbackChecked = true;
    },
  };
}

export function workflowRunsForHead(runs, expectedHeadSha) {
  const headSha = String(expectedHeadSha || '').trim();
  if (!headSha) return [];
  return (Array.isArray(runs) ? runs : []).filter((run) => run?.headSha === headSha);
}

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
  maxHeadChanges = 5,
}) {
  let remaining = attempts;
  let poll = 0;
  let headChanges = 0;
  while (remaining > 0) {
    poll += 1;
    remaining -= 1;
    const beforeResult = await beforeRead(poll);
    if (beforeResult?.resetWait && headChanges < maxHeadChanges) {
      headChanges += 1;
      // The current poll is the first observation of the new head. Replenish
      // the rest of its full poll budget so fallback and required CI have time.
      remaining = Math.max(0, attempts - 1);
    }
    const state = String(await readState()).trim().toUpperCase();
    if (state === 'MERGED') return true;
    if (state === 'CLOSED') {
      throw new Error('generated pull request closed without merging');
    }
    if (remaining > 0) await sleep(intervalMs);
  }
  throw new Error('generated pull request did not merge before the timeout');
}
