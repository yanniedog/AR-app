import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ProductTermsDisclosure } from '../src/components/product/ProductTermsDisclosure';
import { createTermsReferenceStore, previousTermsReference, type TermsReference } from '../src/data/termsReferenceStore';
import { canonicalTermsJson, TERMS_STAGES, validateProductTerms } from '../src/data/productTerms';
import { hashText } from '../src/lib/productTermsEngine/validation';
import { FinancialFactRows } from '../src/components/product/FinancialFactRows';
let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/productTermsTransport', () => ({ loadProductTerms: jest.fn(async () => { throw new Error('offline'); }) }));
jest.mock('../src/data/termsReferenceStore', () => ({ ...jest.requireActual('../src/data/termsReferenceStore'), previousTermsReference: jest.fn() }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerProfilePanel: 'CustomerProfilePanel' }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => jest.requireActual('react').createElement('Disclosure', { ...props, open }, open ? children : null) }));
test.each([
  { sameEdition: true, sameIndex: true, currentDay: '2026-09-15', status: 'Matching' },
  { sameEdition: false, sameIndex: true, currentDay: '2026-09-16', status: 'Earlier' },
  { sameEdition: false, sameIndex: true, currentDay: '2026-09-15', status: 'Different' },
  { sameEdition: false, sameIndex: true, currentDay: '2026-09-14', status: 'Different' },
  { sameEdition: true, sameIndex: false, currentDay: '2026-09-16', status: 'Different' },
  { sameEdition: false, sameIndex: true, currentDay: '2026-02-31', status: 'Unverified' },
])('restart/offline retains source facts with correct publication status: $status ($sameEdition/$sameIndex/$currentDay)', async ({ sameEdition, sameIndex, currentDay, status }) => {
  const body = { schema_version: 1, product_key: 'technical', documents: [], clauses: [], revisions: [], changes: [], coverage: { ...Object.fromEntries(TERMS_STAGES.map(stage => [stage, { status: 'unknown', expected: null, observed: 0 }])), gaps: ['Retained engineering reference'] } };
  const saved: TermsReference = { productKey: 'technical', edition: 'a'.repeat(64), runDate: '2026-09-15', indexSha256: 'b'.repeat(64), assetSha256: 'c'.repeat(64), retainedAt: '2026-09-15T00:00:00Z', terms: validateProductTerms({ ...body, identity_sha256: hashText(canonicalTermsJson(body)) }, 'technical') };
  const slots = new Map<number, string>(), storage = { read: async (slot: number) => slots.get(slot) ?? null, write: async (slot: number, text: string) => { slots.set(slot, text); } };
  await createTermsReferenceStore(storage).retain(saved);
  (previousTermsReference as jest.Mock).mockImplementation(createTermsReferenceStore(storage).previous);
  mockState = { manifest: { run_date: currentDay, payload_revision: { bundle_sha256: (sameEdition ? 'a' : 'd').repeat(64) }, files: { terms_index: { sha256: (sameIndex ? 'b' : 'e').repeat(64) } } } };
  let tree: any;
  await act(async () => { tree = TestRenderer.create(<ProductTermsDisclosure productKey="technical" />); });
  await act(async () => tree.root.findByProps({ title: 'Terms' }).props.onToggle());
  expect(JSON.stringify(tree.toJSON())).toContain('Unverified');
  act(() => tree.root.findByProps({ title: 'Cached' }).props.onToggle());
  const facts = tree.root.findAllByType(FinancialFactRows).flatMap((node: any) => node.props.rows);
  expect(facts).toContainEqual({ label: 'Publication revision', value: status });
  expect(facts).toContainEqual({ label: 'Calculation', value: 'No approval' });
  expect(JSON.stringify(tree.toJSON())).toContain(saved.edition);
  expect(JSON.stringify(tree.toJSON())).toContain('15 Sept 2026');
  expect(JSON.stringify(tree.toJSON())).toContain('Coverage gaps: 1 · Source review required');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Retained engineering reference');
  expect((await createTermsReferenceStore(storage).previous('technical', saved.edition, saved.indexSha256))?.terms.coverage.gaps).toEqual(['Retained engineering reference']);
  act(() => tree.unmount());
});
