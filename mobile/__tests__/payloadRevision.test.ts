import { revisionManifest, revisionHead } from '../testUtils/payloadRevision';
import { assertNoRevisionRollback, assertRevisionManifest, samePayloadIdentity, validateRevisionHead } from '../src/data/payloadRevision';
import { parseDatesIndex } from '../src/data/datesIndex';
import { mergeOptionalManifestFiles, resolveFinalizedManifest } from '../src/data/ingestFinalized';
import { validateDetachedHistoricalCatalogueDescriptor } from '../src/data/detachedHistoricalBankRateCatalogueWire';
import historyManifestFixture from './fixtures/detached-history-manifest-20260926.json';
import type { Manifest } from '../src/types';

const old = revisionManifest(1);
const corrected = revisionManifest(2);
const index = { schema_version: 1, revision_protocol: 1 as const, dates: [corrected.run_date], count: 1,
  min_date: corrected.run_date, latest_date: corrected.run_date,
  revision_heads: { [corrected.run_date]: revisionHead(corrected) } };

it('selects only the indexed revision when rolling still advertises an earlier edition', async () => {
  const fetchDated = jest.fn();
  const fetchRevision = jest.fn(async () => corrected);
  const result = await resolveFinalizedManifest(old, { fetchIndex: async () => index,
    fetchDated, fetchRevision, verifiedDated: old });
  expect(result.manifest).toEqual(corrected);
  expect(fetchDated).not.toHaveBeenCalled();
  expect(fetchRevision).toHaveBeenCalledWith(index.revision_heads[corrected.run_date]);
});

it('recognizes a new edition when core bytes are unchanged', () => {
  expect(old.files.core.sha256).toBe(corrected.files.core.sha256);
  expect(samePayloadIdentity(old, corrected)).toBe(false);
  expect(() => assertNoRevisionRollback(old, corrected)).not.toThrow();
  expect(() => assertNoRevisionRollback(corrected, old)).toThrow('stale');
  expect(() => assertNoRevisionRollback(corrected, { ...corrected, payload_revision: undefined })).toThrow('stale');
});

it('rejects a head that points outside the expected immutable release', () => {
  expect(parseDatesIndex(index)).not.toBeNull();
  expect(parseDatesIndex({ ...index, revision_heads: {} })).toBeNull();
  expect(() => validateRevisionHead({ ...revisionHead(corrected), manifest_url: 'https://example.org/manifest.json' },
    corrected.run_date, corrected.repo)).toThrow();
});

it('rejects mixed-generation assets and bindings before adopting', () => {
  expect(() => assertRevisionManifest(corrected, revisionHead(corrected), corrected.run_date, corrected.repo)).not.toThrow();
  expect(() => assertRevisionManifest({ ...corrected, files: { ...corrected.files, details: old.files.details } },
    revisionHead(corrected), corrected.run_date, corrected.repo)).toThrow('another generation');
  expect(() => assertRevisionManifest(old, revisionHead(corrected), corrected.run_date, corrected.repo)).toThrow('binding mismatch');
  expect(mergeOptionalManifestFiles(corrected, old, true)).toBe(corrected);
});

it('refuses legacy fallback after revision adoption', async () => {
  await expect(resolveFinalizedManifest(old, { verifiedDated: corrected,
    fetchIndex: async () => ({ ...index, revision_protocol: undefined, revision_heads: undefined }),
  })).rejects.toThrow('Revision index unavailable');
});

it('retains same-core legacy rolling history when adopting a finalized dated manifest', async () => {
  const rolling = structuredClone(historyManifestFixture) as Manifest;
  const dated = { ...rolling, tag: `app-payload-${rolling.run_date}`, bank_rate_history_catalogue: undefined };
  const merged = mergeOptionalManifestFiles(dated, rolling);
  expect(merged.bank_rate_history_catalogue).toEqual(rolling.bank_rate_history_catalogue);
  expect(validateDetachedHistoricalCatalogueDescriptor(merged)).toEqual(rolling.bank_rate_history_catalogue!.file);
  expect(merged.bank_rate_history_catalogue!.file.url).toContain('/app-payload-latest/');
  expect(mergeOptionalManifestFiles({ ...dated, run_date: '2026-09-25' }, rolling).bank_rate_history_catalogue).toBeUndefined();
  expect(mergeOptionalManifestFiles({ ...dated, files: { ...dated.files, core: { ...dated.files.core, sha256: 'f'.repeat(64) } } }, rolling).bank_rate_history_catalogue).toBeUndefined();
  const fetchDated = jest.fn();
  const resolved = await resolveFinalizedManifest(rolling, { verifiedDated: dated, fetchDated,
    fetchIndex: async () => ({ schema_version: 1, dates: ['2026-09-25'], count: 1, min_date: '2026-09-25', latest_date: '2026-09-25' }),
  });
  expect(fetchDated).not.toHaveBeenCalled();
  expect(resolved.manifest?.bank_rate_history_catalogue).toEqual(rolling.bank_rate_history_catalogue);
});

it('never borrows legacy history into a selected revision or from another revision', () => {
  const rolling = structuredClone(historyManifestFixture) as Manifest;
  const dated = { ...rolling, tag: `app-payload-${rolling.run_date}`, bank_rate_history_catalogue: undefined };
  const revision = { ...dated, payload_revision: old.payload_revision };
  expect(mergeOptionalManifestFiles(revision, rolling)).toBe(revision);
  expect(mergeOptionalManifestFiles(dated, { ...rolling, payload_revision: old.payload_revision })).toBe(dated);
  expect(validateDetachedHistoricalCatalogueDescriptor({ ...revision, bank_rate_history_catalogue: rolling.bank_rate_history_catalogue })).toBeNull();
  const invalid = { ...rolling, bank_rate_history_catalogue: { schema_version: 2, file: rolling.bank_rate_history_catalogue!.file } } as unknown as Manifest;
  expect(mergeOptionalManifestFiles(dated, invalid)).toBe(dated);
});

it('packed history changes invalidate a legacy payload even when core and legacy history are unchanged', () => {
  const original = structuredClone(historyManifestFixture) as Manifest;
  const oldFile = original.bank_rate_history_catalogue!.file;
  const packed: Manifest = { ...original, bank_rate_history_catalogue_packed: { schema_version: 1, file: {
    name: oldFile.name.replace('catalogue-', 'catalogue-packed-'), bytes: oldFile.bytes, sha256: oldFile.sha256,
    ...(oldFile.enc ? { enc: oldFile.enc } : {}),
  } } };
  expect(samePayloadIdentity(original, packed)).toBe(false);
  expect(samePayloadIdentity(packed, structuredClone(packed))).toBe(true);
  expect(samePayloadIdentity(packed, { ...packed, bank_rate_history_catalogue_packed: { schema_version: 1,
    file: { ...packed.bank_rate_history_catalogue_packed!.file, sha256: 'f'.repeat(64) } } })).toBe(false);
});

it('URL-free packed history merges only within its exact legacy release routing', () => {
  const source = structuredClone(historyManifestFixture) as Manifest;
  const oldFile = source.bank_rate_history_catalogue!.file;
  source.bank_rate_history_catalogue_packed = { schema_version: 1, file: {
    name: oldFile.name.replace('catalogue-', 'catalogue-packed-'), bytes: oldFile.bytes, sha256: oldFile.sha256,
    ...(oldFile.enc ? { enc: oldFile.enc } : {}),
  } };
  const target = { ...source, bank_rate_history_catalogue_packed: undefined };
  expect(mergeOptionalManifestFiles(target, source).bank_rate_history_catalogue_packed).toEqual(source.bank_rate_history_catalogue_packed);
  expect(mergeOptionalManifestFiles({ ...target, tag: `app-payload-${target.run_date}` }, source).bank_rate_history_catalogue_packed).toBeUndefined();
  const invalidLegacy = { ...source, bank_rate_history_catalogue: { schema_version: 2, file: oldFile } } as unknown as Manifest;
  expect(mergeOptionalManifestFiles({ ...target, bank_rate_history_catalogue: undefined }, invalidLegacy).bank_rate_history_catalogue).toBeUndefined();
});
