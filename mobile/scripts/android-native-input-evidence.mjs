import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseAaptBadging } from './apk-identity.mjs';
import { INPUT_ACTIONS, MIN_NATIVE_GESTURES, renderNativeInputQuery, summarizeNativeInputCsv } from './android-native-input-latency.mjs';

export const NATIVE_INPUT_METRIC = 'original-input-to-first-uniquely-attributable-native-presented-frame';
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const IDENTITY_KEYS = ['sourceSha', 'apkSha256', 'packageName', 'versionName', 'versionCode'];
const SUMMARY_KEYS = ['receivedInputCount', 'receivedGestureCount', 'admittedGestureCount', 'unavailableGestureCount',
  'operatorExcludedGestureCount', 'unavailableObservationCount', 'unclassifiedInputCount', 'percentileStatus', 'p95Ns', 'p95Ms'];
const ENVIRONMENT_KEYS = ['deviceFingerprint', 'apiLevel', 'runtimeAbi', 'widthPx', 'heightPx', 'densityDpi',
  'fontScale', 'refreshRateHz', 'ramMiB', 'cpuCores', 'gpuMode', 'theme', 'reducedMotion', 'appState', 'datasetSha256'];
const whole = value => Number.isSafeInteger(value) && value >= 0;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const entries = value => Array.isArray(value) ? value : [];
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && new Set(a).size === a.length
  && new Set(b).size === b.length && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

const artifactPath = artifact => nonempty(artifact?.path)
  ? path.posix.normalize(artifact.path.replaceAll('\\', '/')) : null;
export function distinctApkArtifacts(identity, artifacts) {
  const original = artifacts.get(identity?.apkRef), installed = artifacts.get(identity?.installedApkRef);
  return nonempty(identity?.apkRef) && identity.apkRef !== identity?.installedApkRef
    && artifactPath(original) !== null && artifactPath(installed) !== null
    && artifactPath(original) !== artifactPath(installed);
}

// Read the small textproto grammar emitted by the capture runner. Values in
// comments or in unrelated data-source blocks cannot satisfy capture requirements.
function captureConfigFields(source) {
  const lexer = /\s+|#[^\r\n]*|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z_0-9.]*|[-+]?\d+(?:\.\d+)?|[{}<>:,;]/gy;
  const tokens = [];
  for (let offset = 0; offset < source.length;) {
    lexer.lastIndex = offset;
    const match = lexer.exec(source);
    if (!match) throw new Error('unsupported capture configuration syntax');
    offset = lexer.lastIndex;
    if (!/^(?:\s|#|\/\/|\/\*)/.test(match[0])) tokens.push(match[0]);
  }
  let index = 0;
  const fields = closing => {
    const node = new Map();
    while (index < tokens.length && tokens[index] !== closing) {
      const key = tokens[index++];
      if (!/^[A-Za-z_][A-Za-z_0-9.]*$/.test(key)) throw new Error('invalid capture configuration field');
      if (tokens[index] === ':') index++;
      const token = tokens[index++];
      let value;
      if (token === '{' || token === '<') value = fields(token === '{' ? '}' : '>');
      else if (token?.startsWith('"')) value = { kind: 'string', value: JSON.parse(token) };
      else if (token && /^[A-Za-z_+\-0-9][A-Za-z_0-9.+\-]*$/.test(token)) value = { kind: 'atom', value: token };
      else throw new Error('missing capture configuration value');
      node.set(key, [...(node.get(key) ?? []), value]);
      if (tokens[index] === ',' || tokens[index] === ';') index++;
    }
    if (closing && tokens[index++] !== closing) throw new Error('unclosed capture configuration block');
    return node;
  };
  return fields(undefined);
}

function completeCaptureConfig(source, packageName) {
  const root = captureConfigFields(source);
  const blocks = (node, key) => (node.get(key) ?? []).filter(value => value instanceof Map);
  const has = (node, key, value, kind = 'string') => (node.get(key) ?? [])
    .some(item => item?.kind === kind && item.value === value);
  const only = (node, key, value, kind = 'string') => (node.get(key) ?? []).length === 1
    && has(node, key, value, kind);
  const sourceBlocks = blocks(root, 'data_sources');
  if (!sourceBlocks.every(source => (source.get('config') ?? []).length === 1)) return false;
  const sources = sourceBlocks.flatMap(source => blocks(source, 'config'));
  if (!sources.every(source => (source.get('name') ?? []).length === 1)) return false;
  const inputSources = sources.filter(source => only(source, 'name', 'android.input.inputevent'));
  return sources.some(source => only(source, 'name', 'android.surfaceflinger.frametimeline'))
    && inputSources.length > 0 && inputSources.every(source => (source.get('android_input_event_config') ?? []).length === 1
      && blocks(source, 'android_input_event_config').some(config => only(config, 'mode', 'TRACE_MODE_TRACE_ALL', 'atom')
        && only(config, 'trace_dispatcher_input_events', 'true', 'atom')
        && only(config, 'trace_dispatcher_window_dispatch', 'true', 'atom')))
    && sources.some(source => only(source, 'name', 'linux.ftrace')
      && (source.get('ftrace_config') ?? []).length === 1
      && blocks(source, 'ftrace_config').some(config => ['gfx', 'view', 'input'].every(category => has(config, 'atrace_categories', category))
        && has(config, 'atrace_apps', packageName)));
}

export function nativeSampleListSha256(summary) {
  const samples = summary.gestures.filter(item => item.available)
    .map(item => [item.key, item.representativeInputId, item.latencyNs]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return createHash('sha256').update(JSON.stringify(samples)).digest('hex');
}

/** Schema checks only; no source authentication or native execution. */
export function validateNativeInputEvidence(timing, expected, artifacts) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const ref = (id, kinds, label) => check(nonempty(id) && kinds.includes(artifacts.get(id)?.kind), `${label}: artifact missing`);
  const input = timing?.nativeInput;
  const label = 'Native input';
  check(input?.schemaVersion === 1 && input?.associationMethod === 'native-frame-info-id'
    && input?.metric === NATIVE_INPUT_METRIC, `${label}: direct native method and metric required`);
  check(input?.percentileRule === 'nearest-rank' && input?.minimumUniqueGestures === MIN_NATIVE_GESTURES
    && input?.moveRepresentative === 'first-original-move', `${label}: separate gestures and deterministic first MOVE required`);
  check(input?.scope === 'release-paired' && input?.semanticReadinessSeparate === true,
    `${label}: exploration or frame response cannot stand in for semantic readiness`);
  check(date(input?.registeredAt), `${label}: preregistration time missing`);
  ref(input?.planRef, ['report'], `${label} preregistered cohort plan`);
  const baseline = expected?.baseline;
  check(SHA.test(baseline?.sourceSha ?? '') && HASH.test(baseline?.apkSha256 ?? '')
    && nonempty(baseline?.packageName) && nonempty(baseline?.versionName)
    && whole(baseline?.versionCode) && baseline.versionCode > 0
    && entries(baseline?.apkAbis).length > 0 && baseline.apkAbis.every(abi => ABIS.includes(abi)),
  `${label}: independently trusted baseline source/APK/package/version/ABIs required`);
  check(baseline?.packageName === expected?.packageName, `${label}: paired captures require the same app package`);
  check(baseline?.sourceSha !== expected?.sourceSha && baseline?.apkSha256 !== expected?.apkSha256,
    `${label}: baseline and final require distinct trusted source SHAs and APK hashes`);
  const cohorts = entries(input?.cohorts);
  check(cohorts.length >= 3 && cohorts.every(cohort => nonempty(cohort?.id))
    && new Set(cohorts.map(cohort => cohort?.id)).size === cohorts.length, `${label}: unique paired cohorts required`);
  check(Object.keys(INPUT_ACTIONS).every(action => cohorts.some(cohort => cohort?.actionKind === action)),
    `${label}: DOWN, UP and MOVE cohorts must all remain explicit`);
  const groups = new Map();
  for (const cohort of cohorts) {
    const prefix = `${label}.${cohort?.id}`;
    check(Object.hasOwn(INPUT_ACTIONS, cohort?.actionKind ?? '') && nonempty(cohort?.gestureSetId)
      && nonempty(cohort?.journeyId) && nonempty(cohort?.trigger) && nonempty(cohort?.endState), `${prefix}: action/gesture set/trigger/end state missing`);
    check(whole(cohort?.expectedAttemptCount) && cohort.expectedAttemptCount >= MIN_NATIVE_GESTURES, `${prefix}: planned gesture attempts missing`);
    const group = groups.get(cohort?.gestureSetId) ?? [];
    group.push(cohort);
    groups.set(cohort?.gestureSetId, group);
    for (const stageName of ['baseline', 'final']) {
      const stage = cohort?.[stageName], stageLabel = `${prefix}.${stageName}`;
      const trusted = stageName === 'baseline' ? baseline : expected;
      check(stage?.status === 'measured' && stage?.hostWorkload === 'idle-verified', `${stageLabel}: exploratory/competing-workload/unavailable capture cannot pass`);
      check(date(stage?.capturedAt) && date(input?.registeredAt)
        && Date.parse(input.registeredAt) <= Date.parse(stage.capturedAt), `${stageLabel}: capture must follow preregistration`);
      const identity = stage?.identity;
      check(IDENTITY_KEYS.every(key => identity?.[key] === trusted?.[key]) && sameSet(identity?.apkAbis, trusted?.apkAbis), `${stageLabel}: trusted identity mismatch`);
      check(identity?.installMode === 'fresh', `${stageLabel}: exact fresh APK installation required`);
      for (const key of ['apkRef', 'installedApkRef']) {
        ref(identity?.[key], ['apk'], `${stageLabel}.${key}`);
        check(artifacts.get(identity?.[key])?.sha256 === trusted?.apkSha256, `${stageLabel}: APK bytes must match trusted identity`);
      }
      check(distinctApkArtifacts(identity, artifacts), `${stageLabel}: original and pulled APK require distinct artifact IDs and paths`);
      for (const key of ['badgingRef', 'installedReadbackRef']) ref(identity?.[key], ['log'], `${stageLabel}.${key}`);
      for (const [key, kinds] of [['traceRef', ['trace']], ['queryRef', ['query']], ['csvRef', ['report']],
        ['configRef', ['query']], ['analysisRef', ['log']], ['stderrRef', ['log']], ['environmentRef', ['log']], ['workloadRef', ['log']], ['datasetRef', ['report']]]) {
        ref(stage?.[key], kinds, `${stageLabel}.${key}`);
      }
      const provenanceIds = ['analysisRef', 'environmentRef', 'workloadRef'].map(key => stage?.[key]);
      const provenancePaths = provenanceIds.map(id => artifactPath(artifacts.get(id)));
      const provenanceHashes = provenanceIds.map(id => artifacts.get(id)?.sha256);
      check(provenanceIds.every(nonempty) && provenancePaths.every(nonempty)
        && provenanceHashes.every(hash => HASH.test(hash ?? ''))
        && [provenanceIds, provenancePaths, provenanceHashes].every(values => new Set(values).size === values.length),
      `${stageLabel}: analysis, environment and idle-workload require independent artifact IDs, paths and bytes`);
      check(nonempty(stage?.analyzerVersion), `${stageLabel}: exact analyzer version missing`);
      const env = stage?.environment;
      check(nonempty(env?.deviceFingerprint) && UUID.test(env?.bootId ?? '') && env?.apiLevel === 36
        && ABIS.includes(env?.runtimeAbi) && entries(identity?.apkAbis).includes(env?.runtimeAbi), `${stageLabel}: Android 16 runtime identity missing`);
      check(['widthPx', 'heightPx', 'densityDpi', 'ramMiB', 'cpuCores'].every(key => whole(env?.[key]) && env[key] > 0)
        && Number.isFinite(env?.fontScale) && env.fontScale >= 1 && Number.isFinite(env?.refreshRateHz) && env.refreshRateHz > 0
        && nonempty(env?.gpuMode) && ['light', 'dark'].includes(env?.theme) && typeof env?.reducedMotion === 'boolean'
        && ['ready-cached', 'ready-online'].includes(env?.appState) && HASH.test(env?.datasetSha256 ?? ''), `${stageLabel}: measured paired environment incomplete`);
      check(artifacts.get(stage?.datasetRef)?.sha256 === env?.datasetSha256, `${stageLabel}: actual paired dataset hash missing`);
      check(stage?.attemptedGestureCount === cohort?.expectedAttemptCount && whole(stage?.attemptedGestureCount), `${stageLabel}: attempts must match preregistered count`);
      const corrections = entries(stage?.operatorCorrections);
      check(Array.isArray(stage?.operatorCorrections) && corrections.every(item => nonempty(item?.attemptId))
        && new Set(corrections.map(item => item?.attemptId)).size === corrections.length, `${stageLabel}: operator corrections need unique attempt IDs`);
      for (const correction of corrections) {
        check(['wrong-target', 'input-command-rejected', 'interrupted-capture'].includes(correction?.reason)
          && (correction?.gestureKey === null || nonempty(correction?.gestureKey)), `${stageLabel}: bounded operator correction reason/key required`);
        ref(correction?.ref, ['log', 'report'], `${stageLabel} operator correction`);
      }
      const summary = stage?.summary;
      check(SUMMARY_KEYS.filter(key => key.endsWith('Count')).every(key => whole(summary?.[key]))
        && summary?.percentileStatus === 'measured' && summary?.admittedGestureCount >= MIN_NATIVE_GESTURES
        && summary?.unavailableGestureCount === 0 && summary?.unclassifiedInputCount === 0
        && typeof summary?.p95Ns === 'string' && /^(0|[1-9]\d*)$/.test(summary.p95Ns)
        && BigInt(summary.p95Ns) <= BigInt(Number.MAX_SAFE_INTEGER)
        && Number.isFinite(summary?.p95Ms) && summary.p95Ms === Number(summary.p95Ns) / 1_000_000
        && HASH.test(summary?.sampleListSha256 ?? ''), `${stageLabel}: 30 unique qualifying gestures and exact percentile required`);
      check(summary?.admittedGestureCount + summary?.operatorExcludedGestureCount + summary?.unavailableGestureCount === summary?.receivedGestureCount
        && summary?.operatorExcludedGestureCount === corrections.filter(item => item.gestureKey !== null).length,
      `${stageLabel}: received/admitted/unavailable/excluded gesture counts disagree`);
      check(summary?.receivedGestureCount + corrections.filter(item => item.gestureKey === null).length === stage?.attemptedGestureCount,
        `${stageLabel}: missing attempted gestures cannot disappear`);
    }
    check(ENVIRONMENT_KEYS.every(key => cohort?.baseline?.environment?.[key] === cohort?.final?.environment?.[key]), `${prefix}: baseline/final environment must match`);
    check(cohort?.baseline?.analyzerVersion === cohort?.final?.analyzerVersion
      && artifacts.get(cohort?.baseline?.configRef)?.sha256 === artifacts.get(cohort?.final?.configRef)?.sha256,
    `${prefix}: paired analyzer and capture configuration must match`);
  }
  const captureRoles = ['traceRef', 'csvRef', 'analysisRef'];
  const baselineCaptures = new Set(cohorts.flatMap(cohort => captureRoles.flatMap(role => {
    const id = cohort?.baseline?.[role], artifact = artifacts.get(id);
    return [`${role}/id/${id}`, `${role}/path/${artifactPath(artifact)}`, `${role}/hash/${artifact?.sha256}`];
  })));
  check(cohorts.every(cohort => captureRoles.every(role => {
    const id = cohort?.final?.[role], artifact = artifacts.get(id);
    return ![`${role}/id/${id}`, `${role}/path/${artifactPath(artifact)}`, `${role}/hash/${artifact?.sha256}`]
      .some(key => baselineCaptures.has(key));
  })), `${label}: baseline/final capture trace, CSV and analysis must be distinct, including bytes`);
  for (const group of groups.values()) {
    if (group.some(cohort => cohort?.actionKind !== 'move-scroll')) {
      check(group.length === 2 && sameSet(group.map(cohort => cohort?.actionKind), ['down-feedback', 'up-activation']),
        `${label}: each tap gesture set must link one DOWN cohort with one UP cohort`);
      const [down, up] = group;
      check(['journeyId', 'trigger', 'endState', 'expectedAttemptCount'].every(key => down?.[key] === up?.[key]), `${label}: paired tap workload differs`);
      for (const stage of ['baseline', 'final']) check(['traceRef', 'csvRef', 'queryRef', 'configRef', 'environmentRef'].every(key => down?.[stage]?.[key] === up?.[stage]?.[key]),
        `${label}: DOWN and UP must reference the same captured tap gestures`);
    } else check(group.length === 1, `${label}: swipe gesture sets cannot duplicate cohorts`);
  }
  check(timing?.inputLatencyAggregation === 'maximum-final-cohort-p95'
    && timing?.inputLatencyP95Ms === Math.max(...cohorts.map(cohort => cohort?.final?.summary?.p95Ms ?? NaN)),
  `${label}: legacy scalar must be the maximum final cohort P95, never pooled input actions`);
  return errors;
}

/** Recomputes exact ns math from retained CSV. Raw trace authenticity remains reviewable evidence. */
export function verifyNativeInputArtifacts(timing, expected, contents, artifacts) {
  const errors = [];
  const input = timing?.nativeInput;
  const text = id => contents.get(id)?.toString('utf8');
  const summaries = new Map();
  const usedGestures = new Map();
  try {
    const plan = JSON.parse(text(input?.planRef) ?? 'null');
    const descriptors = entries(input?.cohorts).map(({ id, gestureSetId, journeyId, actionKind, trigger, endState, expectedAttemptCount }) =>
      ({ id, gestureSetId, journeyId, actionKind, trigger, endState, expectedAttemptCount }));
    if (plan?.schemaVersion !== 1 || plan?.registeredAt !== input?.registeredAt
      || JSON.stringify(plan?.cohorts) !== JSON.stringify(descriptors)) throw new Error('preregistered plan differs from declared cohort workload');
    for (const stageName of ['baseline', 'final']) {
      const trusted = stageName === 'baseline' ? expected?.baseline : expected;
      if (IDENTITY_KEYS.some(key => plan?.identity?.[stageName]?.[key] !== trusted?.[key])
        || !sameSet(plan?.identity?.[stageName]?.apkAbis, trusted?.apkAbis)) throw new Error('preregistered plan identity differs from trusted APK/source');
    }
    if (entries(input?.cohorts).some(cohort => ['baseline', 'final'].some(stage => ENVIRONMENT_KEYS.some(key =>
      plan?.environment?.[key] !== cohort?.[stage]?.environment?.[key])))) throw new Error('capture environment differs from preregistered paired workload');
  } catch (error) { errors.push(`Native input plan: ${error.message}`); }
  for (const cohort of entries(input?.cohorts)) for (const stageName of ['baseline', 'final']) {
    const stage = cohort?.[stageName], label = `Native input.${cohort?.id}.${stageName}`;
    const trusted = stageName === 'baseline' ? expected?.baseline : expected;
    try {
      const badging = parseAaptBadging(text(stage?.identity?.badgingRef));
      const readback = text(stage?.identity?.installedReadbackRef) ?? '';
      if (badging.packageName !== trusted?.packageName || badging.versionName !== trusted?.versionName
        || Number(badging.versionCode) !== trusted?.versionCode || !sameSet(badging.supportedAbis, trusted?.apkAbis)
        || !readback.includes(`Package [${trusted?.packageName}]`) || /\bversionName=(\S+)/.exec(readback)?.[1] !== trusted?.versionName
        || Number(/\bversionCode=(\d+)/.exec(readback)?.[1]) !== trusted?.versionCode) throw new Error('actual APK/install readback differs from trusted identity');
      if (text(stage?.queryRef)?.replace(/\r\n/g, '\n') !== renderNativeInputQuery(trusted?.packageName)) throw new Error('retained query differs from the checked-in native bridge query');
      const config = text(stage?.configRef) ?? '';
      if (!completeCaptureConfig(config, trusted?.packageName)) throw new Error('native input/frame capture configuration incomplete: gfx/view/input and target app required');
      const analysis = JSON.parse(text(stage?.analysisRef) ?? 'null');
      if (analysis?.schemaVersion !== 1 || analysis?.exitCode !== 0 || analysis?.analyzerVersion !== stage?.analyzerVersion
        || ['traceRef', 'queryRef', 'csvRef', 'configRef', 'stderrRef'].some(key => analysis?.[key] !== stage?.[key])
        || ['trace', 'query', 'csv', 'config'].some(key => analysis?.[`${key}Sha256`] !== artifacts.get(stage?.[`${key}Ref`])?.sha256)) {
        throw new Error('analysis command/hash bindings incomplete or inconsistent');
      }
      const corrections = entries(stage?.operatorCorrections);
      const summary = summarizeNativeInputCsv(text(stage?.csvRef) ?? '', { packageName: trusted?.packageName,
        actionKind: cohort?.actionKind, excludedGestureKeys: corrections.map(item => item.gestureKey).filter(key => key !== null) });
      if (SUMMARY_KEYS.some(key => stage?.summary?.[key] !== summary[key])
        || stage?.summary?.sampleListSha256 !== nativeSampleListSha256(summary)) throw new Error('recorded counts/percentile/sample list differ from retained native observations');
      summaries.set(`${cohort.gestureSetId}/${stageName}/${cohort.actionKind}`, summary);
      for (const gesture of summary.gestures) {
        const key = `${stageName}/${stage.traceRef}/${cohort.actionKind}/${gesture.key}`;
        if (usedGestures.has(key) && usedGestures.get(key) !== cohort.id) throw new Error('same gestures reused across different workload cohorts');
        usedGestures.set(key, cohort.id);
      }
    } catch (error) { errors.push(`${label}: ${error.message}`); }
  }
  for (const cohort of entries(input?.cohorts).filter(item => item?.actionKind === 'down-feedback')) {
    for (const stage of ['baseline', 'final']) {
      const down = summaries.get(`${cohort.gestureSetId}/${stage}/down-feedback`);
      const up = summaries.get(`${cohort.gestureSetId}/${stage}/up-activation`);
      const upCohort = entries(input?.cohorts).find(item => item?.gestureSetId === cohort.gestureSetId && item?.actionKind === 'up-activation');
      const downCorrections = entries(cohort?.[stage]?.operatorCorrections);
      const upCorrections = entries(upCohort?.[stage]?.operatorCorrections);
      const correctionsLinked = sameSet(downCorrections.map(item => item.attemptId), upCorrections.map(item => item.attemptId))
        && downCorrections.every(item => {
          const paired = upCorrections.find(other => other.attemptId === item.attemptId);
          return paired?.reason === item.reason && (paired.gestureKey === null || item.gestureKey === null || paired.gestureKey === item.gestureKey);
        });
      if (!down || !up || !sameSet(down.gestures.filter(item => item.available).map(item => item.key), up.gestures.filter(item => item.available).map(item => item.key))
        || !correctionsLinked) {
        errors.push(`Native input.${cohort.gestureSetId}.${stage}: DOWN/UP must link the same taps and operator corrections`);
      }
    }
  }
  return errors;
}
