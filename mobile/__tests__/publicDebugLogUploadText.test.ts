import { publicDebugLogUploadText } from '../src/lib/publicDebugLogUploadText';

const violations = [{ reason: 'untrusted-final-url', requestedHost: 'source.example', finalHost: 'private.example', responseStatus: 302 }];
const check = { code: 'network-policy', status: 'fail', metrics: { transportCalls: 1, policyViolations: 1 },
  localEvidence: { networkViolations: violations, unrelatedEvidence: { retained: true } } };

it('omits only local network diagnostics from a public report while preserving local input and all other evidence', () => {
  const report = { sessionId: 'session', coverage: { complete: false, storedChecks: 7 },
    checks: [{ status: 'fail', error: 'retained actual perf-audit: error', durationMs: 10_001 }], appHealth: { checks: [check] } };
  const local = JSON.stringify(report);
  const publicText = publicDebugLogUploadText(local);
  expect(JSON.parse(publicText)).toEqual({ ...report, appHealth: { checks: [{ ...check,
    localEvidence: { unrelatedEvidence: { retained: true } } }] } });
  expect(report.appHealth.checks[0].localEvidence.networkViolations).toBe(violations);
  expect(JSON.stringify(report)).toBe(local);
  expect(local).toContain('private.example');
  expect(publicText).not.toMatch(/private\.example|source\.example|networkViolations/);
});

it('also removes journal, fallback and nested serialized report diagnostics without deleting aggregate outcomes', () => {
  const event = { kind: 'report-fallback', sessionId: 'session', report: { appHealth: { checks: [check] } },
    reportJson: JSON.stringify({ appHealth: { checks: [check] }, completeReportStored: true }) };
  const journal = `2026-10-17T00:00:00Z [WARN ] perf-audit: ${JSON.stringify(event)}`;
  const uploaded = publicDebugLogUploadText(journal);
  expect(uploaded).toContain('2026-10-17T00:00:00Z [WARN ] perf-audit: ');
  expect(uploaded).not.toMatch(/private\.example|source\.example|networkViolations/);
  const decoded = JSON.parse(uploaded.slice(uploaded.indexOf('perf-audit: ') + 'perf-audit: '.length));
  expect(decoded.report.appHealth.checks[0].metrics).toEqual({ transportCalls: 1, policyViolations: 1 });
  expect(JSON.parse(decoded.reportJson)).toMatchObject({ completeReportStored: true,
    appHealth: { checks: [{ status: 'fail', localEvidence: { unrelatedEvidence: { retained: true } } }] } });
  expect(journal).toContain('private.example');
});

it('recognizes encoded JSON keys instead of publishing a hidden diagnostic field', () => {
  const escaped = String.raw`{"sessionId":"session","localEvidence":{"network\u0056iolations":[{"finalHost":"private.example"}],"retained":1}}`;
  expect(JSON.parse(publicDebugLogUploadText(escaped))).toEqual({ sessionId: 'session', localEvidence: { retained: 1 } });
});

it('fails before publication for damaged diagnostic JSON instead of silently losing unrelated evidence', () => {
  for (const text of [
    '2026-10-17T00:00:00Z [WARN ] perf-audit: {"localEvidence":{"networkViolations":[{"finalHost":"private.example"}',
    String.raw`{"reportJson":"{\"localEvidence\":{\"network\u0056iolations\":[\"private.example\"]`,
  ]) expect(() => publicDebugLogUploadText(text)).toThrow('full log remains on this device');
});

it('keeps ordinary log text, failures and JSON without these diagnostics byte-for-byte', () => {
  const text = 'ordinary output\n  { "sessionId": "session", "error": "actual failure", "localEvidence": {"other": 1} }\nmalformed { stack\n';
  expect(publicDebugLogUploadText(text)).toBe(text);
});
