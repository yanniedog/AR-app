import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { setup } from '../test-support/executableDepositHarness';
import { eligibilityTransportHarness } from '../test-support/eligibilityHarness';
import { savingsHarness } from '../test-support/savingsMonetaryHarness';
import { activityHarness } from '../test-support/activityHarness';
import { mortgageHarness } from '../test-support/mortgageHarness';
import { downloadInflate } from '../src/data/payload';
import { profileDefinitions } from '../src/data/executableContracts/instantiate';
import { eligibilityDefinition } from '../src/data/eligibilityContracts/facts';
import { savingsDefinition } from '../src/data/monetaryContracts/facts';
import type { SavingsSubject } from '../src/data/monetaryContracts/types';
import { mortgageDefinition } from '../src/data/mortgageContracts/facts';
import type { InputDefinition } from '../src/data/customerProfile';
import type { Rule } from '../src/lib/productTermsEngine/types';
import { bindCustomerQuestion, type CustomerQuestionBinding, type CustomerQuestionSource } from '../src/lib/customerQuestionBinding';
import { UI_LABELS, uiInputDefinitionLabel } from '../src/lib/uiCopy';
import { CustomerAnswerEditor } from '../src/components/CustomerProfilePanel';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row', Disclosure: 'Disclosure' }));

const questions = [
  { key: 'membership_linked', label: 'Membership account linked', type: 'boolean' as const, unit: null },
  { key: 'membership_months', label: 'Membership duration (months)', type: 'decimal' as const, unit: 'months' },
];
const rules = (evidenceIds: string[]): Rule[] => questions.map((d, i) => ({ id: `custom-question-${i}`, op: 'compare', field: d.key,
  comparison: d.type === 'boolean' ? 'eq' : 'gte',
  expected: d.type === 'boolean' ? { type: 'boolean', value: true } : { type: 'decimal', value: '1', unit: d.unit! }, evidenceIds }));
function addRules(original: Rule, evidence: string[]): Rule { return { id: 'with-custom-questions', op: 'and', rules: [original, ...rules(evidence)] }; }
async function admitted(kind: CustomerQuestionSource['kind']): Promise<{ source: CustomerQuestionSource; definitions: InputDefinition[] }> {
  if (kind === 'td') {
    const h = setup(t => {
      const evidence = t.inputDefinitions[0].clauseIds;
      t.inputDefinitions.push(...questions.map(d => ({ ...d, binding: 'customer_fact' as const, clauseIds: evidence })));
      t.eligibility = addRules(t.eligibility, evidence);
    });
    const selection = await h.load();
    return { source: { kind, selection, context: h.context, row: h.row }, definitions: profileDefinitions(selection) };
  }
  if (kind === 'eligibility') {
    const h = await eligibilityTransportHarness(s => {
      const evidence = s.inputDefinitions[0].clauseIds;
      s.inputDefinitions.push(...questions.map(d => ({ ...d, binding: 'customer_fact' as const, clauseIds: evidence })));
      s.eligibility = addRules(s.eligibility, evidence);
    });
    const [selection] = await h.load();
    return { source: { kind, selection, context: h.context, target: h.target }, definitions: questions.map(d => eligibilityDefinition(selection.subject, d.key)) };
  }
  if (kind === 'mortgage') {
    const h = await mortgageHarness({}, s => {
      const evidence = s.policy.inputDefinitions[0].evidenceIds;
      s.policy.inputDefinitions.push(...questions.map(({ key, ...d }) => ({ ...d, field: key, binding: 'customer_fact' as const, evidenceIds: evidence })));
      s.policy.eligibility = addRules(s.policy.eligibility, evidence);
    });
    const [selection] = await h.load();
    return { source: { kind, selection, context: h.context, target: h.target }, definitions: questions.map(d => mortgageDefinition(selection.subject, d.key)) };
  }
  const prepare = (s: { policy: Pick<SavingsSubject['policy'], 'inputDefinitions' | 'eligibility'> }) => {
    const evidence = s.policy.inputDefinitions[0].evidenceIds;
    s.policy.inputDefinitions.push(...questions.map(d => ({ ...d, binding: 'customer_fact' as const, evidenceIds: evidence })));
    s.policy.eligibility = addRules(s.policy.eligibility, evidence);
  };
  const h = kind === 'activity' ? await activityHarness(prepare) : await savingsHarness(prepare);
  const [selection] = await h.load();
  const source = kind === 'activity'
    ? { kind, selection: selection as Extract<CustomerQuestionSource, { kind: 'activity' }>['selection'], context: h.context, target: h.target }
    : { kind, selection: selection as Extract<CustomerQuestionSource, { kind: 'savings' }>['selection'], context: h.context, target: h.target };
  return { source, definitions: questions.map(d => savingsDefinition(selection.subject, d.key)) };
}
beforeEach(() => { jest.mocked(downloadInflate).mockReset(); });

test.each(['td', 'eligibility', 'savings', 'activity', 'mortgage'] as const)('%s preserves two real admitted custom questions without registering their strings globally', async kind => {
  const { source, definitions } = await admitted(kind);
  const before = JSON.stringify(source.selection);
  const labels = definitions.map(d => uiInputDefinitionLabel(d, bindCustomerQuestion(d, source)));
  expect(labels).toEqual(questions.map(d => d.label));
  expect(questions.every(q => !UI_LABELS.some(label => label === q.label))).toBe(true);
  expect(JSON.stringify(source.selection)).toBe(before);
  expect(definitions.every(d => !Object.hasOwn(d, 'questionSource'))).toBe(true);
});

test('a same-content forged handle cannot bind a question', async () => {
  const { source, definitions: [definition] } = await admitted('td');
  const forged = { ...source, selection: structuredClone(source.selection) } as CustomerQuestionSource;
  expect(bindCustomerQuestion(definition, forged)).toBeNull();
  expect(uiInputDefinitionLabel(definition, bindCustomerQuestion(definition, forged))).toBe('Source review required');
  expect(uiInputDefinitionLabel(definition, {} as CustomerQuestionBinding)).toBe('Source review required');
});

test('a removed adoption invalidates an existing binding and cannot be repaired by its SHA-shaped ID', async () => {
  const { source, definitions: [definition] } = await admitted('savings');
  const binding = bindCustomerQuestion(definition, source);
  expect(uiInputDefinitionLabel(definition, binding)).toBe(questions[0].label);
  delete source.context.manifest!.executable_v3;
  expect(uiInputDefinitionLabel(definition, binding)).toBe('Source review required');
  expect(bindCustomerQuestion(definition, source)).toBeNull();
});

test.each(['id', 'label', 'type', 'unit'] as const)('the %s must match the actual reviewed definition exactly', async field => {
  const { source, definitions: [, original] } = await admitted('eligibility');
  const changed = { ...original, [field]: field === 'type' ? 'text' : 'different' } as InputDefinition;
  expect(bindCustomerQuestion(changed, source)).toBeNull();
});

test('a mutated definition or source invalidates the token before display', async () => {
  const { source, definitions: [definition] } = await admitted('td');
  const binding = bindCustomerQuestion(definition, source);
  definition.label = 'Changed locally';
  expect(uiInputDefinitionLabel(definition, binding)).toBe('Source review required');
  const second = await admitted('mortgage');
  const secondBinding = bindCustomerQuestion(second.definitions[0], second.source);
  if (second.source.kind !== 'mortgage') throw new Error('Fixture family mismatch');
  second.source.selection.subject.policy.inputDefinitions[0].label = 'Changed source';
  expect(uiInputDefinitionLabel(second.definitions[0], secondBinding)).toBe('Source review required');
});

test('local-only saved definitions retain their unknown source rather than minting question provenance', async () => {
  const { definitions: [definition] } = await admitted('td');
  expect(uiInputDefinitionLabel(definition)).toBe('Source review required');
  expect(uiInputDefinitionLabel({ ...definition, label: 'Recorded customer criterion' })).toBe('Source review required');
});

test('scenario bindings and source clause text cannot become customer questions', async () => {
  const { source } = await admitted('eligibility');
  if (source.kind !== 'eligibility') throw new Error('Fixture family mismatch');
  const scenario = eligibilityDefinition(source.selection.subject, 'assessment');
  expect(bindCustomerQuestion(scenario, source)).toBeNull();
  const clause = { ...scenario, label: source.selection.subject.evidence[0].quote };
  expect(bindCustomerQuestion(clause, source)).toBeNull();
});

test.each(['First line\nSecond line', 'Field\tInstructions', 'Field\u0000Instructions'])('a multiline/control question %j fails closed even in a valid transport', async label => {
  const h = setup(t => {
    const evidence = t.inputDefinitions[0].clauseIds;
    t.inputDefinitions.push({ key: 'custom', label, type: 'boolean', unit: null, binding: 'customer_fact', clauseIds: evidence });
    t.eligibility = { id: 'custom-question', op: 'compare', field: 'custom', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: evidence };
  });
  const selection = await h.load();
  const [definition] = profileDefinitions(selection);
  expect(bindCustomerQuestion(definition, { kind: 'td', selection, context: h.context, row: h.row })).toBeNull();
});

test('oversized questions fail both the existing transport schema and the display boundary', async () => {
  const h = setup(t => { t.inputDefinitions[0].label = 'x'.repeat(161); });
  await expect(h.load()).rejects.toThrow('Executable contract wire is invalid');
  const { source, definitions: [definition] } = await admitted('eligibility');
  const oversized = { ...definition, label: 'x'.repeat(161) };
  expect(bindCustomerQuestion(oversized, source)).toBeNull();
  expect(uiInputDefinitionLabel(oversized)).toBe('Source review required');
});

test('actual editor exposes the admitted question in its action label and preserves explicit false with original source identity', async () => {
  const { source, definitions: [definition] } = await admitted('td');
  if (source.kind !== 'td') throw new Error('Fixture family mismatch');
  const onSave = jest.fn();
  type Renderer = ReactTestRenderer & { root: { findByProps: (props: Record<string, unknown>) => { props: Record<string, any> } }; toJSON: () => unknown };
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<CustomerAnswerEditor definition={definition} questionSource={source} productKey={source.row.product_key} disabled={false} onSave={onSave} />) as Renderer; });
  try {
    expect(JSON.stringify(tree.toJSON())).toContain(definition.label);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Source review required');
    act(() => tree.root.findByProps({ label: 'Entered' }).props.onPress());
    act(() => tree.root.findByProps({ label: 'No' }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: `Save ${definition.label}` }).props.onPress());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ state: 'known', fact: { type: 'boolean', value: false },
      provenance: expect.objectContaining({ source: 'user_input', productKey: source.row.product_key }) }));
  } finally { act(() => tree.unmount()); }
});
