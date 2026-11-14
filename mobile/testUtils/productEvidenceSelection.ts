/** Protocol bindings around retained captured products; not publication/device acceptance. */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import factsFixture from '../__tests__/fixtures/product-evidence-real-wire.json';
import responseFixture from '../__tests__/fixtures/product-response-real-wire.json';
import { sampleCore } from '../src/data/sample';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { canonicalTermsJson } from '../src/data/productTerms';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import type { ProductEvidenceContext } from '../src/data/productEvidenceDocument';
import type { EvidenceLane, EvidenceReference } from '../src/data/productEvidencePublication';
import type { EvidenceCapability } from '../src/data/productEvidenceWire';
import type { ResponseCapability } from '../src/data/productResponseWire';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
let nonce = 0;
export function evidenceSelection(lane: EvidenceLane = 'product_evidence_v1') {
  const fixture = lane === 'product_evidence_v1' ? factsFixture : responseFixture;
  const cap = fixture.prepared.capability as EvidenceCapability | ResponseCapability;
  const binding = 'facts' in cap.binding ? cap.binding.facts : cap.binding, source = binding.source;
  const assets = fixture.assets as Record<string, string>, index = JSON.parse(assets[cap.index.name]);
  const route = index.products.find((item: { state?: string }) => lane === 'product_evidence_v1' || item.state === 'matched');
  const text = canonicalTermsJson(cap), packed = gzipSync(text), digest = sha(packed), family = lane === 'product_evidence_v1' ? 'product-evidence' : 'product-response';
  const ref: EvidenceReference = { schema: lane === 'product_evidence_v1' ? 'ar-product-evidence-reference-v1' : 'ar-product-response-evidence-reference-v1',
    source: { generation_id: source.generation_id, observation_date: source.observation_date, observation_state: source.observation_state, contract_digest: source.contract_digest },
    core_sha256: binding.core_sha256, details_sha256: binding.details_sha256,
    capability: { name: `${family}-capability-${digest}.json.gz`, bytes: packed.length, decoded_bytes: Buffer.byteLength(text), sha256: digest } };
  const date = source.observation_date, tag = `app-payload-${date}-r000001`, prefix = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
  const manifest: Manifest = { schema_version: 1, run_date: date, generated_at: `${date}T12:00:00Z`, repo: 'yanniedog/AR-local', tag,
    app_min_version: '1.0.0', counts: { protocol: ++nonce }, schedule: { label: 'Daily' }, source_observation: { ...ref.source }, [lane]: ref,
    files: { core: { name: 'core.json.gz', sha256: binding.core_sha256, bytes: 10, url: prefix + 'core.json.gz' },
      details: { name: 'details.json.gz', sha256: binding.details_sha256, bytes: 10, url: prefix + 'details.json.gz' } } };
  const bundle = payloadBundleIdentity(manifest);
  manifest.payload_revision = { schema_version: 1, revision: 1, parent_revision: null, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  const head = { revision: 1, generation_id: `sha256-${bundle}`, manifest_url: prefix + 'manifest.json', manifest_sha256: sha(JSON.stringify(manifest)), bundle_sha256: bundle };
  const core = JSON.parse(JSON.stringify(sampleCore)) as CorePayload; core.run_date = date;
  const normalized = normalizeCoreWithIntegrity(core, { coreSha256: binding.core_sha256 });
  const key: string = route.identity.product_key;
  const details: DetailsPayload = { schema_version: 1, run_date: date, products: Object.fromEntries(index.products.map((item: typeof route) => [item.identity.product_key,
    { displayIdentity: { name: item.identity.product_name, provider: item.identity.provider } }])) };
  bindVerifiedDetails(details, binding.details_sha256);
  const context: ProductEvidenceContext = { manifest, productEvidenceHead: head, core: normalized.core, coreIntegrity: normalized.integrity, details, source: 'remote' };
  const dates = { schema_version: 1, revision_protocol: 1 as const, dates: [date], count: 1, min_date: date, latest_date: date, revision_heads: { [date]: head } };
  return { cap, binding, key, route, ref, manifest, head, dates, context,
    load: async (url: string) => url.endsWith(ref.capability.name) ? text : assets[url.slice(url.lastIndexOf('/') + 1)] };
}
