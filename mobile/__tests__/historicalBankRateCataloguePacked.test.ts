import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import snapshot from '../src/data/historicalBankRateCatalogue.snapshot.json';
import producerFixture from './fixtures/history-dag-v1-interoperability.json';
import { packHistoricalBankRateCatalogue, unpackHistoricalBankRateCatalogue, unpackHistoricalBankRateCatalogueAsync, PACKED_HISTORY_LIMITS } from '../src/data/historicalBankRateCataloguePacked';
import { validateHistoricalBankRateCatalogue, type HistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';

const pack = (value: unknown) => packHistoricalBankRateCatalogue(value as HistoricalBankRateCatalogue);
const wire = (nodes: unknown[]) => ({ format: 'ar-history-dag-v1', root: nodes.length - 1, nodes });

test('the Python producer and app share exact Unicode, object-key and reference encoding', () => {
  expect(unpackHistoricalBankRateCatalogue(producerFixture.packed)).toEqual(producerFixture.value);
  expect(pack(producerFixture.value)).toEqual(producerFixture.packed);
});

test('entire bundled catalogue preserves the original JSON including multiplicity, provenance and eligibility', () => {
  const bytes = gunzipSync(Buffer.from(snapshot.gzip_base64, 'base64'));
  expect(bytes.length).toBe(snapshot.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(snapshot.sha256);
  expect(bytes.length).toBeLessThan(10 * 1024 * 1024);
  const packed = JSON.parse(bytes.toString('utf8'));
  const catalogue = unpackHistoricalBankRateCatalogue(packed);
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(true);
  // Recorded from the full original catalogue before build-time packing.
  expect(createHash('sha256').update(JSON.stringify(catalogue)).digest('hex')).toBe(snapshot.catalogue_sha256);
  expect(pack(catalogue)).toEqual(packed);
}, 30_000);

test('identical metadata and arrays share immutable values without dropping repeated rates', async () => {
  const original = { rows: [{ info: 'Repeated eligibility', rates: [5, 5, 5.1] }, { info: 'Repeated eligibility', rates: [5, 5, 5.1] }], empty: [], flags: [true, false, null, -1] };
  const packed = pack(original);
  const decoded = unpackHistoricalBankRateCatalogue(packed) as typeof original;
  expect(decoded).toEqual(original);
  expect(decoded.rows[0]).toBe(decoded.rows[1]);
  expect(await unpackHistoricalBankRateCatalogueAsync(packed)).toEqual(original);
});

test('legacy catalogues pass through for the existing schema validation', () => {
  const legacy = { schema_version: 2 };
  expect(unpackHistoricalBankRateCatalogue(legacy)).toBe(legacy);
  expect(validateHistoricalBankRateCatalogue(unpackHistoricalBankRateCatalogue(pack({ schema_version: 2 })))).toBe(false);
});

test.each([
  [[0, 'A']], // self reference
  [[0, 'B']], // forward reference
  [null, [0, 'g']], // unfinished VLQ
  [null, [0, 'gA']], // noncanonical zero
  [null, [0, 'gggggA']], // overflow VLQ
  [null, [0, '!']],
  [null, [1, 0, 'A']], // shape is not array
  ['x', [0, 'AA'], [1, 1, 'AA']], // duplicate object keys
  ['x', [0, 'A'], [1, 1, '']], // missing value
  ['x', [0, 'A'], [1, 1, 'AA']], // extra value
  [{ unexpected: true }],
  [Infinity],
])('rejects malformed dictionary %#', (...nodes: unknown[]) => {
  expect(unpackHistoricalBankRateCatalogue(wire(nodes))).toBeNull();
});

test('rejects unknown versions, excess nodes, nesting and exponential logical expansion', () => {
  expect(unpackHistoricalBankRateCatalogue({ ...pack({}), format: 'future' })).toBeNull();
  expect(unpackHistoricalBankRateCatalogue({ ...pack({}), root: -1 })).toBeNull();
  expect(unpackHistoricalBankRateCatalogue(wire(new Array(PACKED_HISTORY_LIMITS.nodes + 1).fill(null)))).toBeNull();
  // Each node doubles the preceding subtree; references must not hide a bomb
  // from the subsequent full catalogue schema walk.
  const nodes: unknown[] = ['x'];
  for (let i = 0; i < 28; i++) nodes.push([0, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[i].repeat(2)]);
  expect(unpackHistoricalBankRateCatalogue(wire(nodes))).toBeNull();
  const chain: unknown[] = [null], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 66; i++) chain.push([0, i < 32 ? alphabet[i] : alphabet[(i & 31) | 32] + alphabet[i >>> 5]]);
  expect(unpackHistoricalBankRateCatalogue(wire(chain))).toBeNull();
  let deep: unknown = null;
  for (let i = 0; i < 66; i++) deep = [deep];
  expect(() => pack(deep)).toThrow(/depth/);
});

test('preserves JSON own prototype-looking keys without prototype pollution', () => {
  const original = JSON.parse('{"__proto__":{"polluted":true},"constructor":"text"}');
  const decoded = unpackHistoricalBankRateCatalogue(pack(original));
  expect(JSON.stringify(decoded)).toBe(JSON.stringify(original));
  expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
  expect(Object.prototype).not.toHaveProperty('polluted');
});

test('large reference lists unpack cooperatively with bounded checkpoints', async () => {
  const original = Array.from({ length: 20_000 }, (_, i) => ({ key: String(i), rates: [5, 5] }));
  const yieldControl = jest.fn(async () => {});
  expect(await unpackHistoricalBankRateCatalogueAsync(pack(original), { yieldControl, sliceMs: 0 })).toEqual(original);
  expect(yieldControl.mock.calls.length).toBeGreaterThan(40);
});
