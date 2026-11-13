import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { CorePayload, DetailsPayload, Manifest } from '../types';
import { validatePayloadAccounting } from '../lib/appHealth/payloadAccounting';
import { versionLt } from '../lib/versionCompare';
import { isValidCalendarDate } from '../lib/calendarDate';
import { SECTION_ORDER } from '../constants';
import { normalizeCoreWithIntegrity, sealCoreHistoryAsync } from './sectionIntegrity';
import { validatePopulationAssessment, validatePopulationEdition } from './populationAssessment';
import { assertNoRevisionRollback } from './payloadRevision';
import { discoverObservedPopulationCandidate, observedPopulationCacheReceipt, restoreObservedPopulationSelection,
  observedPopulationTransportUrl, OBSERVED_POPULATION_CAPABILITY, type CandidateTextTransport,
  type ObservedPopulationSelection } from './observedPopulationChannel';

export const CANDIDATE_MAX_ASSET_BYTES = 64 * 1024 * 1024;
export const CANDIDATE_MAX_DECODED_BYTES = 192 * 1024 * 1024;
const RECEIPT_LIMIT = 12 * 1024 * 1024;
const storageQueues = new WeakMap<CandidateAssetStorage, Promise<unknown>>();
type AssetKey = 'core' | 'details';
const ASSETS: AssetKey[] = ['core', 'details'];
export interface CandidateAssetTransport extends CandidateTextTransport {
  readBytes(request: { url: string; redirect: 'error'; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
}
/** Adapter must confine every relative key to its own observed-population-v1 directory. */
export interface CandidateAssetStorage {
  read(key: string, maxBytes: number): Promise<Uint8Array | null>;
  write(key: string, bytes: Uint8Array): Promise<void>;
  removeEdition(sequence: number): Promise<void>;
}
export interface CandidateAssetCodec {
  decode(bytes: Uint8Array, maxDecodedBytes: number): Promise<unknown>;
  decodeText(bytes: Uint8Array): string;
  yieldWork(): Promise<void>;
}
export interface CandidateEdition {
  selection: ObservedPopulationSelection;
  core: CorePayload;
  details: DetailsPayload;
  integrity: ReturnType<typeof normalizeCoreWithIntegrity>['integrity'];
}
interface Head { schema_version: 1; sequence: number; cache_key: string; digest: string }
const hash = (bytes: Uint8Array) => bytesToHex(sha256(bytes));
const failed = (message: string): never => { throw new Error(`Observed candidate: ${message}`); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const prefix = (sequence: number) => `edition-${sequence}/`;
function active(signal?: AbortSignal) { if (signal?.aborted) failed('cancelled'); }
function noRollback(installed: Manifest | null | undefined, next: Manifest) {
  if (installed && (!isValidCalendarDate(installed.run_date) || next.run_date < installed.run_date)) failed('stale publication day');
  assertNoRevisionRollback(installed, next);
}
function checkCapabilities(manifest: Manifest, appVersion: string) {
  // Initial authentic contract contains exactly core/details. Never discard an unsupported financial capability.
  if (Object.keys(manifest.files).length !== 2 || ASSETS.some(key => !manifest.files[key]) ||
    manifest.bank_rate_history_catalogue !== undefined || manifest.bank_rate_history_catalogue_packed !== undefined ||
    manifest.bank_rate_history_ready !== undefined || manifest.public_rate_catalogue !== undefined || manifest.executable_v2 !== undefined ||
    manifest.executable_v3 !== undefined || manifest.executable_v4 !== undefined || manifest.enc !== undefined) failed('unsupported asset capability');
  const instant = (value: unknown): value is string => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
    isValidCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
  if (!instant(manifest.generated_at) || !object(manifest.schedule) || typeof manifest.schedule.label !== 'string' ||
    !manifest.schedule.label.trim() || (manifest.schedule.next_due_utc !== undefined && !instant(manifest.schedule.next_due_utc)) ||
    typeof manifest.app_min_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.app_min_version)) failed('required manifest generated_at/schedule/app_min_version');
  if (versionLt(appVersion, manifest.app_min_version)) failed('installed app version is too old');
}
function headDigest(sequence: number, cacheKey: string) { return hash(utf8ToBytes(JSON.stringify([sequence, cacheKey]))); }
function parseHead(bytes: Uint8Array | null, slot: number, codec: CandidateAssetCodec): Head | null {
  if (!bytes) return null;
  try {
    const h = JSON.parse(codec.decodeText(bytes));
    if (!object(h) || Object.keys(h).sort().join(',') !== 'cache_key,digest,schema_version,sequence' ||
      h.schema_version !== 1 || !Number.isSafeInteger(h.sequence) || Number(h.sequence) < 1 || Number(h.sequence) % 2 !== slot ||
      typeof h.cache_key !== 'string' || !h.cache_key.startsWith('ar-rates:observed-population-v1/') ||
      h.digest !== headDigest(Number(h.sequence), h.cache_key)) return null;
    return h as unknown as Head;
  } catch { return null; }
}

/** All decoded financial data is derived from the exact descriptor bytes, including offline reads. */
async function validateAssets(selection: ObservedPopulationSelection, wire: Record<AssetKey, Uint8Array>, codec: CandidateAssetCodec,
  appVersion: string, signal?: AbortSignal): Promise<CandidateEdition> {
  checkCapabilities(selection.manifest, appVersion);
  const decoded: Partial<Record<AssetKey, unknown>> = {};
  for (const key of ASSETS) {
    active(signal);
    const bytes = wire[key], descriptor = selection.manifest.files[key];
    if (bytes.length !== descriptor.bytes || bytes.length > CANDIDATE_MAX_ASSET_BYTES) failed(`${key} byte count`);
    const digest = sha256.create();
    for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
      digest.update(bytes.subarray(offset, offset + 256 * 1024)); await codec.yieldWork(); active(signal);
    }
    if (bytesToHex(digest.digest()) !== descriptor.sha256) failed(`${key} hash`);
    if (bytes[0] === 65 && bytes[1] === 82 && bytes[2] === 69) failed('unopened encrypted transport');
    decoded[key] = await codec.decode(bytes, CANDIDATE_MAX_DECODED_BYTES);
    const doc = decoded[key];
    if (!object(doc) || doc.schema_version !== 1 || doc.run_date !== selection.manifest.run_date) failed(`${key} schema/date`);
  }
  active(signal);
  const core = decoded.core as CorePayload, details = decoded.details as DetailsPayload;
  if (!object(core.sections) || SECTION_ORDER.some(key => !object(core.sections[key]) ||
    !Array.isArray(core.sections[key].rates)) ||
    Object.values(core.sections).some(section => !object(section) || !Array.isArray(section.rates) || section.rates.some(row => !object(row))) ||
    !object(details.products) || Object.values(details.products).some(product => !object(product))) failed('invalid core/details structure');
  for (const row of Object.values(core.sections).flatMap(section => section.rates)) {
    if ([row.provider, row.product_key, row.product_name].some(value => typeof value !== 'string' || !value.trim()) ||
      typeof row.rate !== 'string' || !row.rate.trim() || !Number.isFinite(Number(row.rate)) ||
      [row.ongoing_rate, row.comparison_rate].some(value => value != null && value !== '' &&
        (typeof value !== 'string' || !Number.isFinite(Number(value))))) failed('invalid rate row');
  }
  if (!validatePopulationAssessment(core)) failed('missing population assessment');
  validatePopulationEdition(core, selection.manifest);
  await sealCoreHistoryAsync(core, codec.yieldWork);
  active(signal);
  const normalized = normalizeCoreWithIntegrity(core, { coreSha256: selection.manifest.files.core.sha256,
    generationDigest: selection.manifest.payload_revision!.bundle_sha256 });
  const accounting = validatePayloadAccounting({ source: 'remote', manifest: selection.manifest, core: normalized.core,
    quarantine: { ...normalized.integrity.quarantines, bankHistoryPairs: normalized.integrity.quarantines.bankHistoryPairs.size } });
  const productKeys = new Set(Object.values(normalized.core.sections).flatMap(section => section.rates).map(row => row.product_key));
  const detailKeys = Object.keys(details.products);
  if (!accounting.valid || productKeys.size !== accounting.publishedProducts ||
    detailKeys.length !== accounting.sourceProducts || [...productKeys].some(key => !Object.hasOwn(details.products, key))) failed('unreconciled accounting/details');
  const declared = selection.manifest.counts;
  if (declared?.rates !== accounting.sourceRates || declared?.products !== accounting.sourceProducts) failed('manifest source counts');
  return { selection, core: normalized.core, integrity: normalized.integrity, details };
}

/** One owner per storage adapter. A complete alternate head is the commit point; old assets stay readable. */
export function createObservedPopulationAssets(capability: unknown, storage: CandidateAssetStorage, codec: CandidateAssetCodec, appVersion: string) {
  if (capability !== OBSERVED_POPULATION_CAPABILITY) failed('capability required');
  if (!/^\d+\.\d+\.\d+$/.test(appVersion)) failed('installed app version required');
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = (storageQueues.get(storage) ?? Promise.resolve()).then(operation);
    storageQueues.set(storage, result.catch(() => undefined)); return result;
  };
  const readHead = async () => {
    const bytes = await Promise.all([storage.read('head-0.json', 4096), storage.read('head-1.json', 4096)]);
    const heads = bytes.map((value, slot) => parseHead(value, slot, codec)).filter((h): h is Head => !!h);
    if (!heads.length && bytes.some(Boolean)) failed('unreadable commit records');
    return heads.sort((a, b) => b.sequence - a.sequence)[0] ?? null;
  };
  const readSelection = async (head: Head, installed?: Manifest | null) => {
    const receipt = await storage.read(`${prefix(head.sequence)}selection.json`, RECEIPT_LIMIT);
    if (!receipt) return failed('missing committed receipt');
    const selection = restoreObservedPopulationSelection(codec.decodeText(receipt), capability, installed);
    noRollback(installed, selection.manifest);
    if (selection.cacheKey !== head.cache_key) failed('commit identity mismatch');
    checkCapabilities(selection.manifest, appVersion); return selection;
  };
  const restore = (installed?: Manifest | null): Promise<CandidateEdition | null> => serial(async () => {
    const head = await readHead(); if (!head) return null;
    const selection = await readSelection(head, installed);
    const wire = {} as Record<AssetKey, Uint8Array>;
    for (const key of ASSETS) {
      const bytes = await storage.read(`${prefix(head.sequence)}${key}.bin`, selection.manifest.files[key].bytes);
      if (!bytes) failed('missing committed asset'); wire[key] = bytes!;
    }
    // A corrupt committed edition must not silently fall back to an older date.
    return validateAssets(selection, wire, codec, appVersion);
  });
  const acquire = async (transport: CandidateAssetTransport, installed?: Manifest | null, signal?: AbortSignal) => {
    const selection = await discoverObservedPopulationCandidate(capability, transport, installed, signal);
    noRollback(installed, selection.manifest);
    checkCapabilities(selection.manifest, appVersion);
    const wire = {} as Record<AssetKey, Uint8Array>;
    for (const key of ASSETS) {
      active(signal); const file = selection.manifest.files[key];
      wire[key] = (await transport.readBytes({ url: observedPopulationTransportUrl(file.url, capability),
        redirect: 'error', maxBytes: file.bytes, signal })).slice();
    }
    const edition = await validateAssets(selection, wire, codec, appVersion, signal);
    return { edition, wire };
  };
  const refresh = async (transport: CandidateAssetTransport, installed?: Manifest | null, signal?: AbortSignal,
    canAdopt: () => boolean = () => true): Promise<CandidateEdition> => {
    const { edition, wire } = await acquire(transport, installed, signal);
    const selection = edition.selection;
    return serial(async () => {
      active(signal); if (!canAdopt()) failed('superseded adoption');
      const previous = await readHead();
      if (previous) noRollback((await readSelection(previous)).manifest, selection.manifest);
      const sequence = (previous?.sequence ?? 0) + 1;
      if (!Number.isSafeInteger(sequence)) failed('commit sequence overflow');
      for (const key of ASSETS) {
        await storage.write(`${prefix(sequence)}${key}.bin`, wire[key]);
        const written = await storage.read(`${prefix(sequence)}${key}.bin`, wire[key].length);
        if (!written || hash(written) !== selection.manifest.files[key].sha256) failed('asset persistence verification');
        active(signal);
      }
      const receipt = observedPopulationCacheReceipt(selection, selection.index);
      await storage.write(`${prefix(sequence)}selection.json`, utf8ToBytes(receipt));
      const head: Head = { schema_version: 1, sequence, cache_key: selection.cacheKey, digest: headDigest(sequence, selection.cacheKey) };
      await readSelection(head);
      active(signal); if (!canAdopt()) failed('superseded adoption');
      // Never delete the prior head. A torn alternate write leaves the old verified edition available.
      const headBytes = utf8ToBytes(JSON.stringify(head));
      try { await storage.write(`head-${sequence % 2}.json`, headBytes); }
      catch (error) {
        const actual = await storage.read(`head-${sequence % 2}.json`, 4096);
        if (!actual || hash(actual) !== hash(headBytes)) throw error;
      }
      const committed = await readHead();
      if (committed?.sequence !== sequence || committed.cache_key !== selection.cacheKey) failed('commit persistence verification');
      if (sequence > 2) await storage.removeEdition(sequence - 2).catch(() => undefined);
      return edition;
    });
  };
  return { refresh, restore, readLive: async (transport: CandidateAssetTransport, installed?: Manifest | null, signal?: AbortSignal) =>
    (await acquire(transport, installed, signal)).edition };
}
