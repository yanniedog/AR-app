import { createTermsReferenceStore, type TermsReference } from '../src/data/termsReferenceStore';
import { canonicalTermsJson, TERMS_STAGES, validateProductTerms } from '../src/data/productTerms';
import { hashText } from '../src/lib/productTermsEngine/validation';
function entry(n = 1): TermsReference {
  const body = { schema_version: 1, product_key: 'technical', documents: [], clauses: [], revisions: [], changes: [], coverage: { ...Object.fromEntries(TERMS_STAGES.map(stage => [stage, { status: 'unknown', expected: null, observed: 0 }])), gaps: ['Engineering fixture only'] } };
  return { productKey: 'technical', edition: n.toString(16).padStart(64, '0'), runDate: '2026-09-15', indexSha256: 'a'.repeat(64), assetSha256: 'b'.repeat(64), retainedAt: '2026-09-15T00:00:00Z', terms: validateProductTerms({ ...body, identity_sha256: hashText(canonicalTermsJson(body)) }, 'technical') };
}
function harness() {
  const slots = new Map<number, string>();
  const storage = { read: jest.fn(async (slot: number) => slots.get(slot) ?? null), write: jest.fn(async (slot: number, text: string) => { slots.set(slot, text); }) };
  return { slots, storage, store: createTermsReferenceStore(storage) };
}
test('restart retains a descriptive reference for same or different selected edition', async () => {
  const x = harness(); await x.store.retain(entry(1)); await x.store.retain(entry(2));
  const restarted = createTermsReferenceStore(x.storage);
  expect(await restarted.previous('technical', entry(2).edition)).toEqual(entry(2));
  expect(await restarted.previous('unseen', entry(2).edition)).toBeNull();
});
test('interrupted replacement and corrupt higher slot preserve older verified snapshot', async () => {
  const x = harness(); await x.store.retain(entry(1));
  x.storage.write.mockImplementationOnce(async (slot, text) => { x.slots.set(slot, text.slice(0, 90)); throw new Error('interrupted'); });
  await expect(x.store.retain(entry(2))).rejects.toThrow('interrupted');
  expect(await createTermsReferenceStore(x.storage).previous('technical', entry(3).edition)).toEqual(entry(1));
  await x.store.retain(entry(2));
  const latest = JSON.parse(x.slots.get(1)!); latest.entries[0].terms.coverage.gaps = ['tampered']; x.slots.set(1, JSON.stringify(latest));
  expect(await createTermsReferenceStore(x.storage).previous('technical', entry(3).edition)).toEqual(entry(1));
});
test('serialized concurrent retention stays bounded and oversized new entry leaves old data intact', async () => {
  const x = harness(); await Promise.all(Array.from({ length: 20 }, (_, i) => x.store.retain(entry(i + 1))));
  expect(x.slots.size).toBe(2);
  expect([...x.slots.values()].every(text => Buffer.byteLength(text) <= 2 * 1024 * 1024)).toBe(true);
  const newest = [...x.slots.values()].map(text => JSON.parse(text)).sort((a, b) => b.sequence - a.sequence)[0]; expect(newest.entries).toHaveLength(16);
  const bad = entry(21); bad.terms.coverage.gaps = ['x'.repeat(270000)];
  await expect(x.store.retain(bad)).rejects.toThrow();
  expect((await x.store.previous('technical', entry(21).edition))?.edition).toBe(entry(20).edition);
});
