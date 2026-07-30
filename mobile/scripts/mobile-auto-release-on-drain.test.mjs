#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkedGhOutput,
  ensureApkForMainHead,
  hasApkBuildInFlight,
  pushBranchWithGhAuth,
  waitForQueueDrain,
} from './mobile-auto-release-on-drain.mjs';
import { requiredPrCheckDispatches } from '../../scripts/lib/required-pr-check-dispatch.mjs';

test('checkedGhOutput returns trimmed stdout for a successful command', () => {
  assert.equal(checkedGhOutput({ status: 0, stdout: '[]\n', stderr: '' }, ['pr', 'list']), '[]');
});

test('checkedGhOutput surfaces command and spawn failures', () => {
  assert.throws(
    () => checkedGhOutput({ status: 1, stdout: '', stderr: 'denied' }, ['pr', 'list']),
    /gh pr list failed: denied/,
  );
  assert.throws(
    () =>
      checkedGhOutput(
        { status: null, stdout: '', stderr: '', error: new Error('timed out') },
        ['pr', 'list'],
      ),
    /gh pr list failed to execute: timed out/,
  );
});

test('pushBranchWithGhAuth configures the GitHub CLI credential helper before push', () => {
  const calls = [];
  pushBranchWithGhAuth('chore/mobile-auto-release-v1.2.3', {
    authenticate: (args) => calls.push(['gh', ...args]),
    runGit: (args) => calls.push(['git', ...args]),
  });
  assert.deepEqual(calls, [
    ['gh', 'auth', 'setup-git'],
    ['git', 'push', '-u', 'origin', 'chore/mobile-auto-release-v1.2.3', '--force-with-lease'],
  ]);
});

test('generated PRs dispatch required checks only when PR-event runs are missing', () => {
  assert.deepEqual(requiredPrCheckDispatches(72, 'chore/mobile-auto-release-v1.2.3'), [
    { workflow: 'app-ci.yml', ref: 'chore/mobile-auto-release-v1.2.3', inputs: [] },
    {
      workflow: 'pr-bot-feedback-check.yml',
      ref: 'chore/mobile-auto-release-v1.2.3',
      inputs: ['-f', 'pr_number=72'],
    },
  ]);
  assert.deepEqual(
    requiredPrCheckDispatches(
      72,
      'chore/mobile-auto-release-v1.2.3',
      ['app-ci'],
    ),
    [
      {
        workflow: 'pr-bot-feedback-check.yml',
        ref: 'chore/mobile-auto-release-v1.2.3',
        inputs: ['-f', 'pr_number=72'],
      },
    ],
  );
  assert.deepEqual(
    requiredPrCheckDispatches(
      72,
      'chore/mobile-auto-release-v1.2.3',
      ['app-ci', 'pr-bot-feedback-check'],
    ),
    [],
  );
});

test('waitForQueueDrain refreshes main after a queued PR closes', async () => {
  const openCounts = [1, 0];
  let syncCount = 0;

  const remaining = await waitForQueueDrain({
    countOpen: () => openCounts.shift() ?? 0,
    sleep: async () => {},
    syncAfterDrain: () => {
      syncCount += 1;
    },
  });

  assert.equal(remaining, 0);
  assert.equal(syncCount, 1);
});

test('waitForQueueDrain skips without refreshing when multiple PRs remain', async () => {
  let syncCount = 0;

  const remaining = await waitForQueueDrain({
    countOpen: () => 2,
    sleep: async () => {},
    syncAfterDrain: () => {
      syncCount += 1;
    },
  });

  assert.equal(remaining, 2);
  assert.equal(syncCount, 0);
});

test('hasApkBuildInFlight matches only the exact versioned main head', () => {
  const runs = [
    { headSha: 'older', status: 'in_progress' },
    { headSha: 'target', status: 'completed' },
  ];
  assert.equal(hasApkBuildInFlight(runs, 'target'), false);
  assert.equal(
    hasApkBuildInFlight([...runs, { headSha: 'target', status: 'queued' }], 'target'),
    true,
  );
});

test('ensureApkForMainHead dispatches when the version has no published APK', () => {
  const dispatched = [];
  const checkedHeads = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.40',
    readHeadSha: () => 'abc1234',
    releaseExists: () => false,
    buildInFlight: (headSha) => {
      checkedHeads.push(headSha);
      return false;
    },
    dispatch: (v) => dispatched.push(v),
  });
  assert.equal(did, true);
  assert.deepEqual(checkedHeads, ['abc1234']);
  assert.deepEqual(dispatched, ['1.0.40']);
});

test('ensureApkForMainHead is a no-op when the APK is already published', () => {
  let dispatchedCount = 0;
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.29',
    readHeadSha: () => 'abc1234',
    releaseExists: (v) => v === '1.0.29',
    buildInFlight: () => false,
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.equal(dispatchedCount, 0);
});

test('ensureApkForMainHead skips dispatch when a build is already in flight', () => {
  let dispatchedCount = 0;
  const checkedHeads = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.41',
    readHeadSha: () => 'def5678',
    releaseExists: () => false,
    buildInFlight: (headSha) => {
      checkedHeads.push(headSha);
      return true;
    },
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.deepEqual(checkedHeads, ['def5678']);
  assert.equal(dispatchedCount, 0);
});
