import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
import { captureAuditDiagnostic, publicAuditDiagnostic, publicAuditError } from '../src/lib/performanceAuditDiagnostic';
import { encodeCompactDiagnosticJson, decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';

test('retains every probe and the specific pending-model blocker beyond the old text cap', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('private-session');
  registry.registerSurface({ id: 'projections.lifecycle-chart', datasetRevision: 'private-data', renderRevision: 'private-input', probes: [
    ...Array.from({ length: 40 }, () => ({ id: 'projections.layout', kind: 'layout' as const, status: 'ready' as const })),
    { id: 'projections.model', kind: 'data', status: 'pending', error: 'private account balance 123456' },
  ] });
  // Use different source-authored roles so the registry retains each definition.
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
test('retains safe source locations and error types without raw messages, paths, URL or identity', () => {
  expect(publicAuditError('TypeError: account 123456\n at calculate (/private/account.js:12:34)',
    'model@https://private.example/app.js:1:567')).toEqual({ present: true, type: 'TypeError', frames: [['calculate', 12, 34], ['model', 1, 567]] });
  const body = JSON.stringify(publicAuditDiagnostic({ stage: 'pre-action', readiness: { surfaces: [{ id: 'private-account', secret: 'token' }] }, raw: 'password' }));
  expect(body).not.toMatch(/private|secret|token|password/);
});
