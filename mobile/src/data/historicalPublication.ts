import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { Manifest } from '../types';
import type { DatesIndex } from './datesIndex';
import { PAYLOAD_REPO, datedManifestUrl } from '../config';
import { fetchManifest } from './payload';
import { assertRevisionManifest } from './payloadRevision';
import { historicalSourceIdentity } from './historyIdentity';
export interface HistoricalPublication { manifest: Manifest; identity: string }
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, ordered(v)]));
  return value;
}
/** Digest of bounded deterministic parsed-manifest content, not a signature or raw-file SHA. */
export function legacyPublicationIdentity(runDate: string, manifest: Manifest): string {
  const bytes = utf8ToBytes(JSON.stringify(ordered(manifest)));
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Historical manifest content too large');
  return `legacy-content:${runDate}:${bytesToHex(sha256(bytes))}:${manifest.files.core.sha256}`;
}
export async function resolveDatedPublication(runDate: string, index: DatesIndex): Promise<HistoricalPublication> {
  const head = index.revision_heads?.[runDate];
  const manifest = head ? await fetchManifest(head.manifest_url, undefined, head.manifest_sha256) : await fetchManifest(datedManifestUrl(runDate));
  if (head) assertRevisionManifest(manifest, head, runDate, PAYLOAD_REPO);
  const file = manifest.files?.core;
  if (manifest.run_date !== runDate || (manifest.repo && manifest.repo !== PAYLOAD_REPO) || !file || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > 64 * 1024 * 1024) throw new Error('Historical manifest core identity invalid');
  return { manifest, identity: head ? historicalSourceIdentity(index, runDate) : legacyPublicationIdentity(runDate, manifest) };
}

/** Legacy manifests are mutable selections: refresh before reuse, with a bounded outage circuit. */
export async function resolveLegacyPublications(index: DatesIndex, dates: string[], isCurrent: () => boolean = () => true): Promise<Map<string, HistoricalPublication>> {
  const publications = new Map<string, HistoricalPublication>(); let failures = 0;
  for (const date of [...dates].sort().reverse()) {
    if (!isCurrent() || failures >= 4) break;
    if (index.revision_heads?.[date]) continue;
    try { const publication = await resolveDatedPublication(date, index); if (!isCurrent()) break; publications.set(date, publication); failures = 0; }
    catch { failures += 1; }
  }
  return publications;
}
