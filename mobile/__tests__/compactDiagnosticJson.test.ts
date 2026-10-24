import { decodeCompactDiagnosticJson, encodeCompactDiagnosticJson, encodeCompressedDiagnosticJson } from '../src/lib/compactDiagnosticJson';

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
