import assert from 'node:assert/strict';
import test from 'node:test';
import { admitNativeInputRow, parseNativeInputCsv, renderNativeInputQuery, summarizeNativeInputCsv } from './android-native-input-latency.mjs';
import { nativeRow, nativeCsv } from './fixtures/android-native-input.fixture.mjs';

const options = { packageName: 'example.test.rates', actionKind: 'down-feedback' };
const rows = count => Array.from({ length: count }, (_, index) => nativeRow(index));
const unavailable = (row, status, changes) => ({ ...row, ...changes, association_status: status, original_input_to_present_ns: null });

test('renders only a validated APK package into the exact native bridge query', () => {
  const query = renderNativeInputQuery(options.packageName);
  assert.match(query, /frameTimelineInfo\(frameNumber=/);
  assert.match(query, /to_monotonic\(sf.ts\+sf.dur\)/);
  assert.match(query, /sf.surface_frame_token IS NULL/);
  assert.match(query, /down_time_nanos/);
  assert.doesNotMatch(query, /__AR_PACKAGE__/);
  for (const value of ["x'; SELECT 1; --", '', 'no-package', 'pkg\nsource']) assert.throws(() => renderNativeInputQuery(value), /package identifier/);
});

test('preserves legacy flag 1 while admitting independent native IDs and exact ns beyond numeric timestamp precision', () => {
  const row = nativeRow(0, { latencyNs: 39_623_957n });
  const admitted = admitNativeInputRow(row, options.packageName);
  assert.deepEqual(admitted.rawLegacyFlags, ['1']);
  assert.equal(row.legacy_is_speculative_frame, '1');
  assert.equal(admitted.latencyNs, 39_623_957n);
  assert.equal(admitted.row.native_trace_slice_id, '0');
  assert.throws(() => admitNativeInputRow({ ...row, legacy_is_speculative_frame: '0' }, options.packageName), /flags were changed/);
  assert.throws(() => admitNativeInputRow({ ...row, original_input_to_present_ns: '39623958' }, options.packageName), /ns arithmetic/);
  const mixed = admitNativeInputRow({ ...row, legacy_is_speculative_frame: null, raw_legacy_speculative_flags: '0,1,null' }, options.packageName);
  assert.deepEqual(mixed.rawLegacyFlags, ['0', '1', 'null']);
  assert.equal(mixed.latencyNs, 39_623_957n);
});

test('requires 30 independent gestures, computes nearest-rank P95 and never treats unsupported rows as zero', () => {
  const samples = rows(30).map((row, index) => nativeRow(index, { latencyNs: BigInt(index + 1) * 1_000_000n }));
  const summary = summarizeNativeInputCsv(nativeCsv(samples), options);
  assert.equal(summary.admittedGestureCount, 30);
  assert.equal(summary.p95Ns, '29000000');
  assert.equal(summary.p95Ms, 29);
  assert.equal(summarizeNativeInputCsv(nativeCsv(samples.slice(0, 29)), options).p95Ms, null);
  const dropped = [...samples, unavailable(nativeRow(30), 'dropped_frame', { app_present_type: 'Dropped Frame' })];
  const incomplete = summarizeNativeInputCsv(nativeCsv(dropped), options);
  assert.equal(incomplete.unavailableGestureCount, 1);
  assert.equal(incomplete.admittedGestureCount, 30);
  assert.equal(incomplete.percentileStatus, 'unavailable');
  assert.equal(incomplete.p95Ns, null);
});

test('links DOWN/UP by down-time but never pools either action or MOVE into one latency distribution', () => {
  const samples = Array.from({ length: 20 }, (_, index) => [nativeRow(index), nativeRow(index, { action: 1 }), nativeRow(index, { action: 2 })]).flat();
  for (const actionKind of ['down-feedback', 'up-activation', 'move-scroll']) {
    const summary = summarizeNativeInputCsv(nativeCsv(samples), { ...options, actionKind });
    assert.equal(summary.receivedInputCount, 20);
    assert.equal(summary.admittedGestureCount, 20);
    assert.equal(summary.p95Ms, null);
  }
  assert.equal(admitNativeInputRow(samples[0], options.packageName).gestureKey, admitNativeInputRow(samples[1], options.packageName).gestureKey);
});

test('counts a swipe once and uses the FIRST original MOVE, never the fastest or a later assigned event', () => {
  const samples = Array.from({ length: 30 }, (_, index) => {
    const first = nativeRow(index, { action: 2, latencyNs: 120_000_000n });
    const next = nativeRow(index, { action: 2, offsetNs: 50_000_000n, latencyNs: 10_000_000n,
      input_event_id: `0x${(5000 + index).toString(16)}`, input_event_id_u32: String(5000 + index) });
    return [first, next];
  }).flat();
  const swipe = { ...options, actionKind: 'move-scroll' };
  const summary = summarizeNativeInputCsv(nativeCsv(samples), swipe);
  assert.equal(summary.receivedInputCount, 60);
  assert.equal(summary.admittedGestureCount, 30);
  assert.equal(summary.p95Ms, 120);
  samples[0] = unavailable(samples[0], 'native_frame_mapping_missing', { native_frame_candidate_count: null });
  const unassignedFirst = summarizeNativeInputCsv(nativeCsv(samples), swipe);
  assert.equal(unassignedFirst.unavailableObservationCount, 1);
  assert.equal(unassignedFirst.unavailableGestureCount, 1);
  assert.equal(unassignedFirst.p95Ms, null);
  assert.equal(unassignedFirst.gestures[0].representativeInputId, samples[0].input_event_id);
});

test('retains ambiguous, dropped, incomplete, unassigned and injected-input observations without a fallback', () => {
  const cases = [
    ['input_id_reused_or_ambiguous', { distinct_input_identity_count: '2' }],
    ['receiving_window_ambiguous', { received_window_candidate_count: '2' }],
    ['reader_time_ambiguous', { reader_time_candidate_count: '2', read_time: null }],
    ['hardware_reader_missing', { device_id: '-1', read_time: null }],
    ['original_time_missing', { original_event_time_monotonic: null }],
    ['gesture_identity_missing', { down_time_monotonic: null }],
    ['native_frame_mapping_missing', { native_frame_candidate_count: null }],
    ['multiple_native_frame_candidates', { native_frame_candidate_count: '2' }],
    ['same_window_app_frame_missing_or_ambiguous', { app_frame_candidate_count: '2' }],
    ['display_frame_missing_or_ambiguous', { display_frame_candidate_count: '2' }],
    ['dropped_frame', { display_present_type: 'Dropped Frame' }],
    ['present_state_unverified', { app_present_type: 'Unknown' }],
    ['incomplete_frame', { display_frame_duration: '-1' }],
    ['clock_conversion_missing', { actual_present_monotonic: null }],
    ['invalid_time_order', { actual_present_monotonic: '1' }],
    ['native_window_binding_unverified', { layer_name: 'TX - another.window#111' }],
  ];
  for (const [status, changes] of cases) {
    const sample = unavailable(nativeRow(0), status, changes);
    assert.equal(admitNativeInputRow(sample, options.packageName).status, status);
    const summary = summarizeNativeInputCsv(nativeCsv([sample]), options);
    assert.equal(summary.p95Ms, null);
    assert.equal(summary.observations[0].row.association_status, status);
  }
  assert.throws(() => admitNativeInputRow(nativeRow(0, { native_vsync_id: 'wrong' }), options.packageName), /association disagrees/);
});

test('duplicate records do not inflate gesture count and conflicting admitted identities are rejected', () => {
  const samples = rows(29);
  const summary = summarizeNativeInputCsv(nativeCsv([...samples, samples[0]]), options);
  assert.equal(summary.receivedInputCount, 29);
  assert.equal(summary.receivedGestureCount, 29);
  assert.equal(summary.p95Ms, null);
  const changed = { ...samples[0], native_buffer_frame_number: '99' };
  assert.throws(() => summarizeNativeInputCsv(nativeCsv([...samples, changed]), options), /Conflicting duplicate/);
});

test('operator corrections stay visible and must identify real received gestures', () => {
  const samples = rows(31);
  samples[0] = unavailable(samples[0], 'dropped_frame', { app_present_type: 'Dropped Frame' });
  const key = admitNativeInputRow(samples[0], options.packageName).gestureKey;
  const summary = summarizeNativeInputCsv(nativeCsv(samples), { ...options, excludedGestureKeys: [key] });
  assert.equal(summary.receivedGestureCount, 31);
  assert.equal(summary.operatorExcludedGestureCount, 1);
  assert.equal(summary.unavailableObservationCount, 1);
  assert.equal(summary.observations[0].status, 'dropped_frame');
  assert.equal(summary.p95Ms, 80);
  assert.throws(() => summarizeNativeInputCsv(nativeCsv(samples), { ...options, excludedGestureKeys: ['invented'] }), /unique received gesture/);
});

test('trace loss, bad counts, malformed CSV, duplicate headers and mixed stdout cannot silently discard inputs', () => {
  const sample = nativeRow(0);
  for (const changes of [{ trace_error_count: '1' }, { trace_data_loss_count: '1' }, { trace_data_loss_count: null }]) {
    assert.throws(() => summarizeNativeInputCsv(nativeCsv([{ ...sample, ...changes }]), options), /errors\/data loss/);
  }
  assert.throws(() => admitNativeInputRow({ ...sample, native_frame_candidate_count: 'NaN' }, options.packageName), /Invalid native count/);
  for (const csv of ['"unclosed', nativeCsv([sample]) + 'Loaded trace\n', nativeCsv([sample]).replace('"action"', '"source"'), nativeCsv([sample]) + nativeCsv([sample])]) {
    assert.throws(() => parseNativeInputCsv(csv));
  }
});

test('unidentified input actions cannot disappear from an otherwise complete touch cohort', () => {
  const unknown = unavailable(nativeRow(40), 'original_input_missing', { input_event_id_u32: null, action: null });
  const summary = summarizeNativeInputCsv(nativeCsv([...rows(30), unknown]), options);
  assert.equal(summary.observations.length, 31);
  assert.equal(summary.unclassifiedInputCount, 1);
  assert.equal(summary.p95Ms, null);
});
