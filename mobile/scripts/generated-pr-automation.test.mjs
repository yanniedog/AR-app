#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionRequiredRunIds,
  approveActionRequiredRuns,
  waitForPullRequestMerge,
} from '../../scripts/lib/generated-pr-automation.mjs';

test('actionRequiredRunIds selects only approvable workflow runs', () => {
  assert.deepEqual(
    actionRequiredRunIds([
      { databaseId: 11, conclusion: 'action_required' },
      { databaseId: 12, conclusion: 'success' },
      { databaseId: '13', conclusion: 'action_required' },
    ]),
    [11, 13],
  );
});

test('approveActionRequiredRuns approves each blocked run only once', async () => {
  const approved = [];
  const seenRunIds = new Set();
  const listRuns = async () => [
    { databaseId: 21, conclusion: 'action_required' },
    { databaseId: 22, conclusion: 'action_required' },
  ];
  const first = await approveActionRequiredRuns({
    listRuns,
    approveRun: async (runId) => approved.push(runId),
    seenRunIds,
  });
  const second = await approveActionRequiredRuns({
    listRuns,
    approveRun: async (runId) => approved.push(runId),
    seenRunIds,
  });
  assert.deepEqual(first, [21, 22]);
  assert.deepEqual(second, []);
  assert.deepEqual(approved, [21, 22]);
});

test('waitForPullRequestMerge checks for late blocked runs until merge', async () => {
  const states = ['OPEN', 'OPEN', 'MERGED'];
  const observedAttempts = [];
  await assert.doesNotReject(
    waitForPullRequestMerge({
      beforeRead: async (attempt) => observedAttempts.push(attempt),
      readState: async () => states.shift(),
      sleep: async () => {},
    }),
  );
  assert.deepEqual(observedAttempts, [1, 2, 3]);
});

test('waitForPullRequestMerge rejects a closed unmerged PR', async () => {
  await assert.rejects(
    waitForPullRequestMerge({
      readState: async () => 'CLOSED',
      sleep: async () => {},
    }),
    /closed without merging/,
  );
});
