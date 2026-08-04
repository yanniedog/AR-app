#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARM_RELEASE_ABIS,
  ARM_ROLLING_TAG,
  expectedAbisForApkChannel,
  qrReleaseUrl,
  resolveApkRollingTag,
  versionTagForApkChannel,
} from './app-release-meta.mjs';
import { buildReadmeInstallSection } from './update-readme-app-install.mjs';
import {
  pushBranchWithGhAuth,
  readmeApkQrBranchName,
  readmeApkQrCommitMessage,
} from './publish-readme-app-install.mjs';

test('qrReleaseUrl appends build cache-bust query', () => {
  const url = qrReleaseUrl('owner/repo', 'app-apk-latest', { bust: '42' });
  assert.equal(
    url,
    'https://github.com/owner/repo/releases/download/app-apk-latest/app-preview-qr.png?v=42',
  );
});

test('release publisher accepts only the universal and ARM rolling channels', () => {
  assert.equal(resolveApkRollingTag(undefined), 'app-apk-latest');
  assert.equal(resolveApkRollingTag(ARM_ROLLING_TAG), 'app-apk-arm-latest');
  assert.throws(() => resolveApkRollingTag('attacker-controlled-tag'), /unsupported APK rolling tag/i);
  assert.equal(versionTagForApkChannel('1.2.3', undefined), 'app-v1.2.3');
  assert.equal(versionTagForApkChannel('1.2.3', ARM_ROLLING_TAG), 'app-arm-v1.2.3');
  assert.deepEqual(
    expectedAbisForApkChannel(ARM_ROLLING_TAG, ['arm64-v8a', 'x86_64']),
    ARM_RELEASE_ABIS,
  );
  assert.deepEqual(
    expectedAbisForApkChannel(undefined, ['arm64-v8a', 'x86_64']),
    ['arm64-v8a', 'x86_64'],
  );
});

test('buildReadmeInstallSection embeds cache-busted QR from manifest', () => {
  const section = buildReadmeInstallSection({
    repo: 'owner/repo',
    manifestPath: undefined,
  });
  assert.match(section, /!\[Install QR\]\(https:\/\/github\.com\/owner\/repo\/releases\/download\/app-apk-latest\/app-preview-qr\.png\?v=/);
  assert.match(section, /<!-- app-android-install:start -->/);
  assert.match(section, /<!-- app-android-install:end -->/);
});

test('readme APK QR commit message and branch are deterministic', () => {
  assert.equal(
    readmeApkQrCommitMessage('1.0.13', '27'),
    'docs: refresh Android install QR (v1.0.13 build 27)',
  );
  assert.equal(readmeApkQrBranchName('1.0.13', '27'), 'chore/readme-apk-qr-v1.0.13-b27');
});

test('README branch publisher configures the GitHub CLI credential helper before push', () => {
  const calls = [];
  pushBranchWithGhAuth('chore/readme-apk-qr-v1.0.13-b27', {
    authenticate: (args) => calls.push(['gh', ...args]),
    runGit: (args) => calls.push(['git', ...args]),
  });
  assert.deepEqual(calls, [
    ['gh', 'auth', 'setup-git'],
    ['git', 'push', '-u', 'origin', 'chore/readme-apk-qr-v1.0.13-b27', '--force-with-lease'],
  ]);
});
