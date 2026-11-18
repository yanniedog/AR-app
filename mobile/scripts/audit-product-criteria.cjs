'use strict';
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { TextDecoder } = require('node:util');
const { performance } = require('node:perf_hooks');
const { createProductCriteriaReader } = require('../src/data/productCriteriaTransport.ts');
const { productDocumentActions } = require('../src/data/productDocuments.ts');

async function auditProductCriteria({ manifest, read, publicTransportVerified = false }) {
  const advertised = Object.keys(manifest.files).some(key => key.startsWith('product_criteria_'));
  const receipt = { schema: 'ar-product-criteria-audit-v1', status: advertised ? 'FAIL' : 'ABSENT', advertised,
    scope: 'product-filter-facets-v1', acquired: false, source_current: false, product_routes_complete: false,
    source_fields_complete: null, legal_completeness_verified: false, rendered_coverage_verified: false,
    public_transport_verified: false, products_expected: null, products_observed: 0, facts: 0,
    facet_kinds: {}, evidence_states: {}, documents: { total: 0, specificity: {}, relevance: {}, retrieval: {}, openable: 0, unavailable: 0, checked: 0, homepage: 0, verified_product_evidence: 0 } };
  if (!advertised) return receipt;
  const deadline = performance.now() + 600000;
  try {
    const reader = createProductCriteriaReader(manifest, { isCurrent: () => performance.now() < deadline,
      yieldControl: () => new Promise(resolve => setImmediate(resolve)),
      load: async (file, maximum) => {
        const bytes = await read(file, Math.max(1, Math.min(60000, Math.floor(deadline - performance.now()))));
        if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256
          || bytes[0] !== 31 || bytes[1] !== 139) throw new Error('Criteria asset size/hash/encoding mismatch');
        return new TextDecoder('utf-8', { fatal: true }).decode(gunzipSync(bytes, { maxOutputLength: maximum }));
      } });
    const products = await reader.read();
    receipt.products_expected = receipt.products_observed = Object.keys(products).length;
    const increment = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1; };
    for (const detail of Object.values(products)) {
      for (const fact of detail.facts) { receipt.facts++; increment(receipt.facet_kinds, fact.kind);
        increment(receipt.evidence_states, fact.evidenceState ?? (fact.condition ? 'conditional' : fact.value === undefined ? 'unknown' : 'observed')); }
      for (const action of productDocumentActions(detail)) {
        const doc = receipt.documents; doc.total++; increment(doc.specificity, action.specificity); increment(doc.relevance, action.relevance);
        increment(doc.retrieval, action.document.verification ?? 'unknown');
        if (action.url) doc.openable++; else doc.unavailable++;
        if (action.document.checkedAt) doc.checked++;
        if (action.specificity === 'background') doc.homepage++;
        else if (action.relevance === 'verified') doc.verified_product_evidence++;
      }
    }
    Object.assign(receipt, { status: 'PASS', acquired: true, source_current: true, product_routes_complete: true, public_transport_verified: publicTransportVerified });
  } catch (error) { receipt.error = error.message; }
  return receipt;
}
module.exports = { auditProductCriteria };
