#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAaptBadging } from './apk-identity.mjs';

export const REQUIRED_JOURNEYS = Object.freeze([
  'launch-rates', 'change-product-type', 'open-product', 'save-rate', 'search',
  'filter', 'sort', 'compare-two', 'calculate-from-rate', 'market-arrival',
  'return-from-product', 'switch-tabs',
]);
export const REQUIRED_INVARIANTS = Object.freeze([
  'exact-rate-tier', 'visible-variant-distinction', 'financial-facts', 'unknown-facts',
  'privacy-consent', 'canonical-state-owner', 'legacy-links', 'real-audit-readiness',
  'filter-cancel', 'section-filter-isolation', 'saved-input-reuse', 'error-input-retention',
  'stable-layout', 'touch-targets-48dp', 'contrast', 'talkback', 'reduced-motion',
  'no-prose-rendered', 'no-prose-accessible',
]);
export const REQUIRED_CASES = Object.freeze([
  'small-normal', 'small-large', 'normal-normal', 'normal-large', 'dark',
  'reduced-motion', 'keyboard', 'back-button', 'back-gesture', 'online', 'cached',
  'offline', 'loading', 'empty', 'error', 'permission-denied', 'permission-granted',
  'rapid-taps', 'interrupted',
]);
const COUNT_METRICS = ['taps', 'routeChanges', 'mandatoryChoices', 'typedFields',
  'repeatedFields', 'scrollDetours', 'mistakes', 'recoverySteps'];
const ARTIFACT_KINDS = ['apk', 'screenshot', 'recording', 'log', 'report'];
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const whole = (value) => Number.isSafeInteger(value) && value >= 0;
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && new Set(a).size === a.length && new Set(b).size === b.length
  && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Checks recorded claims and their schema, not whether an assessor told the truth. */
export function validateAndroidRedesignEvidence(record, expected) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const artifacts = new Map();
  const entries = (value) => Array.isArray(value) ? value : [];
  for (const item of entries(record?.artifacts)) {
    check(nonempty(item?.id) && !artifacts.has(item.id), 'Artifact IDs must be unique and nonempty');
    if (item?.id) artifacts.set(item.id, item);
    check(ARTIFACT_KINDS.includes(item?.kind), `Artifact ${item?.id}: unsupported kind`);
    check(nonempty(item?.path), `Artifact ${item?.id}: path missing`);
    check(HASH.test(item?.sha256 ?? ''), `Artifact ${item?.id}: SHA-256 missing or invalid`);
    check(whole(item?.bytes) && item.bytes > 0, `Artifact ${item?.id}: byte size missing or empty`);
  }
  const ref = (value, kinds, label) => {
    check(nonempty(value) && kinds.includes(artifacts.get(value)?.kind), `${label}: missing ${kinds.join('/')} artifact`);
  };
  const evidence = (item, label, kinds = ['screenshot', 'recording', 'log']) => {
    check(item?.result === 'pass', `${label}: result must be pass; missing, skipped and unavailable are incomplete`);
    for (const kind of kinds) {
      check(entries(item?.captureRefs).some((id) => artifacts.get(id)?.kind === kind), `${label}: ${kind} evidence missing`);
    }
    for (const id of entries(item?.captureRefs)) ref(id, ARTIFACT_KINDS, label);
  };
  const required = (value, ids, label, kinds) => {
    const items = entries(value);
    check(items.every((item) => nonempty(item?.id)) && new Set(items.map((item) => item?.id)).size === items.length,
      `${label}: IDs must be unique and nonempty`);
    for (const id of ids) evidence(items.find((item) => item?.id === id), `${label}.${id}`, kinds);
    return items;
  };

  check(record?.schemaVersion === 1, 'schemaVersion must be 1');
  check(nonempty(record?.capturedAt) && Number.isFinite(Date.parse(record.capturedAt)), 'capturedAt missing or invalid');
  check(SHA.test(expected?.sourceSha ?? '') && HASH.test(expected?.apkSha256 ?? ''), 'Trusted expected source/APK hashes are required');
  check(nonempty(expected?.packageName) && nonempty(expected?.versionName)
    && whole(expected?.versionCode) && expected.versionCode > 0, 'Trusted package/version identity is required');
  check(Array.isArray(expected?.apkAbis) && expected.apkAbis.length > 0
    && expected.apkAbis.every((abi) => ABIS.includes(abi)), 'Trusted APK ABI list is required');
  const identity = record?.identity;
  for (const key of ['sourceSha', 'apkSha256', 'packageName', 'versionName', 'versionCode']) {
    check(identity?.[key] === expected?.[key], `Identity ${key} does not match trusted expectation`);
  }
  check(sameSet(identity?.apkAbis, expected?.apkAbis), 'APK ABIs do not match trusted expectation');
  check(identity?.installMode === 'fresh', 'Acceptance requires a fresh installation of the exact APK');
  ref(identity?.apkRef, ['apk'], 'APK');
  ref(identity?.installedApkRef, ['apk'], 'Pulled installed APK');
  for (const id of [identity?.apkRef, identity?.installedApkRef]) {
    check(artifacts.get(id)?.sha256 === expected?.apkSha256, 'Original and pulled installed APK must match trusted APK SHA-256');
  }
  ref(identity?.badgingRef, ['log'], 'aapt badging');
  ref(identity?.installedReadbackRef, ['log'], 'Installed package readback');
  const environment = record?.environment;
  check(environment?.kind === 'android-emulator', 'Genuine Android emulator evidence is required');
  check(whole(environment?.apiLevel) && environment.apiLevel > 0, 'Android API level missing');
  check(ABIS.includes(environment?.deviceAbi) && entries(identity?.apkAbis).includes(environment?.deviceAbi), 'Emulator ABI is not supported by this APK');
  ref(environment?.readbackRef, ['log'], 'Android environment readback');

  const design = record?.design;
  check(JSON.stringify(design?.primaryTabs) === JSON.stringify(['Rates', 'Saved', 'Market']), 'Exactly Rates, Saved, Market tabs are required, in order');
  check(sameSet(design?.accountItems, ['Profile', 'Settings', 'About']), 'Exactly Profile, Settings, About account items are required');
  check(design?.setupQuestions === 0 && design?.normalUseDirectories === 0, 'No mandatory setup or normal-use directories are allowed');
  check(design?.maximumSheetDepth === 1, 'Filter/Sort must use one sheet layer');
  evidence(design?.copyGuard, 'Copy provenance guard', ['log']);
  evidence(design?.nativeReview, 'Rendered navigation/copy review');

  const journeys = required(record?.journeys, REQUIRED_JOURNEYS, 'Journey');
  for (const journey of journeys) {
    check(nonempty(journey?.trigger) && nonempty(journey?.endState), `Journey ${journey?.id}: trigger/end state missing`);
    check(Number.isFinite(journey?.durationMs) && journey.durationMs >= 0, `Journey ${journey?.id}: duration missing or invalid`);
    ref(journey?.baseline?.ref, ['report'], `Journey ${journey?.id} baseline`);
    for (const metric of COUNT_METRICS) {
      check(whole(journey?.[metric]) && whole(journey?.baseline?.[metric]), `Journey ${journey?.id}: ${metric} baseline/pilot count missing`);
      check(journey?.[metric] <= journey?.baseline?.[metric], `Journey ${journey?.id}: ${metric} regressed`);
    }
    check(journey?.baseline?.alreadyMinimal === true
      || COUNT_METRICS.some((key) => journey?.[key] < journey?.baseline?.[key]), `Journey ${journey?.id}: no effort improvement or recorded minimal baseline`);
    if (['change-product-type', 'open-product', 'save-rate', 'calculate-from-rate'].includes(journey?.id)) {
      check(journey.taps === 1, `Journey ${journey.id}: requires one contextual tap`);
    }
    if (journey?.id === 'launch-rates') check(journey.taps === 0 && journey.mandatoryChoices === 0 && journey.typedFields === 0, 'Launch must show rates without setup or navigation taps');
    if (journey?.id === 'compare-two') check(journey.taps <= 4 && journey.selectedRates === 2, 'Compare two requires two selections and at most four total taps');
    if (journey?.id === 'search') check(journey.launchTaps === 0 && journey.submitTaps === 0, 'Search must be inline without launch/Submit taps');
    if (['filter', 'sort'].includes(journey?.id)) check(journey.openTaps === 1 && journey.sheetDepth === 1
      && journey.applyCommits === 1 && journey.cancelRestoredState === true, `${journey.id}: direct single sheet with one Apply and reversible Cancel required`);
    if (['return-from-product', 'switch-tabs'].includes(journey?.id)) check(journey.statePreserved === true, `${journey.id}: state restoration failed or missing`);
    if (journey?.id === 'market-arrival') check(journey.directoryTaps === 0, 'Market must display useful content without directory taps');
  }
  required(record?.invariants, REQUIRED_INVARIANTS, 'Invariant', ['report', 'screenshot']);
  const cases = required(record?.cases, REQUIRED_CASES, 'Android case', ['screenshot', 'log']);
  for (const item of cases) {
    const env = item?.environment;
    check(Number.isFinite(env?.widthDp) && env.widthDp > 0 && Number.isFinite(env?.fontScale) && env.fontScale >= 1,
      `Android case ${item?.id}: measured width/font scale missing`);
    check(['light', 'dark'].includes(env?.theme) && typeof env?.reducedMotion === 'boolean', `Android case ${item?.id}: theme/reduced-motion state missing`);
    if (item?.id?.startsWith('small-')) check(env?.widthDp >= 350 && env.widthDp <= 370, 'Small-device cases require approximately 360dp width');
    if (item?.id?.startsWith('normal-')) check(env?.widthDp >= 400 && env.widthDp <= 420, 'Normal-device cases require approximately 411dp width');
    if (item?.id?.endsWith('-large')) check(env?.fontScale >= 2, 'Large-font cases require at least 200% font scale');
    if (item?.id?.endsWith('-normal')) check(env?.fontScale === 1, 'Normal-font cases require font scale 1');
    if (item?.id === 'dark') check(env?.theme === 'dark', 'Dark-theme case was not recorded in dark mode');
    if (item?.id === 'reduced-motion') check(env?.reducedMotion === true, 'Reduced-motion case was not recorded with reduced motion');
  }

  const audit = record?.audit;
  check(audit?.stepLimitMs === 10_000, 'Audit step limit must remain exactly 10,000ms');
  ref(audit?.inventoryRef, ['report'], 'Audit finalized inventory');
  check(entries(audit?.expectedStepIds).length > 0 && entries(audit?.expectedStepIds).every(nonempty), 'Audit expected step inventory missing');
  check(sameSet(audit?.expectedStepIds, entries(audit?.steps).map((step) => step?.id)), 'Audit actual steps must exactly cover finalized inventory without duplicates');
  for (const step of entries(audit?.steps)) {
    check(step?.result === 'pass' && step?.rendered === true, `Audit ${step?.id}: missing, failed, skipped or non-rendered evidence`);
    check(Number.isFinite(step?.durationMs) && step.durationMs >= 0 && step.durationMs <= 10_000, `Audit ${step?.id}: duration exceeds 10,000ms or is invalid`);
    ref(step?.ref, ['log', 'report'], `Audit ${step?.id}`);
  }
  const timing = record?.frontendTiming;
  evidence(timing, 'Native front-end timing', ['log', 'report']);
  check(timing?.method === 'android-frame-trace' && whole(timing?.frameCount) && timing.frameCount > 0
    && whole(timing?.droppedFrameCount) && timing.droppedFrameCount <= timing.frameCount,
  'Native frame measurements missing or invalid; audit durations do not prove smoothness');
  check(Number.isFinite(timing?.inputLatencyP95Ms) && timing.inputLatencyP95Ms >= 0, 'Native input latency measurement missing');
  const usability = record?.usability;
  evidence(usability, 'Recorded usability study', ['report']);
  check(whole(usability?.participantCount) && usability.participantCount >= 5 && usability.participantCount <= 8,
    'Usability study requires 5–8 representative participants');
  check(usability?.unassistedCoreTasks === true && usability?.criticalFinancialMisunderstandings === 0
    && usability?.coreJourneyRegressions === 0, 'Usability gate failed or incomplete');
  return { ok: errors.length === 0, errors, scope: 'recorded-evidence-completeness' };
}

/** Hashes actual referenced files. No network, Android process control, uploads or mutation. */
export async function verifyAndroidRedesignEvidence(recordPath, expected) {
  const filename = await realpath(recordPath);
  const root = path.dirname(filename);
  const record = JSON.parse(await readFile(filename, 'utf8'));
  const result = validateAndroidRedesignEvidence(record, expected);
  const contents = new Map();
  for (const artifact of Array.isArray(record?.artifacts) ? record.artifacts : []) {
    try {
      if (!nonempty(artifact?.path) || path.isAbsolute(artifact.path) || /^[A-Za-z]:|^[\\/]/.test(artifact.path)
        || artifact.path.split(/[\\/]/).some((part) => part === '..')) throw new Error('path must stay relative to the evidence directory');
      const actual = await realpath(path.resolve(root, artifact.path));
      const relative = path.relative(root, actual);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('resolved path escapes evidence directory');
      const bytes = await readFile(actual);
      if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error('file size/SHA-256 mismatch');
      contents.set(artifact.id, bytes);
    } catch (error) { result.errors.push(`Artifact ${artifact?.id}: ${error.message}`); }
  }
  const badging = parseAaptBadging(contents.get(record?.identity?.badgingRef)?.toString('utf8'));
  if (badging.packageName !== expected?.packageName || badging.versionName !== expected?.versionName
    || Number(badging.versionCode) !== expected?.versionCode || !sameSet(badging.supportedAbis, expected?.apkAbis)) {
    result.errors.push('Actual aapt badging does not match trusted package/version/ABI identity');
  }
  const readback = contents.get(record?.identity?.installedReadbackRef)?.toString('utf8') ?? '';
  if (!readback.includes(`Package [${expected?.packageName}]`)
    || /\bversionName=(\S+)/.exec(readback)?.[1] !== expected?.versionName
    || Number(/\bversionCode=(\d+)/.exec(readback)?.[1]) !== expected?.versionCode) {
    result.errors.push('Installed package readback does not match trusted package/version identity');
  }
  result.ok = result.errors.length === 0;
  return result;
}

function argumentsFrom(argv) {
  const keys = new Map([['--source-sha', 'sourceSha'], ['--apk-sha256', 'apkSha256'],
    ['--package-name', 'packageName'], ['--version-name', 'versionName'],
    ['--version-code', 'versionCode'], ['--abis', 'apkAbis']]);
  const [recordPath, ...flags] = argv;
  const expected = {};
  if (!recordPath || recordPath.startsWith('--') || flags.length % 2) throw new Error('Evidence JSON and all trusted identity flags are required');
  for (let index = 0; index < flags.length; index += 2) {
    const key = keys.get(flags[index]);
    if (!key || Object.hasOwn(expected, key)) throw new Error(`Unknown or repeated flag: ${flags[index]}`);
    expected[key] = key === 'versionCode' ? Number(flags[index + 1])
      : key === 'apkAbis' ? flags[index + 1].split(',') : flags[index + 1];
  }
  return { recordPath, expected };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { recordPath, expected } = argumentsFrom(process.argv.slice(2));
    const result = await verifyAndroidRedesignEvidence(recordPath, expected);
    if (!result.ok) {
      console.error(`Android redesign evidence incomplete:\n${result.errors.map((error) => `- ${error}`).join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log('Recorded Android redesign evidence is complete and artifact hashes match.');
      console.log('This validates records, not human judgement, screenshot content, smoothness, public delivery or physical-device acceptance.');
    }
  } catch (error) { console.error(`Android redesign evidence: ${error.message}`); process.exitCode = 1; }
}
