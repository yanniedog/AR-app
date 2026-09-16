import { customerInputRequirements, type CustomerInputContract } from '../customerInputRequirements';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import type { Fact, Facts, Rule } from '../../lib/productTermsEngine/types';
import { own, validFact, type CustomerProfile, type InputDefinition } from '../customerProfile';
import type { EligibilitySubject, InputBinding } from './types';
export type ScenarioRole = Exclude<InputBinding, 'customer_fact' | 'assessment_date'>;
export interface EligibilityScenario { assessmentDate: string; values: Partial<Record<ScenarioRole, Fact>> }
export function eligibilityAnswerId(subject: EligibilitySubject, key: string) { return `elig_${hashText(canonical([subject.id, key]))}`; }
export function eligibilityDefinition(subject: EligibilitySubject, key: string): InputDefinition {
  const d = subject.inputDefinitions.find(value => value.key === key); if (!d) throw new Error('Unknown eligibility input');
  return { id: eligibilityAnswerId(subject, key), label: d.label, type: d.type, ...(d.unit ? { unit: d.unit } : {}) };
}
/** One local fact assembly path for assessment and missing-input discovery. */
export function eligibilityFacts(subject: EligibilitySubject, scenario: EligibilityScenario, profile: CustomerProfile): Facts {
  if (!scenario || Object.keys(scenario).some(key => !['assessmentDate','values'].includes(key)) || !scenario.values || typeof scenario.values !== 'object' || Array.isArray(scenario.values)) throw new Error('Eligibility scenario is invalid');
  const allowed = new Set(subject.inputDefinitions.filter(d => !['customer_fact','assessment_date'].includes(d.binding)).map(d => d.binding));
  if (Object.keys(scenario.values).some(role => !allowed.has(role as InputBinding))) throw new Error('Scenario role is not declared');
  const facts: Facts = Object.create(null);
  for (const d of subject.inputDefinitions) {
    let value: Fact | undefined;
    if (d.binding === 'assessment_date') value = { type: 'date', value: scenario.assessmentDate };
    else if (d.binding !== 'customer_fact') value = own(scenario.values, d.binding) ? scenario.values[d.binding] : undefined;
    else {
      const id = eligibilityAnswerId(subject, d.key), answer = own(profile.answers, id) ? profile.answers[id] : undefined;
      if (answer?.state !== 'known') continue;
      const p = answer.provenance;
      if (p.productKey !== subject.scope.productKey || p.effectiveFrom && scenario.assessmentDate < p.effectiveFrom || p.effectiveToExclusive && scenario.assessmentDate >= p.effectiveToExclusive) continue;
      value = answer.fact;
    }
    if (value !== undefined && (!validFact(value) || value.type !== d.type || value.type === 'decimal' && value.unit !== d.unit)) {
      if (d.binding !== 'customer_fact') throw new Error('Scenario fact does not match its reviewed type or unit');
      continue;
    }
    if (value !== undefined) facts[d.key] = value;
  }
  return facts;
}
export function customerContractForSubject(subject: EligibilitySubject): CustomerInputContract {
  const rule = JSON.parse(canonical(subject.eligibility)) as Rule;
  function map(r: Rule) { if (r.op === 'compare') r.field = eligibilityAnswerId(subject, r.field); else if (r.op === 'not') map(r.rule); else if (r.op === 'and' || r.op === 'or') r.rules.forEach(map); }
  map(rule);
  return { schemaVersion: 1, productKey: subject.scope.productKey, revisionSha256: subject.id, effectiveFrom: subject.scope.effectiveFrom, effectiveToExclusive: subject.scope.effectiveToExclusive, inputs: subject.inputDefinitions.map(d => eligibilityDefinition(subject, d.key)), rule };
}
export function eligibilityRequirements(subject: EligibilitySubject, scenario: EligibilityScenario, profile: CustomerProfile, contract = customerContractForSubject(subject)) {
  const facts = eligibilityFacts(subject, scenario, profile), mapped: Facts = Object.create(null);
  for (const [key, fact] of Object.entries(facts)) mapped[eligibilityAnswerId(subject, key)] = fact;
  const customerAnswers: CustomerProfile['answers'] = Object.create(null);
  for (const d of subject.inputDefinitions.filter(definition => definition.binding === 'customer_fact')) {
    const id = eligibilityAnswerId(subject, d.key); if (own(profile.answers, id)) customerAnswers[id] = profile.answers[id];
  }
  const requirements = customerInputRequirements(contract, { ...profile, answers: customerAnswers }, subject.scope.productKey, scenario.assessmentDate, mapped);
  const neededIds = new Set(requirements.needed.map(d => d.id)), deferredIds = new Set(requirements.deferred.map(d => d.id));
  return { facts, needed: subject.inputDefinitions.filter(d => neededIds.has(eligibilityAnswerId(subject, d.key))), deferred: subject.inputDefinitions.filter(d => d.binding === 'customer_fact' && deferredIds.has(eligibilityAnswerId(subject, d.key))),
    saved: subject.inputDefinitions.filter(d => d.binding === 'customer_fact' && own(profile.answers, eligibilityAnswerId(subject, d.key))) };
}
