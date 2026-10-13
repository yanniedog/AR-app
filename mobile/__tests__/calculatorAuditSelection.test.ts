import {
  applyCalculatorAuditSection,
  isVerifiedCalculatorSectionSelection,
} from '../src/lib/calculatorAuditSelection';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
import { assertObservableAuditActionEffect } from '../src/lib/performanceAuditActionEvidence';
import type { SectionKey } from '../src/types';

describe('calculator audit explicit section selection', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function fixture(selectedSection: SectionKey, pending = false) {
    const registry = new PerformanceAuditReadinessRegistry({
      now: () => Date.now(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
    const changeSection = jest.fn();
    registry.beginCapture('calculator-selection');
    const surface = registry.registerSurface({
      id: 'calculator.results',
      renderRevision: 'before',
      actions: {
        'calculator.section.mortgage': () =>
          applyCalculatorAuditSection(selectedSection, 'Mortgage', changeSection),
      },
      probes: [
        { id: 'data', kind: 'data', status: pending ? 'pending' : 'ready' },
        { id: 'layout', kind: 'layout', status: 'ready' },
      ],
    })!;
    async function select() {
      const result = await registry.invokeAction('calculator.results', 'calculator.section.mortgage');
      const verified = isVerifiedCalculatorSectionSelection('calculator.section.mortgage', 'Mortgage', result);
      return { result, verified, ready: registry.waitForReady({
        surfaceIds: ['calculator.results'],
        quietWindowMs: 650,
        timeoutMs: 10_000,
        ...(!verified ? { changedRender: { surfaceId: 'calculator.results', previousRevision: 'before' } } : {}),
      }) };
    }
    return { registry, surface, changeSection, select };
  }

  it('settles an already-selected Mortgage without a fabricated render change or 10-second timeout', async () => {
    const { registry, changeSection, select } = fixture('Mortgage');
    const { ready, verified } = await select();
    jest.advanceTimersByTime(650);
    await expect(ready).resolves.toMatchObject({ ready: true });
    expect(changeSection).toHaveBeenCalledWith('Mortgage');
    expect(registry.actionCompletion('calculator.results')).toMatchObject({
      actionName: 'calculator.section.mortgage', actionRevision: 1,
    });
    expect(registry.snapshot(['calculator.results']).surfaces[0].renderRevision).toBe('before');
    // The final effect check must honor the same mounted selection evidence as
    // the readiness wait, or it falsely fails after the ready section settles.
    expect(() => assertObservableAuditActionEffect({
      semanticActionId: 'calculator.section.mortgage', stateImpact: 'local-only',
      verifiedIdempotentFixture: verified, pathChanged: false,
      renderRevisionBefore: 'before', renderRevisionAfter: 'before',
    })).not.toThrow();
  });

  it('still waits for a real render change when selecting Mortgage from Savings', async () => {
    const { registry, surface, select } = fixture('Savings');
    const { ready } = await select();
    let settled = false;
    void ready.then(() => { settled = true; });
    jest.advanceTimersByTime(650);
    await Promise.resolve();
    expect(settled).toBe(false);
    registry.updateSurface(surface, { renderRevision: 'mortgage-rendered' });
    jest.advanceTimersByTime(650);
    await expect(ready).resolves.toMatchObject({ ready: true });
  });

  it('still waits for required data on an already-selected section', async () => {
    const { registry, surface, select } = fixture('Mortgage', true);
    const { ready } = await select();
    let settled = false;
    void ready.then(() => { settled = true; });
    jest.advanceTimersByTime(650);
    await Promise.resolve();
    expect(settled).toBe(false);
    registry.updateProbe(surface, 'data', { status: 'ready' });
    jest.advanceTimersByTime(650);
    await expect(ready).resolves.toMatchObject({ ready: true });
  });

  it('keeps the 10-second failure limit for unresolved required probes', async () => {
    const { select } = fixture('Mortgage', true);
    const { ready } = await select();
    const failure = expect(ready).rejects.toThrow('Readiness did not settle');
    jest.advanceTimersByTime(10_000);
    await failure;
  });

  it('rejects a missing render effect for a section change despite proven action completion', async () => {
    const { registry, select } = fixture('Savings');
    const { verified, ready } = await select();
    const failure = expect(ready).rejects.toThrow('Readiness did not settle');
    jest.advanceTimersByTime(10_000);
    await failure;
    expect(registry.actionCompletion('calculator.results')?.actionName).toBe('calculator.section.mortgage');
    expect(() => assertObservableAuditActionEffect({
      semanticActionId: 'calculator.section.mortgage', stateImpact: 'local-only',
      verifiedIdempotentFixture: verified, pathChanged: false,
      renderRevisionBefore: 'before', renderRevisionAfter: 'before',
    })).toThrow('without an observable path or render-state change');
  });

  it('does not extend the verified-selection exemption to a financial scenario no-op', () => {
    const semanticActionId = 'calculator.scenario.apply-buy';
    const verified = isVerifiedCalculatorSectionSelection(semanticActionId, 'Mortgage', {
      selectedSectionBefore: 'Mortgage', requestedSection: 'Mortgage',
    });
    expect(() => assertObservableAuditActionEffect({
      semanticActionId, stateImpact: 'local-only', verifiedIdempotentFixture: verified,
      pathChanged: false, renderRevisionBefore: 'unchanged', renderRevisionAfter: 'unchanged',
    })).toThrow('without an observable path or render-state change');
  });

  it.each<[string, string]>([
    ['calculator.section.mortgage', 'Mortgage'],
    ['calculator.section.return-mortgage', 'Mortgage'],
    ['calculator.section.savings', 'Savings'],
  ])('accepts only matching explicit selection evidence for %s', (action, section) => {
    expect(isVerifiedCalculatorSectionSelection(action, section, {
      selectedSectionBefore: section, requestedSection: section,
    })).toBe(true);
  });

  it.each<[string, unknown, unknown]>([
    ['calculator.section.next', 'Mortgage', { selectedSectionBefore: 'Mortgage', requestedSection: 'Mortgage' }],
    ['calculator.scenario.apply-buy', 'Mortgage', { selectedSectionBefore: 'Mortgage', requestedSection: 'Mortgage' }],
    ['calculator.section.mortgage', 'Savings', { selectedSectionBefore: 'Savings', requestedSection: 'Savings' }],
    ['calculator.section.mortgage', 'Mortgage', { selectedSectionBefore: 'Savings', requestedSection: 'Mortgage' }],
    ['calculator.section.mortgage', 'Mortgage', { selectedSectionBefore: 'Mortgage', requestedSection: 'Savings' }],
    ['calculator.section.mortgage', undefined, { selectedSectionBefore: 'Mortgage', requestedSection: 'Mortgage' }],
    ['calculator.section.mortgage', 'Mortgage', { fixtureReady: true }],
    ['calculator.section.mortgage', 'Mortgage', null],
  ])('rejects unrelated actions or unproven selections (%s)', (action, section, evidence) => {
    expect(isVerifiedCalculatorSectionSelection(action, section, evidence)).toBe(false);
  });
});
