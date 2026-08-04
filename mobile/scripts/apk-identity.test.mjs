import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  assertExpectedAbis,
  assertExpectedSigningCertificate,
  parseAaptBadging,
  parseApksignerCertificateSha256,
} from './apk-identity.mjs';

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
  const expected = ['armeabi-v7a', 'arm64-v8a'];
  assert.doesNotThrow(() => assertExpectedAbis([...expected].reverse(), expected));
  assert.throws(() => assertExpectedAbis([...expected, 'x86_64'], expected), /APK ABI mismatch/i);
  assert.throws(() => assertExpectedAbis([], expected), /APK ABI mismatch/i);
});

test('scopes ARM release architectures to native and EAS preview APK builds', () => {
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
    ['armeabi-v7a', 'arm64-v8a'],
  );
  const expected = releaseIdentity.android_release_abis.join(',');
  assert.equal(buildProperties?.android?.buildArchs, undefined);
  assert.equal(
    easJson.build.preview.android.gradleCommand,
    `:app:assembleRelease -PreactNativeArchitectures=${expected}`,
  );
  assert.equal(easJson.build.development.android.gradleCommand, undefined);
  assert.equal(easJson.build.production.android.gradleCommand, undefined);
  const workflow = readFileSync(
    new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, new RegExp(`-PreactNativeArchitectures=${expected}`));
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
