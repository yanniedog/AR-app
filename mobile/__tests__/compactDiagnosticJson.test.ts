import { decodeCompactDiagnosticJson, encodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';

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
