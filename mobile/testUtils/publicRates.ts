import type { PublicComponent, PublicCondition, PublicProgramme, PublicRateCapability, PublicRateIndex, PublicRateShard, RateResolution } from '../src/data/publicRateModel';
import type { Manifest } from '../src/types';
import { revisionManifest } from './payloadRevision';

export const PUBLIC_AS_OF = '2026-10-14T00:00:00Z';
export const freshness = { state: 'current' as const, checkedAt: PUBLIC_AS_OF, lastSuccessAt: PUBLIC_AS_OF, reasonCodes: [] };
export const component = (componentId: string, role: PublicComponent['role'], value: string): PublicComponent => ({ componentId, role, value,
  unit: 'fraction_per_annum', scopeId: 'offer', conditions: [], evidenceIds: ['public-source'], source: { rawType: role, rawValue: value, pointer: '/data/lendingRates/0' } });
export const condition = (field: string, values: Partial<PublicCondition> = {}): PublicCondition => ({ conditionId: field, field, operator: 'known', evidenceIds: ['public-source'], ...values });
export function programme(values: Partial<PublicProgramme> = {}): PublicProgramme {
  return { schemaVersion: 1, programmeId: 'programme', productId: 'product', section: 'Mortgage', offerId: 'offer', conditions: [],
    components: [component('net', 'payable', '0.06')], formula: { op: 'component', componentId: 'net' }, evidenceIds: ['public-source'],
    freshness, reasonCodes: [], sourceBindings: [{ pointer: '/data/lendingRates/0', rateIndex: 1 }], ...values };
}
export function resolution(values: Partial<RateResolution> = {}): RateResolution {
  return { status: 'exact', payableRate: '0.06', appliedComponents: [], phases: [], conditions: { met: [], unmet: [], unknown: [] }, reasonCodes: [], evidenceIds: ['public-source'], freshness,
    verifiedCurrent: true, origin: 'published', ...values };
}
export function catalogueFixture() {
  const manifest = revisionManifest(1) as Manifest;
  manifest.source_observation = { generation_id: 'source-public-pricing' };
  const prefix = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/`;
  const binding = { schemaVersion: 1 as const, generationId: 'source-public-pricing', runDate: manifest.run_date,
    coreSha256: manifest.files.core.sha256, detailsSha256: manifest.files.details.sha256 };
  const indexName = `public-rate-index-${manifest.run_date}-${'a'.repeat(12)}.json.gz`;
  const shardName = `public-rate-shard-0000-${manifest.run_date}-${'b'.repeat(12)}.json.gz`;
  const indexAsset = { name: indexName, url: prefix + indexName, sha256: 'a'.repeat(64), bytes: 100, decodedBytes: 1000, encoding: 'gzip' as const };
  const shardAsset = { name: shardName, url: prefix + shardName, sha256: 'b'.repeat(64), bytes: 100, decodedBytes: 2000, encoding: 'gzip' as const };
  const capability: PublicRateCapability = { ...binding, index: indexAsset, shards: [shardAsset] };
  manifest.public_rate_catalogue = capability;
  const { url: _url, ...shardReference } = shardAsset;
  const index: PublicRateIndex = { ...binding, products: [{ productId: 'product', productKey: 'bank::product', providerId: 'bank', providerName: 'Bank', name: 'Product', section: 'Mortgage',
    aliases: [], status: 'current', programmeIds: ['programme'], referenceIds: [], reasonCodes: [] }], coverage: [], shards: [{ ...shardReference, productIds: ['product'] }] };
  const shard: PublicRateShard = { ...binding, programmes: [programme()], referenceRates: [], evidence: [{ evidenceId: 'public-source', url: 'https://www.nab.com.au/home-loans', sha256: 'c'.repeat(64), locator: '/data/lendingRates/0' }] };
  return { manifest, capability, index, shard };
}

/** The pricing asset precedes discovery in the manifest; consumers must obey route kinds. */
export function discoveryCatalogueFixture() {
  const fixture = catalogueFixture();
  const { manifest, capability, index, shard } = fixture;
  const name = `public-rate-shard-0001-${manifest.run_date}-${'d'.repeat(12)}.json.gz`;
  const asset = { ...capability.shards[0], name, sha256: 'd'.repeat(64), url: capability.shards[0].url.replace(capability.shards[0].name, name) };
  capability.shards.push(asset);
  const { url: _url, ...descriptor } = asset;
  index.shards.push({ ...descriptor, productIds: [] });
  index.routes = [{ name: capability.shards[0].name, kind: 'pricing', providerIds: ['bank'], sections: ['Mortgage'] },
    { name, kind: 'discovery', providerIds: ['bank'], sections: ['Mortgage'] }];
  const { programmes: _programmes, referenceRates: _references, evidence: _evidence, ...binding } = shard;
  const discovery: PublicRateShard = { ...binding, products: index.products, programmes: [], referenceRates: [], evidence: [] };
  index.products = [];
  return { ...fixture, discovery, discoveryAsset: asset };
}
