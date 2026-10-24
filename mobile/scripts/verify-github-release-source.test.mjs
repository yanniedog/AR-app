#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  latestCheckRunsByName,
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

test('accepts reviewed main from a merged PR with both required PR gates', () => {
  const result = validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: sha,
    pulls: [pull],
    checkRuns: [
      { name: 'mobile-ci', status: 'completed', conclusion: 'success' },
      { name: 'bot-feedback-gate', status: 'completed', conclusion: 'success' },
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
  }), /not a reviewed commit in main/i);
  const result = validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: sha,
    pulls: [pull],
    checkRuns: [{ name: 'mobile-ci', status: 'completed', conclusion: 'success' }],
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
      if (path === `/commits/${headSha}/check-runs?per_page=100&filter=all`) {
        return {
          check_runs: [
            { name: 'mobile-ci', status: 'completed', conclusion: 'success' },
            { name: 'bot-feedback-gate', status: 'completed', conclusion: 'success' },
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

test('uses only the latest run for each required check name', () => {
  const runs = [
    {
      id: 10,
      name: 'mobile-ci',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-09-03T00:00:00Z',
    },
    {
      id: 11,
      name: 'mobile-ci',
      status: 'in_progress',
      conclusion: null,
      started_at: '2026-09-03T00:01:00Z',
    },
    {
      id: 12,
      name: 'bot-feedback-gate',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-09-03T00:01:00Z',
    },
  ];
  expectLatest(runs, 'mobile-ci', 11);
  const result = validateReleaseSourceSnapshot({
    mainSha: sha,
    requestedSha: sha,
    pulls: [pull],
    checkRuns: runs,
  });
  assert.deepEqual(result.missingChecks, ['mobile-ci']);
});

function expectLatest(runs, name, id) {
  assert.equal(latestCheckRunsByName(runs).get(name)?.id, id);
}

test('rejects a source removed from main before reading PR checks', async () => {
  let reads = 0;
  await assert.rejects(
    () => verifyGithubReleaseSource({
      repo: 'owner/repo',
      requestedSha: sha,
      attempts: 3,
      allowAncestor: true,
      sleep: async () => {},
      readJson: async (_repo, path) => {
        reads += 1;
        if (path === '/git/ref/heads/main') return { object: { sha: 'c'.repeat(40) } };
        return { status: 'diverged', merge_base_commit: { sha: 'd'.repeat(40) } };
      },
    }),
    /not a reviewed commit in main/i,
  );
  assert.equal(reads, 2);
});

test('later main merges do not discard a reviewed build', async () => {
  const mainSha = 'c'.repeat(40);
  const result = await verifyGithubReleaseSource({ repo: 'owner/repo', requestedSha: sha, attempts: 1, allowAncestor: true,
    readJson: async (_repo, path) => {
      if (path === '/git/ref/heads/main') return { object: { sha: mainSha } };
      if (path === `/compare/${sha}...${mainSha}`) return { status: 'ahead', merge_base_commit: { sha } };
      if (path === `/commits/${sha}/pulls`) return [pull];
      if (path.includes('/check-runs?')) return { check_runs: [
        { name: 'mobile-ci', status: 'completed', conclusion: 'success' },
        { name: 'bot-feedback-gate', status: 'completed', conclusion: 'success' },
      ] };
      throw new Error(`Unexpected path ${path}`);
    } });
  assert.equal(result.pull.number, 42);
});

test('EAS and other callers retain strict current-main verification by default', async () => {
  await assert.rejects(verifyGithubReleaseSource({ repo: 'owner/repo', requestedSha: sha, attempts: 1,
    readJson: async (_repo, path) => {
      assert.equal(path, '/git/ref/heads/main');
      return { object: { sha: 'c'.repeat(40) } };
    } }), /not the current main/);
});
