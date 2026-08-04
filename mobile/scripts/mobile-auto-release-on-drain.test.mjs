#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkedGhOutput,
  ensureApkForMainHead,
  hasApkBuildInFlight,
  nextAutoReleaseVersion,
  pushBranchWithGhAuth,
  readPublishedVersion,
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

test('auto-release advances from the published APK instead of a stale source version', () => {
  assert.equal(nextAutoReleaseVersion('1.0.44', '1.0.77'), '1.0.78');
  assert.equal(nextAutoReleaseVersion('1.0.78', '1.0.77'), '1.0.78');
});

test('auto-release reads the ARM channel after the universal transition', async () => {
  let requestedUrl = '';
  const published = await readPublishedVersion(async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ version: '1.0.85' }) };
  });

  assert.equal(published, '1.0.85');
  assert.match(requestedUrl, /\/releases\/download\/app-apk-arm-latest\/app-apk-latest\.json/);
});

test('first ARM auto-release uses the universal manifest as its version floor', async () => {
  const requestedUrls = [];
  const published = await readPublishedVersion(async (url) => {
    requestedUrls.push(url);
    if (url.includes('/app-apk-arm-latest/')) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ version: '1.0.84' }) };
  });

  assert.equal(published, '1.0.84');
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /\/app-apk-arm-latest\//);
  assert.match(requestedUrls[1], /\/app-apk-latest\//);
  assert.equal(nextAutoReleaseVersion('1.0.84', published), '1.0.85');
});

test('rolling-manifest failures fall back to the checked-in release floor', async () => {
  const warnings = [];
  const missing = await readPublishedVersion(
    async () => ({ ok: false, status: 404 }),
    { warn: (message) => warnings.push(message) },
  );
  const malformed = await readPublishedVersion(
    async () => ({ ok: true, json: async () => ({ version: 'not-semver' }) }),
    { warn: (message) => warnings.push(message) },
  );

  assert.equal(missing, null);
  assert.equal(malformed, null);
  assert.equal(warnings.length, 2);
  assert.equal(nextAutoReleaseVersion('1.0.79', missing), '1.0.79');
});

test('rolling-manifest reads abort after the configured timeout', async () => {
  const published = await readPublishedVersion(
    async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    { timeoutMs: 1, warn: () => {} },
  );

  assert.equal(published, null);
});
