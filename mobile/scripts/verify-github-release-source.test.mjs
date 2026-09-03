#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReleaseSourceSnapshot } from './verify-github-release-source.mjs';

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
