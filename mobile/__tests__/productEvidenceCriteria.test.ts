import fixture from './fixtures/product-evidence-criteria-retained.json';
import { checkedCriteriaQuery, criteriaRecordText, projectSourceCriteria, type CriteriaQuery } from '../src/data/productEvidenceCriteria';
import type { EvidenceFact } from '../src/data/productEvidenceWire';
const query: CriteriaQuery = { kind: 'all', text: '', record: 0, page: 0 };
const checkpoint = async () => {};
const template = fixture.products[0].facts[0] as EvidenceFact;
const flag = (value: string, scope = '{}'): EvidenceFact => ({ ...template, fact_id: value, kind: 'feature', canonical_key: 'feature.OFFSET', value_type: 'boolean',
  unit: 'boolean', mapping: 'canonical', value_json: value, qualifiers_json: '{"sourceType":"OFFSET"' + (scope === '{}' ? '}' : ',' + scope.slice(1)),
  source_pattern: 'features[].featureType', source_path: 'features[0].featureType' });

test.each(fixture.products)('retained $identity.dataset criteria preserve every original field and record', async product => {
  const facts = product.facts as EvidenceFact[];
  for (let record = 0; record < facts.length; record++) {
    const first = await projectSourceCriteria(facts, { ...query, record }, checkpoint);
    expect(first.total).toBe(100); expect(first.matching).toBe(facts.length); expect(first.sourceRecord).toBe(record);
    const pieces = [first.text];
    for (let page = 1; page < first.pages; page++) pieces.push((await projectSourceCriteria(facts, { ...query, record, page }, checkpoint)).text);
    expect(pieces.join('')).toBe(criteriaRecordText(facts[record]));
    expect(pieces.every(text => text.length <= 4097)).toBe(true);
    expect(first.typed + first.unsupported).toBe(first.total);
  }
});
test('explicit false, absent, incompatible scope and exact boolean conflict stay distinct', async () => {
  expect((await projectSourceCriteria([flag('false')], query, checkpoint)).state).toBe('observed');
  expect((await projectSourceCriteria([], query, checkpoint)).state).toBe('unknown');
  expect((await projectSourceCriteria([flag('true'), flag('false')], query, checkpoint)).state).toBe('conflicting');
  expect((await projectSourceCriteria([flag('true'), flag('false', '{"loanPurpose":"INVESTMENT"}')], query, checkpoint)).state).toBe('observed');
  expect((await projectSourceCriteria([flag('true', '{"n":9223372036854775809}'), flag('false', '{"n":9223372036854775808}')], query, checkpoint)).state).toBe('observed');
});
test('conditional and unsupported records remain reachable, never positive eligibility', async () => {
  const conditional = flag('true', '{"additionalInfo":"Only customers aged 18+"}');
  expect((await projectSourceCriteria([conditional, flag('false')], query, checkpoint)).state).toBe('conditional');
  const unsupported = { ...conditional, mapping: 'preserved', value_json: 'null', value_type: 'range' };
  const result = await projectSourceCriteria([unsupported], query, checkpoint);
  expect(result.state).toBe('source_review'); expect(result.text).toContain('value_json: null');
});
test('comparison uses exact typed scope, never ordinal, currency, cadence or unsupported-key inference', async () => {
  const first = flag('false'), anchor = await projectSourceCriteria([first], query, checkpoint);
  const aligned = { ...query, alignment: anchor.alignment! };
  const result = await projectSourceCriteria([flag('true', '{"cadence":"monthly"}'), flag('true')], aligned, checkpoint);
  expect(result.sourceRecord).toBe(1); expect(result.matching).toBe(1); expect(result.text).toContain('value_json: true');
  const incompatible: EvidenceFact[] = [{ unit: 'AUD' }, { group_id: 'other' }, { parent_id: 'other' }, { mapping: 'preserved' }, { qualifiers_json: '{"cadence":"annual"}' }];
  for (const patch of incompatible) {
    expect((await projectSourceCriteria([{ ...first, ...patch }], aligned, checkpoint)).state).toBe('unknown');
  }
  expect((await projectSourceCriteria([first, { ...first, fact_id: 'second' }], aligned, checkpoint)).state).toBe('ambiguous');
  const unsupported = await projectSourceCriteria([{ ...first, mapping: 'preserved' }], query, checkpoint);
  expect(unsupported.alignment).toBeNull();
});
test('distinct real products align equivalent minimum-balance criteria while preserving their different thresholds and IDs', async () => {
  const first = fixture.products[0].facts.find(f => f.canonical_key === 'constraint.min_balance')! as EvidenceFact;
  const second = fixture.products[2].facts.find(f => f.canonical_key === 'constraint.min_balance')! as EvidenceFact;
  expect(fixture.products[0].identity.product_key).not.toBe(fixture.products[2].identity.product_key);
  expect(JSON.parse(first.qualifiers_json).groupId).not.toBe(JSON.parse(second.qualifiers_json).groupId);
  const anchor = await projectSourceCriteria([first], query, checkpoint);
  expect(anchor.alignment).not.toBeNull();
  const compared = await projectSourceCriteria([second], { ...query, alignment: anchor.alignment! }, checkpoint);
  expect(compared.matching).toBe(1); expect(compared.text).toContain(second.qualifiers_json);
  expect(anchor.text).toContain('25000.00'); expect(compared.text).toContain('500.00');
  const nested = { ...second, source_path: 'fees[0].discounts[0].constraintType', source_pattern: 'fees[].discounts[].constraintType' };
  expect((await projectSourceCriteria([nested], query, checkpoint)).alignment).toBeNull();
  const unknownScope = { ...second, qualifiers_json: second.qualifiers_json.replace('}', ',"unresolved":{"condition":true}}') };
  expect((await projectSourceCriteria([unknownScope], query, checkpoint)).alignment).toBeNull();
});
test('scalar precision, zero variable fee, raw null/empty and Unicode text retain their exact lexical form', async () => {
  const original = { ...template, kind: 'fee', canonical_key: 'fee.amount', value_type: 'money', unit: 'AUD', mapping: 'canonical',
    value_json: '9223372036854775809.12345', source_value_json: '"9223372036854775809.1234500"', qualifiers_json: '{"empty":"","null":null,"array":[]}' };
  const result = await projectSourceCriteria([original], query, checkpoint);
  expect(result.text).toContain(original.source_value_json); expect(result.text).toContain(original.value_json); expect(result.text).toContain(original.qualifiers_json);
  const variable = { ...original, value_type: 'text', unit: 'text', value_json: '"unpublished"', source_value_json: '0', qualifiers_json: '{"feeType":"VARIABLE"}' };
  expect((await projectSourceCriteria([variable], query, checkpoint)).state).toBe('source_review');
  const long = { ...original, source_value_json: JSON.stringify('x'.repeat(4095) + '😀'.repeat(10000)) };
  const first = await projectSourceCriteria([long], query, checkpoint), pieces = [];
  for (let page = 0; page < first.pages; page++) pieces.push((await projectSourceCriteria([long], { ...query, page }, checkpoint)).text);
  expect(pieces.join('')).toBe(criteriaRecordText(long));
  expect(pieces.every(text => !/^[\uDC00-\uDFFF]/.test(text) && !/[\uD800-\uDBFF]$/.test(text))).toBe(true);
  expect((await projectSourceCriteria([original], { ...query, page: first.pages }, checkpoint)).text).toBe('');
});
test('literal selected-product search and category filter count every match, including unsupported data', async () => {
  const facts = fixture.products[1].facts as EvidenceFact[];
  const expected = facts.filter(f => f.kind === 'fee' && ['canonical_key', 'source_path', 'source_pattern', 'value_json', 'source_value_json', 'qualifiers_json'].some(k => f[k].toLocaleLowerCase().includes('fee')));
  const result = await projectSourceCriteria(facts, { ...query, kind: 'fee', text: 'FEE' }, checkpoint);
  expect(result.matching).toBe(expected.length);
  expect((await projectSourceCriteria(facts, { ...query, text: '.*' }, checkpoint)).matching).toBe(0);
  expect((await projectSourceCriteria(facts, { ...query, record: 1000 }, checkpoint)).state).toBe('unknown');
});
test('query/depth bounds and cancellation stop work without a partial success', async () => {
  for (const patch of [{ text: 'x'.repeat(257) }, { record: -1 }, { page: Infinity }, { kind: 'invented' }]) expect(() => checkedCriteriaQuery({ ...query, ...patch } as CriteriaQuery)).toThrow();
  await expect(projectSourceCriteria([{ ...template, qualifiers_json: '['.repeat(70) + '0' + ']'.repeat(70) }], query, checkpoint)).rejects.toThrow();
  let checks = 0; await expect(projectSourceCriteria(Array(500).fill(template), query, async () => { if (++checks === 3) throw new Error('cancelled'); })).rejects.toThrow('cancelled');
  expect(checks).toBe(3);
});
