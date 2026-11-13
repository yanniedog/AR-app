import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { revisionManifest, revisionHead } from '../testUtils/payloadRevision';
import { revisionTag, validateRevisionHead, assertRevisionManifest } from '../src/data/payloadRevision';
import { parseDatesIndex } from '../src/data/datesIndex';
import { automaticDataUrl, trustedPayloadReleaseUrl } from '../src/lib/automaticDataAccess';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { admitObservedPopulationManifest, discoverObservedPopulationCandidate, observedPopulationCacheReceipt,
  restoreObservedPopulationSelection, observedPopulationTransportUrl, parseObservedPopulationIndex,
  OBSERVED_POPULATION_CAPABILITY as capability, OBSERVED_POPULATION_INDEX_URL, type ObservedPopulationIndex } from '../src/data/observedPopulationChannel';

function fixture(revision = 1) {
  const manifest = { ...revisionManifest(revision), consumer_contract: capability };
  manifest.tag = revisionTag(manifest.run_date, revision, capability);
  Object.values(manifest.files).forEach(file => { file.url = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${file.name}`; });
  manifest.payload_revision!.bundle_sha256 = payloadBundleIdentity(manifest);
  const text = JSON.stringify(manifest);
  const head = { ...revisionHead(manifest), manifest_sha256: bytesToHex(sha256(utf8ToBytes(text))) };
  const index: ObservedPopulationIndex = { schema_version: 1, channel: capability, revision_protocol: 1,
    dates: [manifest.run_date], count: 1, min_date: manifest.run_date, latest_date: manifest.run_date, revision_heads: { [manifest.run_date]: head } };
  const readText = jest.fn(async ({ url }: { url: string }) => {
    if (url === observedPopulationTransportUrl(OBSERVED_POPULATION_INDEX_URL, capability)) return JSON.stringify(index);
    if (url === observedPopulationTransportUrl(head.manifest_url, capability)) return text;
    throw Error('Unexpected route');
  });
  return { manifest, text, head, index, readText };
}
test('candidate uses fixed isolated discovery, immutable routes, exact hashes and metadata cache identity', async () => {
  const f = fixture();
  const result = await discoverObservedPopulationCandidate(capability, f);
  expect(result.manifest).toEqual(f.manifest);
  expect(Object.isFrozen(result.manifest.files.core)).toBe(true);
  expect(result.cacheKey).toMatch(/^ar-rates:observed-population-v1\/app-payload-observed-v1-/);
  expect(f.readText.mock.calls).toHaveLength(2);
  for (const [request] of f.readText.mock.calls) expect(request).toMatchObject({ redirect: 'error', url: expect.stringContaining('/v1/capabilities/observed-population-v1/release/') });
  const cached = observedPopulationCacheReceipt(result, f.index);
  expect(restoreObservedPopulationSelection(cached, capability).manifest).toEqual(f.manifest);
});
test.each([undefined, null, '', '1.0.259', 'observed-population-v2', false])('versionless/version-only/unknown capability %j cannot discover candidate', async value => {
  const f = fixture();
  await expect(discoverObservedPopulationCandidate(value, f)).rejects.toThrow();
  expect(f.readText).not.toHaveBeenCalled();
});
test('unchanged legacy parser, transport matcher and revision validator cannot select candidate tags', () => {
  const f = fixture();
  for (const url of [OBSERVED_POPULATION_INDEX_URL, f.head.manifest_url, ...Object.values(f.manifest.files).map(file => file.url)]) {
    expect(trustedPayloadReleaseUrl(url)).toBeNull(); expect(automaticDataUrl(url)).toBeNull();
  }
  expect(parseDatesIndex(f.index)).toBeNull();
  expect(() => validateRevisionHead(f.head, f.manifest.run_date, f.manifest.repo)).toThrow();
  expect(() => assertRevisionManifest(f.manifest, f.head, f.manifest.run_date, f.manifest.repo)).toThrow();
  const legacy = revisionManifest(1);
  expect(automaticDataUrl(revisionHead(legacy).manifest_url)).toContain('/v1/release/app-payload-');
  expect(revisionTag(legacy.run_date, 1)).not.toContain('observed');
});
test.each([
  'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json',
  'https://evil.example/yanniedog/AR-local/releases/download/app-payload-observed-v1-candidate/dates-index.json',
  `${OBSERVED_POPULATION_INDEX_URL}?capability=observed-population-v1`, `${OBSERVED_POPULATION_INDEX_URL}#fragment`,
  OBSERVED_POPULATION_INDEX_URL.replace('/dates-index.json', '/manifest.json'),
  OBSERVED_POPULATION_INDEX_URL.replace('/dates-index.json', '/..core.json'),
])('candidate rejects cross-channel or ambiguous URL %s', url => {
  expect(() => observedPopulationTransportUrl(url, capability)).toThrow();
});
test.each([{ count: 0 }, { revision_protocol: 2 }, { channel: 'legacy' }, { revision_heads: {} }, { extra: true }])('rejects invalid discovery index %j', patch => {
  expect(() => parseObservedPopulationIndex({ ...fixture().index, ...patch })).toThrow();
});
test('manifest integrity, mixed edition assets and absent capability marker fail closed', () => {
  const f = fixture();
  expect(() => admitObservedPopulationManifest(f.text + ' ', f.index)).toThrow();
  for (const mutate of [
    (candidate: ReturnType<typeof fixture>) => { candidate.manifest.files.core.url = revisionManifest(1).files.core.url; },
    (candidate: ReturnType<typeof fixture>) => { candidate.manifest.consumer_contract = undefined as never; },
    (candidate: ReturnType<typeof fixture>) => { candidate.manifest.files.details.sha256 = 'b'.repeat(64); },
  ]) {
    const candidate = fixture(); mutate(candidate); const changed = JSON.stringify(candidate.manifest);
    candidate.index.revision_heads[candidate.manifest.run_date].manifest_sha256 = bytesToHex(sha256(utf8ToBytes(changed)));
    expect(() => admitObservedPopulationManifest(changed, candidate.index)).toThrow();
  }
});
test('offline receipt cannot cross namespaces, be altered, or roll back an installed revision', () => {
  const f = fixture(), newer = fixture(2);
  const selection = admitObservedPopulationManifest(f.text, f.index);
  const receipt = observedPopulationCacheReceipt(selection, f.index);
  expect(() => restoreObservedPopulationSelection(receipt, capability, newer.manifest)).toThrow();
  expect(() => restoreObservedPopulationSelection(receipt.replace('ar-rates:observed-population-v1/', 'ar-rates:payload/'), capability)).toThrow();
  expect(() => restoreObservedPopulationSelection(receipt, undefined)).toThrow();
});
test('missing candidate and interrupted fetch never retry legacy paths or mutate installed selection', async () => {
  const f = fixture();
  const installed = fixture(2).manifest, before = JSON.stringify(installed);
  f.readText.mockRejectedValueOnce(Error('404 candidate unavailable'));
  await expect(discoverObservedPopulationCandidate(capability, f, installed)).rejects.toThrow('404');
  expect(f.readText).toHaveBeenCalledTimes(1); expect(JSON.stringify(installed)).toBe(before);
  const abort = new AbortController(); abort.abort(); f.readText.mockClear();
  await expect(discoverObservedPopulationCandidate(capability, f, installed, abort.signal)).rejects.toThrow('cancelled');
  expect(f.readText).not.toHaveBeenCalled();
});
