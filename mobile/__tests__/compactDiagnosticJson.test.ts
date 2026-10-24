import { decodeCompactDiagnosticJson, encodeCompactDiagnosticJson, encodeCompressedDiagnosticJson,
  MAX_COMPRESSED_DIAGNOSTIC_BYTES, MAX_DECODED_DIAGNOSTIC_BYTES } from '../src/lib/compactDiagnosticJson';
import * as catalogueCodec from '../src/data/historicalBankRateCatalogueCompression';

test('dictionary encoding round-trips every JSON value, repeated names, Unicode, null and measured zero', () => {
  const source = { checks: [{ id: '中文', durationMs: 0, diagnostic: { ready: false, actual: null } },
    { id: '中文', durationMs: 0.01, diagnostic: { ready: true, actual: 0 } }], nested: [[], {}, null, false, -1],
    ...JSON.parse('{"__proto__":{"retained":true}}') };
  const body = encodeCompactDiagnosticJson(source);
  expect(decodeCompactDiagnosticJson(body)).toEqual(source);
  expect(encodeCompactDiagnosticJson(source)).toBe(body);
  expect(decodeCompactDiagnosticJson(JSON.stringify(source))).toEqual(source);
  expect({}).not.toHaveProperty('retained');
});
test('rejects damaged dictionaries rather than returning a partial report', () => {
  for (const data of [[999], ['o', 999, 1], ['unknown'], ['o', 0], ['r', 0]]) {
    expect(() => decodeCompactDiagnosticJson(JSON.stringify({ format: 'ar-audit-dict-v1', strings: ['key'], data }))).toThrow();
  }
  expect(() => decodeCompactDiagnosticJson(JSON.stringify({ format: 'ar-audit-dict-v1', strings: [], templates: [['r', 0]], data: ['r', 0] }))).toThrow();
});
test('repeated complete records use templates and retain every destination', () => {
  const value = { checks: Array.from({ length: 2700 }, (_, index) => ({ id: `external-link-${index}`, durationMs: index / 10,
    metrics: { executionAttempted: true, nonTimingFailure: false, statusCode: null, handlerAttempted: false, httpAttempted: false } })) };
  const body = encodeCompactDiagnosticJson(value);
  expect(JSON.parse(body).templates.length).toBeGreaterThan(0);
  expect(body.length).toBeLessThan(JSON.stringify(value).length * 0.55);
  expect(decodeCompactDiagnosticJson(body)).toEqual(value);
});

test('gzip preserves the entire varied audit while removing repeated evidence across records', () => {
  const value = { checks: Array.from({ length: 2732 }, (_, index) => ({
    id: `external-link-${index}`, status: index % 2 ? 'pass' : 'warn', durationMs: index / 10,
    diagnostic: { stage: 'complete', readiness: { ready: true, surfaces: [], blockers: [] } },
    metrics: { executionAttempted: true, actual: 0, expected: null, label: 'Crédit 中文 😀' },
  })) };
  const body = encodeCompressedDiagnosticJson(value, { audit: { appVersion: '1.2.3', buildVersion: '456' } });
  expect(body.length).toBeLessThan(encodeCompactDiagnosticJson(value).length * 0.2);
  expect(decodeCompactDiagnosticJson(body)).toEqual(value);
  expect(JSON.parse(body).audit).toEqual({ appVersion: '1.2.3', buildVersion: '456' });
});

test('gzip retries are byte-identical across clocks so upload deduplication survives restart', () => {
  const source = { zero: 0, false: false, unknown: null, unicode: '😀', values: [1, -1, 0.001] };
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  try {
    const first = encodeCompressedDiagnosticJson(source);
    clock.mockReturnValue(9_000);
    expect(encodeCompressedDiagnosticJson(source)).toBe(first);
    expect(decodeCompactDiagnosticJson(first)).toEqual(source);
  } finally { clock.mockRestore(); }
});

test.each(['digest', 'length', 'truncation', 'base64', 'oversize'])(
  'rejects compressed evidence with damaged %s before returning any report', (damage) => {
    const envelope = JSON.parse(encodeCompressedDiagnosticJson({ checks: [{ actual: 0, expected: null }] }));
    if (damage === 'digest') envelope.sha256 = 'f'.repeat(64);
    if (damage === 'length') envelope.bytes += 1;
    if (damage === 'truncation') envelope.gzip_base64 = envelope.gzip_base64.slice(0, -4);
    if (damage === 'base64') envelope.gzip_base64 = '!' + envelope.gzip_base64.slice(1);
    if (damage === 'oversize') envelope.bytes = 128 * 1024 * 1024 + 1;
    expect(() => decodeCompactDiagnosticJson(JSON.stringify(envelope))).toThrow('Invalid compressed diagnostic report');
  },
);

test('rejects forged near-128MiB decoded lengths before entering the historical allocator', () => {
  const envelope = JSON.parse(encodeCompressedDiagnosticJson({ checks: [] }));
  const archive = Buffer.from(envelope.gzip_base64, 'base64');
  envelope.bytes = 128 * 1024 * 1024;
  // The shared decoder checks this footer before allocating; forge both values
  // so this regression exercises the additional audit-specific boundary.
  archive.writeUInt32LE(envelope.bytes, archive.length - 4);
  envelope.gzip_base64 = archive.toString('base64');
  const decode = jest.spyOn(catalogueCodec, 'decompressCatalogue');
  try {
    expect(() => decodeCompactDiagnosticJson(JSON.stringify(envelope))).toThrow('Invalid compressed diagnostic report');
    expect(decode).not.toHaveBeenCalled();
  } finally { decode.mockRestore(); }
});

test('enforces decoded and UTF-8 wire budgets symmetrically without truncation', () => {
  const envelope = JSON.parse(encodeCompressedDiagnosticJson({ checks: [] }));
  const decode = jest.spyOn(catalogueCodec, 'decompressCatalogue');
  const compress = jest.spyOn(catalogueCodec, 'compressCatalogue');
  try {
    envelope.bytes = MAX_DECODED_DIAGNOSTIC_BYTES + 1;
    expect(() => decodeCompactDiagnosticJson(JSON.stringify(envelope))).toThrow('Invalid compressed diagnostic report');
    envelope.bytes = 13;
    envelope.padding = '界'.repeat(Math.floor(MAX_COMPRESSED_DIAGNOSTIC_BYTES / 3));
    const text = JSON.stringify(envelope);
    expect(text.length).toBeLessThan(MAX_COMPRESSED_DIAGNOSTIC_BYTES);
    expect(() => decodeCompactDiagnosticJson(text)).toThrow('Invalid compressed diagnostic report');
    expect(decode).not.toHaveBeenCalled();
    compress.mockReturnValueOnce({ bytes: MAX_DECODED_DIAGNOSTIC_BYTES + 1, sha256: 'a'.repeat(64), gzip_base64: 'small' });
    expect(() => encodeCompressedDiagnosticJson({ checks: [] })).toThrow('decoded audit budget');
    expect(() => encodeCompressedDiagnosticJson({ checks: [] }, { padding: '界'.repeat(MAX_COMPRESSED_DIAGNOSTIC_BYTES / 2) }))
      .toThrow('public upload limit');
  } finally { decode.mockRestore(); compress.mockRestore(); }
});
