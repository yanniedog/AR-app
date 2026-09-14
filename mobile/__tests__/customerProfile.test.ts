import { migrateCustomerProfile } from '../src/data/customerProfileMigration';
import { userProvenance, validateProfile } from '../src/data/customerProfile';
import { customerInputRequirements, localCustomerDate, type CustomerInputContract } from '../src/data/customerInputRequirements';

const age = { id: 'age', label: 'Age', type: 'decimal' as const, unit: 'years' };
const linked = { id: 'linked', label: 'Linked account', type: 'boolean' as const };
const rule: CustomerInputContract['rule'] = { id: 'age-rule', op: 'compare', field: 'age', comparison: 'gte', expected: { type: 'decimal', value: '18', unit: 'years' } };
function contract(): CustomerInputContract {
  return { schemaVersion: 1, productKey: 'bank|product', revisionSha256: 'a'.repeat(64), effectiveFrom: '2026-01-01', effectiveToExclusive: '2027-01-01', inputs: [age, linked], rule };
}
const requirements = (c: CustomerInputContract | null, p = migrateCustomerProfile(null)) => customerInputRequirements(c, p, 'bank|product', '2026-09-15');

test('assessment defaults to the local calendar day around midnight', () => {
  expect(localCustomerDate(new Date(2026, 8, 15, 0, 30))).toBe('2026-09-15');
  expect(localCustomerDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
});

test('migration preserves original raw fields and explicit zero, but defaultable booleans are unknown', () => {
  const legacy = { version: 3, savings: { balance: '0', currentRate: '0' }, projections: { savings: { bonusConditionsMet: false, reinvestInterest: true } }, futureField: { untouched: 'yes' } };
  const p = migrateCustomerProfile(legacy);
  expect(p.legacyScenario).toEqual(legacy);
  expect(p.answers['legacy.savings.balance']).toMatchObject({ state: 'known', fact: { value: '0', unit: 'AUD' }, provenance: { source: 'legacy_user_input', recordedAt: null } });
  expect(p.answers['legacy.projections.savings.bonusConditionsMet'].state).toBe('unknown');
  expect(p.answers['legacy.projections.savings.reinvestInterest'].state).toBe('unknown');
  expect(() => migrateCustomerProfile({ version: 9 })).toThrow('Unsupported');
});
test('all missing states and explicit false/zero survive schema validation', () => {
  const p = migrateCustomerProfile(null);
  for (const state of ['unknown', 'unavailable', 'not_applicable'] as const) {
    p.definitions[state] = { ...linked, id: state }; p.answers[state] = { state, provenance: userProvenance() };
  }
  p.definitions.linked = linked; p.answers.linked = { state: 'known', fact: { type: 'boolean', value: false }, provenance: userProvenance() };
  p.definitions.age = age; p.answers.age = { state: 'known', fact: { type: 'decimal', value: '0', unit: 'years' }, provenance: userProvenance() };
  expect(validateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  expect(() => validateProfile({ ...p, version: 2 })).toThrow('Unsupported');
});
test('unsupported syntax, missing definitions/units, and wrong applicability ask nothing', () => {
  expect(requirements(null).status).toBe('pending_contract');
  for (const c of [{ ...contract(), inputs: [] }, { ...contract(), productKey: 'other' }, { ...contract(), effectiveToExclusive: '2026-01-01' },
    { ...contract(), inputs: [{ ...age, unit: undefined }] }, { ...contract(), rule: { ...rule, op: 'execute' } }]) {
    expect(requirements(c as CustomerInputContract)).toMatchObject({ status: 'pending_contract', needed: [] });
  }
});
test('decisive OR and failed AND branches suppress irrelevant questions', () => {
  const p = migrateCustomerProfile(null); p.definitions.age = age;
  p.answers.age = { state: 'known', fact: { type: 'decimal', value: '20', unit: 'years' }, provenance: userProvenance() };
  const missing: CustomerInputContract['rule'] = { id: 'link-rule', op: 'compare', field: 'linked', comparison: 'eq', expected: { type: 'boolean', value: true } };
  expect(requirements({ ...contract(), rule: { id: 'or', op: 'or', rules: [rule, missing] } }, p).needed).toEqual([]);
  p.answers.age = { ...p.answers.age, state: 'known', fact: { type: 'decimal', value: '0', unit: 'years' } };
  expect(requirements({ ...contract(), rule: { id: 'and', op: 'and', rules: [rule, missing] } }, p).needed).toEqual([]);
  expect(requirements({ ...contract(), rule: { id: 'or', op: 'or', rules: [rule, missing] } }, p).needed).toEqual([linked]);
});
test('unavailable and not applicable remain unresolved; negotiated entries never satisfy published rule facts', () => {
  const p = migrateCustomerProfile(null); p.definitions.age = age;
  p.answers.age = { state: 'not_applicable', provenance: userProvenance() };
  expect(requirements(contract(), p)).toMatchObject({ status: 'needs_inputs', needed: [], deferred: [age] });
  p.negotiatedTerms.push({ id: 'user.age', label: 'age', value: '40', unit: 'years', note: '', provenance: { ...userProvenance('bank|product'), source: 'user_input', productKey: 'bank|product' } });
  delete p.answers.age;
  expect(requirements(contract(), p).needed).toEqual([age]);
});
test('known answer outside its product/effective scope is asked again', () => {
  const p = migrateCustomerProfile(null); p.definitions.age = age;
  p.answers.age = { state: 'known', fact: { type: 'decimal', value: '40', unit: 'years' }, provenance: { ...userProvenance('other'), effectiveFrom: '2026-01-01' } };
  expect(requirements(contract(), p).needed).toEqual([age]);
});
