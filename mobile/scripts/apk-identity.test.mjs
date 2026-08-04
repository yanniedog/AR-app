import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  assertExpectedAbis,
  assertExpectedSigningCertificate,
  parseAaptBadging,
  parseApksignerCertificateSha256,
} from './apk-identity.mjs';
import {
  fetchRemoteManifest,
  releaseFloorTags,
} from './bump-android-version-code.mjs';

test('parses the package and version identity reported by aapt', () => {
  assert.deepEqual(
    parseAaptBadging([
      "package: name='com.eyex.australianrates' versionCode='196' versionName='1.0.83' platformBuildVersionName='15'",
      "native-code: 'armeabi-v7a' 'arm64-v8a'",
    ].join('\n')),
    {
      packageName: 'com.eyex.australianrates',
      versionCode: '196',
      versionName: '1.0.83',
      supportedAbis: ['armeabi-v7a', 'arm64-v8a'],
    },
  );
});

test('requires exactly the configured release ABIs', () => {
  const expected = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
  assert.doesNotThrow(() => assertExpectedAbis([...expected].reverse(), expected));
  assert.throws(() => assertExpectedAbis(expected.slice(0, 2), expected), /APK ABI mismatch/i);
  assert.throws(() => assertExpectedAbis([], expected), /APK ABI mismatch/i);
});

test('reports a missing rolling-tag CLI value explicitly', () => {
  const script = fileURLToPath(new URL('./bump-android-version-code.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--rolling-tag'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --rolling-tag/);
});

test('bounds each release-floor manifest request independently', async () => {
  await assert.rejects(
    () => fetchRemoteManifest(
      'owner/repo',
      'app-apk-arm-latest',
      5,
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    ),
    /manifest request timed out/i,
  );

  const universal = await fetchRemoteManifest(
    'owner/repo',
    'app-apk-latest',
    5,
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ version: '1.0.84', build_number: '205' }),
    }),
  );
  assert.deepEqual(universal, { version: '1.0.84', buildNumber: 205 });
  assert.deepEqual(
    releaseFloorTags('app-apk-arm-latest'),
    ['app-apk-arm-latest', 'app-apk-latest'],
  );
  assert.deepEqual(
    releaseFloorTags('app-apk-latest'),
    ['app-apk-latest', 'app-apk-arm-latest'],
  );
});

test('rejects a missing rolling tag before generating changelog metadata', () => {
  const script = fileURLToPath(new URL('./ensure-changelog-entry.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--rolling-tag'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --rolling-tag/);
});

test('keeps universal trust while scoping preview APK builds to ARM', () => {
  const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const easJson = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const releaseIdentity = JSON.parse(
    readFileSync(new URL('../release-identity.json', import.meta.url), 'utf8'),
  );
  const buildProperties = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  )?.[1];
  assert.deepEqual(
    releaseIdentity.android_release_abis,
    ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
  );
  assert.equal(buildProperties?.android?.buildArchs, undefined);
  assert.equal(
    easJson.build.preview.android.gradleCommand,
    ':app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a',
  );
  assert.equal(easJson.build.development.android.gradleCommand, undefined);
  assert.equal(easJson.build.production.android.gradleCommand, undefined);
  const workflow = readFileSync(
    new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /default: arm/);
  assert.match(workflow, /if \[ "\$APK_CHANNEL" = "arm" \]; then/);
  assert.match(workflow, /-PreactNativeArchitectures=armeabi-v7a,arm64-v8a/);
  assert.match(workflow, /--rolling-tag "\$rolling_tag"/);
  assert.match(workflow, /inputs\.apk_channel == 'universal'/);
  assert.match(workflow, /Bridge legacy AR-local APK update channel/);
  assert.match(workflow, /Publish README Android install QR section/);

  const easWorkflow = readFileSync(
    new URL('../../.github/workflows/mobile-eas-build.yml', import.meta.url),
    'utf8',
  );
  assert.match(easWorkflow, /--rolling-tag app-apk-arm-latest/);
  assert.equal(easWorkflow.match(/--rolling-tag app-apk-arm-latest/g)?.length, 2);
});

test('normalizes exactly one apksigner certificate digest', () => {
  const digest = 'AA:'.repeat(31) + 'AA';
  assert.equal(
    parseApksignerCertificateSha256(`Signer #1 certificate SHA-256 digest: ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`Certificate SHA 256 digest = ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`Certificate SHA-256 digest: ${'bb '.repeat(32)}`),
    'bb'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`V2 Signer: certificate SHA-256 digest: ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256([
      `Signer #1 certificate SHA-256 digest: ${digest}`,
      `Source Stamp Signer certificate SHA-256 digest: ${'cc:'.repeat(31)}cc`,
    ].join('\n')),
    'aa'.repeat(32),
  );
  assert.throws(() => parseApksignerCertificateSha256('Verified'), /exactly one/i);
});

test('requires the pinned release signing certificate', () => {
  const trusted = '5f9ab77ef2b0c68307d652abe28dfa96690851af1a28353bb84d277ef83682c1';
  assert.doesNotThrow(() => assertExpectedSigningCertificate(trusted.toUpperCase(), trusted));
  assert.throws(
    () => assertExpectedSigningCertificate('a'.repeat(64), trusted),
    /signing certificate mismatch/i,
  );
});
