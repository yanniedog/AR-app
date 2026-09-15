import { Decimal } from './decimal';
import { allocateSavingsTiers } from './savingsAllocation';
import { dailyInterest } from './interestAccrual';
import { evaluateEligibility } from './eligibility';
import type { InterestPolicy } from './types';
import type { SavingsRateSchedule } from './savingsTypes';

/** Fixed arithmetic self-checks only. No user inputs or bank eligibility claims. */
export function runtimeSavingsConformance(): Record<string, boolean> {
  const policy: InterestPolicy = { dayCount: 'actual_365_fixed', balanceBasis: 'closing_balance_before_posted_interest',
    eventOrder: 'ordered_events_then_accrual_then_posting', dailyAccrualScale: null, dailyRateRounding: null,
    accrualRounding: 'half_up', postingRounding: 'half_up', postingDates: [], offset: 'none', evidenceIds: [] };
  const schedule: SavingsRateSchedule = { schemaVersion: 1, dailyAccrualRounding: 'aggregate', intervals: [{ id: 'self-check', from: '2026-01-01', toExclusive: '2026-01-02', evidenceIds: [],
    components: [{ id: 'self-check', kind: 'base', allocation: 'marginal', rateMeaning: 'additive', qualification: null, evidenceIds: [],
      tiers: [{ id: 'first', upperInclusive: '100', annualRate: '0.365', evidenceIds: [] }, { id: 'excess', upperInclusive: null, annualRate: '0', evidenceIds: [] }] }] }] };
  const compute = () => allocateSavingsTiers(Decimal.parse('200'), schedule.intervals[0].components[0]).reduce((total, p) =>
    total.add(dailyInterest(p.basis, Decimal.parse(p.tier.annualRate), '2026-01-01', policy)), Decimal.parse('0'));
  const marginal = compute().fixed() === '0.10';
  schedule.intervals[0].components[0].allocation = 'whole_balance';
  const whole = compute().fixed() === '0.00';
  schedule.intervals[0].components[0].qualification = { accountId: 'self-check', assessmentKey: 'self-check',
    windows: [{ from: '2025-12-01', toExclusive: '2026-01-01', appliesFrom: '2026-01-01', appliesToExclusive: '2026-01-02', evidenceIds: [] }],
    rule: { id: 'self-check', op: 'compare', field: 'known', comparison: 'eq', expected: { type: 'boolean', value: true } } };
  return { savingsMarginalBoundary: marginal, savingsWholeBalanceBoundary: whole,
    savingsQualificationMissingFact: evaluateEligibility(schedule.intervals[0].components[0].qualification!.rule, {}).status === 'needs_information' };
}
