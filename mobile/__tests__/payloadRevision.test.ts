import { revisionManifest, revisionHead } from '../testUtils/payloadRevision';
import { assertNoRevisionRollback, assertRevisionManifest, samePayloadIdentity, validateRevisionHead } from '../src/data/payloadRevision';
import { parseDatesIndex } from '../src/data/datesIndex';
import { mergeOptionalManifestFiles, resolveFinalizedManifest } from '../src/data/ingestFinalized';

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
