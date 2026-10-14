import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  REQUIRED_CASES, REQUIRED_INVARIANTS, REQUIRED_JOURNEYS,
  validateAndroidRedesignEvidence, verifyAndroidRedesignEvidence,
} from './verify-android-redesign-evidence.mjs';

// Synthetic records test the validator only. They are never native acceptance evidence.
const expected = {
  sourceSha: 'a'.repeat(40),
  apkSha256: createHash('sha256').update('synthetic APK fixture').digest('hex'),
  packageName: 'example.test.rates', versionName: '1.2.3', versionCode: 123,
  apkAbis: ['arm64-v8a', 'x86_64'],
};
const files = {
  apk: 'synthetic APK fixture', installed: 'synthetic APK fixture',
  screenshot: 'synthetic screenshot fixture', recording: 'synthetic recording fixture',
  log: 'synthetic Android trace fixture', report: 'synthetic assessor report fixture',
  badging: "package: name='example.test.rates' versionCode='123' versionName='1.2.3'\nnative-code: 'arm64-v8a' 'x86_64'\n",
  readback: 'Package [example.test.rates]\n  versionCode=123 minSdk=24\n  versionName=1.2.3\n',
};
const kinds = { apk: 'apk', installed: 'apk', screenshot: 'screenshot', recording: 'recording',
  log: 'log', report: 'report', badging: 'log', readback: 'log' };

function fixture() {
  const pass = { result: 'pass', captureRefs: ['screenshot', 'recording', 'log', 'report'] };
  const counts = { taps: 1, routeChanges: 0, mandatoryChoices: 0, typedFields: 0,
    repeatedFields: 0, scrollDetours: 0, mistakes: 0, recoverySteps: 0 };
  return {
    schemaVersion: 1, capturedAt: '2026-10-14T10:00:00Z',
    artifacts: Object.entries(files).map(([id, value]) => ({ id, kind: kinds[id], path: `${id}.fixture`,
      bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') })),
    identity: { ...expected, apkRef: 'apk', installedApkRef: 'installed', badgingRef: 'badging',
      installedReadbackRef: 'readback', installMode: 'fresh' },
    environment: { kind: 'android-emulator', apiLevel: 36, deviceAbi: 'x86_64', readbackRef: 'log' },
    design: { primaryTabs: ['Rates', 'Saved', 'Market'], accountItems: ['Profile', 'Settings', 'About'],
      setupQuestions: 0, normalUseDirectories: 0, maximumSheetDepth: 1,
      copyGuard: structuredClone(pass), nativeReview: structuredClone(pass) },
    journeys: REQUIRED_JOURNEYS.map((id) => {
      const pilot = { ...counts, taps: id === 'launch-rates' ? 0 : id === 'compare-two' ? 4 : 1 };
      return { id, ...structuredClone(pass), trigger: 'Synthetic trigger', endState: 'Synthetic end state',
        ...pilot, durationMs: 60_000, baseline: { ...pilot, alreadyMinimal: true, ref: 'report' },
        selectedRates: 2, launchTaps: 0, submitTaps: 0, openTaps: 1, sheetDepth: 1,
        applyCommits: 1, cancelRestoredState: true, statePreserved: true, directoryTaps: 0 };
    }),
    invariants: REQUIRED_INVARIANTS.map((id) => ({ id, ...structuredClone(pass) })),
    cases: REQUIRED_CASES.map((id) => ({ id, ...structuredClone(pass), environment: {
      widthDp: id.startsWith('small-') ? 360 : 411,
      fontScale: id.endsWith('-large') ? 2 : 1,
      theme: id === 'dark' ? 'dark' : 'light', reducedMotion: id === 'reduced-motion',
    } })),
    audit: { stepLimitMs: 10_000, inventoryRef: 'report', expectedStepIds: ['rates.open'],
      steps: [{ id: 'rates.open', result: 'pass', rendered: true, durationMs: 10_000, ref: 'log' }] },
    frontendTiming: { ...structuredClone(pass), method: 'android-frame-trace', frameCount: 120,
      droppedFrameCount: 2, inputLatencyP95Ms: 80 },
    usability: { ...structuredClone(pass), participantCount: 5, unassistedCoreTasks: true,
      criticalFinancialMisunderstandings: 0, coreJourneyRegressions: 0 },
  };
}

function reject(mutator, pattern, options = expected) {
  const record = fixture();
  mutator(record);
  const result = validateAndroidRedesignEvidence(record, options);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), pattern);
}

async function onDisk(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ar-android-evidence-test-'));
  try {
    const record = fixture();
    for (const [id, value] of Object.entries(files)) await writeFile(path.join(directory, `${id}.fixture`), value);
    const filename = path.join(directory, 'evidence.json');
    await writeFile(filename, JSON.stringify(record));
    await run({ directory, filename, record });
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('accepts complete synthetic records without calling them native or human proof', () => {
  const result = validateAndroidRedesignEvidence(fixture(), expected);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.scope, 'recorded-evidence-completeness');
});

test('rejects missing evidence and independently mismatched source, APK, version and ABI', () => {
  const absent = validateAndroidRedesignEvidence({}, expected);
  assert.equal(absent.ok, false);
  assert.match(absent.errors.join('\n'), /Journey.launch-rates/);
  for (const [key, value] of [['sourceSha', 'b'.repeat(40)], ['apkSha256', 'b'.repeat(64)],
    ['versionName', '9.9.9'], ['versionCode', 999], ['packageName', 'wrong.package']]) {
    reject((record) => { record.identity[key] = value; }, new RegExp(key));
  }
  reject((record) => { record.identity.apkAbis = ['arm64-v8a']; }, /ABIs/);
  reject((record) => { record.identity.installMode = 'upgrade'; }, /fresh installation/);
  reject(() => {}, /Trusted expected source/, { ...expected, sourceSha: undefined });
});

test('rejects browser evidence, directories, wrong tabs and falsely declared no-prose results', () => {
  reject((record) => { record.environment.kind = 'browser'; }, /Android emulator/);
  reject((record) => { record.design.primaryTabs.push('Tools'); }, /Exactly Rates/);
  reject((record) => { record.design.accountItems.push('Banks'); }, /Exactly Profile/);
  reject((record) => { record.design.normalUseDirectories = 1; }, /normal-use directories/);
  reject((record) => { record.design.copyGuard.result = false; }, /Copy provenance guard: result/);
  reject((record) => { record.design.nativeReview.result = 'unavailable'; }, /Rendered navigation\/copy review: result/);
});

test('rejects hidden setup, tap detours, partial comparison selection and lost state', () => {
  reject((record) => { record.journeys[0].mandatoryChoices = 1; }, /Launch must show rates/);
  reject((record) => { record.journeys.find((item) => item.id === 'open-product').taps = 2; }, /one contextual tap/);
  reject((record) => { record.journeys.find((item) => item.id === 'compare-two').selectedRates = 1; }, /Compare two/);
  reject((record) => { record.journeys.find((item) => item.id === 'search').submitTaps = 1; }, /inline/);
  reject((record) => { record.journeys.find((item) => item.id === 'filter').cancelRestoredState = false; }, /reversible Cancel/);
  reject((record) => { record.journeys.find((item) => item.id === 'switch-tabs').statePreserved = false; }, /state restoration/);
  reject((record) => { record.journeys[1].repeatedFields = 1; }, /repeatedFields regressed/);
  reject((record) => { record.journeys[1].baseline.alreadyMinimal = false; }, /no effort improvement/);
});

test('requires all core journeys, financial/privacy invariants and actual capture references', () => {
  reject((record) => { record.journeys.pop(); }, /Journey.switch-tabs/);
  reject((record) => { record.journeys.push(record.journeys[0]); }, /IDs must be unique/);
  reject((record) => { record.invariants.find((item) => item.id === 'unknown-facts').result = 'skipped'; }, /Invariant.unknown-facts/);
  reject((record) => { record.invariants.find((item) => item.id === 'privacy-consent').captureRefs = []; }, /privacy-consent: report evidence missing/);
  reject((record) => { record.journeys[0].captureRefs = ['screenshot', 'log']; }, /recording evidence missing/);
  reject((record) => { record.artifacts[0].sha256 = ''; }, /SHA-256 missing/);
});

test('requires genuine matrix states, large fonts and measured Android width', () => {
  reject((record) => { record.cases.pop(); }, /Android case.interrupted/);
  reject((record) => { record.cases.find((item) => item.id === 'small-large').environment.fontScale = 1; }, /200%/);
  reject((record) => { record.cases.find((item) => item.id === 'small-normal').environment.widthDp = 411; }, /360dp/);
  reject((record) => { record.cases.find((item) => item.id === 'dark').environment.theme = 'light'; }, /dark mode/);
  reject((record) => { record.cases.find((item) => item.id === 'reduced-motion').environment.reducedMotion = false; }, /with reduced motion/);
});

test('enforces every finalized audit step at 10,000ms independently of journey duration', () => {
  assert.equal(validateAndroidRedesignEvidence(fixture(), expected).ok, true);
  reject((record) => { record.audit.steps[0].durationMs = 10_001; }, /exceeds 10,000ms/);
  reject((record) => { record.audit.stepLimitMs = 20_000; }, /exactly 10,000ms/);
  reject((record) => { record.audit.expectedStepIds.push('product.open'); }, /exactly cover/);
  reject((record) => { record.audit.steps[0].rendered = false; }, /non-rendered/);
  reject((record) => { record.audit.steps[0].result = 'skipped'; }, /skipped/);
  reject((record) => { record.audit.steps.push(record.audit.steps[0]); }, /without duplicates/);
  reject((record) => { record.frontendTiming.method = 'audit-duration'; }, /do not prove smoothness/);
});

test('rejects missing human-study evidence and misinterpreted financial facts', () => {
  reject((record) => { record.usability.result = 'not-run'; }, /Recorded usability study: result/);
  reject((record) => { record.usability.participantCount = 1; }, /representative participants/);
  reject((record) => { record.usability.criticalFinancialMisunderstandings = 1; }, /Usability gate/);
});

test('checks actual file hashes, missing captures and actual aapt/installed readbacks', async () => {
  await onDisk(async ({ filename, directory, record }) => {
    assert.equal((await verifyAndroidRedesignEvidence(filename, expected)).ok, true);
    await writeFile(path.join(directory, 'screenshot.fixture'), 'changed capture');
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /file size\/SHA-256 mismatch/);
    await rm(path.join(directory, 'recording.fixture'));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /Artifact recording/);
    const badging = "package: name='wrong.package' versionCode='999' versionName='9.9.9'\nnative-code: 'arm64-v8a'\n";
    await writeFile(path.join(directory, 'badging.fixture'), badging);
    Object.assign(record.artifacts.find((item) => item.id === 'badging'), {
      bytes: Buffer.byteLength(badging), sha256: createHash('sha256').update(badging).digest('hex'),
    });
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /Actual aapt badging/);
  });
});

test('rejects traversal and absolute capture paths instead of reading outside evidence directory', async () => {
  await onDisk(async ({ filename, record }) => {
    for (const invalid of ['../capture.png', '..\\capture.png', 'C:\\private\\capture.png', '/private/capture.png']) {
      record.artifacts[2].path = invalid;
      await writeFile(filename, JSON.stringify(record));
      assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /path must stay relative/);
    }
  });
});

test('CLI fails incomplete records and explains the limit of a successful record check', async () => {
  await onDisk(async ({ filename, directory }) => {
    const command = fileURLToPath(new URL('./verify-android-redesign-evidence.mjs', import.meta.url));
    const args = [command, filename, '--source-sha', expected.sourceSha, '--apk-sha256', expected.apkSha256,
      '--package-name', expected.packageName, '--version-name', expected.versionName,
      '--version-code', String(expected.versionCode), '--abis', expected.apkAbis.join(',')];
    const good = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, shell: false });
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /not human judgement/);
    const record = JSON.parse(await readFile(filename, 'utf8'));
    record.design.copyGuard.result = 'fail';
    await writeFile(filename, JSON.stringify(record));
    const failed = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, shell: false });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Copy provenance guard/);
    const missing = spawnSync(process.execPath, [command, path.join(directory, 'missing.json')], {
      encoding: 'utf8', windowsHide: true, shell: false,
    });
    assert.equal(missing.status, 1);
  });
});
