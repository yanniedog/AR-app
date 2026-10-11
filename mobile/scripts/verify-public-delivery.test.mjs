import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { verifyPublicDelivery } = require('./verify-public-delivery.cjs');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const { automaticDataUrl } = require('../src/lib/automaticDataAccess.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value));
const base = 'https://github.com/yanniedog/AR-local/releases/download/';

function fixture(change = () => {}) {
  const date = '2026-10-11', tag = `app-payload-${date}-r000002`;
  const assets = Object.fromEntries(['core', 'details'].map(key => [key, gzipSync(encode({ [key]: true }))]));
  const manifest = { schema_version: 1, run_date: date, repo: 'yanniedog/AR-local', tag,
    files: Object.fromEntries(['core', 'details'].map(key => [key, {
      name: `${key}.json.gz`, url: `${base}${tag}/${key}.json.gz`, bytes: assets[key].length, sha256: hash(assets[key]),
    }])) };
  change(manifest);
  const bundle = payloadBundleIdentity(manifest);
  manifest.payload_revision = { schema_version: 1, revision: 2, parent_revision: 1,
    bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  const manifestBytes = encode(manifest);
  const head = { revision: 2, generation_id: `sha256-${bundle}`, bundle_sha256: bundle,
    manifest_url: `${base}${tag}/manifest.json`, manifest_sha256: hash(manifestBytes) };
  const index = { schema_version: 1, revision_protocol: 1, dates: [date], latest_date: date,
    revision_heads: { [date]: head } };
  return { manifest, manifestBytes, head, index, assets };
}

function serve(t, data, alter = (_url, bytes) => ({ bytes })) {
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(url);
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://ar-app-data.jkokavec.workers.dev');
    if (parsed.pathname.endsWith('.json')) assert.ok(parsed.searchParams.get('_'));
    parsed.search = '';
    const documents = {
      [automaticDataUrl(`${base}app-payload-latest/dates-index.json`)]: encode(data.index),
      [automaticDataUrl(`${base}app-payload-latest/manifest.json`)]: data.manifestBytes,
      [automaticDataUrl(data.head.manifest_url)]: data.manifestBytes,
      ...Object.fromEntries(Object.entries(data.manifest.files).map(([key, file]) => [automaticDataUrl(file.url), data.assets[key]])),
    };
    assert.ok(documents[parsed.href], 'only metadata and required domain assets may be fetched');
    const changed = alter(parsed.href, documents[parsed.href]);
    const response = new Response(changed.bytes, { status: changed.status ?? 200, headers: changed.headers });
    return { url: changed.finalUrl ?? url, status: response.status, ok: response.ok,
      headers: response.headers, body: response.body };
  };
  t.after(() => { globalThis.fetch = previous; });
  return calls;
}

test('existing canonical publication verifies Cloudflare selectors and required bytes without a delivery marker', async t => {
  const data = fixture(), calls = serve(t, data);
  const receipt = await verifyPublicDelivery();
  assert.equal(receipt.status, 'PASS');
  assert.equal(receipt.manifest_sha256, data.head.manifest_sha256);
  assert.equal(receipt.revision, 2);
  assert.equal(calls.length, 5);
  assert.equal(receipt.public_transport.length, 5);
  assert.equal(receipt.delivery_mode, 'cloudflare-service');
  assert.ok(receipt.public_transport.every(item => item.route === 'cloudflare_service'));
});

for (const key of ['core', 'details']) {
  test(`a corrupt ${key} domain asset holds publication`, async t => {
    const data = fixture();
    serve(t, data, (url, bytes) => ({ bytes: url.endsWith(`/${key}.json.gz`) ? Buffer.alloc(bytes.length) : bytes }));
    await assert.rejects(verifyPublicDelivery(), /asset size\/SHA-256 mismatch/);
  });
}

test('a stale rolling selector cannot publish even when the selected revision is available', async t => {
  const data = fixture();
  serve(t, data, (url, bytes) => ({ bytes: url.includes('/app-payload-latest/manifest.json') ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes }));
  await assert.rejects(verifyPublicDelivery(), /Rolling manifest does not match/);
});

test('a missing or changed immutable mirror cannot authorize publication', async t => {
  const data = fixture();
  serve(t, data, (url, bytes) => ({ bytes: url.includes('/app-payload-2026-') ? Buffer.from('{}') : bytes }));
  await assert.rejects(verifyPublicDelivery(), /Immutable selected manifest differs/);
});

test('an index cannot grant access to another repository', async t => {
  const data = fixture();
  data.head.manifest_url = data.head.manifest_url.replace('AR-local', 'AR-app');
  const calls = serve(t, data);
  await assert.rejects(verifyPublicDelivery(), /no valid current revision selection/);
  assert.equal(calls.length, 1);
});

test('self-consistent manifest bytes still require the bundle preimage to match', async t => {
  const data = fixture();
  data.manifest.files.core.bytes++;
  data.manifestBytes = encode(data.manifest);
  data.head.manifest_sha256 = hash(data.manifestBytes);
  serve(t, data);
  await assert.rejects(verifyPublicDelivery(), /bundle identity mismatch/);
});

for (const status of [404, 503, 302]) {
  test(`HTTP ${status} fails closed with no alternative route`, async t => {
    const calls = serve(t, fixture(), () => ({ status, bytes: null,
      headers: { location: 'https://example.invalid/payload' } }));
    await assert.rejects(verifyPublicDelivery(), status === 302 ? /redirect/ : /HTTP/);
    assert.equal(calls.length, 1);
  });
}

test('an oversized metadata stream is bounded before JSON parsing', async t => {
  serve(t, fixture(), () => ({ bytes: Buffer.alloc(4 * 1024 * 1024 + 1, 32) }));
  await assert.rejects(verifyPublicDelivery(), /byte limit/);
});

test('public APK dispatch is checked before build and immediately before publication, artifact-only push is unaffected', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url), 'utf8');
  const early = workflow.indexOf('- name: Verify Cloudflare payload delivery before release build');
  assert.ok(early > workflow.indexOf('- name: Install dependencies'));
  assert.ok(early < workflow.indexOf('- name: Materialize Firebase config'));
  assert.match(workflow.slice(early, workflow.indexOf('- name: Materialize Firebase config')),
    /if: github.event_name == 'workflow_dispatch'\s+run: node scripts\/verify-public-delivery.cjs/);
  const publication = workflow.split('- name: Publish preview APK manifest (GitHub release)')[1]
    .split('- name: Queue ARM channel')[0];
  assert.match(publication, /if: github.event_name == 'workflow_dispatch'/);
  assert.ok(publication.indexOf('verify-public-delivery.cjs') < publication.indexOf('publish-apk-manifest.mjs'));
  assert.equal(workflow.match(/node scripts\/verify-public-delivery.cjs/g)?.length, 2);
});
