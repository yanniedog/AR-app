import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertExpectedSigningCertificate,
  parseAaptBadging,
  parseApksignerCertificateSha256,
} from './apk-identity.mjs';

test('parses the package and version identity reported by aapt', () => {
  assert.deepEqual(
    parseAaptBadging("package: name='com.eyex.australianrates' versionCode='195' versionName='1.0.82' platformBuildVersionName='15'"),
    {
      packageName: 'com.eyex.australianrates',
      versionCode: '195',
      versionName: '1.0.82',
    },
  );
});

test('normalizes exactly one apksigner certificate digest', () => {
  const digest = 'AA:'.repeat(31) + 'AA';
  assert.equal(
    parseApksignerCertificateSha256(`Signer #1 certificate SHA-256 digest: ${digest}`),
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
