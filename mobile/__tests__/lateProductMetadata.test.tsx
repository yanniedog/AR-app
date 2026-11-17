import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import sample from '../assets/sample/details.json';
import { ProductTermsDisclosure } from '../src/components/product/ProductTermsDisclosure';
import { uiDetailItem, uiFeeValue } from '../src/lib/productUiFacts';
import { canonicalTermsJson, TERMS_STAGES, validateProductTerms } from '../src/data/productTerms';
import { loadProductTerms } from '../src/data/productTermsTransport';
import type { ProductDetail } from '../src/types';
let mockState: Record<string, any>;
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/data/productTermsTransport', () => ({ loadProductTerms: jest.fn() }));
jest.mock('../src/data/termsReferenceStore', () => ({ previousTermsReference: jest.fn(async () => null) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerProfilePanel: 'CustomerProfilePanel' }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
const bodyText = (tree: any) => tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join('\n');
test('actual legacy cadence-only fees retain the period and unknown price without source prose', () => {
  const fee = Object.values(sample.products as Record<string, ProductDetail>).flatMap(detail => detail.fees ?? [])
    .find(item => item.name === 'Monthly Admin Fee' && item.value === 'P1M')!;
  expect(fee).toBeDefined(); expect(uiFeeValue(fee)).toBe('Unknown · per month');
  expect(uiFeeValue({ amount: '40', value: 'P1M' })).toBe('$40 · per month');
  expect(uiFeeValue({ amount: '0', value: 'P1M' })).toBe('$0 · per month');
  expect(uiFeeValue({ value: 'P2Y' })).toBe('Unknown · every 2 years');
  for (const value of ['P0M', 'P1M. Conditions apply.', 'Monthly payment explained here.', 'P1.5M', 'P999999999999999999999M']) expect(uiFeeValue({ value })).toBe('Unknown');
  expect(uiFeeValue({ amountStatus: 'variable', amount: '0', value: 'P1M' })).toBe('Unknown');
  expect(JSON.stringify(uiDetailItem(fee, 0, 'Fees'))).not.toContain(fee.info!);
  expect(uiFeeValue({ name: 'P1M', info: 'P1M' })).toBe('Unknown');
});
test('same-date term changes retain financial facts without exposing evidence references', async () => {
  const sha = (letter: string) => letter.repeat(64), key = 'protocol-fixture', observed = '2026-10-15T00:00:00Z', clause = 'Explanatory source clause body.';
  const revision = (id: string, parameter: string, value: string) => ({ term_revision_id: sha(id), parameter_key: parameter, value, unit: 'AUD', applicability: { product_key: key, tier: null, package: null, cohort: null, effective_from: null, effective_to: null }, clause_ids: [sha('d')], rule_set_id: null, status: 'validated', observed_at: observed });
  const terms = validateProductTerms({ schema_version: 1, product_key: key, identity_sha256: sha('a'),
    documents: [{ document_version_id: sha('b'), source_url: 'https://example.org/terms.pdf', content_sha256: sha('c'), media_type: 'application/pdf', byte_size: 123, observed_at: observed, effective_from: null, effective_to: null }],
    clauses: [{ clause_id: sha('d'), document_version_id: sha('b'), locator: { start: 0, end: clause.length, page: 1 }, text: clause, disposition: 'interpreted' }],
    revisions: [revision('e', 'fee.annual', '1'), revision('f', 'fee.annual', '2'), revision('0', 'rate.annual', '1'), revision('1', 'rate.annual', '2')],
    coverage: { ...Object.fromEntries(TERMS_STAGES.map(stage => [stage, { status: 'unknown', expected: null, observed: 0 }])), gaps: [] },
    changes: [{ term_change_id: sha('2'), before_revision_id: sha('e'), after_revision_id: sha('f'), kind: 'changed', observed_at: observed }, { term_change_id: sha('3'), before_revision_id: sha('0'), after_revision_id: sha('1'), kind: 'changed', observed_at: observed }] }, key);
  const original = canonicalTermsJson(terms);
  mockState = { manifest: { run_date: '2026-10-15', payload_revision: { bundle_sha256: sha('4') }, files: { terms_index: { sha256: sha('5') } } } };
  jest.mocked(loadProductTerms).mockResolvedValue(terms);
  let tree: any; act(() => { tree = TestRenderer.create(<ProductTermsDisclosure productKey={key} />); });
  try {
    await act(async () => tree.root.findByProps({ title: 'Terms' }).props.onToggle());
    act(() => tree.root.findByProps({ title: 'Changes' }).props.onToggle());
    expect(bodyText(tree)).toContain('fee.annual'); expect(bodyText(tree)).toContain('rate.annual'); expect(bodyText(tree)).toContain('Field');
    expect(bodyText(tree)).not.toContain(sha('2')); expect(bodyText(tree)).not.toContain(sha('d'));
    expect(bodyText(tree)).not.toContain(clause); expect(canonicalTermsJson(terms)).toBe(original);
  } finally { act(() => tree.unmount()); }
});
