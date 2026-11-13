import { gzipSync, gunzipSync, strFromU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { sampleCore } from '../src/data/sample';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { OBSERVED_POPULATION_CAPABILITY as capability, observedPopulationTransportUrl,
  OBSERVED_POPULATION_INDEX_URL } from '../src/data/observedPopulationChannel';
import type { CandidateAssetStorage, CandidateAssetCodec, CandidateAssetTransport } from '../src/data/observedPopulationAssets';
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';

export const hash = (bytes: Uint8Array) => bytesToHex(sha256(bytes));
export const codec: CandidateAssetCodec = { decodeText: strFromU8, yieldWork: async () => undefined,
  decode: async (bytes, maximum) => { const raw = bytes[0] === 0x1f ? gunzipSync(bytes) : bytes;
    if (raw.length > maximum) throw Error('decoded limit'); return JSON.parse(strFromU8(raw)); } };
export function memoryStorage() {
  const files = new Map<string, Uint8Array>();
  const storage: CandidateAssetStorage = {
    async read(key, maximum) { const bytes = files.get(key); if (bytes && bytes.length > maximum) throw Error('cache limit'); return bytes?.slice() ?? null; },
    async write(key, bytes) { files.set(key, bytes.slice()); },
    async removeEdition(sequence) { for (const key of files.keys()) if (key.startsWith(`edition-${sequence}/`)) files.delete(key); },
  };
  return { files, storage };
}
export function candidateFixture(revision = 1, mutate?: (core: CorePayload, details: DetailsPayload) => void, mutateManifest?: (manifest: Manifest) => void) {
  const day = '2026-11-03', tag = `app-payload-observed-v1-${day}-r${String(revision).padStart(6, '0')}`;
  const core: CorePayload = JSON.parse(JSON.stringify(sampleCore)); core.run_date = day;
  const rows = Object.values(core.sections).flatMap(section => section.rates);
  const products = new Set(rows.map(row => row.product_key)), providers = new Set(rows.map(row => row.provider));
  const sections = Object.fromEntries(['Mortgage', 'Savings', 'TD', 'Other'].map(section => {
    const sectionRows = core.sections[section as keyof typeof core.sections]?.rates ?? [];
    return [section, { source_rates: sectionRows.length, published_rates: sectionRows.length, excluded_rates: 0, exclusions: {},
      published_products: new Set(sectionRows.map(row => row.product_key)).size, published_providers: new Set(sectionRows.map(row => row.provider)).size }];
  }));
  core.coverage = { observed_on: day, observed_at: '2026-11-02T14:00:00Z',
    payload_accounting: { schema_version: 1, source_products: products.size, source_rates: rows.length, published_rates: rows.length,
      excluded_rates: 0, exclusions: {}, published_products: products.size, products_without_published_rates: 0,
      providers_with_products: providers.size, providers_with_published_rates: providers.size, sections },
    population_assessment: { schema_version: 1, scope: 'observed-products', observed_on: day, total_population: null, missing_product_count: null,
      observed_counts: { products: products.size, rates: rows.length, providers: providers.size },
      affected_providers: [{ provider_id: 'Wise', provider_name: 'Wise', register_status: 'registered', membership_status: 'unknown',
        reason: 'register-endpoint-conflict', missing_product_count: null, register_url: 'https://register.example/', endpoint_url: 'https://wise.example/' }] } };
  const details = { schema_version: 1, run_date: day, products: Object.fromEntries([...products].map(key => [key, {}])) } as DetailsPayload;
  mutate?.(core, details);
  const wire = { core: gzipSync(utf8ToBytes(JSON.stringify(core))), details: gzipSync(utf8ToBytes(JSON.stringify(details))) };
  const manifest = { schema_version: 1, run_date: day, repo: 'yanniedog/AR-local', tag, consumer_contract: capability,
    generated_at: '2026-11-02T14:30:00Z', schedule: { label: 'Daily', next_due_utc: '2026-11-03T14:00:00Z' }, app_min_version: '1.0.0',
    counts: { rates: rows.length, products: products.size },
    files: Object.fromEntries(Object.entries(wire).map(([key, bytes]) => [key, { name: `${key}.json.gz`, bytes: bytes.length, sha256: hash(bytes),
      url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/${key}.json.gz` }])),
    payload_revision: { schema_version: 1, revision, generation_id: `fixture-${revision}`, bundle_sha256: '', parent_revision: revision > 1 ? revision - 1 : null } } as unknown as Manifest;
  mutateManifest?.(manifest);
  manifest.payload_revision!.bundle_sha256 = payloadBundleIdentity(manifest);
  const text = JSON.stringify(manifest);
  const index = { schema_version: 1 as const, channel: capability, revision_protocol: 1 as const, dates: [day], count: 1, min_date: day, latest_date: day,
    revision_heads: { [day]: { revision, generation_id: manifest.payload_revision!.generation_id,
      manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/manifest.json`, manifest_sha256: hash(utf8ToBytes(text)),
      bundle_sha256: manifest.payload_revision!.bundle_sha256 } } };
  const transport: CandidateAssetTransport = {
    async readText({ url }) {
      if (url === observedPopulationTransportUrl(OBSERVED_POPULATION_INDEX_URL, capability)) return JSON.stringify(index);
      if (url === observedPopulationTransportUrl(index.revision_heads[day].manifest_url, capability)) return text;
      throw Error('Unexpected candidate URL');
    },
    async readBytes({ url }) {
      const key = Object.keys(wire).find(key => observedPopulationTransportUrl(manifest.files[key as 'core'].url, capability) === url);
      if (!key) throw Error('Unexpected candidate asset'); return wire[key as 'core'].slice();
    },
  };
  return { core, details, manifest, index, text, wire, transport };
}
