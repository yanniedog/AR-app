import { canonicalTermsJson, validateProductTerms, TERMS_STAGES } from '../src/data/productTerms';
import { validateProductTermsIndex } from '../src/data/productTermsTransport';
import type { Manifest } from '../src/types';
import { createHash } from 'crypto';
import { downloadInflate } from '../src/data/payload';
import { loadProductTerms } from '../src/data/productTermsTransport';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest.requireActual<typeof import('crypto')>('crypto').createHash('sha256').update(text).digest('hex'),
}));

const hash = (letter: string) => letter.repeat(64);
// Protocol fixtures exercise validation, not real bank or calculation acceptance.
function evidence() {
  return {
    schema_version: 1, product_key: 'protocol-fixture', identity_sha256: hash('a'),
    documents: [{ document_version_id: hash('b'), source_url: 'https://example.org/terms.pdf',
      content_sha256: hash('c'), media_type: 'application/pdf', byte_size: 123,
      observed_at: '2026-09-14T00:00:00Z', effective_from: null, effective_to: null }],
    clauses: [{ clause_id: hash('d'), document_version_id: hash('b'),
      locator: { start: 0, end: 18, page: 1 }, text: 'Protocol test text', disposition: 'interpreted' }],
    revisions: [{ term_revision_id: hash('e'), parameter_key: 'fee.amount', value: '0.00', unit: 'AUD',
      applicability: { product_key: 'protocol-fixture', tier: null, package: null, cohort: null,
        effective_from: null, effective_to: null }, clause_ids: [hash('d')], rule_set_id: null,
      status: 'validated', observed_at: '2026-09-14T00:00:00Z' }],
    coverage: { ...Object.fromEntries(TERMS_STAGES.map((stage) => [stage,
      { status: 'unknown', observed: 0, expected: null }])), gaps: ['Protocol fixture only'] },
    changes: [],
  };
}

test('preserves exact decimals and unknown applicability without claiming completeness', () => {
  const result = validateProductTerms(evidence(), 'protocol-fixture');
  expect(result.revisions[0].value).toBe('0.00');
  expect(result.revisions[0].applicability.cohort).toBeNull();
  expect(result.coverage.calculation.status).toBe('unknown');
});

test.each(['wrong-product', 'orphan-clause', 'orphan-revision', 'duplicate-id', 'unvalidated', 'float', 'false-completeness'])('rejects %s before display or calculation', (kind) => {
  const fixture = evidence();
  if (kind === 'wrong-product') fixture.product_key = 'another';
  if (kind === 'orphan-clause') fixture.clauses[0].document_version_id = hash('f');
  if (kind === 'orphan-revision') fixture.revisions[0].clause_ids = [hash('f')];
  if (kind === 'duplicate-id') fixture.documents.push(fixture.documents[0]);
  if (kind === 'unvalidated') fixture.revisions[0].status = 'staged';
  if (kind === 'float') (fixture.revisions[0] as { value: unknown }).value = 0.1;
  if (kind === 'false-completeness') (fixture.coverage as unknown as { acquisition: unknown }).acquisition = { status: 'complete', observed: 1, expected: null };
  expect(() => validateProductTerms(fixture, 'protocol-fixture')).toThrow();
});

test('canonical serialization uses source-compatible Unicode ordering and exact strings', () => {
  expect(canonicalTermsJson({ '\u{10000}': false, '\ue000': '0.00', count: 0 })).toBe('{"count":0,"":"0.00","𐀀":false}');
  expect(() => canonicalTermsJson({ value: 1.5 })).toThrow();
  expect(() => canonicalTermsJson({ value: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
});

test('the lazy terms index refuses a child from a different release', () => {
  const tag = 'app-payload-2026-09-14-r000002';
  const manifest = { repo: 'yanniedog/AR-local', tag, run_date: '2026-09-14', payload_revision: { revision: 2 } } as Manifest;
  const descriptor = { name: 'terms-a.json.gz', sha256: hash('a'), bytes: 123,
    url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/terms-a.json.gz` };
  const index = { schema_version: 1, run_date: manifest.run_date, products: { product: descriptor } };
  expect(validateProductTermsIndex(index, manifest)).toBe(index);
  descriptor.url = descriptor.url.replace('r000002', 'r000001');
  expect(() => validateProductTermsIndex(index, manifest)).toThrow();
});

test('lazy acquisition verifies canonical identity, bounds downloads and reuses identical verified bytes', async () => {
  const terms = evidence();
  const { identity_sha256: _ignored, ...body } = terms;
  terms.identity_sha256 = createHash('sha256').update(canonicalTermsJson(body)).digest('hex');
  const tag = 'app-payload-2026-09-14-r000003';
  const descriptor = (name: string, sha: string) => ({ name, bytes: 123, sha256: sha,
    url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/${name}` });
  const manifest = { repo: 'yanniedog/AR-local', tag, run_date: '2026-09-14',
    payload_revision: { revision: 3, bundle_sha256: hash('b') },
    files: { terms_index: descriptor('terms-index.json.gz', hash('f')) } } as unknown as Manifest;
  const index = { schema_version: 1, run_date: manifest.run_date,
    products: { 'protocol-fixture': descriptor('product.json.gz', hash('c')) } };
  const download = jest.mocked(downloadInflate);
  download.mockResolvedValueOnce(JSON.stringify(index)).mockResolvedValueOnce(JSON.stringify(terms));
  const first = await loadProductTerms(manifest, 'protocol-fixture');
  expect(first?.identity_sha256).toBe(terms.identity_sha256);
  expect(download).toHaveBeenLastCalledWith(index.products['protocol-fixture'].url, hash('c'),
    expect.objectContaining({ expectedBytes: 123, requireExactBytes: true,
      maxCompressedBytes: 8 * 1024 * 1024, maxInflatedBytes: 32 * 1024 * 1024 }));
  expect(await loadProductTerms(manifest, 'protocol-fixture')).toBe(first);
  expect(download).toHaveBeenCalledTimes(2);

  const changed = { ...manifest, payload_revision: { ...manifest.payload_revision!, bundle_sha256: hash('d') } };
  download.mockResolvedValueOnce(JSON.stringify(index)).mockResolvedValueOnce(JSON.stringify({ ...terms, identity_sha256: hash('e') }));
  await expect(loadProductTerms(changed, 'protocol-fixture')).rejects.toThrow('content identity mismatch');
  download.mockResolvedValueOnce(JSON.stringify(terms));
  await expect(loadProductTerms(changed, 'protocol-fixture')).resolves.toEqual(terms);
});
