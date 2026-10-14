// SYNTHETIC validator fixtures only. Never use these as Android evidence.
import { createHash } from 'node:crypto';
import { NATIVE_INPUT_COLUMNS, renderNativeInputQuery, summarizeNativeInputCsv } from '../android-native-input-latency.mjs';
import { NATIVE_INPUT_METRIC, nativeSampleListSha256 } from '../android-native-input-evidence.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function nativeRow(index, { packageName = 'example.test.rates', action = 0, latencyNs = 80_000_000n,
  offsetNs = 0n, ...changes } = {}) {
  const down = 9_007_199_254_740_993n + BigInt(index) * 1_000_000_000n;
  const original = down + BigInt(action) * 10_000_000n + offsetNs;
  const eventId = BigInt(1000 + index * 3 + action);
  const vsync = String(10000 + index * 3 + action);
  const window = `${packageName}/${packageName}.MainActivity`;
  return {
    ...Object.fromEntries(NATIVE_INPUT_COLUMNS.map(key => [key, null])),
    input_event_id: `0x${eventId.toString(16)}`, input_event_id_u32: eventId.toString(), action: String(action),
    device_id: '12', source: '20482', upid: '2', pid: '2087', process_name: packageName,
    normalized_event_channel: window, reader_time_candidate_count: '1', read_time: (original + 100_000n).toString(),
    original_event_time_monotonic: original.toString(), down_time_monotonic: down.toString(),
    read_time_monotonic: (original + 100_000n).toString(), distinct_input_identity_count: '1',
    received_window_candidate_count: '1',
    native_frame_candidate_count: '1', native_buffer_frame_number: String(index + 1), native_vsync_id: vsync,
    native_trace_slice_id: String(index * 3), native_trace_monotonic: (original + 200_000n).toString(),
    app_frame_candidate_count: '1', app_frame_slice_id: String(index * 3 + 1), surface_frame_token: vsync,
    layer_name: `TX - ${window}#111`, app_present_type: 'On-time Present', app_frame_duration: '1000000',
    display_frame_candidate_count: '1', display_frame_slice_id: String(index * 3 + 2), display_frame_token: String(20000 + index),
    display_present_type: 'On-time Present', display_frame_duration: '1000000',
    actual_present_monotonic: (original + latencyNs).toString(), legacy_is_speculative_frame: '1',
    raw_legacy_speculative_flags: '1', association_status: 'direct_native_frame_info', trace_error_count: '0',
    trace_data_loss_count: '0', original_input_to_present_ns: latencyNs.toString(),
    raw_equivalent_record_count: '1', raw_receive_record_count: '1', raw_equivalent_bridge_count: '1', ...changes,
  };
}
export function nativeCsv(rows) {
  const cell = value => value === null ? '[NULL]' : `"${String(value).replaceAll('"', '""')}"`;
  return `${NATIVE_INPUT_COLUMNS.map(cell).join(',')}\n${rows.map(row => NATIVE_INPUT_COLUMNS.map(key => cell(row[key])).join(',')).join('\n')}\n`;
}
export function buildNativeInputFixture(expected) {
  const files = {}, kinds = {};
  const add = (id, kind, value) => { files[id] = value; kinds[id] = kind; return id; };
  add('baseline-apk', 'apk', 'synthetic baseline APK fixture');
  add('baseline-installed', 'apk', 'synthetic baseline APK fixture');
  add('baseline-badging', 'log', `package: name='${expected.baseline.packageName}' versionCode='${expected.baseline.versionCode}' versionName='${expected.baseline.versionName}'\nnative-code: ${expected.baseline.apkAbis.map(abi => `'${abi}'`).join(' ')}\n`);
  add('baseline-readback', 'log', `Package [${expected.baseline.packageName}]\n versionCode=${expected.baseline.versionCode}\n versionName=${expected.baseline.versionName}\n`);
  add('native-query', 'query', renderNativeInputQuery(expected.packageName));
  add('native-config', 'query', 'SYNTHETIC config fixture\nandroid.input.inputevent android.surfaceflinger.frametimeline linux.ftrace TRACE_MODE_TRACE_ALL trace_dispatcher_input_events: true trace_dispatcher_window_dispatch: true');
  add('native-environment', 'log', 'synthetic measured environment readback');
  add('native-workload', 'log', 'synthetic idle workload readback');
  add('native-stderr', 'log', 'synthetic trace processor progress only');
  add('native-dataset', 'report', 'synthetic paired dataset');
  const environment = { deviceFingerprint: 'synthetic/userdebug/test-keys', bootId: '4fa90106-71d1-41e2-8334-c4e17a2aaebf',
    apiLevel: 36, runtimeAbi: 'x86_64', widthPx: 1080, heightPx: 2400, densityDpi: 420, fontScale: 1,
    refreshRateHz: 60, ramMiB: 2560, cpuCores: 2, gpuMode: 'host', theme: 'light', reducedMotion: false,
    appState: 'ready-cached', datasetSha256: hash('synthetic paired dataset') };
  const makeStage = (stageName, gestureSetId, actionKind) => {
    const prefix = `${stageName}-${gestureSetId}`;
    const latencyNs = stageName === 'baseline' ? 100_000_000n : 80_000_000n;
    const identity = stageName === 'baseline' ? { ...expected.baseline, apkRef: 'baseline-apk', installedApkRef: 'baseline-installed',
      badgingRef: 'baseline-badging', installedReadbackRef: 'baseline-readback', installMode: 'fresh' }
      : { ...expected, baseline: undefined, apkRef: 'apk', installedApkRef: 'installed', badgingRef: 'badging', installedReadbackRef: 'readback', installMode: 'fresh' };
    const rows = Array.from({ length: 30 }, (_, index) => gestureSetId === 'tap'
      ? [nativeRow(index, { action: 0, latencyNs }), nativeRow(index, { action: 1, latencyNs })]
      : [nativeRow(index, { action: 2, latencyNs })]).flat();
    const traceRef = add(`${prefix}-trace`, 'trace', `synthetic raw ${prefix} trace`);
    const csvRef = add(`${prefix}-csv`, 'report', nativeCsv(rows));
    const analysisRef = add(`${prefix}-analysis`, 'log', JSON.stringify({ schemaVersion: 1, exitCode: 0,
      analyzerVersion: 'synthetic TP fixture', traceRef, csvRef, queryRef: 'native-query', configRef: 'native-config', stderrRef: 'native-stderr',
      traceSha256: hash(files[traceRef]), csvSha256: hash(files[csvRef]), querySha256: hash(files['native-query']), configSha256: hash(files['native-config']) }));
    const summary = summarizeNativeInputCsv(files[csvRef], { packageName: expected.packageName, actionKind });
    const { observations: _observations, gestures: _gestures, ...counts } = summary;
    return { status: 'measured', hostWorkload: 'idle-verified', capturedAt: stageName === 'baseline' ? '2026-10-14T09:00:00Z' : '2026-10-14T10:00:00Z',
      identity, traceRef, csvRef, queryRef: 'native-query', configRef: 'native-config', analysisRef, stderrRef: 'native-stderr',
      environmentRef: 'native-environment', workloadRef: 'native-workload', environment: { ...environment },
      datasetRef: 'native-dataset',
      analyzerVersion: 'synthetic TP fixture', attemptedGestureCount: 30, operatorCorrections: [],
      summary: { ...counts, sampleListSha256: nativeSampleListSha256(summary) } };
  };
  const cohorts = Object.keys({ 'down-feedback': 0, 'up-activation': 1, 'move-scroll': 2 }).map(actionKind => {
    const gestureSetId = actionKind === 'move-scroll' ? 'swipe' : 'tap';
    return { id: actionKind, gestureSetId, journeyId: 'sort', actionKind, trigger: `Synthetic ${gestureSetId} trigger`, endState: `Synthetic ${gestureSetId} state`,
      expectedAttemptCount: 30, baseline: makeStage('baseline', gestureSetId, actionKind), final: makeStage('final', gestureSetId, actionKind) };
  });
  const registeredAt = '2026-10-14T08:00:00Z';
  add('native-plan', 'report', JSON.stringify({ schemaVersion: 1, registeredAt, environment,
    identity: { baseline: expected.baseline, final: { ...expected, baseline: undefined } },
    cohorts: cohorts.map(({ baseline: _baseline, final: _final, ...descriptor }) => descriptor) }));
  return { files, kinds, nativeInput: { schemaVersion: 1, associationMethod: 'native-frame-info-id', metric: NATIVE_INPUT_METRIC,
    percentileRule: 'nearest-rank', minimumUniqueGestures: 30, moveRepresentative: 'first-original-move',
    scope: 'release-paired', semanticReadinessSeparate: true, registeredAt, planRef: 'native-plan', cohorts } };
}
