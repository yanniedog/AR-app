import { createPricingWorkTiming } from '../src/lib/pricingWorkTiming';
import { publicAuditWorkDiagnostic } from '../src/lib/performanceAuditWorkDiagnostic';

test('pricing stage time includes waits while the maximum work slice excludes them', async () => {
  let clock = 0;
  const timing = createPricingWorkTiming(() => clock, async () => { clock += 100; });
  expect(timing.snapshot()).toEqual({});
  await timing.measure('candidatePreparationMs', async () => {
    clock += 4;
    await timing.yieldControl();
    clock += 3;
  });
  await timing.measure('pricingResolutionMs', async () => { clock += 2; });
  expect(timing.snapshot()).toEqual({ candidatePreparationMs: 107, pricingResolutionMs: 2, pricingMaxSliceMs: 4 });
  expect(timing.snapshot()).not.toHaveProperty('mortgageScopeMs');
});

test('a failed stage retains its elapsed and uninterrupted-slice evidence', async () => {
  let clock = 0;
  const timing = createPricingWorkTiming(() => clock);
  await expect(timing.measure('mortgageScopeMs', async () => { clock = 341.25; throw new Error('cancelled'); }))
    .rejects.toThrow('cancelled');
  expect(publicAuditWorkDiagnostic(timing.snapshot())).toEqual({ mortgageScopeMs: 341.3, pricingMaxSliceMs: 341.3 });
});

test('public work timings admit only bounded finite observations and retain no private fields', () => {
  expect(publicAuditWorkDiagnostic({ candidatePreparationMs: -1, pricingResolutionMs: Infinity,
    mortgageScopeMs: 3_600_001, pricingMaxSliceMs: NaN, loanAmount: 123456, query: 'private' })).toEqual({});
  expect(publicAuditWorkDiagnostic({ candidatePreparationMs: 0, pricingResolutionMs: 124.27,
    mortgageScopeMs: 3_600_000, pricingMaxSliceMs: 6.01 })).toEqual({ candidatePreparationMs: 0,
    pricingResolutionMs: 124.3, mortgageScopeMs: 3_600_000, pricingMaxSliceMs: 6 });
});
