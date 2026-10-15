import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  REQUIRED_CASES, REQUIRED_INVARIANTS, REQUIRED_JOURNEYS,
  validateAndroidRedesignEvidence, verifyAndroidRedesignEvidence,
} from './verify-android-redesign-evidence.mjs';
import { buildNativeInputFixture } from './fixtures/android-native-input.fixture.mjs';
import { parseNativeInputCsv, summarizeNativeInputCsv } from './android-native-input-latency.mjs';
import { nativeSampleListSha256 } from './android-native-input-evidence.mjs';
import { nativeCsv, nativeRow } from './fixtures/android-native-input.fixture.mjs';

// Synthetic records test the validator only. They are never native acceptance evidence.
const expected = {
  sourceSha: 'a'.repeat(40),
  apkSha256: createHash('sha256').update('synthetic APK fixture').digest('hex'),
  packageName: 'example.test.rates', versionName: '1.2.3', versionCode: 123,
  apkAbis: ['arm64-v8a', 'x86_64'],
  baseline: { sourceSha: 'b'.repeat(40), apkSha256: createHash('sha256').update('synthetic baseline APK fixture').digest('hex'),
    packageName: 'example.test.rates', versionName: '1.2.2', versionCode: 122, apkAbis: ['arm64-v8a', 'x86_64'] },
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
const nativeFixture = buildNativeInputFixture(expected);
Object.assign(files, nativeFixture.files);
Object.assign(kinds, nativeFixture.kinds);
for (const id of REQUIRED_CASES) {
  for (const kind of ['screenshot', 'log']) {
    files[`case-${id}-${kind}`] = `Synthetic ${id} ${kind} capture`;
    kinds[`case-${id}-${kind}`] = kind;
  }
}

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
      const journey = { id, ...structuredClone(pass), trigger: 'Synthetic trigger', endState: 'Synthetic end state',
        ...pilot, durationMs: 60_000, baseline: { ...pilot, trigger: 'Synthetic trigger', endState: 'Synthetic end state', alreadyMinimal: true, ref: 'report' },
        selectedRates: 2, launchTaps: 0, submitTaps: 0, openTaps: 1, sheetDepth: 1,
        applyCommits: 1, cancelRestoredState: true, statePreserved: true, directoryTaps: 0 };
      if (id === 'sort') Object.assign(journey, {
        mode: 'quickPreset', quickPresetVisible: true, openTaps: 0, sheetDepth: 0,
        advancedOptions: { ...structuredClone(pass), trigger: 'Synthetic advanced Sort trigger', endState: 'Synthetic selected sort committed',
          taps: 2, openTaps: 1, selectionTaps: 1, applyTaps: 0, sheetDepth: 1, applyCommits: 1,
          closesAfterSelection: true, cancelRestoredState: true, backRestoredState: true },
      });
      return journey;
    }),
    invariants: REQUIRED_INVARIANTS.map((id) => ({ id, ...structuredClone(pass) })),
    cases: REQUIRED_CASES.map((id) => ({ id, ...structuredClone(pass), captureRefs: [`case-${id}-screenshot`, `case-${id}-log`], environment: {
      widthDp: id.startsWith('small-') ? 360 : 411,
      fontScale: id.endsWith('-large') ? 2 : 1,
      theme: id === 'dark' ? 'dark' : 'light', reducedMotion: id === 'reduced-motion',
    } })),
    audit: { stepLimitMs: 10_000, inventoryRef: 'report', expectedStepIds: ['rates.open'],
      steps: [{ id: 'rates.open', result: 'pass', rendered: true, durationMs: 10_000, ref: 'log' }] },
    frontendTiming: { ...structuredClone(pass), method: 'android-frame-trace', frameCount: 120,
      droppedFrameCount: 2, inputLatencyP95Ms: 80, inputLatencyAggregation: 'maximum-final-cohort-p95',
      nativeInput: structuredClone(nativeFixture.nativeInput) },
    usabilityScope: 'emulator-operator',
    usability: { ...structuredClone(pass), humanValidationClaimed: false, coreTasksCompleted: true,
      criticalFinancialMisunderstandings: 0, coreJourneyRegressions: 0 },
    humanStudy: { status: 'not-run', humanValidationClaimed: false },
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

async function replaceArtifact(directory, record, id, value) {
  const artifact = record.artifacts.find(item => item.id === id);
  await writeFile(path.join(directory, artifact.path), value);
  Object.assign(artifact, { bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') });
}

async function replaceNativeCsv(directory, record, stage, value) {
  await replaceArtifact(directory, record, stage.csvRef, value);
  const filename = path.join(directory, record.artifacts.find(item => item.id === stage.analysisRef).path);
  const analysis = JSON.parse(await readFile(filename, 'utf8'));
  analysis.csvSha256 = record.artifacts.find(item => item.id === stage.csvRef).sha256;
  await replaceArtifact(directory, record, stage.analysisRef, JSON.stringify(analysis));
}

async function replaceNativeConfig(directory, record, value) {
  await replaceArtifact(directory, record, 'native-config', value);
  const refs = new Set(record.frontendTiming.nativeInput.cohorts.flatMap(cohort => [cohort.baseline.analysisRef, cohort.final.analysisRef]));
  for (const id of refs) {
    const artifact = record.artifacts.find(item => item.id === id);
    const analysis = JSON.parse(await readFile(path.join(directory, artifact.path), 'utf8'));
    analysis.configSha256 = createHash('sha256').update(value).digest('hex');
    await replaceArtifact(directory, record, id, JSON.stringify(analysis));
  }
}

test('requires separate original and pulled APK IDs and paths for acceptance and every timing stage', () => {
  reject(record => { record.identity.installedApkRef = record.identity.apkRef; }, /distinct artifact IDs and paths/);
  reject(record => { record.artifacts.find(item => item.id === 'installed').path = './apk.fixture'; }, /distinct artifact IDs and paths/);
  for (const stage of ['baseline', 'final']) {
    reject(record => {
      const identity = record.frontendTiming.nativeInput.cohorts[0][stage].identity;
      identity.installedApkRef = identity.apkRef;
    }, /distinct artifact IDs and paths/);
  }
});

test('rejects an installed APK alias that has a distinct path but is the same filesystem file', async () => {
  await onDisk(async ({ directory, filename }) => {
    await rm(path.join(directory, 'installed.fixture'));
    await link(path.join(directory, 'apk.fixture'), path.join(directory, 'installed.fixture'));
    const result = await verifyAndroidRedesignEvidence(filename, expected);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /same filesystem file/);
  });
});

test('one retained capture cannot be relabelled as both baseline and final', () => {
  reject(record => {
    for (const cohort of record.frontendTiming.nativeInput.cohorts) {
      for (const role of ['traceRef', 'csvRef', 'analysisRef', 'summary']) cohort.final[role] = structuredClone(cohort.baseline[role]);
    }
    record.frontendTiming.inputLatencyP95Ms = 100;
  }, /baseline\/final capture.*distinct/);
  reject(record => {
    const cohort = record.frontendTiming.nativeInput.cohorts[0];
    const baseline = record.artifacts.find(item => item.id === cohort.baseline.traceRef);
    Object.assign(record.artifacts.find(item => item.id === cohort.final.traceRef), { bytes: baseline.bytes, sha256: baseline.sha256 });
  }, /baseline\/final capture.*distinct/);
});

test('native timing requires different trusted baseline and final builds but permits repeated QA versions', () => {
  for (const field of ['sourceSha', 'apkSha256']) {
    reject(() => {}, /distinct trusted source SHAs and APK hashes/, {
      ...expected, baseline: { ...expected.baseline, [field]: expected[field] },
    });
  }
  const record = fixture();
  const options = structuredClone(expected);
  Object.assign(options.baseline, { versionName: expected.versionName, versionCode: expected.versionCode });
  for (const cohort of record.frontendTiming.nativeInput.cohorts) {
    Object.assign(cohort.baseline.identity, { versionName: expected.versionName, versionCode: expected.versionCode });
  }
  const result = validateAndroidRedesignEvidence(record, options);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('native environment, idle workload and analysis cannot alias the same retained artifact', () => {
  for (const stageName of ['baseline', 'final']) {
    for (const role of ['environmentRef', 'workloadRef']) {
      reject(record => {
        const stage = record.frontendTiming.nativeInput.cohorts[0][stageName];
        stage[role] = stage.analysisRef;
      }, /require independent artifact IDs, paths and bytes/);
      for (const field of ['path', 'sha256']) {
        reject(record => {
          const stage = record.frontendTiming.nativeInput.cohorts[0][stageName];
          record.artifacts.find(item => item.id === stage[role])[field]
            = record.artifacts.find(item => item.id === stage.analysisRef)[field];
        }, /require independent artifact IDs, paths and bytes/);
      }
    }
    reject(record => {
      const stage = record.frontendTiming.nativeInput.cohorts[0][stageName];
      stage.environmentRef = stage.workloadRef;
    }, /require independent artifact IDs, paths and bytes/);
  }
});

test('capture configs require actual app atrace fields in their matching data source', async () => {
  const original = files['native-config'];
  const variants = [
    ...['gfx', 'view', 'input'].map(category => original.replace(`atrace_categories: "${category}"`, `# atrace_categories: "${category}"`)),
    original.replace(/atrace_apps:\s*"[^"]+"/, 'atrace_apps: "different.test.app"'),
    original.replace('name: "linux.ftrace"', 'name: "linux.process_stats"') + '\n# linux.ftrace\n',
    original.replace('trace_dispatcher_window_dispatch: true', 'trace_dispatcher_window_dispatch: false') + '\n# trace_dispatcher_window_dispatch: true\n',
  ];
  for (const value of variants) {
    assert.notEqual(value, original);
    await onDisk(async ({ directory, filename, record }) => {
      await replaceNativeConfig(directory, record, value);
      await writeFile(filename, JSON.stringify(record));
      const result = await verifyAndroidRedesignEvidence(filename, expected);
      assert.equal(result.ok, false);
      assert.match(result.errors.join('\n'), /capture configuration incomplete/);
    });
  }
});

test('accepts complete synthetic records without calling them native or human proof', () => {
  const result = validateAndroidRedesignEvidence(fixture(), expected);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.scope, 'recorded-evidence-completeness');
});

test('compares effort only for matching baseline and pilot task boundaries', () => {
  for (const field of ['trigger', 'endState']) {
    reject(record => { delete record.journeys[0].baseline[field]; }, /baseline trigger\/end state must match/);
    reject(record => { record.journeys[0].baseline[field] = 'Different task'; }, /baseline trigger\/end state must match/);
  }
});

test('incompatible Android states require dedicated screenshots and readbacks', () => {
  for (const kind of ['screenshot', 'log']) {
    reject(record => {
      const source = record.cases.find(item => item.id === 'normal-normal');
      const target = record.cases.find(item => item.id === 'small-normal');
      target.captureRefs = target.captureRefs.filter(id => !id.endsWith(kind)).concat(source.captureRefs.filter(id => id.endsWith(kind)));
    }, new RegExp(`dedicated ${kind} capture`));
    reject(record => {
      record.artifacts.find(item => item.id === `case-small-normal-${kind}`).path = `./case-normal-normal-${kind}.fixture`;
    }, new RegExp(`dedicated ${kind} capture`));
  }
  const record = fixture();
  const normal = record.cases.find(item => item.id === 'normal-normal');
  record.cases.find(item => item.id === 'online').captureRefs = [...normal.captureRefs];
  const motion = record.artifacts.find(item => item.id === 'case-reduced-motion-screenshot');
  const normalImage = record.artifacts.find(item => item.id === 'case-normal-normal-screenshot');
  Object.assign(motion, { bytes: normalImage.bytes, sha256: normalImage.sha256 });
  const result = validateAndroidRedesignEvidence(record, expected);
  assert.equal(result.ok, true, result.errors.join('\n'));
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

test('keeps the one-tap sort preset comparable to its direct baseline and verifies advanced options separately', () => {
  const record = fixture(), sort = record.journeys.find(item => item.id === 'sort');
  assert.equal(sort.baseline.taps, 1);
  assert.equal(sort.taps, 1);
  assert.equal(sort.advancedOptions.taps, 2);
  assert.equal(validateAndroidRedesignEvidence(record, expected).ok, true);
  for (const [key, value] of [['mode', 'advancedOptions'], ['quickPresetVisible', false], ['taps', 2],
    ['openTaps', 1], ['sheetDepth', 1], ['applyCommits', 0]]) {
    reject(record => { record.journeys.find(item => item.id === 'sort')[key] = value; }, /sort: visible quickPreset/);
  }
  reject(record => { record.journeys.find(item => item.id === 'sort').scrollDetours = 1; }, /sort: scrollDetours regressed/);
  reject(record => { delete record.journeys.find(item => item.id === 'sort').advancedOptions; }, /sort.advancedOptions/);
});

test('rejects unverified, nested, extra-Apply or irreversible advanced Sort claims', () => {
  for (const [key, value, pattern] of [
    ['result', 'not-run', /sort.advancedOptions: result must be pass/],
    ['trigger', '', /sort.advancedOptions: trigger\/end state missing/],
    ['endState', '', /sort.advancedOptions: trigger\/end state missing/],
    ['taps', 3, /sort.advancedOptions: one open and one selection/],
    ['openTaps', 2, /sort.advancedOptions: one open and one selection/],
    ['selectionTaps', 2, /sort.advancedOptions: one open and one selection/],
    ['applyTaps', 1, /without an extra Apply tap/],
    ['sheetDepth', 2, /one sheet/],
    ['applyCommits', 2, /one open and one selection/],
    ['closesAfterSelection', false, /commit and close/],
    ['cancelRestoredState', false, /explicit Cancel and native Back/],
    ['backRestoredState', false, /explicit Cancel and native Back/],
  ]) {
    reject(record => { record.journeys.find(item => item.id === 'sort').advancedOptions[key] = value; }, pattern);
  }
  for (const kind of ['screenshot', 'recording', 'log', 'report']) {
    reject(record => { record.journeys.find(item => item.id === 'sort').advancedOptions.captureRefs =
      ['screenshot', 'recording', 'log', 'report'].filter(id => id !== kind); }, new RegExp(`sort.advancedOptions: ${kind} evidence missing`));
  }
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

test('scalar latency, speculative fallback, pooled actions and omitted cohorts cannot pass native timing', () => {
  reject(record => { delete record.frontendTiming.nativeInput; }, /direct native method/);
  reject(record => { record.frontendTiming.nativeInput.associationMethod = 'legacy-next-frame'; }, /direct native method/);
  reject(record => { record.frontendTiming.nativeInput.moveRepresentative = 'fastest-assigned-move'; }, /first MOVE/);
  reject(record => { record.frontendTiming.inputLatencyAggregation = 'pooled-p95'; }, /never pooled input actions/);
  reject(record => { record.frontendTiming.nativeInput.cohorts.pop(); }, /DOWN, UP and MOVE/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.summary.admittedGestureCount = 29; }, /30 unique/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.summary.p95Ms = 0; }, /exact percentile/);
});

test('requires independently trusted baseline identity, idle release pairing, attempts and matched measured context', () => {
  reject(() => {}, /independently trusted baseline/, { ...expected, baseline: undefined });
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].baseline.identity.sourceSha = 'c'.repeat(40); }, /trusted identity mismatch/);
  reject(record => { record.frontendTiming.nativeInput.scope = 'exploration'; }, /exploration/);
  reject(record => { record.frontendTiming.nativeInput.semanticReadinessSeparate = false; }, /semantic readiness/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].baseline.hostWorkload = 'canonical-ci-running'; }, /competing-workload/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.environment.fontScale = 2; }, /environment must match/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].baseline.environment.ramMiB = undefined; }, /measured paired environment/);
  reject(record => { record.frontendTiming.nativeInput.registeredAt = '2026-10-15T08:00:00Z'; }, /follow preregistration/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.attemptedGestureCount = 31; }, /missing attempted gestures/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.summary.unavailableGestureCount = 1; }, /qualifying gestures/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.status = 'unavailable'; }, /unavailable capture/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[0].final.operatorCorrections = [{ attemptId: 'a', gestureKey: null, reason: 'slow-app', ref: 'log' }]; }, /bounded operator correction/);
});

test('links tap DOWN and UP to one workload and capture rather than claiming two independent taps', () => {
  reject(record => { record.frontendTiming.nativeInput.cohorts[1].gestureSetId = 'other-taps'; }, /link one DOWN/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[1].final.csvRef = 'final-swipe-csv'; }, /same captured tap gestures/);
  reject(record => { record.frontendTiming.nativeInput.cohorts[1].trigger = 'Different workload'; }, /paired tap workload differs/);
});

test('recomputes CSV counts and exact ns, verifies query/command bindings, and checks preregistered workload bytes', async () => {
  await onDisk(async ({ directory, filename, record }) => {
    const stage = record.frontendTiming.nativeInput.cohorts[0].final;
    const artifact = record.artifacts.find(item => item.id === stage.csvRef);
    const samples = parseNativeInputCsv(await readFile(path.join(directory, artifact.path), 'utf8'));
    samples[0].original_input_to_present_ns = '1';
    await replaceNativeCsv(directory, record, stage, nativeCsv(samples));
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /ns arithmetic/);
  });
  await onDisk(async ({ directory, filename, record }) => {
    const stage = record.frontendTiming.nativeInput.cohorts[0].final;
    const csv = nativeFixture.files[stage.csvRef];
    await replaceNativeCsv(directory, record, stage, nativeCsv(parseNativeInputCsv(csv).slice(2)));
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /counts\/percentile\/sample list/);
  });
  await onDisk(async ({ directory, filename, record }) => {
    await replaceArtifact(directory, record, 'native-query', files['native-query'] + '\n-- changed query\n');
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /checked-in native bridge query/);
  });
  await onDisk(async ({ directory, filename, record }) => {
    const stage = record.frontendTiming.nativeInput.cohorts[0].final;
    const analysis = JSON.parse(files[stage.analysisRef]);
    analysis.traceSha256 = 'a'.repeat(64);
    await replaceArtifact(directory, record, stage.analysisRef, JSON.stringify(analysis));
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /command\/hash bindings/);
  });
  await onDisk(async ({ directory, filename, record }) => {
    const plan = JSON.parse(files['native-plan']);
    plan.cohorts[0].expectedAttemptCount = 31;
    await replaceArtifact(directory, record, 'native-plan', JSON.stringify(plan));
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /preregistered plan differs/);
  });
});

test('accepts a real hash-verified empty native stderr file without adding diagnostic text', async () => {
  await onDisk(async ({ directory, filename, record }) => {
    await replaceArtifact(directory, record, 'native-stderr', '');
    await writeFile(filename, JSON.stringify(record));
    const result = await verifyAndroidRedesignEvidence(filename, expected);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal((await readFile(path.join(directory, 'native-stderr.fixture'))).length, 0);
  });
});

test('retains positive-byte requirements for all non-stderr evidence roles', async () => {
  for (const id of ['apk', 'screenshot', 'recording', 'log', 'report', 'native-query',
    'final-tap-trace', 'final-tap-csv', 'final-tap-analysis', 'native-environment', 'native-workload']) {
    await onDisk(async ({ directory, filename, record }) => {
      await replaceArtifact(directory, record, id, '');
      await writeFile(filename, JSON.stringify(record));
      const result = await verifyAndroidRedesignEvidence(filename, expected);
      assert.equal(result.ok, false, id);
      assert.ok(result.errors.includes(`Artifact ${id}: byte size missing or empty`), result.errors.join('\n'));
    });
  }
});

test('an empty stderr log cannot also satisfy another evidence role or be forged through an unrelated field', async () => {
  for (const alias of [
    record => { record.frontendTiming.nativeInput.cohorts[0].final.environmentRef = 'native-stderr'; },
    record => { record.frontendTiming.captureRefs.push('native-stderr'); },
    record => { record.environment.readbackRef = 'native-stderr'; },
    record => { record.audit.steps[0].ref = 'native-stderr'; },
  ]) {
    await onDisk(async ({ directory, filename, record }) => {
      await replaceArtifact(directory, record, 'native-stderr', ''); alias(record);
      await writeFile(filename, JSON.stringify(record));
      const result = await verifyAndroidRedesignEvidence(filename, expected);
      assert.ok(result.errors.includes('Artifact native-stderr: byte size missing or empty'), result.errors.join('\n'));
    });
  }
  reject(record => {
    const log = record.artifacts.find(item => item.id === 'log');
    Object.assign(log, { bytes: 0, sha256: createHash('sha256').update('').digest('hex') });
    record.unrelated = { stderrRef: 'log' };
  }, /Artifact log: byte size missing or empty/);
});

test('empty native stderr still requires declared zero bytes, actual existence and the exact empty-file hash', async () => {
  for (const change of [
    artifact => { delete artifact.bytes; },
    artifact => { artifact.bytes = null; },
    artifact => { artifact.bytes = '0'; },
    artifact => { artifact.sha256 = 'c'.repeat(64); },
  ]) {
    await onDisk(async ({ directory, filename, record }) => {
      await replaceArtifact(directory, record, 'native-stderr', '');
      change(record.artifacts.find(item => item.id === 'native-stderr'));
      await writeFile(filename, JSON.stringify(record));
      assert.equal((await verifyAndroidRedesignEvidence(filename, expected)).ok, false);
    });
  }
  await onDisk(async ({ directory, filename, record }) => {
    await replaceArtifact(directory, record, 'native-stderr', '');
    await rm(path.join(directory, 'native-stderr.fixture'));
    await writeFile(filename, JSON.stringify(record));
    const result = await verifyAndroidRedesignEvidence(filename, expected);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Artifact native-stderr:/);
  });
});

test('even consistently recalculated UP rows must retain the actual linked tap gestures', async () => {
  await onDisk(async ({ directory, filename, record }) => {
    const cohorts = record.frontendTiming.nativeInput.cohorts;
    const stage = cohorts[1].final;
    const samples = parseNativeInputCsv(files[stage.csvRef]);
    for (const row of samples.filter(item => item.action === '1')) row.down_time_monotonic = String(BigInt(row.down_time_monotonic) + 1n);
    const csv = nativeCsv(samples);
    await replaceNativeCsv(directory, record, stage, csv);
    for (const cohort of cohorts.filter(item => item.gestureSetId === 'tap')) {
      const summary = summarizeNativeInputCsv(csv, { packageName: expected.packageName, actionKind: cohort.actionKind });
      const { observations: _observations, gestures: _gestures, ...counts } = summary;
      cohort.final.summary = { ...counts, sampleListSha256: nativeSampleListSha256(summary) };
    }
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /DOWN\/UP must link the same taps/);
  });
});

test('an explicitly corrected partial tap stays in raw evidence and cannot become an independent extra UP', async () => {
  await onDisk(async ({ directory, filename, record }) => {
    const input = record.frontendTiming.nativeInput;
    const tapCohorts = input.cohorts.filter(item => item.gestureSetId === 'tap');
    const partial = nativeRow(30);
    const key = `${partial.device_id}/${partial.source}/${partial.down_time_monotonic}`;
    for (const stageName of ['baseline', 'final']) {
      const stage = tapCohorts[0][stageName];
      const csv = nativeCsv([...parseNativeInputCsv(files[stage.csvRef]), partial]);
      await replaceNativeCsv(directory, record, stage, csv);
      for (const cohort of tapCohorts) {
        cohort.expectedAttemptCount = 31;
        const capture = cohort[stageName];
        capture.attemptedGestureCount = 31;
        const correction = { attemptId: 'partial-31', gestureKey: cohort.actionKind === 'down-feedback' ? key : null,
          reason: 'input-command-rejected', ref: 'log' };
        capture.operatorCorrections = [correction];
        const summary = summarizeNativeInputCsv(csv, { packageName: expected.packageName, actionKind: cohort.actionKind,
          excludedGestureKeys: correction.gestureKey === null ? [] : [key] });
        const { observations: _observations, gestures: _gestures, ...counts } = summary;
        capture.summary = { ...counts, sampleListSha256: nativeSampleListSha256(summary) };
      }
    }
    const plan = JSON.parse(files['native-plan']);
    for (const cohort of plan.cohorts.filter(item => item.gestureSetId === 'tap')) cohort.expectedAttemptCount = 31;
    await replaceArtifact(directory, record, 'native-plan', JSON.stringify(plan));
    await writeFile(filename, JSON.stringify(record));
    const result = await verifyAndroidRedesignEvidence(filename, expected);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(tapCohorts[0].final.summary.receivedGestureCount, 31);
    assert.equal(tapCohorts[1].final.summary.receivedGestureCount, 30);
    assert.equal(tapCohorts[0].final.summary.admittedGestureCount, 30);
    assert.equal(tapCohorts[1].final.summary.admittedGestureCount, 30);
    tapCohorts[1].final.operatorCorrections[0].attemptId = 'unlinked-correction';
    await writeFile(filename, JSON.stringify(record));
    assert.match((await verifyAndroidRedesignEvidence(filename, expected)).errors.join('\n'), /same taps and operator corrections/);
  });
});

test('requires truthful operator assessment but treats a human study as separately reported optional evidence', () => {
  const noStudy = fixture();
  delete noStudy.humanStudy;
  const noStudyResult = validateAndroidRedesignEvidence(noStudy, expected);
  assert.equal(noStudyResult.ok, true, noStudyResult.errors.join('\n'));
  assert.equal(noStudyResult.humanStudyStatus, 'not-run');
  assert.equal(validateAndroidRedesignEvidence(fixture(), expected).ok, true);
  reject((record) => { record.usabilityScope = 'representative-users'; }, /scope must be emulator-operator/);
  reject((record) => { record.usability.result = 'not-run'; }, /Emulator operator usability assessment: result/);
  reject((record) => { record.usability.coreTasksCompleted = false; }, /assessment failed or incomplete/);
  reject((record) => { record.usability.humanValidationClaimed = true; }, /must not claim human validation/);
  reject((record) => { record.usability.criticalFinancialMisunderstandings = 1; }, /assessment failed or incomplete/);
  reject((record) => { record.humanStudy.humanValidationClaimed = true; }, /explicitly disclaim human validation/);
  reject((record) => { record.humanStudy.result = 'pass'; }, /completed-study result or participant claims/);
  reject((record) => { record.humanStudy.status = 'pass'; }, /status must be not-run or completed/);
  const completed = fixture();
  completed.humanStudy = { status: 'completed', result: 'pass', captureRefs: ['report'],
    participantCount: 5, unassistedCoreTasks: true, criticalFinancialMisunderstandings: 0,
    coreJourneyRegressions: 0 };
  assert.equal(validateAndroidRedesignEvidence(completed, expected).ok, true);
  for (const [key, value, pattern] of [
    ['participantCount', 1, /representative participants/],
    ['captureRefs', [], /human usability study: report evidence missing/],
    ['result', 'not-run', /human usability study: result/],
    ['unassistedCoreTasks', false, /human usability study failed or incomplete/],
    ['criticalFinancialMisunderstandings', 1, /human usability study failed or incomplete/],
  ]) {
    const changed = structuredClone(completed);
    changed.humanStudy[key] = value;
    const result = validateAndroidRedesignEvidence(changed, expected);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), pattern);
  }
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
      '--version-code', String(expected.versionCode), '--abis', expected.apkAbis.join(','),
      '--baseline-source-sha', expected.baseline.sourceSha, '--baseline-apk-sha256', expected.baseline.apkSha256,
      '--baseline-package-name', expected.baseline.packageName, '--baseline-version-name', expected.baseline.versionName,
      '--baseline-version-code', String(expected.baseline.versionCode), '--baseline-abis', expected.baseline.apkAbis.join(',')];
    const good = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, shell: false });
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /not human judgement/);
    assert.match(good.stdout, /Human study: not-run \(no human validation claimed\)/);
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
