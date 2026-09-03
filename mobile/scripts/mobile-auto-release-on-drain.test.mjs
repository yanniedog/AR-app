#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkedGhOutput,
  dispatchApkBuild,
  ensureApkForMainHead,
  hasApkBuildInFlight,
  missingApkChannels,
  nextAutoReleaseVersion,
  pushBranchWithGhAuth,
  readPublishedVersion,
  recoveryIdentityForMissingChannel,
  validatePublishedChannelSnapshot,
  waitForQueueDrain,
} from './mobile-auto-release-on-drain.mjs';
import {
  APK_ASSET,
  INSTALL_HTML,
  MANIFEST_ASSET,
  QR_ASSET,
  ROLLING_TAG,
} from './app-release-meta.mjs';
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

test('hasApkBuildInFlight matches the exact head and every required channel', () => {
  const runs = [
    { headSha: 'older', status: 'in_progress', displayTitle: 'mobile-android-apk (universal+arm)' },
    { headSha: 'target', status: 'completed', displayTitle: 'mobile-android-apk (universal+arm)' },
  ];
  assert.equal(hasApkBuildInFlight(runs, 'target'), false);
  assert.equal(
    hasApkBuildInFlight([
      ...runs,
      { headSha: 'target', status: 'queued', displayTitle: 'mobile-android-apk (universal+arm)' },
    ], 'target'),
    true,
  );
  const armOnly = [
    { headSha: 'target', status: 'in_progress', displayTitle: 'mobile-android-apk (arm)' },
  ];
  assert.equal(hasApkBuildInFlight(armOnly, 'target', ['arm']), true);
  assert.equal(hasApkBuildInFlight(armOnly, 'target', ['universal']), false);
  assert.equal(hasApkBuildInFlight(armOnly, 'target', ['universal', 'arm']), false);
});

test('ensureApkForMainHead dispatches when the version has no published APK', () => {
  const dispatched = [];
  const checkedHeads = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.40',
    readHeadSha: () => 'abc1234',
    readPublishedChannels: () => ({ arm: false, universal: false }),
    buildInFlight: (headSha, channels) => {
      checkedHeads.push([headSha, channels]);
      return false;
    },
    dispatch: (v, channels) => dispatched.push([v, channels]),
  });
  assert.equal(did, true);
  assert.deepEqual(checkedHeads, [['abc1234', ['universal', 'arm']]]);
  assert.deepEqual(dispatched, [['1.0.40', ['universal', 'arm']]]);
});

test('APK release dispatches universal first and lets that run queue ARM', () => {
  const calls = [];
  dispatchApkBuild('1.0.40', ['universal', 'arm'], {
    simulate: false,
    runGh: (args) => calls.push(args),
  });

  assert.deepEqual(calls, [[
    'workflow', 'run', 'mobile-android-apk.yml', '--ref', 'main', '--repo', 'yanniedog/AR-app',
    '-f', 'apk_channel=universal',
    '-f', 'follow_with_arm=true',
  ]]);
});

test('partial APK recovery dispatches only the missing published channel', () => {
  assert.deepEqual(missingApkChannels({ arm: true, universal: false }), ['universal']);
  assert.deepEqual(missingApkChannels({ arm: false, universal: true }), ['arm']);

  const calls = [];
  dispatchApkBuild('1.0.40', ['arm'], {
    simulate: false,
    runGh: (args) => calls.push(args),
    releaseVersion: '1.0.40',
    releaseVersionCode: '152',
  });
  assert.deepEqual(calls, [[
    'workflow', 'run', 'mobile-android-apk.yml', '--ref', 'main', '--repo', 'yanniedog/AR-app',
    '-f', 'apk_channel=arm',
    '-f', 'follow_with_arm=false',
    '-f', 'release_version=1.0.40',
    '-f', 'release_version_code=152',
  ]]);
  assert.throws(
    () => dispatchApkBuild('1.0.40', ['arm'], { simulate: false, runGh: () => {} }),
    /exact surviving version and versionCode/,
  );
});

test('ensureApkForMainHead is a no-op when the APK is already published', () => {
  let dispatchedCount = 0;
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.29',
    readHeadSha: () => 'abc1234',
    readPublishedChannels: () => ({
      arm: { version: '1.0.30', versionCode: 142, sourceSha: 'abc1234' },
      universal: { version: '1.0.30', versionCode: 142, sourceSha: 'abc1234' },
    }),
    buildInFlight: () => false,
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.equal(dispatchedCount, 0);
});

test('partial recovery uses the version actually allocated by the APK workflow', () => {
  const dispatched = [];
  const checked = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.42',
    readHeadSha: () => 'f'.repeat(40),
    readPublishedChannels: () => ({
      arm: null,
      universal: { version: '1.0.43', versionCode: 155, sourceSha: 'f'.repeat(40) },
    }),
    buildInFlight: (head, channels) => {
      checked.push([head, channels]);
      return false;
    },
    dispatch: (version, channels, options) => dispatched.push([version, channels, options]),
  });

  assert.equal(did, true);
  assert.deepEqual(checked, [['f'.repeat(40), ['arm']]]);
  assert.deepEqual(dispatched, [[
    '1.0.43',
    ['arm'],
    { releaseVersion: '1.0.43', releaseVersionCode: '155' },
  ]]);
});

test('current-head channels with conflicting release identities rebuild as a pair', () => {
  const dispatched = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.42',
    readHeadSha: () => 'f'.repeat(40),
    readPublishedChannels: () => ({
      arm: { version: '1.0.43', versionCode: 155, sourceSha: 'f'.repeat(40) },
      universal: { version: '1.0.44', versionCode: 156, sourceSha: 'f'.repeat(40) },
    }),
    buildInFlight: () => false,
    dispatch: (version, channels) => dispatched.push([version, channels]),
  });

  assert.equal(did, true);
  assert.deepEqual(dispatched, [['1.0.42', ['universal', 'arm']]]);
});

test('ensureApkForMainHead skips dispatch when a build is already in flight', () => {
  let dispatchedCount = 0;
  const checkedHeads = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.41',
    readHeadSha: () => 'def5678',
    readPublishedChannels: () => ({ arm: false, universal: false }),
    buildInFlight: (headSha, channels) => {
      checkedHeads.push([headSha, channels]);
      return true;
    },
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.deepEqual(checkedHeads, [['def5678', ['universal', 'arm']]]);
  assert.equal(dispatchedCount, 0);
});

test('ensureApkForMainHead repairs only the missing channel with the surviving identity', () => {
  const dispatched = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.42',
    readHeadSha: () => 'f'.repeat(40),
    readPublishedChannels: () => ({
      arm: { version: '1.0.42', versionCode: 154, sourceSha: 'f'.repeat(40) },
      universal: null,
    }),
    buildInFlight: () => false,
    dispatch: (version, channels, options) => dispatched.push([version, channels, options]),
  });

  assert.equal(did, true);
  assert.deepEqual(dispatched, [[
    '1.0.42',
    ['universal'],
    { releaseVersion: '1.0.42', releaseVersionCode: '154' },
  ]]);
  assert.deepEqual(
    recoveryIdentityForMissingChannel('1.0.42', {
      arm: { version: '1.0.42', versionCode: 154, sourceSha: 'f'.repeat(40) },
      universal: null,
    }, 'f'.repeat(40)),
    { releaseVersion: '1.0.42', releaseVersionCode: '154' },
  );
});

test('partial recovery rebuilds a new pair when the surviving channel came from another source', () => {
  const dispatched = [];
  const checked = [];
  const did = ensureApkForMainHead({
    readVersion: () => '1.0.42',
    readHeadSha: () => 'f'.repeat(40),
    readPublishedChannels: () => ({
      arm: { version: '1.0.42', versionCode: 154, sourceSha: 'e'.repeat(40) },
      universal: null,
    }),
    buildInFlight: (head, channels) => {
      checked.push([head, channels]);
      return false;
    },
    dispatch: (version, channels) => dispatched.push([version, channels]),
  });

  assert.equal(did, true);
  assert.deepEqual(checked, [['f'.repeat(40), ['universal', 'arm']]]);
  assert.deepEqual(dispatched, [['1.0.42', ['universal', 'arm']]]);
});

test('a channel is published only when its rolling manifest and immutable APK agree', () => {
  const version = '1.0.44';
  const repository = 'owner/repo';
  const rollingRelease = {
    tagName: ROLLING_TAG,
    assets: [APK_ASSET, MANIFEST_ASSET, QR_ASSET, INSTALL_HTML]
      .map((name) => ({ name })),
  };
  const versionedRelease = {
    tagName: `app-v${version}`,
    assets: [{ name: APK_ASSET }],
  };
  const manifest = {
    version,
    tag: ROLLING_TAG,
    version_tag: `app-v${version}`,
    repo: repository,
    download_url: `https://github.com/${repository}/releases/download/app-v${version}/${APK_ASSET}`,
    build_number: '156',
    sha256: 'a'.repeat(64),
    bytes: 123,
    source_sha: 'a'.repeat(40),
  };
  const snapshot = {
    version,
    rollingTag: ROLLING_TAG,
    repository,
    rollingRelease,
    versionedRelease,
    manifest,
  };

  assert.equal(validatePublishedChannelSnapshot(snapshot), true);
  assert.equal(validatePublishedChannelSnapshot({
    ...snapshot,
    rollingRelease: {
      ...rollingRelease,
      assets: rollingRelease.assets.filter((asset) => asset.name !== MANIFEST_ASSET),
    },
  }), false);
  assert.equal(validatePublishedChannelSnapshot({
    ...snapshot,
    manifest: { ...manifest, version: '1.0.43' },
  }), false);
  assert.equal(validatePublishedChannelSnapshot({
    ...snapshot,
    versionedRelease: { ...versionedRelease, assets: [] },
  }), false);
});

test('auto-release advances from the published APK instead of a stale source version', () => {
  assert.equal(nextAutoReleaseVersion('1.0.44', '1.0.77'), '1.0.78');
  assert.equal(nextAutoReleaseVersion('1.0.78', '1.0.77'), '1.0.78');
});

test('auto-release reads the ARM channel after the universal transition', async () => {
  const requestedUrls = [];
  const published = await readPublishedVersion(async (url) => {
    requestedUrls.push(url);
    return { ok: true, json: async () => ({ version: '1.0.85' }) };
  });

  assert.equal(published, '1.0.85');
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /\/releases\/download\/app-apk-arm-latest\/app-apk-latest\.json/);
  assert.match(requestedUrls[1], /\/releases\/download\/app-apk-latest\/app-apk-latest\.json/);
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

test('auto-release merges a newer universal floor with an older ARM channel', async () => {
  const published = await readPublishedVersion(async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({
      version: url.includes('/app-apk-arm-latest/') ? '1.0.83' : '1.0.84',
    }),
  }));

  assert.equal(published, '1.0.84');
  assert.equal(nextAutoReleaseVersion('1.0.84', published), '1.0.85');
});

test('ARM manifest timeout fails closed instead of using a stale universal floor', async () => {
  const requestedUrls = [];
  await assert.rejects(
    () => readPublishedVersion(
      async (url, { signal }) => {
        requestedUrls.push(url);
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('arm timed out')), { once: true });
        });
      },
      { timeoutMs: 5, warn: () => {} },
    ),
    /app-apk-arm-latest request timed out/i,
  );
  assert.equal(requestedUrls.length, 1);
});

test('only definitively missing rolling manifests use the checked-in release floor', async () => {
  const warnings = [];
  const missing = await readPublishedVersion(
    async () => ({ ok: false, status: 404 }),
    { warn: (message) => warnings.push(message) },
  );
  await assert.rejects(
    () => readPublishedVersion(
      async () => ({ ok: true, json: async () => ({ version: 'not-semver' }) }),
      { warn: (message) => warnings.push(message) },
    ),
    /x\.y\.z/i,
  );

  assert.equal(missing, null);
  assert.equal(warnings.length, 1);
  assert.equal(nextAutoReleaseVersion('1.0.79', missing), '1.0.79');
});

test('ARM server errors do not fall back to the older universal channel', async () => {
  let requests = 0;
  await assert.rejects(
    () => readPublishedVersion(async () => {
      requests += 1;
      return { ok: false, status: 500 };
    }),
    /app-apk-arm-latest HTTP 500/i,
  );
  assert.equal(requests, 1);
});

test('universal read errors fail closed even after a valid ARM response', async () => {
  let requests = 0;
  await assert.rejects(
    () => readPublishedVersion(async (url) => {
      requests += 1;
      if (url.includes('/app-apk-arm-latest/')) {
        return { ok: true, status: 200, json: async () => ({ version: '1.0.85' }) };
      }
      return { ok: false, status: 500 };
    }),
    /app-apk-latest HTTP 500/i,
  );
  assert.equal(requests, 2);
});

test('rolling-manifest timeouts reject the release decision', async () => {
  await assert.rejects(
    () => readPublishedVersion(
      async (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
      { timeoutMs: 1, warn: () => {} },
    ),
    /request timed out/i,
  );
});
