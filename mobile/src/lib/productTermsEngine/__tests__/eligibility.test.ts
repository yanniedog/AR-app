import { evaluateEligibility } from '../eligibility';
import type { Facts, Rule } from '../types';
import { ageRule, sources } from '../testSupport';

describe('reviewed source-clause predicates', () => {
  test.each(sources.filter(row => row.pattern === 'decimal-gte'))('age clause $id ($split)', row => {
    const rule = ageRule(row.id), age = Number(row.values.minimumAge);
    expect(evaluateEligibility(rule, { age: { type: 'decimal', value: String(age), unit: 'years' } }).status).toBe('meets');
    expect(evaluateEligibility(rule, { age: { type: 'decimal', value: String(age - 1), unit: 'years' } }).status).toBe('does_not_meet');
    expect(evaluateEligibility(rule, {}).status).toBe('needs_information');
    expect(evaluateEligibility(rule, { age: { type: 'text', value: String(age) } }).status).toBe('needs_information');
  });
  test('full eligibility stays pending after a satisfied age clause', () => {
    const rule: Rule = { id: 'all', op: 'and', rules: [ageRule(), { id: 'remaining', op: 'unknown', reason: 'remaining_criteria_and_source_conflicts' }] };
    expect(evaluateEligibility(rule, { age: { type: 'decimal', value: '16', unit: 'years' } }).status).toBe('needs_information');
    expect(evaluateEligibility(rule, { age: { type: 'decimal', value: '15', unit: 'years' } }).status).toBe('does_not_meet');
  });
  test.each([
    ['and', 'meets', 'needs_information', 'needs_information'],
    ['and', 'does_not_meet', 'needs_information', 'does_not_meet'],
    ['or', 'meets', 'needs_information', 'meets'],
    ['or', 'does_not_meet', 'needs_information', 'needs_information'],
  ] as const)('three-valued %s %s %s', (op, first, second, expected) => {
    const facts: Facts = { age: { type: 'decimal', value: first === 'meets' ? '16' : '15', unit: 'years' } };
    const rule: Rule = { id: 'group', op, rules: [ageRule(), { id: second, op: 'unknown', reason: 'missing' }] };
    expect(evaluateEligibility(rule, facts).status).toBe(expected);
  });
  test('NOT preserves unknown instead of admitting missing information', () => {
    expect(evaluateEligibility({ id: 'not', op: 'not', rule: ageRule() }, {}).status).toBe('needs_information');
    expect(evaluateEligibility({ id: 'not', op: 'not', rule: ageRule() }, { age: { type: 'decimal', value: '15', unit: 'years' } }).status).toBe('meets');
  });
  test('empty groups and duplicate identities never produce a vacuous eligible result', () => {
    expect(evaluateEligibility({ id: 'empty', op: 'and', rules: [] }, {}).status).toBe('needs_information');
    expect(evaluateEligibility({ id: 'root', op: 'and', rules: [ageRule(), ageRule()] }, { age: { type: 'decimal', value: '16', unit: 'years' } }).status).toBe('needs_information');
  });
  test('exact financial thresholds do not round into eligibility', () => {
    const rule: Rule = { id: 'bound', op: 'compare', field: 'value', comparison: 'lt', expected: { type: 'decimal', value: '0.8', unit: 'fraction' } };
    expect(evaluateEligibility(rule, { value: { type: 'decimal', value: '0.79999999999999999', unit: 'fraction' } }).status).toBe('meets');
    expect(evaluateEligibility(rule, { value: { type: 'decimal', value: '0.8', unit: 'fraction' } }).status).toBe('does_not_meet');
    expect(evaluateEligibility(rule, { value: { type: 'decimal', value: '0.8', unit: 'percentage_points' } }).status).toBe('needs_information');
  });
});
