import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { nextApkBuildVersion, nextVersionCode } = require('./android-release-version-pure.cjs');

test('every APK advances the visible app patch beyond both release floors', () => {
  assert.equal(nextApkBuildVersion('1.0.88', null), '1.0.89');
  assert.equal(nextApkBuildVersion('1.0.90', '1.0.89'), '1.0.91');
  assert.equal(nextApkBuildVersion('1.0.88', '1.0.92'), '1.0.93');
});

test('every APK advances Android versionCode beyond local and published floors', () => {
  assert.equal(nextVersionCode(192, null), 193);
  assert.equal(nextVersionCode(205, 200), 206);
  assert.equal(nextVersionCode(192, 205), 206);
  assert.equal(nextVersionCode(192, 205, 300), 300);
});
