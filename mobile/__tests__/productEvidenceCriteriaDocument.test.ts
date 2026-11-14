import { downloadInflate } from '../src/data/payload';
import { evidenceSelection } from '../testUtils/productEvidenceSelection';
import { statusSelection } from '../testUtils/productEvidenceStatusSelection';
import * as documents from '../src/data/productEvidenceDocument';
import { loadProductCriteria } from '../src/data/productEvidenceCriteriaDocument';
import type { CriteriaQuery } from '../src/data/productEvidenceCriteria';
import { claimEvidenceUi } from '../src/data/productEvidenceUiLease';
const query: CriteriaQuery = { kind: 'all', text: '', record: 0, page: 0 };
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn(), fetchManifest: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

test('real selected products are sequential and release each document before the next acquisition', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockImplementation(p.load);
  const original = documents.loadProductEvidenceDocument, retained: documents.ProductEvidenceDocument[] = [];
  const release = jest.spyOn(documents, 'releaseProductEvidenceDocument');
  jest.spyOn(documents, 'loadProductEvidenceDocument').mockImplementation(async (...args) => {
    expect(release).toHaveBeenCalledTimes(retained.length);
    const result = await original(...args); if (result.status === 'observed') retained.push(result.document); return result;
  });
  const keys = Object.keys(p.context.details!.products).sort((a, b) => Number(b.startsWith('Up|')) - Number(a.startsWith('Up|')));
  const columns = await loadProductCriteria(p.context, keys, { ...query, kind: 'feature', text: 'features[1].featureType' }, () => true, new AbortController().signal);
  expect(columns).toHaveLength(3); expect(release).toHaveBeenCalledTimes(3);
  let textBytes = 0;
  for (const column of columns) { expect(column.status).toBe('observed'); if (column.status !== 'observed') continue;
    expect(column.edition).toBe(p.head.bundle_sha256);
    if (column.criteria.sourcePage) textBytes += new TextEncoder().encode(documents.productEvidencePageText(column.criteria.sourcePage)).length;
    else expect(column.criteria.state).toBe('unknown'); }
  expect(textBytes).toBeLessThanOrEqual(65536);
  for (const document of retained) await expect(documents.projectProductEvidenceCriteria(document, query, async () => {})).rejects.toThrow('admitted');
});
test('cancelled acquired document is released; a changed member/edition never returns partial columns', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockImplementation(p.load);
  const original = documents.loadProductEvidenceDocument, release = jest.spyOn(documents, 'releaseProductEvidenceDocument');
  const controller = new AbortController();
  jest.spyOn(documents, 'loadProductEvidenceDocument').mockImplementation(async (...args) => { const result = await original(...args); controller.abort(); return result; });
  await expect(loadProductCriteria(p.context, [p.key], query, () => true, controller.signal)).rejects.toThrow('changed'); expect(release).toHaveBeenCalledTimes(1);
  await expect(loadProductCriteria(p.context, [p.key], query, () => false, new AbortController().signal)).rejects.toThrow('changed');
});
test('actual pending/disabled/unavailable statuses require no optional asset IO', async () => {
  for (const state of ['pending', 'disabled', 'unavailable'] as const) {
    const p = statusSelection(state); jest.mocked(downloadInflate).mockClear();
    const [column] = await loadProductCriteria(p.context, [p.key], query, () => true, new AbortController().signal);
    expect(column.status).toBe(state); expect(downloadInflate).not.toHaveBeenCalled();
  }
});
test('unverified or excessive product selections are rejected, legacy missing evidence stays unavailable', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockClear();
  await expect(loadProductCriteria(p.context, ['not-a-product'], query, () => true, new AbortController().signal)).rejects.toThrow('absent');
  await expect(loadProductCriteria(p.context, Array.from({ length: 5 }, (_, i) => String(i)), query, () => true, new AbortController().signal)).rejects.toThrow('selection');
  const context = { ...p.context, manifest: { ...p.manifest }, productEvidenceHead: null }; delete context.manifest.product_evidence_v1;
  expect((await loadProductCriteria(context, [p.key], query, () => true, new AbortController().signal))[0].status).toBe('unavailable');
  expect(downloadInflate).not.toHaveBeenCalled();
});
test('shared UI ownership replacement cancels exactly once and stale release cannot drop a new owner', () => {
  const firstCancel = jest.fn(), secondCancel = jest.fn(); const first = claimEvidenceUi(firstCancel), second = claimEvidenceUi(secondCancel);
  expect(firstCancel).toHaveBeenCalledTimes(1); expect(first.current()).toBe(false); first.release(); expect(second.current()).toBe(true);
  second.release(); expect(second.current()).toBe(false); expect(secondCancel).not.toHaveBeenCalled();
});
