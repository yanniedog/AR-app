import fs from 'node:fs';
import path from 'node:path';
import { AUDIT_APP_ROUTES, buildAuditAppCoverage } from '../src/lib/auditAppCoverage';
import type { AuditCheck } from '../src/lib/performanceAudit';
import type { AuditCheckDiagnostic } from '../src/lib/performanceAuditDiagnostic';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';

const plan = buildDeepPerformanceAuditPlan(null);
const step = plan.passes[0].steps.find(candidate => candidate.semanticActionId === 'about.open')!;
const checkId = `deep-${step.id}`;
const complete = { executionAttempted: true, actionInvoked: true, actionCompleted: true, firstReadyFrameObserved: true };

function check(readiness?: object): AuditCheck {
  return {
    id: checkId, kind: 'journey', label: 'About', status: 'pass', durationMs: 5, metrics: complete,
    ...(readiness ? { diagnostic: { readiness, stage: 'complete' } as AuditCheckDiagnostic } : {}),
  };
}

function readiness(probes: object[]) {
  return {
    ready: true, capturing: true, blockers: [],
    surfaces: [{ id: step.expectedSurface, probes }],
  };
}

test('requires a route audit scenario, system role or explicit boundary for every Expo entry', () => {
  const routes = path.resolve(__dirname, '../app');
  const walk = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.tsx?$/.test(entry.name) ? [path.relative(routes, target).split(path.sep).join('/')] : [];
  });
  expect(Object.keys(AUDIT_APP_ROUTES).sort()).toEqual(walk(routes).sort());
  for (const pass of plan.passes) {
    const planned = new Set(pass.steps.map(step => step.scenarioId));
    const mapped = Object.values(AUDIT_APP_ROUTES).flatMap(entry => 'scenario' in entry ? [entry.scenario] : []);
    expect(mapped.filter(scenario => !planned.has(scenario))).toEqual([]);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(new Set(pass.steps.map(step => step.id)).size).toBe(pass.steps.length);
    expect(pass.steps.filter(step => !step.expectedPath || !step.expectedSurface || !step.readiness.length)).toEqual([]);
  }
});

test('a terminal record needs unique completed action and current target evidence to verify', () => {
  const outcome = (...checks: AuditCheck[]) => buildAuditAppCoverage({ plan, checks }).actions
    .find(action => action.checkId === checkId)?.outcome;
  const ready = { id: 'about.overview.layout', kind: 'layout', status: 'ready', required: true, layout: true };
  const verified = check(readiness([ready]));
  expect(outcome()).toBe('missing');
  expect(outcome(check())).toBe('unverified');
  expect(outcome(verified, verified)).toBe('duplicate');
  expect(outcome({ ...verified, metrics: { ...complete, interruptedByBackground: true } })).toBe('interrupted');
  expect(outcome({ ...verified, status: 'skipped' })).toBe('unavailable');
  expect(outcome({ ...verified, status: 'fail' })).toBe('failed');
  expect(outcome(check(readiness([{ ...ready, renderMatches: false }])))).toBe('unverified');
  expect(outcome(check(readiness([ready, { ...ready, id: 'about.overview.content', status: 'pending' }])))).toBe('unverified');
  expect(outcome(check(readiness([ready, ready])))).toBe('unverified');
  expect(outcome(check(readiness([{ ...ready, layout: false }])))).toBe('unverified');
  expect(outcome({ ...verified, metrics: { ...complete, firstReadyFrameObserved: false } })).toBe('unverified');
  expect(outcome(verified)).toBe('verified');
});

test('ignores arbitrary stored plan strings and keeps the sample outside the semantic denominator', () => {
  const privateValue = 'private-email@example.test';
  const modified = {
    ...plan,
    passes: [{ ...plan.passes[0], steps: [...plan.passes[0].steps, {
      ...step, id: privateValue, expectedPath: privateValue, semanticActionId: privateValue,
      parameters: { value: privateValue },
    }] }],
  };
  const coverage = buildAuditAppCoverage({ plan: modified, checks: [{
    ...check(), id: 'deep-first-pass.sample.catalogue.0.product.open',
  }] });
  expect(JSON.stringify(coverage)).not.toContain(privateValue);
  expect(coverage.catalogueSample).toEqual({ recordedChecks: 1, fullCatalogueRendered: false });
  expect(coverage.actions.every(action => !action.checkId.includes('sample.catalogue'))).toBe(true);
  expect(coverage.routeFiles.find(route => route.file === '(tabs)/index.tsx')?.status).toBe('unverified');
});
