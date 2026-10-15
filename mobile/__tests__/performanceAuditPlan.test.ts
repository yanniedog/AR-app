import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
  DEEP_AUDIT_EXCLUDED_ACTION_IDS,
  DEEP_AUDIT_PASS_IDS,
  buildDeepPerformanceAuditPlan,
  deriveDeepAuditInputs,
  ScenarioReentryGate,
  type DeepAuditStep,
} from '../src/lib/performanceAuditPlan';
import type { CorePayload, RateRow, Ribbon } from '../src/types';
import { ANDROID_UPDATE_READINESS_AUDIT, PERFORMANCE_AUDIT_DEDICATED_CHECKS,
  dedicatedPerformanceAuditChecks } from '../src/lib/performanceAuditCheckInventory';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';


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
  afterEach(() => {
    installMandatoryEligibility(selectMandatoryEligibility(null, null, null));
    setSuitabilityAllowed(null);
  });
  test('builds structurally identical first and repeat whole-app passes with stable unique ids', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    expect(plan.passes.map((pass) => pass.id)).toEqual(DEEP_AUDIT_PASS_IDS);
    expect(plan.coverageProfile).toBe('maximum-safe-coverage-v1');
    expect(plan.safeActionCount).toBe(plan.passes[0].steps.length);

    const ids = plan.passes.flatMap((pass) => pass.steps.map((step) => step.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('first-pass.route.rates.search.open');
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
      parameters: step.semanticActionId === 'calculator.scenario.apply-deposit'
        ? {}
        : step.parameters,
    });
    expect(plan.passes[1].steps.map(shape)).toEqual(plan.passes[0].steps.map(shape));

    const firstDeposit = plan.passes[0].steps.find(
      (step) => step.semanticActionId === 'calculator.scenario.apply-deposit',
    );
    const repeatDeposit = plan.passes[1].steps.find(
      (step) => step.semanticActionId === 'calculator.scenario.apply-deposit',
    );
    expect(firstDeposit?.parameters).toEqual({ balance: '50000', currentRate: '2.50' });
    expect(repeatDeposit?.parameters).toEqual({ balance: '51000', currentRate: '2.60' });
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

  test('uses real result actions without onboarding jobs and retains receipt evidence', () => {
    const steps = buildDeepPerformanceAuditPlan(corePayload()).passes[0].steps;
    expect(steps.filter(item => item.scenarioId === 'route.rates').map(item => item.semanticActionId))
      .toEqual(expect.arrayContaining(['search.open', 'search.query.product', 'search.filters.open', 'search.filter.provider.first', 'search.compare.open']));
    expect(steps.some(item => /^(onboarding|home|tools|today|browse|lenders)\./.test(item.semanticActionId))).toBe(false);
    expect(steps.find(item => item.semanticActionId === 'receipt.scroll.evidence')?.readiness).toContain('list');
  });

  test('covers canonical workflows and compatibility aliases without obsolete surfaces', () => {
    const steps = buildDeepPerformanceAuditPlan(corePayload()).passes[0].steps;
    const scenarios = new Set(steps.map(item => item.scenarioId));
    for (const id of ['route.rates', 'route.market', 'route.bank-rates', 'route.compare', 'route.product',
      'route.receipt', 'route.lender', 'route.calculator', 'route.projections', 'route.moves',
      'route.rba', 'route.outlook', 'route.saved', 'route.profile', 'route.settings', 'route.terms',
      'route.debug-log', 'route.not-found', 'route.audit', 'redirect.root', 'redirect.node',
      'redirect.search', 'redirect.categories', 'redirect.banks', 'redirect.matches',
      'redirect.catalogue', 'redirect.onboarding', 'redirect.tools', 'redirect.projections', 'redirect.changes']) {
      expect(scenarios.has(id)).toBe(true);
    }
    expect([...scenarios].some(id => ['route.onboarding', 'route.home', 'route.tools', 'route.today', 'route.browse', 'route.search', 'route.lenders', 'route.changes'].includes(id))).toBe(false);
    expect(steps.some(item => ['home.hub', 'rates.hub', 'market.hub', 'tools.hub', 'today.hero', 'browse.hierarchy', 'lenders.list', 'changes.feed', 'search.results'].includes(item.expectedSurface))).toBe(false);
    const actions = steps.map(item => item.semanticActionId);
    expect(actions).toEqual(expect.arrayContaining(['search.query.product', 'search.compare.open',
      'search.filter.provider.first', 'compare.scroll.last-column', 'product.receipt.open',
      'receipt.back-to-product', 'lender.history.date.previous', 'calculator.projections.open',
      'projections.chart.previous', 'projections.chart.next', 'outlook.economy.date.previous',
      'saved.fixture.ensure-exact-pair', 'saved.fixture.restore', 'profile.filter.restore', 'settings.update-status.observe']));
  });

  test('covers safe actions reachable from real app routes and canonical components', () => {
    const mobileRoot = path.resolve(__dirname, '..');
    const visited = new Set<string>();
    const registered = new Set<string>();
    const pattern = /['"]([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)['"]\s*:/g;
    const visitFile = (file: string) => {
      if (visited.has(file)) return;
      visited.add(file);
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes('usePerformanceAuditSurface(') || source.includes('<NavigationHub ')) {
        for (const match of source.matchAll(pattern)) registered.add(match[1]);
      }
      for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
        if (!imported.fileName.startsWith('.')) continue;
        const base = path.resolve(path.dirname(file), imported.fileName);
        const candidate = [base, ...['.ts', '.tsx', '.native.ts', '.android.tsx', '/index.ts', '/index.tsx'].map(ext => base + ext)]
          .find(target => fs.existsSync(target) && fs.statSync(target).isFile());
        if (candidate && candidate.startsWith(mobileRoot + path.sep)) visitFile(candidate);
      }
    };
    const visitRoutes = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visitRoutes(target);
        else if (/\.tsx?$/.test(entry.name)) visitFile(target);
      }
    };
    visitRoutes(path.join(mobileRoot, 'app'));
    registered.delete('calculator.section.next');
    registered.delete('changes.open'); // Alias of the canonical Market entry.
    const generic = new Set(allSteps().filter(item => item.passId === 'first-pass'
      && !item.semanticActionId.startsWith('redirect.')).map(item => item.semanticActionId));
    const ownedActions = PERFORMANCE_AUDIT_DEDICATED_CHECKS.map(owner => owner.semanticActionId);
    expect(new Set(ownedActions).size).toBe(ownedActions.length);
    expect(ownedActions.filter(action => generic.has(action))).toEqual([]);
    const planned = new Set([...generic, ...ownedActions]);
    expect([...registered].filter(action => !planned.has(action))).toEqual([]);
    expect([...planned].filter(action => !registered.has(action))).toEqual([]);
  });

  test('assigns the session-bound update action to one separately measured platform check', () => {
    const owners = dedicatedPerformanceAuditChecks('android');
    expect(owners).toEqual([ANDROID_UPDATE_READINESS_AUDIT]);
    expect(new Set(owners.map(owner => owner.checkId)).size).toBe(owners.length);
    expect(owners[0]).toEqual({
      checkId: 'update-readiness', semanticActionId: 'settings.update.check',
      expectedPath: '/settings', expectedSurface: 'settings.app-update', kind: 'update',
      platform: 'android', executionMode: 'live-source', phase: 'after-journeys', transportScope: 'app-update-metadata',
    });
    for (const platform of ['ios', 'web']) expect(dedicatedPerformanceAuditChecks(platform)).toEqual([]);
    // Generic passes have no session/AbortSignal or temporary metadata capability.
    // The separately scheduled owner is their exclusive executor.
    expect(allSteps().filter(step => step.semanticActionId === owners[0].semanticActionId)).toEqual([]);
  });

  test('waits on real canonical destinations for controls and compatibility entries', () => {
    const steps = buildDeepPerformanceAuditPlan(corePayload()).passes[0].steps;
    const step = (id: string) => steps.find(item => item.semanticActionId === id);
    for (const id of ['search.open', 'redirect.root.verify', 'redirect.node.verify', 'redirect.search.verify', 'redirect.categories.verify', 'redirect.banks.verify', 'redirect.matches.verify', 'redirect.catalogue.verify', 'redirect.onboarding.verify', 'not-found.home']) {
      expect(step(id)).toMatchObject({ expectedPath: '/browse', expectedSurface: 'rates.results' });
    }
    expect(step('search.open')?.readiness).toEqual(expect.arrayContaining(['data', 'suitability', 'list']));
    expect(step('market.open')).toMatchObject({ expectedPath: '/market', expectedSurface: 'market.overview', readiness: expect.arrayContaining(['bank-insights', 'rba-calendar', 'list']) });
    for (const [id, expectedPath, expectedSurface] of [
      ['market.outlook.open', '/research', 'outlook.dashboard'],
      ['market.history.open', '/bank-rates', 'bank-rates.dashboard'],
      ['market.rba.open', '/rba', 'rba.dashboard'],
      ['market.response.open', '/rba-response', 'moves.response-chart'],
    ]) expect(step(id)).toMatchObject({ depth: 1, expectedPath, expectedSurface });
    expect(step('calculator.projections.open')).toMatchObject({ expectedPath: '/calculator', expectedSurface: 'projections.inputs' });
    expect(step('redirect.projections.verify')).toMatchObject({ expectedPath: '/calculator', expectedSurface: 'projections.inputs' });
  });

  test('opens the RBA page before exercising its optional market chart controls', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    for (const pass of plan.passes) {
      const steps = pass.steps.filter((step) => step.scenarioId === 'route.rba');
      expect(steps.map((step) => step.semanticActionId)).toEqual([
        'rba.open', 'rba.forecast.next', 'rba.bonds.next',
      ]);
      expect(steps.every((step) => step.expectedPath === '/rba' && step.expectedSurface === 'rba.dashboard')).toBe(true);
      expect(steps[0]).toMatchObject({
        depth: 0,
        readiness: ['app', 'data', 'rba-calendar'],
      });
      for (const step of steps.slice(1)) {
        expect(step).toMatchObject({
          depth: 1,
          optional: true,
          skipReason: null,
          skipSafety: { maySkip: true },
          safety: { stateImpact: 'local-only' },
        });
        expect(step.readiness).toEqual(expect.arrayContaining(['economic-data', 'graphics']));
        expect(step.readiness).not.toContain('redirect');
        expect(step.readiness).not.toContain('bank-history');
      }
      expect(pass.steps.some((step) => step.semanticActionId === 'redirect.rba.verify')).toBe(false);
    }
  });

  test('never uses a removed matched-card journey to fabricate product readiness', () => {
    const steps = allSteps();
    expect(steps.some(item => item.scenarioId === 'route.today' || item.semanticActionId.startsWith('today.'))).toBe(false);
    const product = steps.find(item => item.semanticActionId === 'product.open');
    expect(product).toMatchObject({ expectedSurface: 'product.details', parameters: { productKey: expect.any(String), rateIndex: expect.any(Number) } });
  });

  test('exercises real sheet cancellation and type selection without losing Apply coverage', () => {
    for (const pass of buildDeepPerformanceAuditPlan(corePayload()).passes) {
      expect(pass.steps.filter(item => item.scenarioId === 'route.rates-sheets').map(item => item.semanticActionId))
        .toEqual(['search.open', 'search.filters.open', 'search.filter.provider.first',
          'search.filters.cancel', 'search.sort.open', 'search.sort.cancel', 'search.section.next']);
      expect(pass.steps.filter(item => item.scenarioId === 'route.rates').map(item => item.semanticActionId))
        .toEqual(expect.arrayContaining(['search.filters.apply', 'search.filters.clear', 'search.compare.open']));
    }
  });

  test('targets contextual calculation from the exact product and saved fixture before comparison selection', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    const primary = plan.inputs.primaryProduct!;
    for (const pass of plan.passes) {
      const product = pass.steps.filter(item => item.scenarioId === 'route.product-calculation');
      expect(product.map(item => item.semanticActionId)).toEqual(['product.open', 'product.calculate.open']);
      expect(product[1]).toMatchObject({ expectedPath: '/calculator', expectedSurface: 'calculator.results',
        parameters: { productKey: primary.productKey, rateIndex: primary.rateIndex } });
      const saved = pass.steps.filter(item => item.scenarioId === 'route.saved');
      const calculate = saved.findIndex(item => item.semanticActionId === 'saved.calculate.open');
      expect(calculate).toBeGreaterThan(saved.findIndex(item => item.semanticActionId === 'saved.fixture.ensure-exact-pair'));
      expect(calculate).toBeLessThan(saved.findIndex(item => item.semanticActionId === 'saved.compare.mode'));
      expect(saved[calculate]).toMatchObject({ expectedPath: '/calculator', expectedSurface: 'calculator.results',
        parameters: { savedId: primary.rateIndex == null ? `product:${primary.productKey}` : `rate:${primary.productKey}:${primary.rateIndex}` } });
    }
  });

  test('gates economics controls on their own data and graphic surface', () => {
    const plan = buildDeepPerformanceAuditPlan(corePayload());
    for (const pass of plan.passes) {
      const economy = pass.steps.filter(step => step.semanticActionId.startsWith('outlook.economy.'));
      expect(economy).toHaveLength(3);
      for (const step of economy) {
        expect(step.expectedSurface).toBe('outlook.economy');
        expect(step.readiness).toEqual(expect.arrayContaining(['data', 'economic-data', 'graphics']));
        expect(step.optional).toBe(true);
      }
    }
  });

  test('replays exact same-section comparison tiers and sample ordering from the recorded seed', () => {
    const core = corePayload();
    const options = { seed: 'session-example' };
    const inputs = deriveDeepAuditInputs(core, options);
    expect(deriveDeepAuditInputs(core, options)).toEqual(inputs);
    const reversed = { ...core, sections: { ...core.sections,
      Mortgage: { ...core.sections.Mortgage, rates: [...core.sections.Mortgage.rates].reverse() } } };
    expect(deriveDeepAuditInputs(reversed, options)).toEqual(inputs);
    expect(inputs.section).toBe('Mortgage');
    expect(inputs.primaryProduct?.productKey).not.toBe(inputs.secondaryProduct?.productKey);
    expect(inputs.primaryProduct?.provider).not.toBe(inputs.secondaryProduct?.provider);
    for (const product of inputs.sampledProducts) {
      expect(core.sections[product.section].rates).toEqual(expect.arrayContaining([
        expect.objectContaining({ product_key: product.productKey, rate_index: product.rateIndex }),
      ]));
      expect(product.selectionToken).toBe(`${product.rateIndex}#${product.productKey}`);
    }
    const steps = buildDeepPerformanceAuditPlan(core, options).passes[0].steps;
    expect(steps.find(step => step.semanticActionId === 'search.compare.open')?.parameters)
      .toMatchObject({ section: 'Mortgage', selectionTokens: inputs.compareSelectionTokens,
        primaryRateIndex: inputs.primaryProduct?.rateIndex, secondaryRateIndex: inputs.secondaryProduct?.rateIndex });
    expect(steps.find(step => step.scenarioId === 'route.product' && step.semanticActionId === 'product.open'))
      .toMatchObject({ parameters: { productKey: inputs.primaryProduct?.productKey, rateIndex: inputs.primaryProduct?.rateIndex } });
  });

  test('randomizes across all eligible banks, products and tiers while sampling every non-empty category', () => {
    const core = corePayload();
    for (let index = 0; index < 6; index += 1) core.sections.Mortgage.rates.push(rate({
      provider: `Bank ${index}`, product_key: `loan-${index}`, rate_index: index,
    }));
    core.sections.TD.rates.push(rate({ provider: 'Deposit Bank', product_key: 'term-one', rate_index: 1 }));
    const reached = new Set<string>();
    const primaries = new Set<string>();
    for (let index = 0; index < 120; index += 1) {
      const inputs = deriveDeepAuditInputs(core, { seed: `run-${index}` });
      expect(inputs.sampling).toMatchObject({ sampledSections: 3, fullCatalogueRendered: false });
      expect(new Set(inputs.sampledProducts.map(product => product.section))).toEqual(new Set(['Mortgage', 'Savings', 'TD']));
      inputs.sampledProducts.forEach(product => reached.add(product.selectionToken));
      primaries.add(inputs.primaryProduct!.provider);
    }
    expect(reached).toEqual(new Set(Object.values(core.sections).flatMap(section => section.rates)
      .map(row => `${row.rate_index}#${row.product_key}`)));
    expect(primaries.size).toBe(8);
  });

  test('never samples profile-excluded products even with full-catalogue opt-in', () => {
    const core = corePayload();
    const permitted = core.sections.Mortgage.rates.filter(row => row.provider === 'Zed Bank');
    installMandatoryEligibility({ active: true, loading: false,
      rows: new WeakSet(permitted), productKeys: new Set(permitted.map(row => row.product_key)) });
    const inputs = deriveDeepAuditInputs(core, { seed: 'blocked-ANZ', includeNonStandard: true });
    expect(inputs.primaryProduct?.provider).toBe('Zed Bank');
    expect(inputs.sampledProducts).toHaveLength(1);
    expect(inputs.secondaryProduct).toBeNull();
    expect(inputs.compareSelectionTokens).toEqual([]);
    installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() });
    expect(deriveDeepAuditInputs(core, { includeNonStandard: true })).toMatchObject({
      primaryProduct: null, sampledProducts: [], sampling: { filterReady: false },
    });
  });

  test('does not convert a blocked suitability gate into an empty catalogue sample', () => {
    setSuitabilityAllowed(new Set(), { rebuildClosed: true });
    expect(deriveDeepAuditInputs(corePayload()).sampling.filterReady).toBe(false);
    expect(deriveDeepAuditInputs(corePayload(), { includeNonStandard: true }).sampling.filterReady).toBe(true);
  });

  test('ignores invalid identities without biasing the random sample', () => {
    const core = corePayload();
    const before = deriveDeepAuditInputs(core);
    core.sections.Savings.rates.push(rate({ provider: 'Zed Bank', product_key: '' }));
    expect(deriveDeepAuditInputs(core)).toEqual(before);
  });

  test('keeps hidden optional graphics outside the base Outlook entry barrier', () => {
    const steps = buildDeepPerformanceAuditPlan(corePayload()).passes[0].steps;
    expect(steps.find(step => step.semanticActionId === 'outlook.open')?.readiness).not.toContain('graphics');
    expect(steps.find(step => step.semanticActionId === 'outlook.economy.lens.next')?.readiness).toContain('graphics');
  });

  test('opens projection inputs before requiring the chart built from the audit scenario', () => {
    for (const pass of buildDeepPerformanceAuditPlan(corePayload()).passes) {
      const steps = pass.steps.filter(step => step.scenarioId === 'route.projections');
      expect(steps[0]).toMatchObject({ semanticActionId: 'projections.open', expectedSurface: 'projections.inputs' });
      expect(steps[0].readiness).not.toContain('graphics');
      expect(steps[0].readiness).toContain('scenario-storage');
      expect(steps[1].semanticActionId).toBe('projections.inputs.apply-primary');
      expect(steps.find(step => step.semanticActionId === 'projections.chart.next'))
        .toMatchObject({ expectedSurface: 'projections.lifecycle-chart', readiness: expect.arrayContaining(['graphics']) });
    }
  });

  test('does not inherit graphic readiness when compare.dismiss returns to search.results', () => {
    const dismiss = allSteps().find(
      (step) => step.passId === 'first-pass' && step.semanticActionId === 'compare.dismiss',
    );
    expect(dismiss).toMatchObject({
      expectedPath: '/browse',
      expectedSurface: 'rates.results',
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
    const calculatorActions = allSteps()
      .filter((step) => step.passId === 'first-pass' && step.scenarioId === 'route.calculator')
      .map((step) => step.semanticActionId);
    expect(calculatorActions.indexOf('calculator.section.mortgage'))
      .toBeLessThan(calculatorActions.indexOf('calculator.scenario.apply-buy'));
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

describe('scenario re-entry gate', () => {
  // The search scenario is the clearest case: a filter sheet opened at depth 1
  // and acted on at depth 2, all local-only state that route recovery discards.
  const searchSteps = () =>
    allSteps().filter(
      (step) => step.passId === 'first-pass' && step.scenarioId === 'route.rates',
    );
  // Mirrors routeEntryHref in the runner: depth-0 opens push their own route,
  // as do the redirect verifications. Deeper `.open` actions such as
  // search.compare.open are mounted controls on the current screen.
  const routeEntry = (step: DeepAuditStep) =>
    step.depth === 0 || step.semanticActionId.startsWith('redirect.');

  test('skips the rest of a scenario once recovery has unmounted its screen', () => {
    const steps = searchSteps();
    const filtersOpen = steps.findIndex(
      (step) => step.semanticActionId === 'search.filters.open',
    );
    expect(filtersOpen).toBeGreaterThan(0);
    const gate = new ScenarioReentryGate();

    // Everything up to the interruption runs normally.
    for (const step of steps.slice(0, filtersOpen + 1)) {
      expect(gate.shouldSkip(step, routeEntry(step))).toBe(false);
    }

    gate.markRecovered(steps[filtersOpen]);

    // The provider filter and the apply that depends on it would otherwise run
    // against a freshly mounted screen with no sheet open.
    const dependents = steps.slice(filtersOpen + 1);
    expect(dependents.map((step) => step.semanticActionId)).toEqual(
      expect.arrayContaining(['search.filter.provider.first', 'search.filters.apply']),
    );
    for (const step of dependents) {
      expect(gate.shouldSkip(step, routeEntry(step))).toBe(true);
    }
  });

  test('resumes at the next scenario rather than discarding the rest of the pass', () => {
    const steps = allSteps().filter((step) => step.passId === 'first-pass');
    const searchIndex = steps.findIndex(
      (step) => step.semanticActionId === 'search.filters.open',
    );
    const gate = new ScenarioReentryGate();
    gate.markRecovered(steps[searchIndex]);

    const next = steps.slice(searchIndex + 1).find((step) => step.scenarioId !== 'route.rates');
    expect(next).toBeDefined();
    expect(gate.shouldSkip(next!, routeEntry(next!))).toBe(false);
  });

  test('a step that navigates to its own route clears the gate', () => {
    const steps = searchSteps();
    const gate = new ScenarioReentryGate();
    gate.markRecovered(steps[steps.length - 1]);

    const open = steps.find((step) => step.semanticActionId === 'search.open');
    expect(open).toBeDefined();
    // search.open enters the canonical /browse results, so it re-establishes the screen.
    expect(gate.shouldSkip(open!, true)).toBe(false);
  });

  test('does nothing when no recovery has happened', () => {
    const gate = new ScenarioReentryGate();
    for (const step of searchSteps()) {
      expect(gate.shouldSkip(step, routeEntry(step))).toBe(false);
    }
  });
});
