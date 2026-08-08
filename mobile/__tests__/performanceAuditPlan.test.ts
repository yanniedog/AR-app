import {
  DEEP_AUDIT_EXCLUDED_ACTION_IDS,
  DEEP_AUDIT_PASS_IDS,
  buildDeepPerformanceAuditPlan,
  deriveDeepAuditInputs,
  type DeepAuditStep,
} from '../src/lib/performanceAuditPlan';
import type { CorePayload, RateRow, Ribbon } from '../src/types';

const EMPTY_RIBBON: Ribbon = {
  counts: { rates: 0, products: 0, providers: 0 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};

function rate(overrides: Partial<RateRow> & Pick<RateRow, 'provider' | 'product_key'>): RateRow {
  return {
    product_name: `${overrides.provider} product`,
    rate: '0.0510',
    ...overrides,
  };
}

function corePayload(): CorePayload {
  return {
    schema_version: 1,
    run_date: '2026-08-07',
    sections: {
      Mortgage: {
        rates: [
          rate({
            provider: 'Zed Bank',
            product_key: 'mortgage-zed',
            product_name: 'Zed Variable 80',
            rate_index: 19,
            taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE.LVR_80_90',
          }),
          // A second tier for the same product must not be mistaken for a
          // distinct comparison product.
          rate({
            provider: 'Zed Bank',
            product_key: 'mortgage-zed',
            product_name: 'Zed Variable 70',
            rate_index: 20,
            taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE.LVR_70_80',
          }),
          rate({
            provider: 'Alpha Bank',
            product_key: 'mortgage-alpha',
            product_name: 'Alpha Variable',
            rate_index: 7,
            taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE.LVR_60_70',
          }),
        ],
        ribbon: EMPTY_RIBBON,
      },
      Savings: {
        rates: [
          rate({
            provider: 'Savings Bank',
            product_key: 'savings-one',
            rate_index: 3,
            taxonomy_path: 'SAVINGS.STANDARD',
          }),
        ],
        ribbon: EMPTY_RIBBON,
      },
      TD: { rates: [], ribbon: EMPTY_RIBBON },
    },
    brands: {
      'Alpha Bank': { short: 'Alpha', color: '#0055aa' },
      'Zed Bank': { short: 'Zed', color: '#5500aa' },
    },
    rba: [{ date: '2026-08-04', rate: 3.6 }],
  };
}

function allSteps(core: CorePayload | null = corePayload()): DeepAuditStep[] {
  return buildDeepPerformanceAuditPlan(core).passes.flatMap((pass) => pass.steps);
}

describe('deep performance audit plan', () => {
  test('builds structurally identical first and repeat whole-app passes with stable unique ids', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    expect(plan.passes.map((pass) => pass.id)).toEqual(DEEP_AUDIT_PASS_IDS);

    const ids = plan.passes.flatMap((pass) => pass.steps.map((step) => step.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('first-pass.route.onboarding.onboarding.open');
    expect(ids.at(-1)).toBe('repeat.route.audit.audit.pass.complete');

    const shape = (step: DeepAuditStep) => ({
      scenarioId: step.scenarioId,
      depth: step.depth,
      semanticActionId: step.semanticActionId,
      expectedPath: step.expectedPath,
      expectedSurface: step.expectedSurface,
      readiness: step.readiness,
      optional: step.optional,
      skipReason: step.skipReason,
      skipSafety: step.skipSafety,
      mutatesRestorableState: step.mutatesRestorableState,
      safety: step.safety,
      parameters: step.parameters,
    });
    expect(plan.passes[1].steps.map(shape)).toEqual(plan.passes[0].steps.map(shape));
  });

  test('returns to the audit route only once at the end of each pass', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    for (const pass of plan.passes) {
      const auditSteps = pass.steps.filter((step) => step.expectedPath === '/performance-audit');
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]).toBe(pass.steps.at(-1));
      expect(auditSteps[0].semanticActionId).toBe('audit.pass.complete');
    }
  });

  test('covers every steady route, compatibility redirect, and deep workflow family', () => {
    const steps = buildDeepPerformanceAuditPlan(corePayload()).passes[0].steps;
    const scenarios = new Set(steps.map((step) => step.scenarioId));
    expect(scenarios).toEqual(new Set([
      'route.onboarding',
      'route.today',
      'route.browse',
      'redirect.node',
      'route.search',
      'route.compare',
      'route.product',
      'route.receipt',
      'route.lender',
      'route.lenders',
      'route.calculator',
      'route.projections',
      'route.moves',
      'redirect.rba',
      'route.outlook',
      'route.saved',
      'route.profile',
      'route.settings',
      'route.terms',
      'route.debug-log',
      'route.not-found',
      'redirect.root',
      'route.audit',
    ]));

    const actions = new Set(steps.map((step) => step.semanticActionId));
    [
      'browse.category.deepest',
      'browse.products.all',
      'search.query.product',
      'search.filter.provider.first',
      'search.compare.open',
      'compare.scroll.last-column',
      'product.receipt.open',
      'receipt.back-to-product',
      'lender.history.date.previous',
      'lender.product.first',
      'calculator.projections.open',
      'projections.chart.previous',
      'projections.chart.next',
      'moves.response-chart.zoom-in',
      'moves.response-chart.reset',
      'moves.lender.open',
      'outlook.history.mode.spread',
      'outlook.history.mode.calendar',
      'outlook.history.mode.pulse',
      'outlook.history.mode.leaders',
      'outlook.rba-response.decision.previous',
      'outlook.economy.date.previous',
      'saved.fixture.ensure-exact-pair',
      'saved.fixture.restore',
      'profile.filter.restore',
      'settings.theme.restore',
      'settings.update-status.observe',
      'debug-log.scroll.end',
    ].forEach((action) => expect(actions).toContain(action));
  });

  test('derives exact deterministic same-section comparison inputs and preserves rate_index', () => {
    const inputs = deriveDeepAuditInputs(corePayload());
    expect(inputs.section).toBe('Mortgage');
    expect(inputs.primaryProduct).toMatchObject({
      section: 'Mortgage',
      productKey: 'mortgage-alpha',
      rateIndex: 7,
      selectionToken: '7#mortgage-alpha',
      taxonomyPath: ['OO', 'PI', 'VARIABLE', 'LVR_60_70'],
    });
    expect(inputs.secondaryProduct).toMatchObject({
      section: 'Mortgage',
      productKey: 'mortgage-zed',
      rateIndex: 19,
      selectionToken: '19#mortgage-zed',
    });
    expect(inputs.primaryProduct?.productKey).not.toBe(inputs.secondaryProduct?.productKey);
    expect(inputs.compareSelectionTokens).toEqual(['7#mortgage-alpha', '19#mortgage-zed']);

    const compareOpen = allSteps().find(
      (step) => step.passId === 'first-pass' && step.semanticActionId === 'search.compare.open',
    );
    expect(compareOpen?.parameters).toMatchObject({
      section: 'Mortgage',
      selectionTokens: ['7#mortgage-alpha', '19#mortgage-zed'],
      primaryRateIndex: 7,
      secondaryRateIndex: 19,
    });
  });

  test('does not inherit graphic readiness when compare.dismiss returns to search.results', () => {
    const dismiss = allSteps().find(
      (step) => step.passId === 'first-pass' && step.semanticActionId === 'compare.dismiss',
    );
    expect(dismiss).toMatchObject({
      expectedPath: '/search',
      expectedSurface: 'search.results',
    });
    expect(dismiss?.readiness).toEqual(expect.arrayContaining(['list']));
    expect(dismiss?.readiness).not.toContain('graphics');
    expect(dismiss?.readiness).not.toContain('logos');
  });

  test('never schedules unsafe financial-input.edit while still exercising calculator field actions', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    const actions = allSteps().map((step) => step.semanticActionId);
    for (const excluded of DEEP_AUDIT_EXCLUDED_ACTION_IDS) {
      expect(actions).not.toContain(excluded);
      expect(plan.excludedUnsafeActions).toContain(excluded);
    }
    expect(actions.join(' ')).not.toMatch(/(financial-input\.edit|balance\.edit|amount\.edit|rate\.edit|term\.edit)/);
    expect(actions).toEqual(expect.arrayContaining([
      'calculator.scenario.apply-buy',
      'calculator.mode.next',
      'calculator.scenario.apply-refi',
      'calculator.section.savings',
      'calculator.scenario.apply-deposit',
      'calculator.section.mortgage',
      'projections.inputs.apply-primary',
      'projections.rate-structure.next',
      'projections.inputs.apply-alternate',
    ]));
    const buy = allSteps().find((step) =>
      step.passId === 'first-pass' && step.semanticActionId === 'calculator.scenario.apply-buy',
    );
    expect(buy?.parameters).toMatchObject({
      mode: 'buy',
      propertyValue: '750000',
      currentRate: '7.25',
    });
    expect(buy?.safety.stateImpact).toBe('restorable');
  });

  test('marks unavailable data-dependent work as safely optional without changing the pass shape', () => {
    const plan = buildDeepPerformanceAuditPlan(null);
    const first = plan.passes[0].steps;
    const second = plan.passes[1].steps;
    expect(second.map((step) => step.semanticActionId)).toEqual(
      first.map((step) => step.semanticActionId),
    );

    const exactProductSteps = first.filter((step) =>
      ['product.open', 'search.compare.select.0', 'search.compare.select.1'].includes(
        step.semanticActionId,
      ),
    );
    expect(exactProductSteps.length).toBeGreaterThan(0);
    expect(exactProductSteps.every((step) => step.optional && step.skipSafety.maySkip)).toBe(true);
    expect(exactProductSteps.every((step) => Boolean(step.skipReason))).toBe(true);
  });

  test('carries complete execution metadata and flags every restorable mutation consistently', () => {
    for (const step of allSteps()) {
      expect(step.id).toBe(`${step.passId}.${step.scenarioId}.${step.semanticActionId}`);
      expect(step.depth).toBeGreaterThanOrEqual(0);
      expect(step.depth).toBeLessThanOrEqual(3);
      expect(step.expectedPath).toBeTruthy();
      expect(step.expectedSurface).toBeTruthy();
      expect(step.readiness.length).toBeGreaterThan(0);
      expect(step.mutatesRestorableState).toBe(step.safety.stateImpact === 'restorable');
      if (step.skipSafety.maySkip) {
        expect(step.skipSafety.when.length).toBeGreaterThan(0);
        expect(step.skipSafety.reason).toBeTruthy();
      }
    }
  });
});
