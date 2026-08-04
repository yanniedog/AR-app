import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertApkSizeBudget,
  collectArtifactSizes,
  evaluateArtifactBudgets,
} from './report-artifact-sizes.mjs';

test('collects platform bundles, assets, fonts, and an optional APK', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ar-app-sizes-'));
  try {
    const dist = path.join(root, 'dist');
    await mkdir(path.join(dist, '_expo/static/js/android'), { recursive: true });
    await mkdir(path.join(dist, '_expo/static/js/ios'), { recursive: true });
    await mkdir(path.join(dist, '_expo/static/js/web'), { recursive: true });
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await writeFile(path.join(dist, '_expo/static/js/android/app.hbc'), Buffer.alloc(100));
    await writeFile(path.join(dist, '_expo/static/js/ios/app.hbc'), Buffer.alloc(110));
    await writeFile(path.join(dist, '_expo/static/js/web/app.js'), Buffer.alloc(120));
    await writeFile(path.join(dist, 'assets/icon.png'), Buffer.alloc(30));
    await writeFile(path.join(dist, 'assets/font.ttf'), Buffer.alloc(40));
    const apk = path.join(root, 'app.apk');
    await writeFile(apk, Buffer.alloc(200));

    const report = await collectArtifactSizes({ distDir: dist, apkPaths: [apk] });
    assert.equal(report.androidBundleBytes, 100);
    assert.equal(report.iosBundleBytes, 110);
    assert.equal(report.webBundleBytes, 120);
    assert.equal(report.assetBytes, 70);
    assert.equal(report.fontBytes, 40);
    assert.equal(report.apkBytes, 200);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails only metrics that grow beyond the configured tolerance', () => {
  const budget = {
    maximumGrowthFraction: 0.05,
    baseline: { androidBundleBytes: 100, apkBytes: 200 },
  };
  assert.deepEqual(
    evaluateArtifactBudgets({ androidBundleBytes: 105, apkBytes: null }, budget),
    [],
  );
  assert.deepEqual(
    evaluateArtifactBudgets({ androidBundleBytes: 106, apkBytes: 211 }, budget),
    [
      { metric: 'androidBundleBytes', actual: 106, baseline: 100, maximum: 105 },
      { metric: 'apkBytes', actual: 211, baseline: 200, maximum: 210 },
    ],
  );
});

test('enforces the APK budget for every publisher path', () => {
  const budget = { maximumGrowthFraction: 0.05, baseline: { apkBytes: 200 } };
  assert.doesNotThrow(() => assertApkSizeBudget(210, budget));
  assert.throws(() => assertApkSizeBudget(211, budget), /APK size 211 bytes exceeds 210 bytes/i);
});
