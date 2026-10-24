import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';
import { allocateApkBuildIdentity, validateReusedReleaseIdentity } from './bump-android-version-code.mjs';

test('a generated version survives the universal build and exact ARM pairing', () => {
  const universal = allocateApkBuildIdentity({ version: '1.0.247', versionCode: 192,
    remoteVersion: '1.0.246', remoteCode: 302, useCheckedInVersion: true });
  assert.deepEqual(universal, { version: '1.0.247', versionCode: 303 });
  assert.deepEqual(validateReusedReleaseIdentity({ ...universal,
    baseVersion: '1.0.247', baseVersionCode: 192, allowCheckedInVersion: true }), universal);
  assert.equal(allocateApkBuildIdentity({ version: '1.0.247', versionCode: 192,
    remoteVersion: '1.0.246', remoteCode: 302 }).version, '1.0.248');
});

test('paired allocation remains newer than publication and honors the workflow build floor', () => {
  assert.deepEqual(allocateApkBuildIdentity({ version: '1.0.247', versionCode: 192,
    remoteVersion: '1.0.246', remoteCode: 302, runFloor: 400, useCheckedInVersion: true }),
  { version: '1.0.247', versionCode: 400 });
  for (const version of ['1.0.246', '1.0.247']) {
    assert.throws(() => allocateApkBuildIdentity({ version, versionCode: 192,
      remoteVersion: '1.0.247', remoteCode: 303, useCheckedInVersion: true }), /newer than the published/);
  }
});

test('explicit checked-in pairing cannot roll back either identity field or omit half the pair', () => {
  for (const [version, versionCode] of [['1.0.246', '303'], ['1.0.247', '191'], ['1.0.248', '192'], ['1.0.247', '']]) {
    assert.throws(() => validateReusedReleaseIdentity({ version, versionCode,
      baseVersion: '1.0.247', baseVersionCode: 192, allowCheckedInVersion: true }));
  }
  assert.throws(() => validateReusedReleaseIdentity({ version: '1.0.247', versionCode: '303',
    baseVersion: '1.0.247', baseVersionCode: 192 }));
});

test('the existing paired dispatch and recovery inputs activate checked-in identity handling', () => {
  const workflow = yaml.load(readFileSync(new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url), 'utf8'));
  const step = workflow.jobs['android-apk'].steps.find(row => row.id === 'release');
  assert.equal(step.env.USE_CHECKED_IN_VERSION, "${{ inputs.follow_with_arm || inputs.release_version != '' }}");
  assert.match(step.run, /if \[ "\$USE_CHECKED_IN_VERSION" = "true" \]; then\s+reuse_args\+=\(--use-checked-in-version\)/);
});
