'use strict';

// Complete sequential audit, not the UI reader. No global fact/body text list.
const { createHash } = require('node:crypto');
const { validateEvidenceIndex, validateEvidenceShard, sameEvidence } = require('../src/data/productEvidenceWire.ts');
const { validateResponseIndex } = require('../src/data/productResponseIndex.ts');
const { validateResponseShard, responseUtf8 } = require('../src/data/productResponseWire.ts');
const MAX_PENDING_BYTES = 64 * 1024 ** 2;
const MAX_PENDING_IDS = 250000;
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };

async function auditFacts(capability, load, check) {
  const index = validateEvidenceIndex(await load(capability.index, 0), capability);
  const routes = new Map(), states = new Map();
  for (const route of index.products) {
    states.set(route.identity.product_key, { left: route.pages.length, ids: new Set(), bytes: 0 });
    route.pages.forEach((page, sequence) => {
      if (!routes.has(page.shard)) routes.set(page.shard, new Map());
      routes.get(page.shard).set(page.page, { route, sequence, facts: page.facts });
    });
  }
  let facts = 0, pendingBytes = 0, pendingIds = 0;
  for (const [position, descriptor] of capability.shards.entries()) {
    check();
    const shard = validateEvidenceShard(await load(descriptor, position + 1), capability);
    const wanted = routes.get(descriptor.sha256);
    requireValue(shard.pages.length === wanted.size, 'Evidence shard has missing/unrouted pages');
    shard.pages.forEach((page, number) => {
      check(); const expected = wanted.get(number);
      requireValue(expected && sameEvidence(page.identity, expected.route.identity)
        && page.sequence === expected.sequence && page.facts.length === expected.facts, 'Evidence routed page mismatch');
      const state = states.get(page.identity.product_key);
      for (const fact of page.facts) {
        requireValue(!state.ids.has(fact.fact_id), 'Duplicate product fact across audit pages');
        const size = Buffer.byteLength(fact.fact_id) + 32;
        pendingBytes += size; pendingIds++;
        requireValue(pendingBytes <= MAX_PENDING_BYTES && pendingIds <= MAX_PENDING_IDS, 'Evidence audit pending-ID budget exceeded');
        state.ids.add(fact.fact_id); state.bytes += size; facts++;
      }
      if (--state.left === 0) {
        requireValue(state.ids.size === expected.route.facts, 'Evidence product fact count differs');
        pendingBytes -= state.bytes; pendingIds -= state.ids.size; states.delete(page.identity.product_key);
      }
    });
  }
  requireValue(states.size === 0 && facts === capability.facts, 'Incomplete evidence inventory');
  return { products: capability.products, facts };
}

async function auditResponses(capability, load, check) {
  const index = validateResponseIndex(await load(capability.index, 0), capability);
  const states = new Map(index.bodies.map(body => [body.sha256,
    { bytes: body.bytes, offset: 0, hash: createHash('sha256'), pending: new Map() }]));
  let pendingBytes = 0, bodies = 0;
  for (const [position, descriptor] of capability.shards.entries()) {
    check();
    const shard = validateResponseShard(await load(descriptor, position + 1), capability, index, descriptor.sha256);
    for (const page of shard.pages) {
      check(); const state = states.get(page.sha256);
      requireValue(state && page.offset >= state.offset && !state.pending.has(page.offset), 'Duplicate/outdated original response chunk');
      const bytes = Buffer.from(responseUtf8(page.text));
      pendingBytes += bytes.length;
      requireValue(pendingBytes <= MAX_PENDING_BYTES, 'Evidence audit pending-body budget exceeded');
      state.pending.set(page.offset, bytes);
      while (state.pending.has(state.offset)) {
        const next = state.pending.get(state.offset); state.pending.delete(state.offset);
        state.hash.update(next); state.offset += next.length; pendingBytes -= next.length;
      }
      if (state.offset === state.bytes) {
        requireValue(state.pending.size === 0 && state.hash.digest('hex') === page.sha256, 'Original response body hash mismatch');
        states.delete(page.sha256); bodies++;
      }
    }
  }
  requireValue(states.size === 0 && bodies === capability.bodies, 'Incomplete original response inventory');
  return { products: capability.products, bodies,
    route_states: Object.fromEntries(['matched','ambiguous','projection_unverified','index_only','missing']
      .map(state => [state, index.products.filter(product => product.state === state).length])) };
}

module.exports = { auditFacts, auditResponses, MAX_PENDING_BYTES, MAX_PENDING_IDS };
