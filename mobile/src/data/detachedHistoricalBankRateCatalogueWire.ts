import type { Manifest, ManifestFile, ManifestEnc } from '../types';
import type { CompressedCatalogue } from './historicalBankRateCatalogueCompression';
import { isValidCalendarDate } from '../lib/calendarDate';
import { automaticDataUrl } from '../lib/automaticDataAccess';

export const DETACHED_HISTORY_MAX_COMPRESSED = 8 * 1024 * 1024;
export const DETACHED_HISTORY_MAX_DECODED = 24 * 1024 * 1024;
export const DETACHED_HISTORY_MAX_ENCODED = Math.ceil(DETACHED_HISTORY_MAX_COMPRESSED / 3) * 4;
const SHA = /^[a-f0-9]{64}$/;
const INNER_COMPRESSED = 16 * 1024 * 1024, INNER_DECODED = 128 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function sha(value: unknown): value is string { return typeof value === 'string' && SHA.test(value); }

/** Pure, optional capability validation. Failure never invalidates usable core data. */
export function validateDetachedHistoricalCatalogueDescriptor(manifest: Manifest, expectedRepo = 'yanniedog/AR-local'): ManifestFile | null {
  try {
    if (!manifest || !isValidCalendarDate(manifest.run_date) || !sha(manifest.files?.core?.sha256) ||
        Object.hasOwn(manifest.files, 'bank_rate_history_catalogue')) return null;
    const namespace: unknown = manifest.bank_rate_history_catalogue;
    if (!record(namespace) || !keys(namespace, ['schema_version', 'file']) || namespace.schema_version !== 1) return null;
    const file = namespace.file;
    if (!record(file) || !keys(file, ['name', 'bytes', 'sha256', 'url'], ['enc']) || !sha(file.sha256) ||
        !Number.isSafeInteger(file.bytes) || (file.bytes as number) <= 0 || (file.bytes as number) > DETACHED_HISTORY_MAX_COMPRESSED) return null;
    const enc = file.enc;
    if (Object.hasOwn(file, 'enc') && (!record(enc) || !keys(enc, ['alg', 'key_id']) || enc.alg !== 'aes-256-gcm' ||
        typeof enc.key_id !== 'string' || !/^[a-f0-9]{8}$/.test(enc.key_id))) return null;
    const encryption = enc as ManifestEnc | undefined;
    const coreEnc = manifest.files.core.enc;
    if (encryption ? !coreEnc || coreEnc.alg !== encryption.alg || coreEnc.key_id !== encryption.key_id : coreEnc !== undefined) return null;
    if (manifest.tag !== 'app-payload-latest' && manifest.tag !== `app-payload-${manifest.run_date}` &&
        !new RegExp(`^app-payload-${manifest.run_date}-r[0-9]{6}$`).test(manifest.tag)) return null;
    const name = `bank-rate-history-catalogue-${manifest.run_date}-${file.sha256.slice(0, 12)}.json.gz${enc ? '.enc' : ''}`;
    const legacyTags = ['app-payload-latest', `app-payload-${manifest.run_date}`];
    // Legacy finalized manifests can gain a same-core optional asset from the
    // same day's rolling alias. Keep its authenticated URL; do not invent an
    // asset on another release. Immutable revisions never borrow alias assets.
    const tags = !manifest.payload_revision && legacyTags.includes(manifest.tag) ? legacyTags : [manifest.tag];
    if (file.name !== name || typeof file.url !== 'string' || manifest.repo !== expectedRepo ||
        !tags.some(tag => file.url === `https://github.com/${manifest.repo}/releases/download/${tag}/${name}`) || !automaticDataUrl(file.url) ||
        Object.values(manifest.files).some(entry => entry?.name === name)) return null;
    return { name, bytes: file.bytes as number, sha256: file.sha256, url: file.url,
      ...(encryption ? { enc: { ...encryption } } : {}) };
  } catch { return null; }
}

/** Inner gzip content is independently authenticated by the registered codec. */
export function validateDetachedHistoricalCatalogueEnvelope(value: unknown, manifest: Manifest): CompressedCatalogue | null {
  if (!record(value) || !keys(value, ['schema_version', 'run_date', 'core_sha256', 'catalogue']) || value.schema_version !== 1 ||
      value.run_date !== manifest.run_date || value.core_sha256 !== manifest.files?.core?.sha256 || !sha(value.core_sha256)) return null;
  const archive = value.catalogue;
  if (!record(archive) || !keys(archive, ['sha256', 'bytes', 'gzip_base64']) || !sha(archive.sha256) ||
      !Number.isSafeInteger(archive.bytes) || (archive.bytes as number) <= 0 || (archive.bytes as number) > INNER_DECODED ||
      typeof archive.gzip_base64 !== 'string' || !archive.gzip_base64.length || archive.gzip_base64.length % 4 ||
      archive.gzip_base64.length > Math.ceil(INNER_COMPRESSED / 3) * 4) return null;
  return archive as unknown as CompressedCatalogue;
}
