import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_NATIVE_GESTURES = 30;
export const INPUT_ACTIONS = Object.freeze({ 'down-feedback': 0, 'up-activation': 1, 'move-scroll': 2 });
const MEASURED_ACTIONS = new Set(Object.values(INPUT_ACTIONS).map(String));
const PRESENTED = ['Early Present', 'On-time Present', 'Late Present'];
const DECIMAL = /^(0|[1-9]\d*)$/;
const INTEGER = /^-?(0|[1-9]\d*)$/;
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
export const NATIVE_INPUT_COLUMNS = Object.freeze([
  'input_event_id', 'input_event_id_u32', 'action', 'device_id', 'source', 'upid', 'pid',
  'process_name', 'normalized_event_channel', 'reader_time_candidate_count', 'read_time',
  'original_event_time_monotonic', 'down_time_monotonic', 'read_time_monotonic',
  'distinct_input_identity_count', 'native_frame_candidate_count', 'native_buffer_frame_number',
  'received_window_candidate_count',
  'native_vsync_id', 'native_trace_slice_id', 'native_trace_monotonic', 'app_frame_candidate_count',
  'app_frame_slice_id', 'surface_frame_token', 'layer_name', 'app_present_type', 'app_frame_duration',
  'display_frame_candidate_count', 'display_frame_slice_id', 'display_frame_token',
  'display_present_type', 'display_frame_duration', 'actual_present_monotonic',
  'legacy_is_speculative_frame', 'raw_legacy_speculative_flags', 'association_status',
  'trace_error_count', 'trace_data_loss_count', 'original_input_to_present_ns',
  'raw_equivalent_record_count', 'raw_receive_record_count', 'raw_equivalent_bridge_count',
]);

export function renderNativeInputQuery(packageName) {
  if (!PACKAGE.test(packageName ?? '')) throw new Error('Invalid APK package identifier');
  return readFileSync(new URL('./android-native-input-latency.sql', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').replaceAll('__AR_PACKAGE__', packageName);
}

// One clean CSV table from trace_processor stdout; keep stderr in its own log.
// Never ignore malformed rows, an unexpected second table, or mixed log output.
export function parseNativeInputCsv(text) {
  const records = [], row = [];
  let field = '', quoted = false, closed = false;
  const cell = () => { row.push(field); field = ''; closed = false; };
  const record = () => { cell(); records.push(row.splice(0)); };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else if (char === ',') cell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || closed || row.length) record();
    } else {
      if (closed || char === '"') throw new Error('Malformed Perfetto CSV quoting');
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed Perfetto CSV field');
  if (field !== '' || closed || row.length) record();
  const header = records.shift();
  if (!header || new Set(header).size !== header.length
    || NATIVE_INPUT_COLUMNS.some(key => !header.includes(key))) throw new Error('Native input CSV columns missing or repeated');
  return records.map(values => {
    if (values.every((value, index) => value === header[index])) throw new Error('Unexpected second Perfetto CSV table');
    if (values.length !== header.length) throw new Error('Native input CSV row width mismatch');
    return Object.fromEntries(header.map((key, i) => [key, values[i] === '[NULL]' ? null : values[i]]));
  });
}

const integer = value => typeof value === 'string' && INTEGER.test(value) ? BigInt(value) : null;
const positive = value => typeof value === 'string' && DECIMAL.test(value) && BigInt(value) > 0n;
const nonnegative = value => typeof value === 'string' && DECIMAL.test(value);
const equals = (left, right) => integer(left) !== null && integer(left) === integer(right);
const inputIdentity = ({ row }) => JSON.stringify([
  row.upid, row.input_event_id, row.original_event_time_monotonic, row.down_time_monotonic, row.device_id, row.source,
]);

/** Rechecks recorded source columns, preserving flags and every unavailable row. */
export function admitNativeInputRow(row, packageName) {
  if (!PACKAGE.test(packageName ?? '')) throw new Error('Invalid APK package identifier');
  if (row.action !== null && (!nonnegative(row.action) || BigInt(row.action) > 65535n)) throw new Error('Invalid native motion action');
  for (const key of ['reader_time_candidate_count', 'distinct_input_identity_count', 'received_window_candidate_count', 'native_frame_candidate_count',
    'app_frame_candidate_count', 'display_frame_candidate_count', 'raw_equivalent_record_count',
    'raw_receive_record_count', 'raw_equivalent_bridge_count']) {
    if (row[key] !== null && !nonnegative(row[key])) throw new Error(`Invalid native count: ${key}`);
  }
  const flags = row.raw_legacy_speculative_flags?.split(',');
  if (!flags?.length || flags.some(value => !['0', '1', 'null'].includes(value))) throw new Error('Raw legacy flags missing or invalid');
  const distinctFlags = [...new Set(flags)];
  const scalar = distinctFlags.length === 1 && distinctFlags[0] !== 'null' ? distinctFlags[0] : null;
  if (row.legacy_is_speculative_frame !== scalar) throw new Error('Raw legacy flags were changed or collapsed');
  let status;
  const original = integer(row.original_event_time_monotonic);
  const down = integer(row.down_time_monotonic);
  const read = integer(row.read_time_monotonic);
  const native = integer(row.native_trace_monotonic);
  const present = integer(row.actual_present_monotonic);
  const eventId = integer(row.input_event_id_u32);
  if (row.process_name !== packageName || !positive(row.upid) || !positive(row.pid)) status = 'app_identity_mismatch';
  else if (eventId === null || eventId <= 0n || eventId > 0xffffffffn
    || !/^0x[0-9a-f]+$/.test(row.input_event_id ?? '') || BigInt(row.input_event_id) !== eventId) status = 'original_input_missing';
  else if (row.distinct_input_identity_count !== '1') status = 'input_id_reused_or_ambiguous';
  else if (row.received_window_candidate_count !== '1') status = 'receiving_window_ambiguous';
  else if (integer(row.reader_time_candidate_count) > 1n) status = 'reader_time_ambiguous';
  else if (integer(row.device_id) === null || integer(row.device_id) < 0n || !positive(row.read_time)) status = 'hardware_reader_missing';
  else if (original === null || original <= 0n) status = 'original_time_missing';
  else if (down === null || down <= 0n || down > original) status = 'gesture_identity_missing';
  else if (row.native_frame_candidate_count === null) status = 'native_frame_mapping_missing';
  else if (row.native_frame_candidate_count !== '1') status = 'multiple_native_frame_candidates';
  else if (row.app_frame_candidate_count !== '1') status = 'same_window_app_frame_missing_or_ambiguous';
  else if (row.display_frame_candidate_count !== '1') status = 'display_frame_missing_or_ambiguous';
  else if (row.app_present_type === 'Dropped Frame' || row.display_present_type === 'Dropped Frame') status = 'dropped_frame';
  else if (!PRESENTED.includes(row.app_present_type) || !PRESENTED.includes(row.display_present_type)) status = 'present_state_unverified';
  else if (!positive(row.app_frame_duration) || !positive(row.display_frame_duration)) status = 'incomplete_frame';
  else if (read === null || native === null || present === null) status = 'clock_conversion_missing';
  else if (read < original || native < read || present < native) status = 'invalid_time_order';
  else {
    const window = row.normalized_event_channel;
    const prefix = `TX - ${window}#`;
    if (!window?.startsWith(`${packageName}/`) || !row.layer_name?.startsWith(prefix)
      || !/^\d+$/.test(row.layer_name.slice(prefix.length))
      || !equals(row.surface_frame_token, row.native_vsync_id)
      || ['native_buffer_frame_number', 'native_vsync_id', 'display_frame_token'].some(key => !positive(row[key]))
      || ['native_trace_slice_id', 'app_frame_slice_id', 'display_frame_slice_id'].some(key => !nonnegative(row[key]))
      || !positive(row.source) || row.reader_time_candidate_count !== '1') status = 'native_window_binding_unverified';
    else status = 'direct_native_frame_info';
  }
  if (status !== row.association_status) throw new Error(`Recorded native association disagrees with source columns: ${status}`);
  const latency = status === 'direct_native_frame_info' ? present - original : null;
  if ((latency?.toString() ?? null) !== row.original_input_to_present_ns) throw new Error('Native latency ns arithmetic disagrees with timestamps');
  return { row, status, latencyNs: latency, rawLegacyFlags: distinctFlags,
    gestureKey: down !== null && down > 0n ? `${row.device_id}/${row.source}/${down}` : null };
}

export function summarizeNativeInputCsv(text, { packageName, actionKind, excludedGestureKeys = [] }) {
  if (!Object.hasOwn(INPUT_ACTIONS, actionKind)) throw new Error('Native action cohort must be down-feedback, up-activation or move-scroll');
  const observations = parseNativeInputCsv(text).map(row => admitNativeInputRow(row, packageName));
  if (observations.some(({ row }) => integer(row.trace_error_count) !== 0n || integer(row.trace_data_loss_count) !== 0n)) {
    throw new Error('Native trace errors/data loss are not zero or verified');
  }
  // CANCEL, encoded pointer actions and unknown codes are original evidence,
  // not another cohort or permission to omit an interrupted attempt.
  const unsupported = ({ row }) => !MEASURED_ACTIONS.has(row.action);
  const selected = observations.filter(item => item.row.action === String(INPUT_ACTIONS[actionKind]) || unsupported(item));
  const identities = new Map();
  for (const item of selected) {
    const key = `${item.row.upid}/${item.row.input_event_id}`;
    const identity = JSON.stringify(NATIVE_INPUT_COLUMNS.map(column => item.row[column]));
    if (item.status === 'direct_native_frame_info') {
      if (identities.has(key) && identities.get(key) !== identity) throw new Error('Conflicting duplicate native input records');
      identities.set(key, identity);
    }
  }
  const groups = new Map();
  for (const observation of selected) {
    const key = observation.gestureKey ?? `missing/${observation.row.input_event_id}/${observation.row.upid}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  if (new Set(excludedGestureKeys).size !== excludedGestureKeys.length
    || excludedGestureKeys.some(key => !groups.has(key))) throw new Error('Operator exclusion must identify a unique received gesture');
  const gestures = [...groups].map(([key, group]) => {
    const cohortInputs = group.filter(item => !unsupported(item));
    const uniqueInputs = new Set(cohortInputs.map(item => `${item.row.upid}/${item.row.input_event_id}`));
    // The representative is predeclared FIRST MOVE, by original event time.
    // An unassigned first MOVE is unavailable, never replaced by a later one.
    const times = cohortInputs.map(item => integer(item.row.original_event_time_monotonic));
    const firstTime = !times.length || times.some(time => time === null) ? null
      : times.reduce((minimum, time) => time < minimum ? time : minimum);
    const representative = actionKind === 'move-scroll'
      ? cohortInputs.filter(item => integer(item.row.original_event_time_monotonic) === firstTime) : cohortInputs;
    const distinctRepresentatives = new Set(representative.map(item => `${item.row.upid}/${item.row.input_event_id}`));
    const excluded = excludedGestureKeys.includes(key);
    const available = !excluded && cohortInputs.length === group.length
      && representative.length > 0 && distinctRepresentatives.size === 1
      && representative.every(item => item.status === 'direct_native_frame_info')
      && (actionKind === 'move-scroll' || uniqueInputs.size === 1);
    const latency = available ? representative[0].latencyNs : null;
    return { key, excluded, available, representativeInputId: representative[0]?.row.input_event_id ?? null,
      latencyNs: latency?.toString() ?? null };
  });
  const values = gestures.filter(item => item.available).map(item => BigInt(item.latencyNs))
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const unclassifiedInputCount = new Set(observations.filter(unsupported).map(inputIdentity)).size;
  const complete = values.length >= MIN_NATIVE_GESTURES && unclassifiedInputCount === 0
    && gestures.every(item => item.available || item.excluded);
  const p95 = complete ? values[Math.ceil(values.length * 0.95) - 1] : null;
  if (p95 !== null && p95 > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Native percentile exceeds exact numeric-ms range');
  return { observations, gestures, receivedInputCount: new Set(selected.map(inputIdentity)).size,
    receivedGestureCount: gestures.length, admittedGestureCount: values.length,
    operatorExcludedGestureCount: gestures.filter(item => item.excluded).length,
    unavailableGestureCount: gestures.filter(item => !item.available && !item.excluded).length,
    unclassifiedInputCount,
    unavailableObservationCount: selected.filter(item => unsupported(item) || item.status !== 'direct_native_frame_info').length,
    percentileStatus: complete ? 'measured' : 'unavailable', p95Ns: p95?.toString() ?? null,
    p95Ms: p95 === null ? null : Number(p95) / 1_000_000 };
}

// Emits only to stdout; callers retain the rendered query and clean CSV as
// separate hash-bound artifacts. No Android control or trace execution here.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, filename, packageName, actionKind, ...extra] = process.argv.slice(2);
    if (mode === '--query' && filename && !packageName && !extra.length) process.stdout.write(renderNativeInputQuery(filename));
    else if (mode === '--summarize' && filename && packageName && actionKind && !extra.length) {
      console.log(JSON.stringify(summarizeNativeInputCsv(readFileSync(filename, 'utf8'), { packageName, actionKind }),
        (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    } else throw new Error('Use --query PACKAGE or --summarize CSV PACKAGE ACTION_KIND');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
