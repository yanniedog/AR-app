import { catalogueFixture, condition, discoveryCatalogueFixture, freshness } from '../testUtils/publicRates';
import { validatePublicRateCapability, validatePublicRateDiscovery, validatePublicRateIndex, validatePublicRateShard, PUBLIC_RATE_TOTAL_DECODED } from '../src/data/publicRateWire';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { mergeOptionalManifestFiles } from '../src/data/ingestFinalized';

it('binds every catalogue index and shard to the selected generation and exact core/details bytes', () => {
  const { manifest, capability, index, shard } = catalogueFixture();
  expect(validatePublicRateCapability(manifest)).toEqual(capability);
  expect(validatePublicRateIndex(index, manifest)).toEqual(index);
  expect(validatePublicRateShard(shard, manifest, index, capability.shards[0])).toEqual(shard);
  expect(() => validatePublicRateIndex({ ...index, generationId: 'unrelated' }, manifest)).toThrow();
  expect(() => validatePublicRateShard({ ...shard, detailsSha256: 'f'.repeat(64) }, manifest, index, capability.shards[0])).toThrow();
  capability.shards[0].url = capability.shards[0].url.replace('-r000001/', '-r000002/');
  expect(() => validatePublicRateCapability(manifest)).toThrow();
});

it('rejects decompression budgets, mixed shard references, duplicate product identity and dangling evidence', () => {
  const { manifest, capability, index, shard } = catalogueFixture();
  capability.shards[0].decodedBytes = PUBLIC_RATE_TOTAL_DECODED;
  expect(() => validatePublicRateCapability(manifest)).toThrow();
  capability.shards[0].decodedBytes = 2000;
  expect(() => validatePublicRateIndex({ ...index, shards: [{ ...index.shards[0], sha256: 'f'.repeat(64) }] }, manifest)).toThrow();
  expect(() => validatePublicRateIndex({ ...index, products: [...index.products, index.products[0]] }, manifest)).toThrow();
  expect(() => validatePublicRateShard({ ...shard, evidence: [] }, manifest, index, capability.shards[0])).toThrow();
});

it('keeps legacy editions readable and never borrows the pricing capability from rolling aliases', () => {
  const { manifest } = catalogueFixture();
  const legacy = { ...manifest, payload_revision: undefined, public_rate_catalogue: undefined };
  expect(validatePublicRateCapability(legacy)).toBeNull();
  expect(mergeOptionalManifestFiles(legacy, manifest).public_rate_catalogue).toBeUndefined();
  expect(() => validatePublicRateCapability({ ...legacy, public_rate_catalogue: manifest.public_rate_catalogue })).toThrow();
});

it('retains optional bounded raw material notes without changing legacy programmes', () => {
  const { manifest, capability, index, shard } = catalogueFixture();
  expect(validatePublicRateShard(shard, manifest, index, capability.shards[0]).programmes[0].materialFootnotes).toBeUndefined();
  shard.programmes[0].materialFootnotes = ['Public material clause retained verbatim for adapter review.'];
  expect(validatePublicRateShard(shard, manifest, index, capability.shards[0]).programmes[0].materialFootnotes).toEqual(shard.programmes[0].materialFootnotes);
  for (const notes of [[''], ['x'.repeat(16385)], Array.from({ length: 65 }, () => 'note'), [123]]) {
    expect(() => validatePublicRateShard({ ...shard, programmes: [{ ...shard.programmes[0], materialFootnotes: notes }] }, manifest, index, capability.shards[0])).toThrow();
  }
});

it('preserves public alias observation dates independently of lender effective periods', () => {
  const { manifest, index } = catalogueFixture();
  const product = index.products[0];
  product.aliases = [{ name: 'Earlier public name' }];
  expect(validatePublicRateIndex(index, manifest).products[0].aliases[0]).toEqual({ name: 'Earlier public name' });
  const alias = { name: 'Earlier public name', effectiveFrom: '2020-01-01', effectiveTo: '2023-12-31',
    firstObservedAt: '2024-01-02T00:00:00Z', lastObservedAt: '2026-10-14T00:00:00Z' };
  product.aliases = [alias];
  expect(validatePublicRateIndex(index, manifest).products[0].aliases[0]).toEqual(alias);
  for (const field of ['firstObservedAt', 'lastObservedAt'] as const) {
    for (const invalidDate of ['2026-02-30T00:00:00Z', '2026-10-14T00:00:00', 42]) {
      expect(() => validatePublicRateIndex({ ...index, products: [{ ...product, aliases: [{ ...alias, [field]: invalidDate }] }] }, manifest)).toThrow();
    }
  }
  expect(() => validatePublicRateIndex({ ...index, products: [{ ...product, aliases: [{ ...alias,
    firstObservedAt: '2026-10-15T00:00:00Z', lastObservedAt: '2026-10-14T00:00:00Z' }] }] }, manifest)).toThrow();
});

it('binds capability hashes while publication URL retagging leaves the bundle identity stable', () => {
  const { manifest } = catalogueFixture();
  const before = payloadBundleIdentity(manifest);
  const retagged = structuredClone(manifest);
  retagged.public_rate_catalogue!.index.url = 'https://github.com/yanniedog/AR-local/releases/download/new/index.json.gz';
  retagged.public_rate_catalogue!.shards[0].url = 'https://github.com/yanniedog/AR-local/releases/download/new/shard.json.gz';
  expect(payloadBundleIdentity(retagged)).toBe(before);
  retagged.public_rate_catalogue!.shards[0].sha256 = 'f'.repeat(64);
  expect(payloadBundleIdentity(retagged)).not.toBe(before);
});

it('retains typed reference applicability and rejects unsupported or unbound reference conditions', () => {
  const { manifest, capability, index, shard } = catalogueFixture();
  shard.referenceRates.push({ referenceId: 'reference', providerId: 'bank', name: 'Indicator', scopeId: 'scope:owner-pi', value: '8.89', unit: 'percentage_points',
    conditions: [condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' })], freshness, evidenceIds: ['public-source'] });
  expect(validatePublicRateShard(shard, manifest, index, capability.shards[0]).referenceRates[0].conditions).toEqual(shard.referenceRates[0].conditions);
  shard.referenceRates[0].conditions![0].field = 'unsupported';
  expect(() => validatePublicRateShard(shard, manifest, index, capability.shards[0])).toThrow('Invalid public reference observation');
  shard.referenceRates[0].conditions![0].field = 'purpose';
  shard.referenceRates[0].conditions![0].evidenceIds = ['missing'];
  expect(() => validatePublicRateShard(shard, manifest, index, capability.shards[0])).toThrow('unbound evidence');
});

it('binds discovery routes and requires verified canonical products before pricing', () => {
  const { manifest, index, shard, discovery, discoveryAsset, capability } = discoveryCatalogueFixture();
  expect(validatePublicRateIndex(index, manifest)).toBe(index);
  expect(validatePublicRateShard(discovery, manifest, index, discoveryAsset)).toBe(discovery);
  expect(() => validatePublicRateShard(shard, manifest, index, capability.shards[0])).toThrow('Programme is not bound');
  expect(validatePublicRateShard(shard, manifest, index, capability.shards[0], discovery.products)).toBe(shard);
  expect(() => validatePublicRateDiscovery(index, [])).toThrow('undiscovered product');
  expect(() => validatePublicRateDiscovery(index, [...discovery.products!, ...discovery.products!])).toThrow('Ambiguous public product identity');
  index.routes![1].providerIds = ['different-bank'];
  expect(() => validatePublicRateShard(discovery, manifest, index, discoveryAsset)).toThrow('Invalid public discovery shard');
  index.routes![1].providerIds = ['bank']; index.routes![1].name = 'not-an-asset';
  expect(() => validatePublicRateIndex(index, manifest)).toThrow('Invalid public discovery routing');
});

it('retains suppressed product source dates and public name evidence without requiring an executable price', () => {
  const { manifest, index, discovery, discoveryAsset } = discoveryCatalogueFixture();
  const product = discovery.products![0];
  product.programmeIds = []; product.suppressedProgrammeCount = 5; product.reasonCodes = ['pricing_programme_not_enabled'];
  product.freshness = freshness;
  product.sourceEvidence = { evidenceId: 'public-product-name', url: 'https://openbank.api.nab.com.au/cds-au/v1/banking/products/public-product',
    sha256: 'f'.repeat(64), locator: '/data', checkedAt: freshness.checkedAt };
  expect(validatePublicRateShard(discovery, manifest, index, discoveryAsset).products![0]).toMatchObject({ suppressedProgrammeCount: 5, freshness, sourceEvidence: product.sourceEvidence });
  product.sourceEvidence.url = 'https://borrower:secret@example.com/private';
  expect(() => validatePublicRateShard(discovery, manifest, index, discoveryAsset)).toThrow('Invalid public discovery shard');
});
