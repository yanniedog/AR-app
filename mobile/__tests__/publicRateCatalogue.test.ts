import { catalogueFixture, discoveryCatalogueFixture } from '../testUtils/publicRates';
import { createPublicRateCatalogueClient } from '../src/data/publicRateCatalogue';
import { createPublicRateAssetCache, type PublicRateCacheStorage } from '../src/data/publicRateCache';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { gzipSync } from 'node:zlib';
import { PUBLIC_RATE_INDEX_COMPRESSED, PUBLIC_RATE_INDEX_DECODED, PUBLIC_RATE_SHARD_COMPRESSED, PUBLIC_RATE_SHARD_DECODED } from '../src/data/publicRateWire';

it('recovers a transient index failure through loadAll on the same catalogue client', async () => {
  const { manifest, index, shard } = catalogueFixture();
  let fail = true;
  const client = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => {
    if (isIndex && fail) throw new Error('Temporary index outage');
    return isIndex ? index : shard;
  });
  await expect(client.start()).rejects.toThrow('Temporary index outage');
  expect(client.snapshot().status).toBe('error');
  fail = false;
  await client.snapshot().loadAll();
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: true, error: null });
});

it('discovers unresolved products before programme downloads and publishes no partial shard', async () => {
  const { manifest, index, shard, capability } = catalogueFixture();
  let failDownload = true;
  const acquire = jest.fn(async (_asset, isIndex: boolean) => {
    if (isIndex) return index;
    if (failDownload) throw new Error('interrupted download');
    return shard;
  });
  const client = createPublicRateCatalogueClient(manifest, acquire);
  await client.start();
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: false, products: [{ productKey: 'bank::product' }] });
  expect(client.snapshot().getProgrammes('product')).toEqual([]);
  await expect(client.snapshot().loadProduct('product')).rejects.toThrow('interrupted');
  expect(client.snapshot().getProgrammes('product')).toEqual([]);
  expect(client.snapshot().products).toHaveLength(1);
  failDownload = false;
  await client.snapshot().loadProduct('product');
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: true, evidence: [{ evidenceId: 'public-source' }] });
  expect(client.snapshot().getProgrammes('product')).toEqual(shard.programmes);
  expect(acquire).toHaveBeenCalledWith(capability.shards[0], false);
});

it('rejects same-priced foreign generations and preserves only valid programme identities', async () => {
  const { manifest, index, shard } = catalogueFixture();
  const client = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => isIndex ? index : { ...shard, generationId: 'old-generation' });
  await expect(client.snapshot().loadAll()).rejects.toThrow('Invalid public rate shard');
  expect(client.snapshot()).toMatchObject({ status: 'error', allLoaded: false });
  expect(client.snapshot().getProgrammes('product')).toEqual([]);
});

it('requires every declared programme before complete candidate ranking', async () => {
  const { manifest, index, shard } = catalogueFixture();
  index.products[0].programmeIds.push('missing-programme');
  const client = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => isIndex ? index : shard);
  await client.snapshot().loadAll();
  expect(client.snapshot()).toMatchObject({ status: 'error', allLoaded: false, error: 'Declared public pricing programme is missing' });
});

it('loads verified discovery before ready searches and leaves pricing on demand', async () => {
  const { manifest, index, shard, discovery, discoveryAsset, capability } = discoveryCatalogueFixture();
  let release!: () => void;
  const deferred = new Promise<void>(resolve => { release = resolve; });
  const acquire = jest.fn(async (asset, isIndex: boolean) => {
    if (isIndex) return index;
    if (asset.name === discoveryAsset.name) { await deferred; return discovery; }
    return shard;
  });
  const client = createPublicRateCatalogueClient(manifest, acquire);
  const start = client.start();
  await Promise.resolve();
  expect(client.snapshot()).toMatchObject({ status: 'loading', allLoaded: false, products: [] });
  expect(acquire).not.toHaveBeenCalledWith(capability.shards[0], false);
  release(); await start;
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: false, products: [{ productKey: 'bank::product' }] });
  expect(client.snapshot().getProgrammes('product')).toEqual([]);
  await client.snapshot().loadProduct('product');
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: true });
  expect(client.snapshot().getProgrammes('product')).toEqual(shard.programmes);
});

it('retains discovery interruption as incomplete, retries atomically and rejects foreign discovery generations', async () => {
  const { manifest, index, shard, discovery, discoveryAsset } = discoveryCatalogueFixture();
  let fail = true;
  const client = createPublicRateCatalogueClient(manifest, async (asset, isIndex) => {
    if (isIndex) return index;
    if (asset.name === discoveryAsset.name) { if (fail) throw new Error('interrupted discovery'); return discovery; }
    return shard;
  });
  await expect(client.start()).rejects.toThrow('interrupted discovery');
  expect(client.snapshot()).toMatchObject({ status: 'error', allLoaded: false, products: [] });
  expect(client.snapshot().getProduct('bank::product')).toBeUndefined();
  fail = false; await client.start();
  expect(client.snapshot()).toMatchObject({ status: 'ready', allLoaded: false, products: [{ productKey: 'bank::product' }] });
  const foreign = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => isIndex ? index : { ...discovery, generationId: 'other-generation' });
  await expect(foreign.start()).rejects.toThrow('Invalid public rate shard');
  expect(foreign.snapshot()).toMatchObject({ status: 'error', allLoaded: false, products: [] });
});

it('retains 2934 product identities and suppressed pricing within a compact discovery index', async () => {
  const { manifest, index, shard, discovery, discoveryAsset } = discoveryCatalogueFixture();
  const base = discovery.products![0];
  discovery.products!.push(...Array.from({ length: 2933 }, (_, index) => {
    const hash = bytesToHex(sha256(utf8ToBytes(`public-discovery-structure-${index}`)));
    return { ...base, productId: `product:v1:${hash}`, productKey: `bank::${hash}`, name: `Discovered product ${index}`, programmeIds: [],
      suppressedProgrammeCount: 5, reasonCodes: ['pricing_programme_not_enabled'] };
  }));
  const discoveryText = JSON.stringify(discovery), discoveryCompressed = gzipSync(discoveryText);
  discoveryAsset.bytes = discoveryCompressed.length; discoveryAsset.decodedBytes = Buffer.byteLength(discoveryText);
  Object.assign(index.shards[1], { bytes: discoveryAsset.bytes, decodedBytes: discoveryAsset.decodedBytes });
  const indexText = JSON.stringify(index), indexCompressed = gzipSync(indexText);
  manifest.public_rate_catalogue!.index.bytes = indexCompressed.length;
  manifest.public_rate_catalogue!.index.decodedBytes = Buffer.byteLength(indexText);
  expect(indexCompressed.length).toBeLessThan(PUBLIC_RATE_INDEX_COMPRESSED);
  expect(Buffer.byteLength(indexText)).toBeLessThan(PUBLIC_RATE_INDEX_DECODED);
  expect(discoveryCompressed.length).toBeLessThan(PUBLIC_RATE_SHARD_COMPRESSED);
  expect(Buffer.byteLength(discoveryText)).toBeLessThan(PUBLIC_RATE_SHARD_DECODED);
  const client = createPublicRateCatalogueClient(manifest, async (asset, isIndex) => isIndex ? index : asset.name === discoveryAsset.name ? discovery : shard);
  await client.start();
  expect(client.snapshot().products).toHaveLength(2934);
  expect(client.snapshot().getProduct(discovery.products![2933].productKey)).toMatchObject({ programmeIds: [], suppressedProgrammeCount: 5 });
  expect(client.snapshot().allLoaded).toBe(false);
  await client.snapshot().loadAll();
  expect(client.snapshot().allLoaded).toBe(true);
});

it('hydrates shared public fee sets without certifying missing fee bindings', async () => {
  const { manifest, index, shard } = catalogueFixture();
  shard.programmes[0].feeSetId = 'fees';
  shard.feeSets = [{ feeSetId: 'fees', productId: 'product', fees: [], feeCoverage: { status: 'complete', reasonCodes: [], evidenceIds: ['public-source'] } }];
  const client = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => isIndex ? index : shard);
  await client.snapshot().loadAll();
  expect(client.snapshot().getProgrammes('product')[0]).toMatchObject({ fees: [], feeCoverage: { status: 'complete' } });
  const missing = createPublicRateCatalogueClient(manifest, async (_asset, isIndex) => isIndex ? index : { ...shard, feeSets: [] });
  await missing.snapshot().loadAll();
  expect(missing.snapshot()).toMatchObject({ status: 'error', allLoaded: false, error: 'Declared public pricing fees are missing' });
});

it('hashes retained bytes and keeps an interrupted replacement isolated by catalogue edition', async () => {
  const values = new Map<string, string>();
  let interrupt = false;
  const storage: PublicRateCacheStorage = { read: async (name, maximum) => { const value = values.get(name); return value && value.length <= maximum ? value : null; },
    writeAtomic: async (name, value) => { if (interrupt) { values.set(name + '.tmp', value.slice(0, 5)); throw new Error('interrupted'); } values.set(name, value); },
    remove: async name => { values.delete(name); }, list: async () => [...values.keys()] };
  const cache = createPublicRateAssetCache(storage), bytes = utf8ToBytes('public source'), digest = bytesToHex(sha256(bytes));
  const asset = { name: 'source.json.gz', url: 'https://github.com/yanniedog/AR-local/releases/download/tag/source.json.gz', sha256: digest, bytes: bytes.length, decodedBytes: bytes.length, encoding: 'gzip' as const };
  const old = 'a'.repeat(64), next = 'b'.repeat(64);
  await cache.retain(old, asset, bytes);
  interrupt = true;
  await expect(cache.retain(next, asset, bytes)).rejects.toThrow('interrupted');
  expect(await cache.read(old, asset)).toEqual(bytes);
  expect(await cache.read(next, asset)).toBeNull();
  values.set(`${old}-${digest}.hex`, bytesToHex(utf8ToBytes('bad bytes!!!')));
  expect(await cache.read(old, asset)).toBeNull();
});

it('never accepts unverified cache bytes and evicts older generations within fixed retention', async () => {
  const values = new Map<string, string>();
  const storage: PublicRateCacheStorage = { read: async name => values.get(name) ?? null, writeAtomic: async (name, value) => { values.set(name, value); }, remove: async name => { values.delete(name); }, list: async () => [...values.keys()] };
  const cache = createPublicRateAssetCache(storage), bytes = utf8ToBytes('public');
  const asset = { name: 'source.json.gz', url: 'https://github.com/yanniedog/AR-local/releases/download/tag/source.json.gz', sha256: bytesToHex(sha256(bytes)), bytes: bytes.length, decodedBytes: bytes.length, encoding: 'gzip' as const };
  await expect(cache.retain('a'.repeat(64), asset, utf8ToBytes('private'))).rejects.toThrow('Unverified');
  for (const edition of ['a', 'b', 'c']) await cache.retain(edition.repeat(64), asset, bytes);
  expect(await cache.read('a'.repeat(64), asset)).toBeNull();
  expect(await cache.read('b'.repeat(64), asset)).toEqual(bytes);
  expect(await cache.read('c'.repeat(64), asset)).toEqual(bytes);
});
