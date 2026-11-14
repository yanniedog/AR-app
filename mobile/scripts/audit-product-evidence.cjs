'use strict';

const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { TextDecoder } = require('node:util');
const { performance } = require('node:perf_hooks');
const { validateEvidenceCandidate, validateEvidencePublication, validateDetachedCapability,
  checkCommonEvidenceBinding, EVIDENCE_REFERENCE_SCHEMAS } = require('../src/data/productEvidencePublication.ts');
const { EVIDENCE_LIMITS, parseEvidenceJson } = require('../src/data/productEvidenceWire.ts');
const { RESPONSE_LIMITS, parseResponseJson } = require('../src/data/productResponseWire.ts');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const { auditFacts, auditResponses } = require('./audit-product-evidence-inventory.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const lanes = Object.keys(EVIDENCE_REFERENCE_SCHEMAS);
const hasEvidence = manifest => Object.keys(manifest).some(key => key === 'optional_product_evidence_status'
  || key.startsWith('product_evidence_') || key.startsWith('product_response_evidence_'));

async function auditProductEvidence({ manifest, manifestSha, head, directory, financialAssets, read, publicTransportVerified = false }) {
  if (!hasEvidence(manifest)) return null;
  const assets = {}, summary = {}, receipt = { schema: 'ar-product-evidence-audit-v1', status: 'FAIL', manifest_sha256: manifestSha,
    scope: directory ? 'private_candidate' : 'public_selected', lanes: {}, namespace_validation_complete: false,
    selected_head_verified: false, public_transport_verified: false, rendered_coverage_verified: false,
    population_completeness_verified: false, original_wire_bytes_verified: false };
  const deadline = performance.now() + 600000;
  const check = () => { if (performance.now() >= deadline) throw new Error('Evidence audit deadline exceeded'); };
  let lastCapability;
  try {
    if (Object.keys(manifest).some(key => (key.startsWith('product_evidence_') || key.startsWith('product_response_evidence_')) && !lanes.includes(key))) {
      const error = new Error('Unsupported evidence namespace'); error.code = 'unsupported'; throw error;
    }
    if (!directory && (!head || head.manifest_sha256 !== manifestSha)) throw new Error('Evidence audit requires actual selected manifest bytes');
    if (!directory && !publicTransportVerified) throw new Error('Evidence audit requires authenticated root/financial transport');
    const accepted = directory ? validateEvidenceCandidate(manifest) : validateEvidencePublication(manifest, head);
    if (manifest.payload_revision && (manifest.payload_revision.bundle_sha256 !== payloadBundleIdentity(manifest)
        || manifest.payload_revision.generation_id !== 'sha256-' + payloadBundleIdentity(manifest))) throw new Error('Evidence bundle identity mismatch');
    if (['core','details'].some(key => financialAssets[key]?.status !== 'PASS')) throw new Error('Evidence requires verified financial asset bytes');
    receipt.selected_head_verified = !directory;
    for (const lane of lanes) {
      const availability = accepted.availability[lane], reference = accepted.references[lane];
      const result = receipt.lanes[lane] = { state: availability.state, reason: availability.reason ?? null, verified_asset_count: 0 };
      if (reference.status === 'unsupported' || availability.reason === 'unsupported_delivery_schema') {
        const error = new Error('Unsupported evidence reference/status'); error.code = 'unsupported'; throw error;
      }
      if (reference.status === 'absent') continue;
      const limits = lane === 'product_evidence_v1' ? EVIDENCE_LIMITS : RESPONSE_LIMITS;
      let compressed = 0, decoded = 0;
      const acquire = async (item, key, parser, capability = false) => {
        check(); compressed += item.bytes; decoded += item.decoded_bytes;
        if (compressed > limits.totalCompressed + 65536 || decoded > limits.totalRaw + 65536) throw new Error('Evidence audit aggregate budget exceeded');
        const bytes = await read(item, Math.max(1, Math.min(60000, Math.floor(deadline - performance.now()))));
        check();
        if (bytes.length !== item.bytes || hash(bytes) !== item.sha256 || bytes[0] !== 31 || bytes[1] !== 139) throw new Error('Evidence asset size/hash/encoding mismatch');
        const raw = gunzipSync(bytes, { maxOutputLength: item.decoded_bytes });
        if (raw.length !== item.decoded_bytes) throw new Error('Evidence decoded size mismatch');
        const value = parser(new TextDecoder('utf-8', { fatal: true }).decode(raw), item.decoded_bytes);
        assets[key] = { status: 'PASS', sha256: item.sha256, bytes: bytes.length, decoded_bytes: raw.length,
          acquisition: directory ? 'local_file' : 'public_http', capability };
        result.verified_asset_count++; check(); return value;
      };
      const ref = reference.reference;
      const capability = validateDetachedCapability(await acquire(ref.capability, lane+'_capability', parseResponseJson, true), lane, ref);
      if (lastCapability) checkCommonEvidenceBinding(lastCapability, capability);
      lastCapability = capability;
      const load = (item, number) => acquire(item, lane+'_asset_'+String(number).padStart(3,'0'),
        lane === 'product_evidence_v1' ? parseEvidenceJson : parseResponseJson);
      const counts = await (lane === 'product_evidence_v1' ? auditFacts : auditResponses)(capability, load, check);
      summary[lane] = counts; check();
    }
    receipt.status = 'PASS'; receipt.namespace_validation_complete = true;
    // The read callback must enforce the authenticated service route in public mode.
    receipt.public_transport_verified = !directory;
  } catch (error) { receipt.status = error.code === 'unsupported' ? 'UNSUPPORTED' : 'FAIL'; receipt.error = error.message; }
  return { assets, receipt, summary };
}

module.exports = { auditProductEvidence, hasEvidence };
