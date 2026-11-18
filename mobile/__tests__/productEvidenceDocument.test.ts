import { downloadInflate } from '../src/data/payload';
import { evidenceSelection } from '../testUtils/productEvidenceSelection';
import * as evidenceModule from '../src/data/productEvidenceDocument';
import { loadProductEvidenceDocument, verifyEvidenceProduct } from '../src/data/productEvidenceDocument';
import { selectedProductEvidenceHead } from '../src/data/historyDatesIndex';
import { resolveFinalizedManifest } from '../src/data/ingestFinalized';
import { productEvidenceTextSlice } from '../src/data/productEvidencePagination';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn(), fetchManifest: jest.fn() }));
test('validated real selection survives cloned manifest and serialized history receipt', () => {
  const p = evidenceSelection();
  expect(selectedProductEvidenceHead(JSON.parse(JSON.stringify(p.dates)), JSON.parse(JSON.stringify(p.manifest)))).toEqual(p.head);
  expect(selectedProductEvidenceHead(undefined, p.manifest)).toBeNull();
  const bad = JSON.parse(JSON.stringify(p.manifest)); bad.product_evidence_v1.source.contract_digest = 'd'.repeat(64);
  expect(selectedProductEvidenceHead(p.dates, bad)).toBeNull();
});
test('real finalized-resolution path checks optional metadata without fetching evidence', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockClear();
  const result = await resolveFinalizedManifest(p.manifest, { fetchIndex: async () => p.dates, fetchRevision: async () => p.manifest });
  expect(result.manifest).toBe(p.manifest); expect(downloadInflate).not.toHaveBeenCalled();
  p.ref.core_sha256 = 'd'.repeat(64);
  await expect(resolveFinalizedManifest(p.manifest, { fetchIndex: async () => p.dates, fetchRevision: async () => p.manifest })).rejects.toThrow();
});
test('admitted facts expose counts only and the module has no string renderer path', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockImplementation(p.load);
  const result = await loadProductEvidenceDocument(p.context, p.key, 'product_evidence_v1', () => true, new AbortController().signal);
  expect(result.status).toBe('observed'); if (result.status !== 'observed') return;
  expect(result.document.facts).toBeGreaterThan(0); expect(result.document.records).toBeGreaterThan(0);
  expect(evidenceModule).not.toHaveProperty('productEvidencePage'); expect(evidenceModule).not.toHaveProperty('productEvidencePageText');
});
test('original body is bound to its export hash; alternate index stays unverified', async () => {
  const p = evidenceSelection('product_response_evidence_v1'); jest.mocked(downloadInflate).mockImplementation(p.load);
  const result = await loadProductEvidenceDocument(p.context, p.key, 'product_response_evidence_v1', () => true, new AbortController().signal);
  expect(result.status).toBe('observed'); if (result.status !== 'observed') return;
  expect(result.document.bodyMatchesExport).toBe(true);
  const alternative = result.bodies.find(choice => choice.role === 'index')!;
  const alternate = await loadProductEvidenceDocument(p.context, p.key, 'product_response_evidence_v1', () => true, new AbortController().signal, alternative.sha256);
  expect(alternate.status).toBe('observed'); if (alternate.status === 'observed') expect(alternate.document).toMatchObject({ bodyRole: 'index', bodyMatchesExport: false });
});
test('product membership uses verified priced or unpriced data, never an arbitrary key or stale details', () => {
  const p = evidenceSelection(); expect(() => verifyEvidenceProduct(p.context, p.key)).not.toThrow();
  for (const section of Object.values(p.context.core!.sections)) if (section.rates.length) expect(() => verifyEvidenceProduct(p.context, section.rates[0].product_key)).not.toThrow();
  expect(() => verifyEvidenceProduct(p.context, 'not-observed')).toThrow('absent');
  expect(() => verifyEvidenceProduct({ ...p.context, details: null }, p.key)).toThrow('absent');
  expect(() => verifyEvidenceProduct({ ...p.context, productEvidenceHead: null }, p.key)).toThrow('unverified');
  expect(() => verifyEvidenceProduct({ ...p.context, source: 'sample' }, p.key)).toThrow('unverified');
  const other = evidenceSelection(); expect(() => verifyEvidenceProduct({ ...p.context, coreIntegrity: other.context.coreIntegrity }, p.key)).toThrow('unverified');
});
test('current source mutation after acquisition cannot create an admitted source document', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockImplementation(async url => {
    const text = await p.load(url); p.context.core!.run_date = '2000-01-01'; return text;
  });
  await expect(loadProductEvidenceDocument(p.context, p.key, 'product_evidence_v1', () => true, new AbortController().signal)).rejects.toThrow('unverified');
});
test('bounded literal pages preserve every Unicode/null/empty/large-number lexical character', () => {
  for (const text of ['', 'a'.repeat(16383) + '😀' + '{"null":null,"empty":[],"object":{},"text":"","large":9223372036854775809}',
    '😀'.repeat(30000), 'x'.repeat(65536)]) {
    const first = productEvidenceTextSlice(text, 0), slices = Array.from({ length: first.pages }, (_, page) => productEvidenceTextSlice(text, page));
    expect(slices.map(item => item.text).join('')).toBe(text);
    expect(slices.every(item => item.text.length <= 16385)).toBe(true);
    for (const item of slices) {
      expect(/^[\uDC00-\uDFFF]/.test(item.text)).toBe(false); expect(/[\uD800-\uDBFF]$/.test(item.text)).toBe(false);
    }
    expect(() => productEvidenceTextSlice(text, first.pages)).toThrow('out of range');
  }
});
