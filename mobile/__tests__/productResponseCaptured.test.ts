import { gzipSync } from 'node:zlib';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import fixture from './fixtures/product-response-real-wire.json';
import { canonicalTermsJson } from '../src/data/productTerms';
import { createProductResponseReader, type ResponseLoader } from '../src/data/productResponseTransport';
import { validateResponseIndex } from '../src/data/productResponseIndex';
import { validateResponseCapability, type ResponseCapability, type ResponseIndex, type ResponseShard } from '../src/data/productResponseWire';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const hash = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));
const capability = fixture.prepared.capability as ResponseCapability;
const assets = fixture.assets as Record<string, string>;
const index = JSON.parse(assets[capability.index.name]) as ResponseIndex;
const matched = index.products.find(product => product.state === 'matched')!, key = matched.identity.product_key;
const edition = { repo: 'yanniedog/AR-local' as const, tag: `app-payload-${capability.binding.facts.source.observation_date}-r000001`, bundle_sha256: 'c'.repeat(64) };
function setup(cap = capability, textAssets = assets, overrides: { load?: ResponseLoader; isCurrent?: () => boolean } = {}) {
  const load = jest.fn(async (_url: string, item: { name: string }) => textAssets[item.name]);
  const value = createProductResponseReader({ capability: cap, binding: cap.binding, edition, isCurrent: () => true, load, ...overrides });
  return { value, load };
}
/** Re-hash changed technical envelope controls; unchanged financial observations stay captured. */
function repack(changed: ResponseIndex, shards: ResponseShard[]) {
  const cap = copy(capability), textAssets: Record<string, string> = {}, remap = new Map<string, string>();
  cap.shards = shards.map((shard, i) => {
    const text = canonicalTermsJson(shard), compressed = gzipSync(utf8ToBytes(text)), sha = bytesToHex(sha256(compressed));
    const descriptor = { name: `product-response-shard-${sha}.json.gz`, sha256: sha, bytes: compressed.length, decoded_bytes: utf8ToBytes(text).length };
    textAssets[descriptor.name] = text; remap.set(capability.shards[i].sha256, sha); return descriptor;
  });
  for (const body of changed.bodies) for (const chunk of body.chunks) chunk.shard = remap.get(chunk.shard)!;
  const text = canonicalTermsJson(changed), compressed = gzipSync(utf8ToBytes(text)), sha = bytesToHex(sha256(compressed));
  cap.index = { name: `product-response-index-${sha}.json.gz`, sha256: sha, bytes: compressed.length, decoded_bytes: utf8ToBytes(text).length };
  cap.bodies = changed.bodies.length; cap.products = changed.products.length; textAssets[cap.index.name] = text;
  return setup(cap, textAssets);
}

test('Python-produced original bodies remain byte-exact; default only reads uniquely matched body', async () => {
  validateResponseCapability(capability, capability.binding); validateResponseIndex(index, capability);
  for (const route of index.products) {
    const { value, load } = setup();
    const result = await value.readProduct(route.identity.product_key);
    if (route.state !== 'matched') {
      expect(result).toMatchObject({ status: 'unknown', reason: 'no_unique_current_body', route: { state: route.state } });
      expect(load).toHaveBeenCalledTimes(1); continue;
    }
    expect(result.status).toBe('observed'); if (result.status !== 'observed') throw new Error('No captured body');
    expect(result.text).toBe(fixture.original_bodies[route.identity.product_key as keyof typeof fixture.original_bodies]);
    expect(hash(result.text)).toBe(route.current_body_sha256);
    expect(result).toMatchObject({ role: 'detail', currentMatchesExport: true, renderedCoverageVerified: false,
      wireBytesIncluded: false, populationCompletenessVerified: false });
    expect(load).toHaveBeenCalledTimes(1 + new Set(result.body.chunks.map(chunk => chunk.shard)).size);
  }
});
test('unverified detail and index need explicit selection and never become current', async () => {
  const route = index.products.find(product => product.state === 'projection_unverified')!;
  const raw = await setup().value.readProduct(route.identity.product_key, { bodySha: route.details[0].sha256 });
  expect(raw).toMatchObject({ status: 'observed', role: 'detail', currentMatchesExport: false });
  if (raw.status === 'observed') expect(raw.text).toBe(fixture.original_bodies[route.identity.product_key as keyof typeof fixture.original_bodies]);
  expect(await setup().value.readProduct(key, { bodySha: matched.indexes[0] })).toMatchObject({ status: 'observed', role: 'index', currentMatchesExport: false });
});
test('raw-body tampering is rejected even when changed shard/index asset hashes agree', async () => {
  const changed = copy(index), shards = capability.shards.map(item => JSON.parse(assets[item.name]) as ResponseShard);
  const body = changed.bodies.find(item => item.sha256 === matched.current_body_sha256)!, chunk = body.chunks[0];
  const page = shards[0].pages[chunk.page]; page.text = page.text.replace(' ', '\t');
  expect(page.text).not.toBe((JSON.parse(assets[capability.shards[0].name]) as ResponseShard).pages[chunk.page].text);
  await expect(repack(changed, shards).value.readProduct(key)).rejects.toThrow('Original response hash/size');
});
test('wrong product/provider, duplicate events, missing and noncontiguous chunks fail', () => {
  for (const kind of ['provider', 'sequence', 'offset', 'bytes']) {
    const changed = copy(index);
    if (kind === 'provider') changed.products[0].provider_uid = 'different';
    if (kind === 'sequence') changed.bodies[1].events[0].sequence = changed.bodies[0].events[0].sequence;
    if (kind === 'offset') changed.bodies[0].chunks[0].offset = 1;
    if (kind === 'bytes') changed.bodies[0].bytes++;
    expect(() => validateResponseIndex(changed, capability)).toThrow();
  }
});
test('one chosen body cannot bypass aggregate limits by using many individually valid shards', () => {
  const changed = copy(index), cap = copy(capability), route = changed.products.find(product => product.identity.product_key === key)!;
  const body = changed.bodies.find(item => item.sha256 === route.current_body_sha256)!;
  changed.products = [route]; route.indexes = []; changed.bodies = [body]; cap.products = 1; cap.bodies = 1;
  cap.shards = Array.from({ length: 17 }, (_, i) => {
    const sha = (i + 100).toString(16).padStart(64, '0');
    return { name: `product-response-shard-${sha}.json.gz`, sha256: sha, bytes: 100, decoded_bytes: 4 * 1024 ** 2 };
  });
  body.bytes = 17; body.chunks = cap.shards.map((item, offset) => ({ shard: item.sha256, page: 0, offset, bytes: 1 }));
  validateResponseCapability(cap, cap.binding);
  expect(() => validateResponseIndex(changed, cap)).toThrow('cumulative budget');
});
test('original body and individual asset ceilings reject byte-plus-one claims', () => {
  const changed = copy(index); changed.bodies[0].bytes = 32 * 1024 ** 2 + 1;
  expect(() => validateResponseIndex(changed, capability)).toThrow('original response body');
  const cap = copy(capability); cap.shards[0].decoded_bytes = 4 * 1024 ** 2 + 1;
  expect(() => validateResponseCapability(cap, cap.binding)).toThrow('asset');
});
test('abort and edition drift during a shard cannot adopt original evidence', async () => {
  for (const kind of ['abort', 'edition']) {
    const abort = new AbortController(); let current = true;
    const load: ResponseLoader = async (_url, descriptor) => {
      if (descriptor.name !== capability.index.name) { if (kind === 'abort') abort.abort(); else current = false; }
      return assets[descriptor.name];
    };
    await expect(setup(capability, assets, { load, isCurrent: () => current }).value.readProduct(key, { signal: abort.signal }))
      .rejects.toMatchObject({ code: kind === 'abort' ? 'cancelled' : 'unavailable' });
  }
});
test('ambiguous byte-distinct original versions never receive an implicit current selection', async () => {
  const changed = copy(index), shards = capability.shards.map(item => JSON.parse(assets[item.name]) as ResponseShard);
  const route = changed.products.find(product => product.identity.product_key === key)!;
  const original = changed.bodies.find(body => body.sha256 === route.current_body_sha256)!, duplicate = copy(original);
  const page = copy(shards[0].pages[original.chunks[0].page]); page.text += '\n'; page.sha256 = hash(page.text); page.bytes++;
  duplicate.sha256 = page.sha256; duplicate.bytes++; duplicate.chunks[0].bytes++; duplicate.chunks[0].page = shards[0].pages.length;
  duplicate.events[0].sequence = 99999; duplicate.events[0].event_digest = '9'.repeat(64); shards[0].pages.push(page); changed.bodies.push(duplicate);
  route.details.push({ ...copy(route.details[0]), sha256: duplicate.sha256 }); route.state = 'ambiguous'; route.current_body_sha256 = null;
  const { value, load } = repack(changed, shards);
  expect(await value.readProduct(key)).toMatchObject({ status: 'unknown', route: { state: 'ambiguous' } }); expect(load).toHaveBeenCalledTimes(1);
  expect(await value.readProduct(key, { bodySha: duplicate.sha256 })).toMatchObject({ status: 'observed', currentMatchesExport: false, text: page.text });
});
test('multipart UTF8 chunks preserve added unknown/null/empty fields and numeric lexemes', async () => {
  const changed = copy(index), shards = capability.shards.map(item => JSON.parse(assets[item.name]) as ResponseShard);
  const route = changed.products.find(product => product.identity.product_key === key)!;
  const body = changed.bodies.find(item => item.sha256 === route.current_body_sha256)!, first = body.chunks[0];
  const page = shards[0].pages[first.page];
  // Protocol-extension controls add no invented financial products or rates.
  const raw = page.text.replace(/}\s*$/, ',"future":{"null":null,"empty":[],"text":"😀","precise":9007199254740993}}');
  const at = raw.indexOf('😀') + 2, chunks = [raw.slice(0, at), raw.slice(at)];
  const sha = hash(raw); route.current_body_sha256 = sha; route.details[0].sha256 = sha;
  body.sha256 = sha; body.bytes = utf8ToBytes(raw).length;
  const second = shards[0].pages.length;
  Object.assign(page, { sha256: sha, offset: 0, bytes: utf8ToBytes(chunks[0]).length, text: chunks[0] });
  shards[0].pages.push({ sha256: sha, offset: page.bytes, bytes: utf8ToBytes(chunks[1]).length, text: chunks[1] });
  body.chunks = [{ ...first, offset: 0, bytes: page.bytes }, { ...first, page: second, offset: page.bytes, bytes: utf8ToBytes(chunks[1]).length }];
  const result = await repack(changed, shards).value.readProduct(key);
  expect(result).toMatchObject({ status: 'observed', text: raw });
  if (result.status === 'observed') expect(hash(result.text)).toBe(sha);
});
