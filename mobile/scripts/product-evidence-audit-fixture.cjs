'use strict';
// Captured products/rates/body text, with explicit technical publication bindings.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createHash } = require('node:crypto'), { gzipSync } = require('node:zlib');
const { canonicalTermsJson } = require('../src/data/productTerms.ts');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const hash = value => createHash('sha256').update(value).digest('hex');
const root = path.resolve(__dirname, '..');

function candidate(t, { mutate = () => {}, revision = true } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-evidence-audit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/sample/manifest.json')));
  manifest.tag = revision ? `app-payload-${manifest.run_date}-r000001` : 'app-payload-latest';
  const prefix = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/`;
  for (const entry of Object.values(manifest.files)) {
    fs.copyFileSync(path.join(root, 'assets/sample', entry.name), path.join(directory, entry.name)); entry.url = prefix + entry.name;
  }
  const facts = JSON.parse(fs.readFileSync(path.join(root, '__tests__/fixtures/product-evidence-real-wire.json')));
  const response = JSON.parse(fs.readFileSync(path.join(root, '__tests__/fixtures/product-response-real-wire.json')));
  const common = structuredClone(facts.prepared.capability.binding);
  Object.assign(common.source, { observation_date: manifest.run_date, generation_id: `obs-${manifest.run_date}-0123456789abcdef` });
  common.core_sha256 = manifest.files.core.sha256; common.details_sha256 = manifest.files.details.sha256;
  const source = Object.fromEntries(['generation_id','observation_date','observation_state','contract_digest'].map(key => [key,common.source[key]]));
  manifest.source_observation = source;
  manifest.optional_product_evidence_status = { schema: 'ar-product-evidence-status-v1', source, lanes: {} };
  const assets = {};
  function pack(family, kind, value) {
    const body = Buffer.from(canonicalTermsJson(value)), bytes = gzipSync(body), sha256 = hash(bytes);
    const item = { name: `${family}-${kind}-${sha256}.json.gz`, bytes: bytes.length, decoded_bytes: body.length, sha256 };
    assets[item.name] = bytes; fs.writeFileSync(path.join(directory,item.name),bytes); return item;
  }
  for (const [lane, family, fixture] of [['product_evidence_v1','product-evidence',facts], ['product_response_evidence_v1','product-response',response]]) {
    const capability = fixture.prepared.capability;
    capability.binding = lane === 'product_evidence_v1' ? structuredClone(common) : { ...capability.binding, facts: structuredClone(common) };
    const old = capability.shards, remap = new Map();
    capability.shards = old.map((entry, position) => {
      const shard = JSON.parse(fixture.assets[entry.name]); shard.binding = capability.binding;
      mutate(lane, 'shard', shard, position);
      const item = pack(family,'shard',shard); remap.set(entry.sha256,item.sha256); return item;
    });
    const index = JSON.parse(fixture.assets[capability.index.name]); index.binding = capability.binding;
    if (lane === 'product_evidence_v1') for (const product of index.products) for (const page of product.pages) page.shard = remap.get(page.shard);
    else for (const body of index.bodies) for (const chunk of body.chunks) chunk.shard = remap.get(chunk.shard);
    mutate(lane,'index',index);
    capability.index = pack(family,'index',index); mutate(lane,'capability',capability);
    const descriptor = pack(family,'capability',capability);
    manifest[lane] = { schema: lane === 'product_evidence_v1' ? 'ar-product-evidence-reference-v1' : 'ar-product-response-evidence-reference-v1',
      source, core_sha256: common.core_sha256, details_sha256: common.details_sha256, capability: descriptor };
    manifest.optional_product_evidence_status.lanes[lane] = { state:'available', reason:'verified' };
  }
  function seal() {
    if (revision) {
      const bundle = payloadBundleIdentity(manifest);
      manifest.payload_revision = { schema_version:1,revision:1,parent_revision:null,bundle_sha256:bundle,generation_id:'sha256-'+bundle };
    }
    const raw = Buffer.from(canonicalTermsJson(manifest)); fs.writeFileSync(path.join(directory,'manifest.json'),raw);
    return { revision:1,bundle_sha256:manifest.payload_revision?.bundle_sha256,generation_id:manifest.payload_revision?.generation_id,
      manifest_sha256:hash(raw),manifest_url:prefix+'manifest.json' };
  }
  const head = seal();
  return { directory, manifest, head, assets, seal, options:{repo:manifest.repo,date:null,directory,output:null} };
}
module.exports = { candidate, hash };
