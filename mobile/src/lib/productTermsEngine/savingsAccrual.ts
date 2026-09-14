import { Decimal, decimalZero } from './decimal';
import { evaluateEligibility } from './eligibility';
import { dailyInterest } from './interestAccrual';
import type { InterestPolicy } from './types';
import type { SavingsAssessment, SavingsContribution, SavingsRateSchedule } from './savingsTypes';
import { assessSavingsActivity } from './savingsActivity';
export type SavingsActivityCache = Map<string, ReturnType<typeof assessSavingsActivity>>;

/** Call only after validateSavings. Unknown component accrual is omitted and explicitly incomplete. */
export function savingsInterest(balance: Decimal, date: string, policy: InterestPolicy, schedule: SavingsRateSchedule, assessments: SavingsAssessment[], cache?: SavingsActivityCache) {
  const interval = schedule.intervals.find(i => i.from <= date && date < i.toExclusive)!;
  const contributions: SavingsContribution[] = [], issues: string[] = [];
  let total = decimalZero();
  for (const c of interval.components) {
    const q = c.qualification;
    const window = q?.windows.find(w => w.appliesFrom <= date && date < w.appliesToExclusive);
    const assessment = q && window ? assessments.find(a => a.assessmentKey === q.assessmentKey && a.accountId === q.accountId &&
      a.from === window.from && a.toExclusive === window.toExclusive && a.appliesFrom === window.appliesFrom && a.appliesToExclusive === window.appliesToExclusive) : null;
    const cacheKey = JSON.stringify([interval.id, c.id, assessment?.id]);
    const activity = q?.activityMetrics && assessment ? cache?.get(cacheKey) ?? assessSavingsActivity(assessment, q.activityMetrics) : null;
    if (activity) cache?.set(cacheKey, activity);
    const qualification = q ? evaluateEligibility(q.rule, assessment?.coverage === 'complete' ? activity?.facts ?? assessment.facts : {}) : null;
    const status = q && (!assessment || assessment.coverage !== 'complete') ? 'needs_information' : qualification?.status ?? 'meets';
    const trace: SavingsContribution = { intervalId: interval.id, componentId: c.id, kind: c.kind, allocation: c.allocation,
      status: status === 'meets' ? 'applied' : status, assessmentId: assessment?.id ?? null, qualification,
      tiers: [], evidenceIds: [...new Set([...interval.evidenceIds, ...c.evidenceIds, ...(window?.evidenceIds ?? []), ...(assessment?.evidenceIds ?? [])])] };
    if (activity) trace.activityResults = activity.results;
    contributions.push(trace);
    if (status === 'needs_information') { issues.push(`savings_qualification_unknown:${interval.id}:${c.id}`); continue; }
    if (status === 'does_not_meet') continue;
    let lower = decimalZero();
    for (const tier of c.tiers) {
      const upper = tier.upperInclusive === null ? null : Decimal.parse(tier.upperInclusive);
      const fits = upper === null || balance.compare(upper) <= 0;
      let basis = balance;
      if (c.allocation === 'marginal') {
        basis = (upper !== null && balance.compare(upper) > 0 ? upper : balance).sub(lower);
        if (basis.compare(decimalZero()) < 0) basis = decimalZero();
      } else if (!fits) { lower = upper!; continue; }
      const tierPolicy = schedule.dailyAccrualRounding === 'aggregate' ? { ...policy, dailyAccrualScale: null } : policy;
      const amount = dailyInterest(basis, Decimal.parse(tier.annualRate), date, tierPolicy);
      total = total.add(amount);
      trace.tiers.push({ id: tier.id, basis: basis.fixed(), annualRate: tier.annualRate, accrual: amount.fixed(12), evidenceIds: tier.evidenceIds });
      if (c.allocation === 'whole_balance' || fits) break;
      lower = upper!;
    }
  }
  if (schedule.dailyAccrualRounding === 'aggregate' && policy.dailyAccrualScale !== null) total = total.rounded(policy.dailyAccrualScale, policy.accrualRounding);
  return { amount: total, contributions, issues };
}
