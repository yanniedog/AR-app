import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildUxFrictionFluidityAudit } from '../src/lib/uxFrictionFluidityAudit';
import { getAuditTargetCapture, recordAuditTargetLayout, startAuditTargetCollection, stopAuditTargetCollection, unregisterAuditTargetLayout } from '../src/lib/auditTargetRegistry';

test('whole-app remounts retain distinct measured geometry and state without exhausting capacity', () => {
  startAuditTargetCollection();
  for (let i = 0; i < 5000; i++) {
    recordAuditTargetLayout(`save#${i}`, 48, 48, 'button');
    unregisterAuditTargetLayout(`save#${i}`);
  }
  recordAuditTargetLayout('save#5001', 24, 48, 'button');
  unregisterAuditTargetLayout('save#5001');
  recordAuditTargetLayout('save#5002', 48, 48, 'button', 'selected');
  unregisterAuditTargetLayout('save#5002');
  const samples = stopAuditTargetCollection();
  expect(samples).toHaveLength(3);
  expect(samples.find(sample => sample.width === 24)).toMatchObject({ height: 48, layoutObservations: 1 });
  expect(samples.find(sample => sample.layoutObservations === 5000)).toMatchObject({ width: 48, height: 48 });
  expect(getAuditTargetCapture().capacityReached).toBe(false);
});

test('unmounting one equivalent control preserves another mounted control and both audit entries', () => {
  recordAuditTargetLayout('audit-start-local#1', 48, 48, 'button');
  recordAuditTargetLayout('audit-start-live#2', 48, 48, 'button');
  recordAuditTargetLayout('target#3', 48, 48, 'button');
  recordAuditTargetLayout('target#4', 48, 48, 'button');
  unregisterAuditTargetLayout('target#3');
  startAuditTargetCollection();
  const samples = stopAuditTargetCollection();
  expect(samples).toHaveLength(3);
  expect(getAuditTargetCapture().auditStartControlsMeasured).toBe(true);
  for (const id of ['audit-start-local#1', 'audit-start-live#2', 'target#4']) unregisterAuditTargetLayout(id);
});

test('genuine distinct-state overflow remains incomplete and never discards retained failures', () => {
  startAuditTargetCollection();
  recordAuditTargetLayout('small#1', 20, 20, 'button');
  unregisterAuditTargetLayout('small#1');
  for (let i = 0; i < 4100; i++) {
    recordAuditTargetLayout(`control-${i}#1`, 48, 48, 'button');
    unregisterAuditTargetLayout(`control-${i}#1`);
  }
  const samples = stopAuditTargetCollection();
  expect(samples).toHaveLength(4096);
  expect(samples[0]).toMatchObject({ width: 20, height: 20 });
  expect(getAuditTargetCapture().capacityReached).toBe(true);
});


test('aggregated layout counts and failing geometry survive durable telemetry and UX analysis', () => {
  startAuditTargetCollection();
  recordAuditTargetLayout('audit-start-local#1', 48, 48, 'button');
  recordAuditTargetLayout('audit-start-live#2', 48, 48, 'button');
  for (let i = 0; i < 20; i++) {
    recordAuditTargetLayout(`save#${i}`, 48, 48, 'button');
    unregisterAuditTargetLayout(`save#${i}`);
  }
  recordAuditTargetLayout('save#30', 20, 20, 'button');
  unregisterAuditTargetLayout('save#30');
  const targetSamples = stopAuditTargetCollection();
  const report = makePerformanceAuditReport();
  report.auditEvidenceVersion = 2;
  report.uxTelemetry = { targetSamples, targetCapture: getAuditTargetCapture() };
  const ux = buildUxFrictionFluidityAudit(JSON.parse(JSON.stringify(report)));
  const standards = ux.pillars.standardsAndAccessibility;
  expect(standards.targetSampleCoverage).toMatchObject({ aggregation: 'control-state-geometry', retained: 4, layoutObservations: 23, capacityReached: false, auditStartControlsMeasured: true });
  expect(standards.targetSizingByRole?.button?.failed).toBe(1);
  for (const id of ['audit-start-local#1', 'audit-start-live#2']) unregisterAuditTargetLayout(id);
});


test('unidentified controls remain distinct unless their owner supplies a semantic identity', () => {
  startAuditTargetCollection();
  recordAuditTargetLayout('target#1', 48, 48, 'button');
  recordAuditTargetLayout('target#2', 48, 48, 'button');
  recordAuditTargetLayout('target#3', 48, 48, 'button', 'default', 'rates-next-page');
  recordAuditTargetLayout('target#4', 48, 48, 'button', 'default', 'rates-next-page');
  expect(stopAuditTargetCollection()).toHaveLength(3);
  for (const id of ['target#1', 'target#2', 'target#3', 'target#4']) unregisterAuditTargetLayout(id);
});
