#!/usr/bin/env node
'use strict';

// Reuse the audit's bounded, redirect-refusing Cloudflare transport and its
// checked-in TypeScript loader. No archive inflation or history reconstruction.
const { fetchBytes } = require('./audit-public-payload.cjs');
const { createHash } = require('node:crypto');
const { parseDatesIndex } = require('../src/data/datesIndex.ts');
const { assertRevisionManifest } = require('../src/data/payloadRevision.ts');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');

const REPO = 'yanniedog/AR-local';
const BASE = `https://github.com/${REPO}/releases/download/`;
const MAX_METADATA_BYTES = 4 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

async function verifyPublicDelivery() {
  const transports = [];
  const nonce = Date.now();
  const read = (url) => fetchBytes(`${url}?_=${nonce}`, MAX_METADATA_BYTES, REPO, transports);
  const indexBytes = await read(`${BASE}app-payload-latest/dates-index.json`);
  const rawIndex = parse(indexBytes);
  const index = parseDatesIndex(rawIndex, REPO);
  if (!index || index.revision_protocol !== 1 || rawIndex.latest_date !== index.latest_date) {
    throw new Error('Public delivery index has no valid current revision selection');
  }
  const head = index.revision_heads[index.latest_date];
  const latestBytes = await read(`${BASE}app-payload-latest/manifest.json`);
  const manifest = parse(latestBytes);
  if (hash(latestBytes) !== head.manifest_sha256) {
    throw new Error('Rolling manifest does not match the current index-selected manifest SHA-256');
  }
  assertRevisionManifest(manifest, head, index.latest_date, REPO);
  const bundle = payloadBundleIdentity(manifest);
  if (bundle !== head.bundle_sha256 || head.generation_id !== `sha256-${bundle}`) {
    throw new Error('Public delivery manifest bundle identity mismatch');
  }
  const selectedBytes = await read(head.manifest_url);
  if (hash(selectedBytes) !== head.manifest_sha256 || !selectedBytes.equals(latestBytes)) {
    throw new Error('Immutable selected manifest differs from the verified rolling manifest');
  }
  // Existing canonical publishers need no new marker. Prove that the service
  // actually serves the two required domain assets, not just readable selectors.
  const assets = {};
  for (const name of ['core', 'details']) {
    const file = manifest.files[name];
    const bytes = await fetchBytes(file.url, file.bytes, REPO, transports);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) {
      throw new Error(`Public delivery ${name} asset size/SHA-256 mismatch`);
    }
    assets[name] = { bytes: bytes.length, sha256: file.sha256 };
  }
  return {
    status: 'PASS', delivery_mode: 'cloudflare-service', assets,
    run_date: index.latest_date, revision: head.revision,
    manifest_url: head.manifest_url, manifest_sha256: head.manifest_sha256,
    bundle_sha256: bundle, dates_index_sha256: hash(indexBytes),
    public_transport: transports,
  };
}

if (require.main === module) {
  verifyPublicDelivery().then(
    (receipt) => process.stdout.write(JSON.stringify(receipt, null, 2) + '\n'),
    (error) => { console.error(`Public delivery release gate: ${error.message}`); process.exitCode = 1; },
  );
}
module.exports = { verifyPublicDelivery };
