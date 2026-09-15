import canonicalFixture from './fixtures/executable-eligibility-identity-v2.json';
import { eligibilitySubject, eligibilityAsset } from '../test-support/eligibilityHarness';
import { validateEligibilitySubject, validateEligibilityAsset, eligibilityIdentity } from '../src/data/eligibilityContracts/validation';
import { eligibilityFacts, eligibilityRequirements, eligibilityAnswerId } from '../src/data/eligibilityContracts/facts';
import { profile } from '../test-support/executableDepositHarness';
test('validates exact scoped eligibility protocol and rejects closed-schema/association changes', () => {
  expect(validateEligibilitySubject(eligibilitySubject()).capability).toBe('eligibility_only');
  for (const mutate of [(s: any) => s.adapterVersion = 'future', (s: any) => s.scope.intervalBasis = 'bank_policy_effective', (s: any) => s.inputDefinitions[1].binding = 'derived_lvr', (s: any) => s.scope.rateIndexes = [1]]) {
    expect(() => validateEligibilitySubject(eligibilitySubject(mutate))).toThrow();
  }
  const asset = eligibilityAsset(); asset.subjects[0].approval.subjectId = 'f'.repeat(64); asset.identitySha256 = eligibilityIdentity(asset, 'identitySha256'); expect(() => validateEligibilityAsset(asset)).toThrow();
  const duplicate = eligibilityAsset(); duplicate.subjects.push(structuredClone(duplicate.subjects[0])); duplicate.identitySha256 = eligibilityIdentity(duplicate, 'identitySha256'); expect(() => validateEligibilityAsset(duplicate)).toThrow();
});
test('scenario roles never fall back to profile and explicit zero remains zero', () => {
  const subject = eligibilitySubject(); const p = structuredClone(profile);
  p.answers[eligibilityAnswerId(subject, 'amount')] = { state: 'known', fact: { type: 'decimal', value: '5000', unit: 'AUD' }, provenance: { source: 'user_input', productKey: subject.scope.productKey, recordedAt: '2028-01-01T00:00:00Z', effectiveFrom: null, effectiveToExclusive: null } };
  expect(eligibilityFacts(subject, { assessmentDate: '2028-01-02', values: {} }, p).amount).toBeUndefined();
  expect(eligibilityRequirements(subject, { assessmentDate: '2028-01-02', values: {} }, p).needed.map(d => d.binding)).toEqual(['scenario_amount']);
  expect(eligibilityFacts(subject, { assessmentDate: '2028-01-02', values: { scenario_amount: { type: 'decimal', value: '0', unit: 'AUD' } } }, p).amount).toEqual({ type: 'decimal', value: '0', unit: 'AUD' });
  expect(() => eligibilityFacts(subject, { assessmentDate: '2028-01-02', values: { scenario_amount: { type: 'decimal', value: '3', unit: '%' } } }, p)).toThrow();
});

test('matches frozen Python Unicode and decimal-preserving canonical vector', () => {
  expect(validateEligibilitySubject(canonicalFixture.subject).id).toBe('caef222b594337018466e771216c778651e840fe3104aa85ff18631cd27ec842');
  expect(validateEligibilitySubject(canonicalFixture.subject).scopeId).toBe('5390a987cb4b2c3d47eda20d9d06ca91b8a9fd9a2ca279d5af671a7c14f3507f');
});
test.each(['document inventory','revision order','blank label','blank unit','credential URL','date-only','invalid date','invalid offset'])('shared semantic negative: %s', kind => {
  const subject = eligibilitySubject();
  if (kind === 'document inventory') subject.source.documentVersionIds.push('f'.repeat(64));
  if (kind === 'revision order') subject.source.termRevisionIds = ['f'.repeat(64), 'a'.repeat(64)];
  if (kind === 'blank label') subject.inputDefinitions[1].label = '  ';
  if (kind === 'blank unit') subject.inputDefinitions[1].unit = '  ';
  if (kind === 'credential URL') subject.evidence = subject.evidence.map(e => ({ ...e, sourceUrl: 'https://user:pass@example.com/terms' }));
  subject.id = eligibilityIdentity(subject, 'id'); const asset = eligibilityAsset(subject);
  if (kind === 'date-only') asset.subjects[0].approval.reviewedAt = '2028-01-01';
  if (kind === 'invalid date') asset.subjects[0].approval.reviewedAt = '2028-02-30T00:00:00Z';
  if (kind === 'invalid offset') asset.subjects[0].approval.reviewedAt = '2028-01-01T00:00:00+25:00';
  asset.identitySha256 = eligibilityIdentity(asset, 'identitySha256');
  expect(() => validateEligibilityAsset(asset)).toThrow();
});

test('decisive branches hide irrelevant customer questions while explicit unavailable stays unresolved', () => {
  const subject = eligibilitySubject(s => {
    const clause = s.evidence[0].id;
    s.inputDefinitions.push({ key: 'resident', label: 'Recorded residency', type: 'boolean', unit: null, binding: 'customer_fact', clauseIds: [clause] });
    s.eligibility = { id: 'both', op: 'and', rules: [s.eligibility, { id: 'resident-check', op: 'compare', field: 'resident', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: [clause] }] };
  });
  const p = structuredClone(profile), date = '2028-01-02';
  const zero = { assessmentDate: date, values: { scenario_amount: { type: 'decimal' as const, value: '0', unit: 'AUD' } } };
  expect(eligibilityRequirements(subject, zero, p).needed).toEqual([]);
  const enough = { ...zero, values: { scenario_amount: { type: 'decimal' as const, value: '1000', unit: 'AUD' } } };
  expect(eligibilityRequirements(subject, enough, p).needed.map(d => d.key)).toEqual(['resident']);
  p.answers[eligibilityAnswerId(subject, 'resident')] = { state: 'unavailable', provenance: { source: 'user_input', productKey: subject.scope.productKey, recordedAt: null, effectiveFrom: null, effectiveToExclusive: null } };
  const result = eligibilityRequirements(subject, enough, p);
  expect(result.needed).toEqual([]); expect(result.deferred.map(d => d.key)).toEqual(['resident']);
});
