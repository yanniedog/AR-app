#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateReleaseSourceSnapshot,
  verifyGithubReleaseSource,
} from './verify-github-release-source.mjs';

const sha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const pull = {
  number: 42,
  merged_at: '2026-09-03T00:00:00Z',
  merge_commit_sha: sha,
  base: { ref: 'main' },
  head: { sha: headSha },
};

test('accepts only current main from a merged PR with both required PR gates', () => {
  const result = validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: sha,
    pulls: [pull],
    checkRuns: [
      { name: 'mobile-ci', conclusion: 'success' },
      { name: 'bot-feedback-gate', conclusion: 'success' },
    ],
  });
  assert.equal(result.pull.number, 42);
  assert.deepEqual(result.missingChecks, []);
});

test('rejects a selected branch and reports incomplete PR gates', () => {
  assert.throws(() => validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: 'c'.repeat(40),
    pulls: [pull],
    checkRuns: [],
  }), /not the current main/i);
  const result = validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: sha,
    pulls: [pull],
    checkRuns: [{ name: 'mobile-ci', conclusion: 'success' }],
  });
  assert.deepEqual(result.missingChecks, ['bot-feedback-gate']);
});

test('retries transient commit-to-PR association lag before reading checks', async () => {
  let pullReads = 0;
  let sleeps = 0;
  const result = await verifyGithubReleaseSource({
    repo: 'owner/repo',
    requestedSha: sha,
    attempts: 2,
    sleep: async () => { sleeps += 1; },
    readJson: async (_repo, path) => {
      if (path === '/git/ref/heads/main') return { object: { sha } };
      if (path === `/commits/${sha}/pulls`) {
        pullReads += 1;
        return pullReads === 1 ? [] : [pull];
      }
      if (path === `/commits/${headSha}/check-runs?per_page=100`) {
        return {
          check_runs: [
            { name: 'mobile-ci', conclusion: 'success' },
            { name: 'bot-feedback-gate', conclusion: 'success' },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  });

  assert.equal(result.pull.number, 42);
  assert.equal(pullReads, 2);
  assert.equal(sleeps, 1);
});

test('fails immediately when main advances instead of retrying stale source', async () => {
  let reads = 0;
  await assert.rejects(
    () => verifyGithubReleaseSource({
      repo: 'owner/repo',
      requestedSha: sha,
      attempts: 3,
      sleep: async () => {},
      readJson: async () => {
        reads += 1;
        return { object: { sha: 'c'.repeat(40) } };
      },
    }),
    /not the current main/i,
  );
  assert.equal(reads, 1);
});
