import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
import { captureAuditDiagnostic, deidentifyAuditText, publicAuditDiagnostic, publicAuditError } from '../src/lib/performanceAuditDiagnostic';
import { encodeCompactDiagnosticJson, decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

test('retains every probe and the specific pending-model blocker beyond the old text cap', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('private-session');
  registry.registerSurface({ id: 'projections.lifecycle-chart', datasetRevision: 'private-data', renderRevision: 'private-input', probes: [
    ...Array.from({ length: 40 }, () => ({ id: 'projections.layout', kind: 'layout' as const, status: 'ready' as const })),
    { id: 'projections.model', kind: 'data', status: 'pending', error: 'private account balance 123456' },
  ] });
  // Exercise a payload beyond the legacy per-metric text budget.
  const surface = registry.snapshot().surfaces[0];
  const snapshot = registry.snapshot();
  snapshot.surfaces[0].probes = Array.from({ length: 100 }, () => surface.probes[0]).concat(surface.probes.at(-1)!);
  const captured = captureAuditDiagnostic(snapshot, 'pre-action');
  const body = encodeCompactDiagnosticJson(publicAuditDiagnostic(captured));
  const restored = decodeCompactDiagnosticJson(body) as typeof captured;
  expect(restored.stage).toBe('pre-action');
  expect(restored.readiness!.surfaces[0].probes).toHaveLength(101);
  expect(restored.readiness!.blockers).toContainEqual({ code: 'probe-pending', surface: 'projections.lifecycle-chart', probe: 'projections.model' });
  expect(body).not.toMatch(/private|123456/);
});
test('all fixed production role identifiers survive deidentified diagnostic serialization', () => {
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
  const ids = new Set(files(path.resolve(__dirname, '../src')).concat(files(path.resolve(__dirname, '../app')))
    .flatMap(file => Array.from(readFileSync(file, 'utf8').matchAll(/\bid:\s*['"]([a-z][a-z0-9.-]{0,99})['"]/g), match => match[1])));
  expect(ids.size).toBeGreaterThan(100);
  for (const id of ids) {
    expect(publicAuditDiagnostic({ readiness: { surfaces: [{ id }] } })).toEqual({ readiness: { surfaces: [{ id }] } });
  }
});
test.each(['path', 'data', 'readiness', 'back', 'recovery', 'origin-readiness'])('the %s failure stage is retained verbatim', stage => {
  expect(publicAuditDiagnostic({ stage })).toEqual({ stage });
});
test('retains safe source locations, error type and a deidentified message without paths, URL or identity', () => {
  expect(publicAuditError('TypeError: account 123456\n at calculate (/private/account.js:12:34)',
    'model@https://private.example/app.js:1:567')).toEqual({
    present: true, type: 'TypeError', message: 'account [REDACTED]', frames: [['frame', 12, 34], ['frame', 1, 567]],
  });
  const body = JSON.stringify(publicAuditDiagnostic({ stage: 'pre-action', readiness: { surfaces: [{ id: 'private-account', secret: 'token' }] }, raw: 'password' }));
  expect(body).not.toMatch(/private|secret|token|password/);
});


test('deidentification marks bounded diagnostic text with explicit omitted-character counts', () => {
  const text = 'Pricing state remained pending. '.repeat(40) + 'Terminal probe outcome was error.';
  expect(deidentifyAuditText(text)).toBe(`${text.slice(0, 400)}…[truncated ${text.length - 400} chars]`);
  expect(deidentifyAuditText(text, 16_384)).toBe(text);
});

test('work diagnostics retain bounded stage/loading facts without financial inputs or identifiers', () => {
  const registry = new PerformanceAuditReadinessRegistry(); registry.beginCapture('work-test');
  registry.registerSurface({ id: 'rates.results', work: { pricingStage: 'scope', pricingRequestRevision: 3,
    workerStarts: 1, sourceRowCount: 8119, candidateCount: null, catalogueStatus: 'ready', catalogueAllLoaded: true,
    mortgageCriteriaReady: true, mortgageInputsInvalid: false, suitabilityReady: true, detailsLoading: false,
    loanAmount: 123456, query: 'secret account', generationId: 'private-id' } as never,
    probes: [{ id: 'search.data', kind: 'data', status: 'pending' }] });
  const diagnostic = publicAuditDiagnostic(captureAuditDiagnostic(registry.snapshot(), 'readiness')) as any;
  expect(diagnostic.readiness.surfaces[0].work).toMatchObject({ pricingStage: 'scope', sourceRowCount: 8119,
    catalogueStatus: 'ready', mortgageCriteriaReady: true, detailsLoading: false });
  expect(JSON.stringify(diagnostic)).not.toMatch(/loanAmount|123456|secret account|generationId|private-id/);
});
