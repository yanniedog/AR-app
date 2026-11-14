/** Public status/edition controls around existing retained product evidence. */
import { createHash } from 'node:crypto';
import { evidenceSelection } from './productEvidenceSelection';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import type { EvidenceDeliveryState } from '../src/data/productEvidenceStatus';
import { EVIDENCE_STATUS_REASONS, EVIDENCE_STATUS_SCHEMA } from '../src/data/productEvidenceStatus';

export function statusSelection(state: EvidenceDeliveryState = 'available') {
  const p = evidenceSelection();
  p.manifest.optional_product_evidence_status = { schema: EVIDENCE_STATUS_SCHEMA, source: { ...p.ref.source }, lanes: {
    product_evidence_v1: { state, reason: EVIDENCE_STATUS_REASONS[state][0] },
    product_response_evidence_v1: { state: 'disabled', reason: 'disabled_by_configuration' },
  } };
  if (state !== 'available') delete p.manifest.product_evidence_v1;
  function seal(revision = 1) {
    const tag = `app-payload-${p.manifest.run_date}-r${String(revision).padStart(6, '0')}`;
    p.manifest.tag = tag;
    const prefix = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
    for (const entry of Object.values(p.manifest.files)) entry.url = prefix + entry.name;
    const bundle = payloadBundleIdentity(p.manifest);
    p.manifest.payload_revision = { schema_version: 1, revision, parent_revision: revision === 1 ? null : revision - 1,
      generation_id: `sha256-${bundle}`, bundle_sha256: bundle };
    Object.assign(p.head, { revision, generation_id: `sha256-${bundle}`, manifest_url: prefix + 'manifest.json',
      manifest_sha256: createHash('sha256').update(JSON.stringify(p.manifest)).digest('hex'), bundle_sha256: bundle });
    return p.head;
  }
  seal(); return { ...p, seal };
}
