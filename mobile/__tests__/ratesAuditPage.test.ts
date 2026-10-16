import { isVerifiedRatesPagePreparation, type RatesAuditPagePreparation } from '../src/lib/ratesAuditPage';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
import { assertObservableAuditActionEffect } from '../src/lib/performanceAuditActionEvidence';

const token = '35#p-35';
const evidence: RatesAuditPagePreparation = { selectionToken: token, resultIndex: 35, pageSize: 20,
  pageBefore: 2, selectionModeBefore: true, requestedPage: 2, renderedSelectionToken: token };

test.each([
  ['search.compare.select.0', token, evidence],
  ['unrelated.action', token, evidence],
  ['search.compare.page.0', 'other', evidence],
  ['search.compare.page.0', token, null],
  ['search.compare.page.0', token, { ...evidence, renderedSelectionToken: null }],
  ['search.compare.page.0', token, { ...evidence, selectionModeBefore: false }],
  ['search.compare.page.0', token, { ...evidence, selectionModeBefore: undefined }],
  ['search.compare.page.0', token, { ...evidence, pageBefore: 1 }],
  ['search.compare.page.0', token, { ...evidence, requestedPage: 3 }],
  ['search.compare.page.0', token, { ...evidence, pageSize: 500 }],
  ['search.compare.page.0', token, { ...evidence, resultIndex: -1 }],
  ['search.compare.page.0', token, { ...evidence, resultIndex: 35.5 }],
  ['search.compare.page.0', token, { ...evidence, resultIndex: NaN }],
])('rejects unproven same-page exemption %s / %s / %j', (action, requested, result) => {
  expect(isVerifiedRatesPagePreparation(action as string, requested, result)).toBe(false);
});

test('an already-rendered exact target still waits for real list evidence without a fabricated render revision', async () => {
  jest.useFakeTimers();
  try {
    const registry = new PerformanceAuditReadinessRegistry({ now: () => Date.now(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) });
    registry.beginCapture('rates-page-fixture');
    const handle = registry.registerSurface({ id: 'rates.results', renderRevision: 'page-2',
      actions: { 'search.compare.page.1': () => evidence }, probes: [
        { id: 'data', kind: 'data', status: 'ready' },
        { id: 'list', kind: 'list', status: 'pending', expectedCount: 20, actualCount: 20, visibleCount: 0 },
        { id: 'layout', kind: 'layout', status: 'ready', layoutMeasured: true },
      ] })!;
    const result = await registry.invokeAction('rates.results', 'search.compare.page.1');
    const verified = isVerifiedRatesPagePreparation('search.compare.page.1', token, result);
    expect(verified).toBe(true);
    let settled = false;
    const ready = registry.waitForReady({ surfaceIds: ['rates.results'], requiredKinds: ['data', 'list', 'layout'],
      quietWindowMs: 650, timeoutMs: 10_000,
      ...(!verified ? { changedRender: { surfaceId: 'rates.results', previousRevision: 'page-2' } } : {}) });
    void ready.then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(650);
    expect(settled).toBe(false);
    registry.upsertProbe(handle, { id: 'list', kind: 'list', status: 'ready', expectedCount: 20, actualCount: 20, visibleCount: 2 });
    await jest.advanceTimersByTimeAsync(650);
    await expect(ready).resolves.toMatchObject({ ready: true });
    expect(registry.snapshot(['rates.results']).surfaces[0].renderRevision).toBe('page-2');
    expect(() => assertObservableAuditActionEffect({ semanticActionId: 'search.compare.page.1', stateImpact: 'local-only',
      verifiedIdempotentFixture: verified, pathChanged: false, renderRevisionBefore: 'page-2', renderRevisionAfter: 'page-2' })).not.toThrow();
    // The real selection is never exempted from its render-effect check.
    expect(() => assertObservableAuditActionEffect({ semanticActionId: 'search.compare.select.1', stateImpact: 'local-only',
      verifiedIdempotentFixture: isVerifiedRatesPagePreparation('search.compare.select.1', token, result),
      pathChanged: false, renderRevisionBefore: 'page-2', renderRevisionAfter: 'page-2' })).toThrow();
  } finally { jest.useRealTimers(); }
});
