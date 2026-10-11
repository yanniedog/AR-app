import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { audit, options, fetchBytes } = require('./audit-public-payload.cjs');
const { automaticDataUrl, APP_DATA_ORIGIN } = require('../src/lib/automaticDataAccess.ts');
const { upsertHistoricalCatalogueDay } = require('../src/data/historicalBankRateCatalogueMerge.ts');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const sample = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/sample');
const hash = (body) => createHash('sha256').update(body).digest('hex');

// Model the URL actually requested, rather than rewriting a Response.url to
// disguise delivery as GitHub. The response body uses Node's real byte stream.
function httpResponse(url, bytes = null, status = 200, headers = {}) {
  const response = new Response(bytes, { status, headers });
  return { url, status, ok: response.ok, headers: response.headers, body: response.body };
}

function mockFetch(t, implementation) {
  const previous = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = previous; });
}

function encryptedTransport(plain) {
  // Public deterministic fixture key, never an app or producer credential.
  const key = Buffer.alloc(32, 7), nonce = Buffer.alloc(12, 9);
  const id = createHash('sha256').update(Buffer.concat([Buffer.from('ar-local-payload-key:'), key])).digest('hex').slice(0, 32);
  const header = Buffer.alloc(44); header.write('ARE2' + id); header.writeUInt32BE(plain.length, 40);
  const cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(header);
  return Buffer.concat([header, nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}

const publication = 'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json';

test('public transport requests the shipping allowlisted service and retains the original identity', async t => {
  const bytes = gzipSync(Buffer.from('{"verified":"domain bytes"}')), transports = [];
  mockFetch(t, async (url, init) => {
    assert.equal(url, automaticDataUrl(publication));
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    return httpResponse(url, bytes);
  });
  assert.deepEqual(await fetchBytes(publication, bytes.length, 'yanniedog/AR-local', transports), bytes);
  assert.deepEqual(transports, [{ source_url: publication, requested_url: automaticDataUrl(publication),
    final_url: automaticDataUrl(publication), route: 'automatic_data_service' }]);
});

test('an actual unopened ARE2 wire envelope is rejected before index JSON parsing', async t => {
  const wire = encryptedTransport(Buffer.from('{"schema_version":1}'));
  assert.equal(wire.subarray(0, 4).toString(), 'ARE2');
  let requests = 0;
  mockFetch(t, async url => { requests++; return httpResponse(url, wire); });
  await assert.rejects(audit(options([])), /unopened ARE2 transport/);
  assert.equal(requests, 1);
});

for (const target of [
  'https://evil.invalid/manifest.json', publication.replace('AR-local', 'AR-app'),
  publication.replace('app-payload-latest', 'other-release'), publication + '?url=http://localhost',
  publication.replace('manifest.json', '..manifest.json'), automaticDataUrl(publication),
]) test(`public transport rejects an unapproved source ${target}`, async t => {
  mockFetch(t, () => { throw new Error('Invalid source reached transport'); });
  await assert.rejects(fetchBytes(target, 100), /Invalid publication source URL/);
});

for (const target of [APP_DATA_ORIGIN + '/other-path', publication, 'https://evil.invalid/manifest.json']) {
  test(`delivery redirect is rejected before following ${target}`, async t => {
    let requests = 0;
    mockFetch(t, async url => { requests++; return httpResponse(url, null, 302, { location: target }); });
    await assert.rejects(fetchBytes(publication, 100), /Unexpected publication redirect/);
    assert.equal(requests, 1);
  });
}

test('non-proxied GitHub releases retain bounded approved CDN redirects and actual provenance', async t => {
  const source = publication.replace('yanniedog/AR-local', 'example/payload'), bytes = Buffer.from('{}');
  const cdn = 'https://release-assets.githubusercontent.com/github-production-release-asset/123/asset?token=example';
  const calls = [], transports = [];
  mockFetch(t, async (url, init) => {
    calls.push({ url, signal: init.signal });
    return url === source ? httpResponse(url, null, 302, { location: cdn }) : httpResponse(url, bytes);
  });
  assert.deepEqual(await fetchBytes(source, 100, 'example/payload', transports), bytes);
  assert.deepEqual(calls.map(call => call.url), [source, cdn]);
  assert.equal(calls[0].signal, calls[1].signal); // One deadline covers the entire acquisition.
  assert.deepEqual(transports, [{ source_url: source, requested_url: source, final_url: cdn, route: 'github_release' }]);
});

for (const target of ['https://evil.invalid/a', 'http://release-assets.githubusercontent.com/a',
  'https://user:secret@release-assets.githubusercontent.com/a', 'https://release-assets.githubusercontent.com:8443/a',
  publication, APP_DATA_ORIGIN + '/v1/release/app-payload-latest/manifest.json']) {
  test(`direct GitHub redirect cannot escape its trusted publication route to ${target}`, async t => {
    let requests = 0;
    mockFetch(t, async url => { requests++; return httpResponse(url, null, 302, { location: target }); });
    await assert.rejects(fetchBytes(publication.replace('yanniedog/AR-local', 'example/payload'), 100, 'example/payload'),
      /Invalid publication source URL|Unexpected publication redirect/);
    assert.equal(requests, 1);
  });
}

test('direct GitHub redirect loops stop at the bounded hop limit', async t => {
  const source = publication.replace('yanniedog/AR-local', 'example/payload');
  let requests = 0;
  mockFetch(t, async url => { requests++; return httpResponse(url, null, 302, { location: source }); });
  await assert.rejects(fetchBytes(source, 100, 'example/payload'), /Unexpected publication redirect/);
  assert.equal(requests, 6);
});

test('an unexpectedly followed or missing response identity cannot be disguised as approved delivery', async t => {
  let responseUrl;
  mockFetch(t, async () => httpResponse(responseUrl, Buffer.from('{}')));
  for (responseUrl of [publication, 'https://evil.invalid/a', '']) {
    await assert.rejects(fetchBytes(publication, 100), /Unexpected publication response URL/);
  }
});

test('byte limits, HTTP failures, and aborts propagate without an alternate transport', async t => {
  let requests = 0;
  const timeout = new DOMException('deadline expired', 'TimeoutError');
  mockFetch(t, async url => {
    requests++;
    if (requests === 1) return httpResponse(url, Buffer.from('12345'));
    if (requests === 2) return httpResponse(url, null, 503);
    throw timeout;
  });
  await assert.rejects(fetchBytes(publication, 4), /byte limit/);
  await assert.rejects(fetchBytes(publication, 100), /HTTP 503/);
  await assert.rejects(fetchBytes(publication, 100), error => error === timeout);
  assert.equal(requests, 3);
});

function candidate(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-app-private-audit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(fs.readFileSync(path.join(sample, 'manifest.json')));
  // Unmodified retained CDR bytes; only publication descriptor metadata changes.
  manifest.tag = `app-payload-${manifest.run_date}`;
  for (const file of Object.values(manifest.files)) {
    fs.copyFileSync(path.join(sample, file.name), path.join(directory, file.name));
    file.url = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${file.name}`;
  }
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { directory, manifest, opts: options(['--directory', directory]) };
}

test('private candidates verify local bytes without claiming public publication', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Private audit attempted a network request'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const report = await audit(opts);
  assert.equal(report.acquisition, 'private_candidate');
  assert.equal(report.publication_verified, false);
  assert.equal(report.manifest_url, null);
  assert.equal(report.dates_index_sha256, null);
  assert.equal(report.manifest_sha256, hash(fs.readFileSync(path.join(directory, 'manifest.json'))));
  for (const [key, file] of Object.entries(manifest.files)) {
    assert.equal(report.assets[key].status, 'PASS');
    assert.equal(report.assets[key].sha256, file.sha256);
    assert.equal(report.assets[key].url, null);
  }
  // Retained historical freshness/coverage warnings must remain visible.
  assert.notEqual(report.status, 'PASS');
});

test('private audit rejects a changed candidate asset without downloading a fallback', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  fs.appendFileSync(path.join(directory, manifest.files.core.name), ' ');
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.core.status, 'FAIL');
});

test('private audit binds an explicitly requested date', async (t) => {
  const { opts } = candidate(t);
  await assert.rejects(audit({ ...opts, date: '2026-08-06' }), /Manifest run\/repository mismatch/);
});

test('private audit rejects unsafe descriptor paths before reading them', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  manifest.files.core.name = '../core.json';
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.core.status, 'FAIL');
});

function detachedCandidate(t, editEnvelope = () => {}, editCatalogue = value => value) {
  const result = candidate(t), { directory, manifest } = result;
  const core = JSON.parse(fs.readFileSync(path.join(directory, manifest.files.core.name)));
  const details = JSON.parse(fs.readFileSync(path.join(directory, manifest.files.details.name)));
  const catalogue = editCatalogue(upsertHistoricalCatalogueDay(null, core, details, { kind: 'published_core',
    core_sha256: manifest.files.core.sha256, details_sha256: manifest.files.details.sha256,
    manifest_sha256: hash(fs.readFileSync(path.join(directory, 'manifest.json'))) }), core, details);
  const inner = Buffer.from(JSON.stringify(catalogue));
  const envelope = { schema_version: 1, run_date: manifest.run_date, core_sha256: manifest.files.core.sha256,
    catalogue: { sha256: hash(inner), bytes: inner.length, gzip_base64: gzipSync(inner).toString('base64') } };
  editEnvelope(envelope);
  const outer = gzipSync(Buffer.from(JSON.stringify(envelope)));
  const sha256 = hash(outer), name = `bank-rate-history-catalogue-${manifest.run_date}-${sha256.slice(0, 12)}.json.gz`;
  manifest.bank_rate_history_catalogue = { schema_version: 1, file: { name, sha256, bytes: outer.length,
    url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}` } };
  fs.writeFileSync(path.join(directory, name), outer);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { ...result, catalogue };
}

test('private candidate audits detached history bytes and retained real catalogue outside legacy files', async (t) => {
  const { opts, manifest, catalogue } = detachedCandidate(t);
  assert.equal(manifest.files.bank_rate_history_catalogue, undefined);
  const report = await audit(opts), proof = report.assets.bank_rate_history_catalogue;
  assert.equal(proof.status, 'PASS');
  assert.equal(proof.sha256, manifest.bank_rate_history_catalogue.file.sha256);
  assert.equal(proof.catalogue_sha256, hash(Buffer.from(JSON.stringify(catalogue))));
  assert.equal(proof.observed_dates, 1);
  assert.equal(proof.acquisition, 'local_file');
  assert.equal(report.publication_verified, false);
  assert.equal(report.historical_coverage_verified, null);
  assert.equal(proof.source_selection.status, 'NOT_CHECKED');
  assert.equal(proof.source_selection.selected_heads_checked, false);
  assert.equal(report.checks.find(check => check.code === 'bank-history-selected-sources').status, 'warn');
});

function publicCandidate(t, value, editIndex = () => {}, editRevision = () => {}, deliver = (_url, bytes) => bytes) {
  const { manifest, directory, catalogue } = value;
  const base = `https://github.com/${manifest.repo}/releases/download/`;
  manifest.tag = `app-payload-${manifest.run_date}-r000001`;
  for (const file of [...Object.values(manifest.files), manifest.bank_rate_history_catalogue.file]) file.url = `${base}${manifest.tag}/${file.name}`;
  const bundle = payloadBundleIdentity(manifest);
  manifest.payload_revision = { schema_version: 1, revision: 1, parent_revision: null,
    bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  editRevision(manifest.payload_revision);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const index = { schema_version: 1, revision_protocol: 1, dates: [...catalogue.run_dates],
    latest_date: manifest.run_date, min_date: catalogue.run_dates[0], count: catalogue.run_dates.length,
    revision_heads: Object.fromEntries(catalogue.run_dates.map(day => [day, {
      revision: 1, generation_id: manifest.payload_revision.generation_id, bundle_sha256: bundle,
      manifest_url: `${base}app-payload-${day}-r000001/manifest.json`,
      manifest_sha256: day === manifest.run_date ? hash(manifestBytes) : catalogue.sources[day]?.manifest_sha256 ?? 'd'.repeat(64),
    }])) };
  editIndex(index);
  const assets = new Map([[`${base}${manifest.tag}/manifest.json`, manifestBytes],
    [`${base}app-payload-latest/dates-index.json`, Buffer.from(JSON.stringify(index))],
    ...[...Object.values(manifest.files), manifest.bank_rate_history_catalogue.file].map(file =>
      [file.url, fs.readFileSync(path.join(directory, file.name))])]);
  const deliveredAssets = new Map([...assets].map(([url, bytes]) => [automaticDataUrl(url), bytes]));
  mockFetch(t, async url => {
    const clean = String(url).split('?')[0], bytes = deliveredAssets.get(clean);
    assert.ok(bytes, `Unexpected audit URL ${clean}`);
    return httpResponse(url, deliver(clean, bytes));
  });
  return options(['--repo', manifest.repo]);
}

test('opened public delivery bytes still must match the immutable domain size and digest', async t => {
  const value = detachedCandidate(t);
  const opts = publicCandidate(t, value, () => {}, () => {}, (url, bytes) => {
    if (!url.endsWith('/' + value.manifest.files.core.name)) return bytes;
    const changed = Buffer.from(bytes); changed[0] ^= 1; return changed;
  });
  const report = await audit(opts);
  assert.equal(report.assets.core.status, 'FAIL');
  assert.match(report.assets.core.error, /Asset size\/hash mismatch/);
  assert.equal(report.publication_verified, false);
});

test('automatic public delivery does not waive unsupported legacy domain encryption', async t => {
  const value = detachedCandidate(t);
  value.manifest.files.core.enc = { alg: 'aes-256-gcm', key_id: '12345678' };
  const report = await audit(publicCandidate(t, value));
  assert.equal(report.assets.core.status, 'FAIL');
  assert.match(report.assets.core.error, /Invalid public asset descriptor/);
  assert.equal(report.publication_verified, false);
  assert.ok(!report.public_transport.some(item => item.source_url === value.manifest.files.core.url));
});

for (const acquisition of ['public', 'private']) test(`${acquisition} audit rejects a stale generation even when the selected head agrees`, async t => {
  const value = detachedCandidate(t);
  const publicOpts = publicCandidate(t, value, () => {}, revision => { revision.generation_id = `sha256-${'f'.repeat(64)}`; });
  assert.equal(value.manifest.payload_revision.bundle_sha256, payloadBundleIdentity(value.manifest));
  fs.writeFileSync(path.join(value.directory, 'manifest.json'), JSON.stringify(value.manifest));
  await assert.rejects(audit(acquisition === 'public' ? publicOpts : value.opts), /Detached history bundle identity mismatch/);
});

test('public audit exposes a superseded current source without comparing its prior edition to the repackaged core', async t => {
  const value = detachedCandidate(t), opts = publicCandidate(t, value);
  const report = await audit(opts), proof = report.assets.bank_rate_history_catalogue;
  assert.equal(proof.status, 'PASS'); // The declared archive bytes are authentic.
  assert.equal(report.publication_verified, true);
  assert.ok(report.public_transport.length >= 5);
  assert.ok(report.public_transport.every(value => value.route === 'automatic_data_service' &&
    value.source_url.startsWith('https://github.com/') && value.final_url === automaticDataUrl(value.source_url)));
  assert.equal(report.historical_coverage_verified, false);
  assert.equal(proof.source_selection.status, 'WARN');
  assert.deepEqual(proof.source_selection.superseded_dates, [value.manifest.run_date]);
  assert.equal(report.checks.find(check => check.code === 'bank-history-selected-sources').status, 'warn');
});

for (const state of ['matching', 'superseded', 'missing-head', 'missing-source']) test(`public archive selection reports ${state} historical observations`, async t => {
  const prior = '2026-08-04';
  const value = detachedCandidate(t, () => {}, (catalogue, core, details) => {
    const result = upsertHistoricalCatalogueDay(catalogue, { ...core, run_date: prior }, { ...details, run_date: prior },
      { kind: 'published_core', core_sha256: 'a'.repeat(64), details_sha256: 'b'.repeat(64), manifest_sha256: 'c'.repeat(64) });
    result.sources[core.run_date] = { kind: 'selected_contract', generation_id: 'current-source',
      contract_digest: 'e'.repeat(64), banks_sha256: 'f'.repeat(64), bytes: 123 };
    if (state === 'missing-source') {
      delete result.sources[prior]; result.unavailable_dates[prior] = 'Source observation unavailable';
      for (const tiers of Object.values(result.sections)) for (const tier of tiers) tier.spans = tier.spans.flatMap(([start, count, rates, evidence]) =>
        start === 0 ? count > 1 ? [[1, count - 1, rates, evidence]] : [] : [[start, count, rates, evidence]]);
    }
    return result;
  });
  const opts = publicCandidate(t, value, index => {
    if (state === 'superseded') index.revision_heads[prior].manifest_sha256 = 'd'.repeat(64);
    if (state === 'missing-head') delete index.revision_heads[prior];
  });
  const report = await audit(opts), proof = report.assets.bank_rate_history_catalogue;
  assert.equal(proof.status, 'PASS');
  assert.equal(report.historical_coverage_verified, state === 'matching');
  assert.equal(proof.source_selection.independent_source_dates, 1);
  assert.deepEqual(proof.source_selection.missing_historical_dates, state === 'matching' ? [] : [prior]);
  assert.equal(proof.source_selection.status, state === 'matching' ? 'PASS' : 'WARN');
});

for (const [label, change] of [
  ['different core', value => { value.core_sha256 = 'f'.repeat(64); }],
  ['different day', value => { value.run_date = '2026-08-06'; }],
  ['inner digest mismatch', value => { value.catalogue.sha256 = 'f'.repeat(64); }],
  ['invalid base64', value => { value.catalogue.gzip_base64 += '\n'; }],
]) test(`private candidate rejects detached history ${label}`, async t => {
  const { opts } = detachedCandidate(t, change);
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.bank_rate_history_catalogue.status, 'FAIL');
});
