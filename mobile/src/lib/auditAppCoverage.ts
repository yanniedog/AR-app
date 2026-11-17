import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { buildDeepPerformanceAuditPlan, type DeepAuditStep } from './performanceAuditPlan';

type AuditRouteCoverage = { scenario: string } | {
  system: 'native-intent' | 'root-layout' | 'tab-layout';
};

export const AUDIT_APP_ROUTES = {
  '_layout.tsx': { system: 'root-layout' },
  '(tabs)/_layout.tsx': { system: 'tab-layout' },
  '+native-intent.tsx': { system: 'native-intent' },
  '+not-found.tsx': { scenario: 'route.not-found' },
  'index.tsx': { scenario: 'redirect.root' },
  '(tabs)/index.tsx': { scenario: 'redirect.tab-index' },
  '(tabs)/browse.tsx': { scenario: 'route.rates' },
  '(tabs)/market.tsx': { scenario: 'route.market' },
  '(tabs)/watchlist.tsx': { scenario: 'route.saved' },
  '(tabs)/tools.tsx': { scenario: 'redirect.tools' },
  '(tabs)/trends.tsx': { scenario: 'redirect.tab-trends' },
  'about.tsx': { scenario: 'route.about' },
  'bank-rates.tsx': { scenario: 'route.bank-rates' },
  'bank/[provider].tsx': { scenario: 'route.lender' },
  'banks.tsx': { scenario: 'redirect.banks' },
  'calculation-receipt.tsx': { scenario: 'route.calculation-receipt' },
  'calculator.tsx': { scenario: 'route.calculator' },
  'catalogue.tsx': { scenario: 'redirect.catalogue' },
  'categories.tsx': { scenario: 'redirect.categories' },
  'compare.tsx': { scenario: 'route.compare' },
  'debug-log.tsx': { scenario: 'route.debug-log' },
  'matches.tsx': { scenario: 'redirect.matches' },
  'node.tsx': { scenario: 'redirect.node' },
  'onboarding.tsx': { scenario: 'redirect.onboarding' },
  'passthrough.tsx': { scenario: 'redirect.changes' },
  'performance-audit.tsx': { scenario: 'route.audit' },
  'product/[key].tsx': { scenario: 'route.product' },
  'profile.tsx': { scenario: 'route.profile' },
  'projections.tsx': { scenario: 'redirect.projections' },
  'rate-receipt.tsx': { scenario: 'route.receipt' },
  'rba-response.tsx': { scenario: 'route.moves' },
  'rba.tsx': { scenario: 'route.rba' },
  'research.tsx': { scenario: 'route.outlook' },
  'search.tsx': { scenario: 'redirect.search' },
  'settings.tsx': { scenario: 'route.settings' },
  'terms.tsx': { scenario: 'route.terms' },
  'third-party-notices.tsx': { scenario: 'route.notices' },
  'trends.tsx': { scenario: 'redirect.trends' },
} as const satisfies Record<string, AuditRouteCoverage>;

const readinessCategories = {
  graphics: 'graphic',
  list: 'list',
  logos: 'logo',
  'local-state': 'layout',
} as const;

type EvidenceOutcome = 'missing' | 'duplicate' | 'unavailable' | 'interrupted' | 'failed' | 'unverified' | 'verified';

function outcomeForStep(step: DeepAuditStep, checks: readonly AuditCheck[]): EvidenceOutcome {
  if (!checks.length) return 'missing';
  if (checks.length > 1) return 'duplicate';
  const [check] = checks;
  if (check.metrics.interruptedByBackground === true) return 'interrupted';
  if (check.status === 'fail') return 'failed';
  if (check.status === 'skipped' || check.metrics.availabilityFailure === true) return 'unavailable';
  if (check.kind !== 'journey' || check.metrics.executionAttempted !== true ||
    check.metrics.actionInvoked !== true || check.metrics.actionCompleted !== true ||
    check.metrics.firstReadyFrameObserved !== true) return 'unverified';
  const readiness = check.diagnostic?.readiness;
  if (readiness?.ready !== true || readiness.capturing !== true || !Array.isArray(readiness.surfaces)) return 'unverified';
  const targets = readiness.surfaces.filter(surface => surface?.id === step.expectedSurface);
  const [target] = targets;
  if (targets.length !== 1 || !Array.isArray(target?.probes)) return 'unverified';
  const activeProbes = target.probes.filter(probe => probe != null && probe.coveredBySheet !== true);
  const positiveEvidence = activeProbes.filter(probe => probe.status === 'ready' && !probe.errorPresent &&
    (probe.kind !== 'layout' || probe.layout === true));
  const requiredKinds = step.readiness.flatMap(category =>
    category in readinessCategories ? [readinessCategories[category as keyof typeof readinessCategories]] : []);
  if (!positiveEvidence.length || requiredKinds.some(kind => !positiveEvidence.some(probe => probe.kind === kind)) ||
    new Set(activeProbes.map(probe => probe.id)).size !== activeProbes.length ||
    activeProbes.some(probe => (probe.required && probe.status !== 'ready') || probe.status === 'error' ||
      probe.errorPresent || probe.datasetMatches === false || probe.renderMatches === false)) return 'unverified';
  return 'verified';
}

const stepIdentity = (step: DeepAuditStep) => `deep-${step.id}`;

// The current source-authored plan is the vocabulary for public route/action
// evidence. Report parameters and arbitrary stored strings are never emitted.
let sourceSteps: ReadonlyMap<string, DeepAuditStep> | undefined;
function fixedSteps(): ReadonlyMap<string, DeepAuditStep> {
  sourceSteps ??= new Map(buildDeepPerformanceAuditPlan(null).passes.flatMap(pass =>
    pass.steps.map(step => [stepIdentity(step), step] as const)));
  return sourceSteps;
}

export function buildAuditAppCoverage(report: Pick<PerformanceAuditReport, 'plan' | 'checks'>) {
  const matches = new Map<string, AuditCheck[]>();
  for (const check of report.checks) {
    if (typeof check?.id !== 'string' || !check.id.startsWith('deep-')) continue;
    const sameId = matches.get(check.id);
    if (sameId) sameId.push(check);
    else matches.set(check.id, [check]);
  }
  const templates = fixedSteps();
  const observedPlanIds = new Set<string>();
  for (const pass of Array.isArray(report.plan?.passes) ? report.plan.passes : []) {
    for (const step of Array.isArray(pass?.steps) ? pass.steps : []) {
      if (typeof step?.id === 'string') observedPlanIds.add(stepIdentity(step));
    }
  }
  const hasPlan = Array.isArray(report.plan?.passes) && report.plan.passes.length > 0;
  const actions = [...templates].map(([id, step]) => {
    const checks = matches.get(id) ?? [];
    return {
      checkId: id,
      scenario: step.scenarioId,
      action: step.semanticActionId,
      pass: step.passId,
      assertionCategories: [...step.readiness],
      targetSurface: step.expectedSurface,
      outcome: observedPlanIds.has(id) ? outcomeForStep(step, checks) : 'missing' as const,
    };
  });
  const scenarioCounts = new Map<string, { planned: number; recorded: number; verified: number }>();
  for (const action of actions) {
    const counts = scenarioCounts.get(action.scenario) ?? { planned: 0, recorded: 0, verified: 0 };
    counts.planned++;
    if (action.outcome !== 'missing') counts.recorded++;
    if (action.outcome === 'verified') counts.verified++;
    scenarioCounts.set(action.scenario, counts);
  }
  const scenarios = [...scenarioCounts.entries()].map(([scenario, counts]) => ({ scenario, ...counts }));
  const routeFiles = Object.entries(AUDIT_APP_ROUTES).map(([file, definition]) => {
    if ('system' in definition) return { file, status: 'system' as const, role: definition.system };
    const counts = scenarioCounts.get(definition.scenario);
    return {
      file, scenario: definition.scenario,
      status: counts && counts.verified === counts.planned ? 'verified' as const : 'unverified' as const,
    };
  });
  return {
    schemaVersion: 1,
    measurement: 'semantic-audit-actions' as const,
    hasPlan,
    routeFiles,
    scenarios,
    actions,
    catalogueSample: report.plan?.inputs?.sampling?.fullCatalogueRendered === false
      ? {
          // The sample is intentionally outside the fixed-action denominator.
          recordedChecks: [...matches.keys()].filter(id =>
            /^deep-(?:first-pass|repeat)\.sample\.catalogue\.\d+\.(?:product\.open|product\.lender\.open)$/.test(id)).length,
          fullCatalogueRendered: false as const,
        }
      : null,
  };
}
