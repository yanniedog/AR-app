import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import type { Rule } from '../../lib/productTermsEngine/types';
import type { RateRow } from '../../types';
import type { CustomerProfile, InputDefinition } from '../customerProfile';
import { own, validFact } from '../customerProfile';
import { assertSelection, type ApprovedSelection, type ContractContext } from './transport';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { addCalendarMonths, calendarDate, dayNumber } from '../../lib/productTermsEngine/calendar';
import { EVALUATOR_VERSION, type Facts, type LedgerContract, type LedgerScenario } from '../../lib/productTermsEngine/types';
import { calculateLedger } from '../../lib/productTermsEngine/ledger';
export interface DepositInputs { principal: string; confirmedAnnualRate: string; fundedDate: string; maturityDate: string; confirmed: boolean; confirmedAt: string | null; noWithholdingConfirmed: boolean }
export function profileDefinitions(selection: ApprovedSelection): InputDefinition[] {
  return selection.template.inputDefinitions.filter(d => d.binding === 'customer_fact').map(d => ({ id: `td_${selection.template.id}_${d.key}`, label: d.label, type: d.type, ...(d.unit ? { unit: d.unit } : {}) }));
}
function depositFacts(selection: ApprovedSelection, inputs: DepositInputs, profile: CustomerProfile): Facts {
  const t = selection.template, facts: Facts = Object.create(null);
  for (const d of t.inputDefinitions) {
    if (d.binding === 'deposit_principal') { const f = { type: 'decimal' as const, value: inputs.principal, unit: 'AUD' }; if (validFact(f)) facts[d.key] = f; }
    else if (d.binding === 'funded_date' || d.binding === 'maturity_date') { const f = { type: 'date' as const, value: d.binding === 'funded_date' ? inputs.fundedDate : inputs.maturityDate }; if (validFact(f)) facts[d.key] = f; }
    else {
      const key = `td_${t.id}_${d.key}`, answer = own(profile.answers, key) ? profile.answers[key] : undefined;
      if (answer?.state !== 'known' || !validFact(answer.fact) || answer.fact.type !== d.type || (answer.fact.type === 'decimal' && answer.fact.unit !== d.unit)) continue;
      const p = answer.provenance;
      if (p.productKey !== t.productKey || (p.effectiveFrom && inputs.fundedDate < p.effectiveFrom) || (p.effectiveToExclusive && inputs.fundedDate >= p.effectiveToExclusive)) continue;
      facts[d.key] = answer.fact;
    }
  }
  return facts;
}

/** Customer values only enter this local call, never the immutable transport. */
export function instantiateDeposit(selection: ApprovedSelection, context: ContractContext, row: RateRow, inputs: DepositInputs, profile: CustomerProfile) {
  const dependencies = assertSelection(selection, context, row), t = selection.template;
  if (t.evaluatorVersion !== EVALUATOR_VERSION) throw new Error('A reviewed rate-confirmation calculation template is unavailable for this publication.');
  if (inputs.confirmed !== true || !inputs.confirmedAt || !Number.isFinite(Date.parse(inputs.confirmedAt)) || inputs.noWithholdingConfirmed !== true) throw new Error('Confirm the bank-agreed amount, rate and dates, and withholding treatment.');
  if (!/^\d+(\.\d{1,12})?$/.test(inputs.confirmedAnnualRate) || Decimal.parse(inputs.confirmedAnnualRate).compare(Decimal.parse(t.annualRate)) !== 0) throw new Error('The bank-confirmed rate does not match this reviewed rate. Choose the matching rate; this calculation cannot substitute another offer.');
  const principal = Decimal.parse(inputs.principal);
  if (principal.compare(Decimal.parse('0')) <= 0 || principal.compare(principal.rounded(2, 'toward_zero')) !== 0) throw new Error('Enter a positive deposit amount in cents.');
  for (const [kind, bound] of [['minimum', t.principalBounds.minimum], ['maximum', t.principalBounds.maximum]] as const) {
    if ('value' in bound) { const comparison = principal.compare(Decimal.parse(bound.value));
      if ((kind === 'minimum' ? comparison < 0 : comparison > 0) || (comparison === 0 && !bound.inclusive)) throw new Error('Deposit amount is outside the reviewed rate tier.');
    }
  }
  const funded = dayNumber(inputs.fundedDate), maturity = dayNumber(inputs.maturityDate);
  const expected = t.term.unit === 'days' ? calendarDate(funded + t.term.count) : addCalendarMonths(inputs.fundedDate, t.term.count, t.term.monthConvention);
  if (inputs.maturityDate !== expected || maturity <= funded || maturity - funded > 3660) throw new Error('Confirmed maturity does not match the reviewed term.');
  if (inputs.fundedDate < t.effectiveFrom || inputs.fundedDate >= t.effectiveToExclusive || (t.effectiveScope === 'whole_accrual_horizon' && inputs.maturityDate > t.effectiveToExclusive)) throw new Error('The confirmed dates fall outside the reviewed source interval.');
  const end = calendarDate(maturity + 1), facts = depositFacts(selection, inputs, profile);
  const refs = t.fieldClauseIds, allRefs = [...new Set(Object.values(refs).flat())], accountId = `td_${t.id}`;
  const contract: LedgerContract = {
    schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION, id: t.id, productId: t.productKey, direction: 'asset', currency: 'AUD',
    review: { ...selection.approval.review, benchmarkSha256: selection.approval.benchmarkResultSha256 },
    // Source eligibility interval was checked above; this instance includes its settlement day.
    applicability: { cohortKey: t.cohortKey, from: inputs.fundedDate, toExclusive: end },
    evidence: t.evidence, dependencyIds: [...new Set([...dependencies, ...t.documentVersionIds, ...t.termRevisionIds, t.sourceObservationId, t.sourceSha256])], unsupportedTerms: [], eligibility: t.eligibility,
    initialAnnualRate: t.annualRate, initialRateEvidenceIds: refs.annualRate,
    interest: { ...t.interest, balanceBasis: 'closing_balance_before_posted_interest', eventOrder: 'ordered_events_then_accrual_then_posting', postingDates: [], offset: 'none', evidenceIds: allRefs },
    feeSchedule: { schemaVersion: 1, accountId, from: inputs.fundedDate, toExclusive: end, inventoryCoverage: 'reviewed_complete', deferredObligations: 'none_confirmed', evidenceIds: refs.feeDisposition, ordering: 'before_scenario_events', inventory: [{ categoryId: 'all_fees', state: 'none_applicable', feeIds: [], evidenceIds: refs.feeDisposition }], fees: [] },
    tdLifecycle: { schemaVersion: 1, mode: 'fixed_maturity', cohortKey: t.cohortKey, evidenceIds: allRefs, confirmationEvidenceIds: [], investmentAmount: principal.fixed(), fundedDate: inputs.fundedDate, accrualStartDate: inputs.fundedDate, term: t.term, nominalMaturityDate: inputs.maturityDate, calendar: null, roundingReviewed: true, taxTreatment: 'none_confirmed',
      payments: { cadence: 'maturity', destination: 'linked_account', firstPeriodEnd: null, monthConvention: t.term.monthConvention, periodEnds: [], evidenceIds: refs.postingPolicy },
      closure: { kind: 'maturity', confirmedDate: inputs.maturityDate, acceptedNoticeDate: null, feeDecision: 'waived', principalRecovery: 'unknown', evidenceIds: refs.postingPolicy } },
  };
  const scenario: LedgerScenario = { tdConfirmation: { source: 'user_supplied_bank_confirmation', recordedAt: inputs.confirmedAt!, annualRate: inputs.confirmedAnnualRate, principal: principal.fixed(), fundedDate: inputs.fundedDate, maturityDate: inputs.maturityDate, noWithholding: true }, accountId, productId: t.productKey, cohortKey: t.cohortKey, startDate: inputs.fundedDate, endDateExclusive: end, openingBalance: principal.fixed(), initialOffset: '0', facts, events: [], assumptions: [] };
  return { contract, scenario };
}
export function calculateDeposit(selection: ApprovedSelection, context: ContractContext, row: RateRow, inputs: DepositInputs, profile: CustomerProfile) {
  const { contract, scenario } = instantiateDeposit(selection, context, row, inputs, profile);
  return { calculationInputs: { contract, scenario }, approval: selection.approval, edition: selection.edition, basis: 'Return before tax; bank confirmation reported by you, not independently verified.', receipt: calculateLedger(contract, scenario) };
}

export function depositInputRequirements(selection: ApprovedSelection, inputs: DepositInputs, profile: CustomerProfile) {
  const facts = depositFacts(selection, inputs, profile), fields = new Set<string>();
  function collect(r: Rule): void {
    if (evaluateEligibility(r, facts).status !== 'needs_information') return;
    if (r.op === 'compare') fields.add(`td_${selection.template.id}_${r.field}`);
    else if (r.op === 'not') collect(r.rule);
    else if (r.op === 'and' || r.op === 'or') r.rules.forEach(collect);
  }
  collect(selection.template.eligibility);
  const definitions = profileDefinitions(selection), missing = definitions.filter(d => fields.has(d.id));
  return { needed: missing.filter(d => !['unavailable', 'not_applicable'].includes(profile.answers[d.id]?.state)), deferred: missing.filter(d => ['unavailable', 'not_applicable'].includes(profile.answers[d.id]?.state)), saved: definitions.filter(d => own(profile.answers, d.id)) };
}
