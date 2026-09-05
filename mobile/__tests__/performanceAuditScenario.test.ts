import { prepareProjectionAuditScenario } from '../src/lib/performanceAuditScenario';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { buildLifecycleProjection } from '../src/data/projections';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';

it('runs both canned projection variants after incompatible prior scenarios without mutating them', () => {
  const original = normalizeUserRateScenario({
    mortgage: { mode: 'refi', loanBalance: '650000', currentRate: '9', years: '25' },
    projections: { mortgage: { higherRate: '7', startDate: 'bad', periodicAmount: '-2' },
      savings: { savingsRateStructure: 'conditional-bonus', ongoingRate: '90', higherRate: '4' } },
  });
  const before = JSON.stringify(original);
  const steps = buildDeepPerformanceAuditPlan(null).passes.flatMap((pass) => pass.steps);
  for (const step of steps.filter((s) => s.semanticActionId.startsWith('projections.inputs.apply-'))) {
    const scenario = prepareProjectionAuditScenario(original);
    const p = step.parameters;
    scenario.mortgage = { ...scenario.mortgage, mode: 'refi', loanBalance: String(p.loanBalance),
      propertyValue: String(p.propertyValue), currentRate: String(p.currentRate), years: String(p.years) };
    scenario.projections.mortgage = { ...scenario.projections.mortgage,
      lowerRate: String(p.lowerRate), higherRate: String(p.higherRate),
      mortgageRateStructure: p.mortgageRateStructure === 'fixed' ? 'fixed' : 'variable',
      fixedPeriodMonths: String(p.fixedPeriodMonths ?? '') };
    for (const section of ['Mortgage', 'Savings', 'TD'] as const) {
      expect(buildLifecycleProjection(section, scenario).missing).toEqual([]);
    }
  }
  expect(JSON.stringify(original)).toBe(before);
  expect(steps.filter((s) => s.semanticActionId === 'projections.open')
    .every((s) => s.parameters.section === 'Mortgage')).toBe(true);
});
