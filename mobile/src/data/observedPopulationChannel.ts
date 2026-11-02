import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { StandardUrl as URL } from '../lib/standardUrl';
import { APP_DATA_ORIGIN } from '../lib/automaticDataAccess';
import { isValidCalendarDate } from '../lib/calendarDate';
import type { Manifest } from '../types';
import { assertNoRevisionRollback, assertRevisionManifest, revisionTag, validateRevisionHead, type PayloadRevisionHead } from './payloadRevision';
import { payloadBundleIdentity } from './payloadBundleIdentity';

/** Dormant candidate channel. No config, store, transport or release feed opts in implicitly. */
export const OBSERVED_POPULATION_CAPABILITY = 'observed-population-v1' as const;
export const OBSERVED_POPULATION_REPO = 'yanniedog/AR-local';
export const OBSERVED_POPULATION_CANDIDATE_TAG = 'app-payload-observed-v1-candidate';
const GITHUB_PREFIX = `https://github.com/${OBSERVED_POPULATION_REPO}/releases/download/`;
export const OBSERVED_POPULATION_INDEX_URL = `${GITHUB_PREFIX}${OBSERVED_POPULATION_CANDIDATE_TAG}/dates-index.json`;
const CACHE_PREFIX = 'ar-rates:observed-population-v1/';

export interface ObservedPopulationIndex {
  schema_version: 1;
  channel: typeof OBSERVED_POPULATION_CAPABILITY;
  revision_protocol: 1;
  dates: string[];
  count: number;
  min_date: string;
  latest_date: string;
  revision_heads: Record<string, PayloadRevisionHead>;
}
export interface ObservedPopulationSelection {
  readonly channel: typeof OBSERVED_POPULATION_CAPABILITY;
  readonly manifest: Manifest;
  readonly manifestText: string;
  readonly manifestSha256: string;
  readonly cacheKey: string;
}
function reject(): never { throw new Error('Invalid observed-population candidate channel'); }
function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject();
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== keys.length || keys.some(key => !Object.hasOwn(obj, key))) return reject();
  return obj;
}
function requireCapability(value: unknown): void { if (value !== OBSERVED_POPULATION_CAPABILITY) reject(); }
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}

/** No version/header heuristic, arbitrary host, redirects, query aliases or legacy tag is accepted. */
export function observedPopulationTransportUrl(canonical: string, capability: unknown): string {
  requireCapability(capability);
  const url = new URL(canonical);
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || !canonical.startsWith(GITHUB_PREFIX)) return reject();
  const path = canonical.slice(GITHUB_PREFIX.length);
  const match = /^(app-payload-observed-v1-(?:candidate|\d{4}-\d{2}-\d{2}-r\d{6}))\/([A-Za-z0-9][A-Za-z0-9_.-]*\.json(?:\.gz(?:\.enc)?)?)$/.exec(path);
  if (!match || match[2].includes('..') || (match[1] === OBSERVED_POPULATION_CANDIDATE_TAG && match[2] !== 'dates-index.json')) return reject();
  return `${APP_DATA_ORIGIN}/v1/capabilities/${OBSERVED_POPULATION_CAPABILITY}/release/${path}`;
}

export function parseObservedPopulationIndex(value: unknown): ObservedPopulationIndex {
  const obj = exactObject(value, ['schema_version', 'channel', 'revision_protocol', 'dates', 'count', 'min_date', 'latest_date', 'revision_heads']);
  if (obj.schema_version !== 1 || obj.channel !== OBSERVED_POPULATION_CAPABILITY || obj.revision_protocol !== 1 ||
    !Array.isArray(obj.dates) || !obj.dates.length || obj.dates.length > 3660 ||
    obj.dates.some(day => typeof day !== 'string' || !isValidCalendarDate(day))) return reject();
  const dates = obj.dates as string[];
  if (dates.some((day, index) => index > 0 && day <= dates[index - 1]) || obj.count !== dates.length ||
    obj.min_date !== dates[0] || obj.latest_date !== dates.at(-1)) return reject();
  const rawHeads = exactObject(obj.revision_heads, dates);
  const heads = Object.fromEntries(dates.map(day => {
    const head = exactObject(rawHeads[day], ['revision', 'generation_id', 'manifest_url', 'manifest_sha256', 'bundle_sha256']);
    if (typeof head.revision !== 'number' || head.revision > 999999 || typeof head.generation_id !== 'string' ||
      !head.generation_id.trim() || head.generation_id.length > 200 || /[\u0000-\u001f\u007f]/.test(head.generation_id)) return reject();
    return [day, validateRevisionHead(head, day, OBSERVED_POPULATION_REPO, OBSERVED_POPULATION_CAPABILITY)];
  }));
  return { schema_version: 1, channel: OBSERVED_POPULATION_CAPABILITY, revision_protocol: 1,
    dates: [...dates], count: dates.length, min_date: dates[0], latest_date: dates.at(-1)!, revision_heads: heads };
}

/** Text is the exact service-opened domain manifest; no decrypted/re-serialized hash substitution. */
export function admitObservedPopulationManifest(text: string, index: ObservedPopulationIndex,
  installed?: Manifest | null, day = index.latest_date): ObservedPopulationSelection {
  const validated = parseObservedPopulationIndex(index);
  const head = validated.revision_heads[day];
  if (!head || utf8ToBytes(text).length > 4 * 1024 * 1024 || bytesToHex(sha256(utf8ToBytes(text))) !== head.manifest_sha256) return reject();
  const manifest = JSON.parse(text) as Manifest & { consumer_contract?: unknown };
  if (manifest.schema_version !== 1 || manifest.consumer_contract !== OBSERVED_POPULATION_CAPABILITY) return reject();
  assertRevisionManifest(manifest, head, day, OBSERVED_POPULATION_REPO, OBSERVED_POPULATION_CAPABILITY);
  if (payloadBundleIdentity(manifest) !== head.bundle_sha256) return reject();
  // This v1 contract only admits core-row pricing; alternate offer synthesis remains unsupported.
  if (manifest.public_rate_catalogue !== undefined) return reject();
  for (const file of Object.values(manifest.files)) observedPopulationTransportUrl(file.url, OBSERVED_POPULATION_CAPABILITY);
  const detached = manifest.bank_rate_history_catalogue;
  if (detached !== undefined) {
    if (detached?.schema_version !== 1 || detached.file?.url !== `${GITHUB_PREFIX}${manifest.tag}/${detached.file?.name}`) return reject();
    observedPopulationTransportUrl(detached.file.url, OBSERVED_POPULATION_CAPABILITY);
  }
  assertNoRevisionRollback(installed, manifest);
  return freezeDeep({ channel: OBSERVED_POPULATION_CAPABILITY, manifest, manifestText: text,
    manifestSha256: head.manifest_sha256,
    cacheKey: `${CACHE_PREFIX}${revisionTag(day, head.revision, OBSERVED_POPULATION_CAPABILITY)}/${head.manifest_sha256}` });
}

/** Metadata-only cache receipt: candidate acquisition never shares legacy core-bundle/meta slots. */
export function observedPopulationCacheReceipt(selection: ObservedPopulationSelection, index: ObservedPopulationIndex): string {
  const admitted = admitObservedPopulationManifest(selection.manifestText, index);
  if (admitted.cacheKey !== selection.cacheKey) return reject();
  return JSON.stringify({ schema_version: 1, channel: OBSERVED_POPULATION_CAPABILITY, index, manifest_text: selection.manifestText, cache_key: selection.cacheKey });
}
export function restoreObservedPopulationSelection(receipt: string, capability: unknown, installed?: Manifest | null): ObservedPopulationSelection {
  requireCapability(capability);
  // JSON escaping may double a bounded 4 MiB manifest inside the 1 MiB index envelope.
  if (utf8ToBytes(receipt).length > 12 * 1024 * 1024) return reject();
  const obj = exactObject(JSON.parse(receipt), ['schema_version', 'channel', 'index', 'manifest_text', 'cache_key']);
  if (obj.schema_version !== 1 || obj.channel !== OBSERVED_POPULATION_CAPABILITY || typeof obj.manifest_text !== 'string') return reject();
  const admitted = admitObservedPopulationManifest(obj.manifest_text, parseObservedPopulationIndex(obj.index), installed);
  if (obj.cache_key !== admitted.cacheKey) return reject();
  return admitted;
}

export interface CandidateTextTransport {
  /** Must reject redirects and non-2xx; enforce maxBytes while reading, not after allocating an unbounded response. */
  readText(request: { url: string; redirect: 'error'; maxBytes: number; signal?: AbortSignal }): Promise<string>;
}
/** Isolated discovery seam. Not imported by shipping config/store and never writes the shared payload cache. */
export async function discoverObservedPopulationCandidate(capability: unknown, transport: CandidateTextTransport,
  installed?: Manifest | null, signal?: AbortSignal): Promise<ObservedPopulationSelection> {
  requireCapability(capability);
  const read = async (canonical: string, maxBytes: number) => {
    if (signal?.aborted) throw new Error('Candidate discovery cancelled');
    const text = await transport.readText({ url: observedPopulationTransportUrl(canonical, capability), redirect: 'error', maxBytes, signal });
    if (signal?.aborted) throw new Error('Candidate discovery cancelled');
    if (utf8ToBytes(text).length > maxBytes) return reject();
    return text;
  };
  const index = parseObservedPopulationIndex(JSON.parse(await read(OBSERVED_POPULATION_INDEX_URL, 1024 * 1024)));
  const head = index.revision_heads[index.latest_date];
  return admitObservedPopulationManifest(await read(head.manifest_url, 4 * 1024 * 1024), index, installed);
}
