import { utf8ToBytes } from '@noble/hashes/utils';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { dayNumber } from '../../lib/productTermsEngine/calendar';
import type { Facts } from '../../lib/productTermsEngine/types';
import { own, type CustomerProfile, type CustomerAnswer } from '../customerProfile';
import { assertEligibilitySelection, type EligibilityContext, type EligibilitySelection, type EligibilityTarget } from './transport';
import { eligibilityAnswerId, eligibilityFacts, eligibilityRequirements, customerContractForSubject, type EligibilityScenario } from './facts';
import type { EligibilityApproval, EligibilitySubject } from './types';
import { ELIGIBILITY_ADAPTER_VERSION, ELIGIBILITY_EVALUATOR_VERSION } from './types';
export interface EligibilityEvaluationInputs {
  subject: EligibilitySubject; approval: EligibilityApproval; binding: ReturnType<typeof assertEligibilitySelection>;
  target: { kind: 'product'; productKey: string; productRecordSha256: string } | { kind: 'rate_variant'; productKey: string; productRecordSha256: string; section: string; coreRowIndex: number; rateIndex: number; rowSha256: string };
  scenario: EligibilityScenario; customerAnswers: Record<string, CustomerAnswer>; facts: Facts;
}
export function assertAssessment(selection: EligibilitySelection, context: EligibilityContext, target: EligibilityTarget, scenario: EligibilityScenario) {
  const binding = assertEligibilitySelection(selection, context, target); dayNumber(scenario.assessmentDate);
  if (scenario.assessmentDate < selection.subject.scope.effectiveFrom || scenario.assessmentDate >= selection.subject.scope.effectiveToExclusive) throw new Error('Assessment date is outside the reviewed coverage interval');
  return binding;
}
/** Pure local eligibility execution. No ledger, monetary totals, upload or bank-decision claim. */
export function evaluateEligibilitySelection(selection: EligibilitySelection, context: EligibilityContext, target: EligibilityTarget, scenario: EligibilityScenario, profile: CustomerProfile) {
  const binding = assertAssessment(selection, context, target, scenario), subject = selection.subject;
  const facts = eligibilityFacts(subject, scenario, profile), customerAnswers = Object.create(null);
  for (const definition of subject.inputDefinitions.filter(d => d.binding === 'customer_fact')) {
    const id = eligibilityAnswerId(subject, definition.key);
    if (own(profile.answers, id)) customerAnswers[id] = profile.answers[id];
  }
  const evaluationInputs: EligibilityEvaluationInputs = JSON.parse(canonical({ subject, approval: selection.approval, binding,
    target: target.kind === 'product' ? { kind: target.kind, productKey: target.productKey, productRecordSha256: subject.source.productRecordSha256 } : { kind: target.kind, productKey: target.productKey, productRecordSha256: subject.source.productRecordSha256, section: target.section, coreRowIndex: context.core!.sections[target.section].rates.indexOf(target.row), rateIndex: target.row.rate_index, rowSha256: hashText(canonical(target.row)) },
    scenario, customerAnswers, facts }));
  if (utf8ToBytes(canonical(evaluationInputs)).length > 512 * 1024) throw new Error('Eligibility receipt input exceeds limit');
  const result = { schemaVersion: 1 as const, evaluationKind: 'eligibility_only' as const, adapterVersion: ELIGIBILITY_ADAPTER_VERSION, evaluatorVersion: ELIGIBILITY_EVALUATOR_VERSION,
    evaluationInputs, inputSha256: hashText(canonical(evaluationInputs)), eligibility: evaluateEligibility(subject.eligibility, facts) };
  if (utf8ToBytes(canonical(result)).length > 1024 * 1024) throw new Error('Eligibility receipt exceeds limit');
  return result;
}
export function reviewedEligibilityInputs(selection: EligibilitySelection, context: EligibilityContext, target: EligibilityTarget, scenario: EligibilityScenario, profile: CustomerProfile) {
  const contract = reviewedCustomerInputContract(selection, context, target, scenario); return eligibilityRequirements(selection.subject, scenario, profile, contract);
}

/** A product key alone cannot resolve or authorize customer questions. */
export function reviewedCustomerInputContract(selection: EligibilitySelection, context: EligibilityContext, target: EligibilityTarget, scenario: EligibilityScenario) {
  assertAssessment(selection, context, target, scenario); return customerContractForSubject(selection.subject);
}
