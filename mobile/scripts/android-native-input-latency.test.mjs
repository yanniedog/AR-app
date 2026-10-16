import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { admitNativeInputRow, parseNativeInputCsv, renderNativeInputQuery, summarizeNativeInputCsv } from './android-native-input-latency.mjs';
import { nativeRow, nativeCsv, nativeInterruptedGesture } from './fixtures/android-native-input.fixture.mjs';

const options = { packageName: 'example.test.rates', actionKind: 'down-feedback' };
const rows = count => Array.from({ length: count }, (_, index) => nativeRow(index));
const unavailable = (row, status, changes) => ({ ...row, ...changes, association_status: status, original_input_to_present_ns: null });

// SYNTHETIC trace tables, not native measurements. Execute the checked-in query
// with only Perfetto module/DDL syntax and scalar functions adapted for SQLite.
function querySyntheticTrace(sourceRows, { unreceivedIds = [], missingOriginalIds = [] } = {}) {
  const database = new DatabaseSync(':memory:');
  const args = new Map();
  const absentReceipts = new Set(unreceivedIds), absentOriginals = new Set(missingOriginalIds);
  const number = value => value === null ? null : BigInt(value);
  try {
    database.exec(`
      CREATE TABLE android_motion_events (event_id INTEGER, action INTEGER, device_id INTEGER, source INTEGER, arg_set_id INTEGER);
      CREATE TABLE android_input_events (input_event_id TEXT, upid INTEGER, pid INTEGER, process_name TEXT,
        normalized_event_channel TEXT, read_time INTEGER, is_speculative_frame INTEGER);
      CREATE TABLE thread_slice (id INTEGER, ts INTEGER, upid INTEGER, process_name TEXT, thread_name TEXT, name TEXT);
      CREATE TABLE actual_frame_timeline_slice (id INTEGER, upid INTEGER, surface_frame_token INTEGER,
        display_frame_token INTEGER, layer_name TEXT, present_type TEXT, dur INTEGER, ts INTEGER);
      CREATE TABLE process (upid INTEGER, name TEXT);
      INSERT INTO process VALUES (7, '/system/bin/surfaceflinger');
      CREATE TABLE stats (severity TEXT, value INTEGER);
    `);
    database.function('extract_arg', { useBigIntArguments: true }, (id, name) => args.get(String(id))?.[name] ?? null);
    database.function('to_monotonic', { useBigIntArguments: true }, value => value);
    database.function('unhex', value => value === null ? null : BigInt(value.startsWith('0x') ? value : `0x${value}`));
    database.function('str_split', (value, separator, index) => value?.split(separator)[index] ?? null);
    const original = database.prepare('INSERT INTO android_motion_events VALUES (?, ?, ?, ?, ?)');
    const received = database.prepare('INSERT INTO android_input_events VALUES (?, ?, ?, ?, ?, ?, ?)');
    const bridge = database.prepare('INSERT INTO thread_slice VALUES (?, ?, ?, ?, ?, ?)');
    const frame = database.prepare('INSERT INTO actual_frame_timeline_slice VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    sourceRows.forEach((row, index) => {
      args.set(String(index), { event_time_nanos: number(row.original_event_time_monotonic), down_time_nanos: number(row.down_time_monotonic) });
      if (!absentOriginals.has(row.input_event_id)) original.run(number(row.input_event_id_u32), number(row.action),
        number(row.device_id), number(row.source), index);
      if (absentReceipts.has(row.input_event_id)) return;
      received.run(row.input_event_id, number(row.upid), number(row.pid), row.process_name,
        row.normalized_event_channel, number(row.read_time), number(row.legacy_is_speculative_frame));
      if (row.native_frame_candidate_count === null) return;
      bridge.run(index * 3, number(row.native_trace_monotonic), number(row.upid), row.process_name, 'RenderThread',
        `frameTimelineInfo(frameNumber=${row.native_buffer_frame_number}, vsyncId=${row.native_vsync_id}, inputEventId=${row.input_event_id})`);
      const displayToken = 200000 + index;
      frame.run(index * 3 + 1, number(row.upid), number(row.native_vsync_id), displayToken,
        row.layer_name, row.app_present_type, number(row.app_frame_duration), number(row.native_trace_monotonic));
      frame.run(index * 3 + 2, 7, null, displayToken, null, row.display_present_type,
        number(row.display_frame_duration), number(row.actual_present_monotonic) - number(row.display_frame_duration));
    });
    const sql = renderNativeInputQuery(options.packageName)
      .replace(/^INCLUDE PERFETTO MODULE [^\n]+;\n/gm, '').replace('CREATE PERFETTO TABLE', 'CREATE TABLE');
    const boundary = sql.indexOf('\nSELECT *,');
    assert.notEqual(boundary, -1);
    database.exec(sql.slice(0, boundary));
    const statement = database.prepare(sql.slice(boundary));
    statement.setReadBigInts(true);
    return statement.all().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key, typeof value === 'bigint' ? String(value) : value])));
  } finally { database.close(); }
}

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

test('admits only the exact preregistered touchscreen event source, never mouse, stylus or combined sources', () => {
  assert.equal(admitNativeInputRow(nativeRow(0, { source: '4098' }), options.packageName).status, 'direct_native_frame_info');
  for (const source of ['8194', '16386', '20482', '4099', '0', null]) {
    const sample = unavailable(nativeRow(40, { source }), 'touchscreen_source_mismatch');
    assert.equal(admitNativeInputRow(sample, options.packageName).status, 'touchscreen_source_mismatch');
    const summary = summarizeNativeInputCsv(nativeCsv([...rows(30), sample]), options);
    assert.equal(summary.admittedGestureCount, 30);
    assert.equal(summary.unavailableGestureCount, 1);
    assert.equal(summary.p95Ms, null);
    assert.throws(() => admitNativeInputRow({ ...sample, association_status: 'direct_native_frame_info' }, options.packageName), /touchscreen_source_mismatch/);
  }
  const sqlRows = querySyntheticTrace([nativeRow(0), nativeRow(1, { source: '20482' })]);
  assert.deepEqual(sqlRows.map(row => row.association_status), ['direct_native_frame_info', 'touchscreen_source_mismatch']);
  assert.equal(summarizeNativeInputCsv(nativeCsv(sqlRows), options).unavailableGestureCount, 1);
});

test('real SQL preserves an unreceived FIRST MOVE instead of substituting a later presented MOVE', () => {
  const first = nativeRow(40, { action: 2 });
  const later = nativeRow(40, { action: 2, offsetNs: 50_000_000n, input_event_id: '0x2710', input_event_id_u32: '10000' });
  const sqlRows = querySyntheticTrace([...rows(30).map((_, index) => nativeRow(index, { action: 2 })), nativeRow(40), first, later],
    { unreceivedIds: [first.input_event_id] });
  assert.equal(sqlRows.length, 33);
  const lost = sqlRows.find(row => row.input_event_id === first.input_event_id);
  assert.equal(lost.association_status, 'app_receipt_missing');
  assert.equal(lost.upid, null);
  assert.equal(lost.normalized_event_channel, null);
  assert.equal(lost.app_frame_candidate_count, '0');
  assert.equal(lost.display_frame_candidate_count, '0');
  assert.equal(lost.raw_legacy_speculative_flags, null);
  assert.equal(lost.original_event_time_monotonic, first.original_event_time_monotonic);
  const admitted = admitNativeInputRow(lost, options.packageName);
  assert.deepEqual(admitted.rawLegacyFlags, []);
  assert.equal(admitted.gestureKey, admitNativeInputRow(later, options.packageName).gestureKey);
  const summary = summarizeNativeInputCsv(nativeCsv(sqlRows), { ...options, actionKind: 'move-scroll' });
  assert.equal(summary.receivedInputCount, 32);
  assert.equal(summary.receivedGestureCount, 31);
  assert.equal(summary.admittedGestureCount, 30);
  assert.equal(summary.unavailableGestureCount, 1);
  assert.equal(summary.gestures.find(item => item.key === admitted.gestureKey).representativeInputId, first.input_event_id);
  assert.equal(summary.p95Ms, null);
});

test('real SQL keeps an unreceived CANCEL and every missing tap/swipe phase unavailable', () => {
  const cancel = nativeRow(40, { action: 3 });
  const samples = [...rows(30).flatMap((_, index) => [nativeRow(index), nativeRow(index, { action: 1 })]),
    nativeRow(40), nativeRow(40, { action: 1 }), cancel];
  const sqlRows = querySyntheticTrace(samples, { unreceivedIds: [cancel.input_event_id] });
  assert.equal(sqlRows.length, samples.length);
  const lostCancel = sqlRows.find(row => row.input_event_id === cancel.input_event_id);
  assert.equal(lostCancel.action, '3');
  assert.equal(lostCancel.association_status, 'app_receipt_missing');
  assert.equal(lostCancel.raw_receive_record_count, null);
  for (const actionKind of ['down-feedback', 'up-activation']) {
    const summary = summarizeNativeInputCsv(nativeCsv(sqlRows), { ...options, actionKind });
    assert.equal(summary.admittedGestureCount, 30);
    assert.equal(summary.unavailableGestureCount, 1);
    assert.equal(summary.unclassifiedInputCount, 1);
    assert.equal(summary.p95Ms, null);
  }
  for (const [actionKind, action] of Object.entries({ 'down-feedback': 0, 'up-activation': 1, 'move-scroll': 2 })) {
    const missing = nativeRow(40, { action });
    const phases = querySyntheticTrace([...rows(30).map((_, index) => nativeRow(index, { action })), missing],
      { unreceivedIds: [missing.input_event_id] });
    const summary = summarizeNativeInputCsv(nativeCsv(phases), { ...options, actionKind });
    assert.equal(summary.receivedGestureCount, 31);
    assert.equal(summary.unavailableGestureCount, 1);
    assert.equal(summary.gestures.at(-1).representativeInputId, missing.input_event_id);
    assert.equal(summary.p95Ms, null);
  }
});

test('real SQL also retains app receipts whose original motion record is missing', () => {
  const sample = nativeRow(0);
  const sqlRows = querySyntheticTrace([sample], { missingOriginalIds: [sample.input_event_id] });
  assert.equal(sqlRows.length, 1);
  assert.equal(sqlRows[0].association_status, 'original_input_missing');
  assert.equal(sqlRows[0].input_event_id, sample.input_event_id);
  const summary = summarizeNativeInputCsv(nativeCsv(sqlRows), options);
  assert.equal(summary.unclassifiedInputCount, 1);
  assert.equal(summary.unavailableGestureCount, 1);
  assert.equal(summary.p95Ms, null);
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
  assert.equal(summary.receivedGestureCount, 31);
  assert.equal(summary.unavailableGestureCount, 1);
  assert.equal(summary.p95Ms, null);
});

test('CANCEL and encoded/unknown motion actions remain unavailable attempts in every declared cohort', () => {
  for (const action of [3, 4, 5, 6, 257, 261, 65535]) {
    const terminal = nativeInterruptedGesture(40, action)[1];
    for (const [actionKind, measuredAction] of Object.entries({ 'down-feedback': 0, 'up-activation': 1, 'move-scroll': 2 })) {
      const samples = rows(30).map((_, index) => nativeRow(index, { action: measuredAction }));
      const summary = summarizeNativeInputCsv(nativeCsv([...samples, terminal]), { ...options, actionKind });
      assert.equal(summary.observations.length, 31);
      assert.equal(summary.observations.at(-1).row.action, String(action));
      assert.equal(summary.observations.at(-1).status, 'native_frame_mapping_missing');
      assert.deepEqual(summary.observations.at(-1).rawLegacyFlags, ['1']);
      assert.equal(summary.receivedGestureCount, 31);
      assert.equal(summary.receivedInputCount, 31);
      assert.equal(summary.admittedGestureCount, 30);
      assert.equal(summary.unclassifiedInputCount, 1);
      assert.equal(summary.unavailableGestureCount, 1);
      assert.equal(summary.unavailableObservationCount, 1);
      assert.equal(summary.percentileStatus, 'unavailable');
      assert.equal(summary.p95Ns, null);
      assert.equal(summary.p95Ms, null);
    }
  }
});

test('a cancelled tap invalidates its linked DOWN and UP even when 30 other gestures qualify', () => {
  const [down, cancel] = nativeInterruptedGesture(40);
  const up = nativeRow(40, { action: 1 });
  const samples = [...rows(30).flatMap((_, index) => [nativeRow(index), nativeRow(index, { action: 1 })]), down, up, cancel];
  for (const actionKind of ['down-feedback', 'up-activation']) {
    const summary = summarizeNativeInputCsv(nativeCsv(samples), { ...options, actionKind });
    const interrupted = summary.gestures.find(item => item.key === admitNativeInputRow(down, options.packageName).gestureKey);
    assert.equal(summary.receivedGestureCount, 31);
    assert.equal(summary.admittedGestureCount, 30);
    assert.equal(summary.unavailableGestureCount, 1);
    assert.equal(interrupted.available, false);
    assert.equal(interrupted.latencyNs, null);
    assert.equal(summary.p95Ms, null);
    const excluded = summarizeNativeInputCsv(nativeCsv(samples), { ...options, actionKind, excludedGestureKeys: [interrupted.key] });
    assert.equal(excluded.operatorExcludedGestureCount, 1);
    assert.equal(excluded.unclassifiedInputCount, 1);
    assert.equal(excluded.percentileStatus, 'unavailable');
  }
});

test('unsupported swipe events cannot replace FIRST MOVE or be hidden by a later assigned event', () => {
  const first = unavailable(nativeRow(40, { action: 2 }), 'native_frame_mapping_missing', { native_frame_candidate_count: null });
  const next = nativeRow(40, { action: 2, offsetNs: 50_000_000n, input_event_id: '0x2710', input_event_id_u32: '10000' });
  const cancel = nativeInterruptedGesture(40)[1];
  const samples = [...rows(30).map((_, index) => nativeRow(index, { action: 2 })), first, cancel, next];
  const summary = summarizeNativeInputCsv(nativeCsv(samples), { ...options, actionKind: 'move-scroll' });
  const interrupted = summary.gestures.find(item => item.key === admitNativeInputRow(first, options.packageName).gestureKey);
  assert.equal(interrupted.representativeInputId, first.input_event_id);
  assert.equal(interrupted.available, false);
  assert.equal(summary.unavailableObservationCount, 2);
  assert.equal(summary.unavailableGestureCount, 1);
  assert.equal(summary.unclassifiedInputCount, 1);
  assert.equal(summary.p95Ms, null);
  // Even a native-presented unsupported action is not a supported gesture.
  const mapped = nativeRow(41, { action: 3 });
  const mappedSummary = summarizeNativeInputCsv(nativeCsv([...samples.slice(0, 30), mapped]), { ...options, actionKind: 'move-scroll' });
  assert.equal(mappedSummary.observations.at(-1).status, 'direct_native_frame_info');
  assert.equal(mappedSummary.unavailableObservationCount, 1);
  assert.equal(mappedSummary.unavailableGestureCount, 1);
  assert.equal(mappedSummary.p95Ms, null);
});
