import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { DetailsPayload } from '../types';
import { auditExternalLink, type ExternalLinkAuditResult } from './externalLinkAudit';
import { collectExternalAuditLinks } from './externalLinkInventory';
import { trustedExternalUrl, type TrustedExternalUrlRequest } from './trustedExternalUrl';
import { StandardUrl } from './standardUrl';
import { PASSIVE_AUDIT_MAX_AGE_MS, PASSIVE_AUDIT_INPUT_MAX_AGE_MS } from './passiveAuditCache';

const KEY = 'ar-passive-links-v1';
const MAX_BYTES = 900 * 1024;
const MAX_LINKS = 5_000;
interface Entry { result: ExternalLinkAuditResult; checkedAt: number; durationMs: number }
type CompactEntry = [ExternalLinkAuditResult['handler']['status'], number, number, boolean];
interface Record {
  schema: 1; appBuild: string; revision: string; createdAt: number;
  pending: TrustedExternalUrlRequest[]; cursor: number; entries: (CompactEntry | null)[];
}
let record: Record | null = null;
let loaded = false;
let dirty = false;
let lastWriteAt = 0;
let lastWrittenCursor = 0;
let indexedRecord: Record | null = null;
let lookup = new Map<string, number>();
let writes: Promise<void> = Promise.resolve();
let detailsRef: DetailsPayload | null = null;
const requestKey = (request: TrustedExternalUrlRequest) =>
  bytesToHex(sha256(utf8ToBytes(JSON.stringify([request.purpose, request.url]))));
const fresh = (value: Record, appBuild: string, now: number) => value.appBuild === appBuild &&
  now >= value.createdAt && now - value.createdAt < PASSIVE_AUDIT_INPUT_MAX_AGE_MS;

export function passiveLinkProgress(): { completed: number; total: number } {
  const now = Date.now();
  return { completed: record?.entries.filter(entry => entry && now >= entry[1] && now - entry[1] < PASSIVE_AUDIT_MAX_AGE_MS).length ?? 0,
    total: record?.pending.length ?? 0 };
}

/** Only public, credential-free destinations are persisted. Rejected URLs are
 * assessed when encountered in the foreground and never enter this cache. */
export async function preloadPassiveLinks(input: {
  appBuild: string; revision: string | null; details: DetailsPayload | null;
  platform: string; stopped: () => boolean;
}): Promise<void> {
  const now = Date.now();
  if (!loaded) {
    loaded = true;
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && utf8ToBytes(raw).length <= MAX_BYTES) {
      try {
        const saved = JSON.parse(raw) as Record;
        if (saved.schema === 1 && typeof saved.revision === 'string' && fresh(saved, input.appBuild, now) &&
          Array.isArray(saved.pending) && saved.pending.length <= MAX_LINKS &&
          Number.isInteger(saved.cursor) && saved.cursor >= 0 && saved.cursor <= saved.pending.length &&
          Array.isArray(saved.entries)) record = saved;
      } catch { /* Ignore malformed optional evidence. */ }
    }
  }
  if (input.stopped()) return;
  if (input.details && input.revision && (detailsRef !== input.details || !record ||
      record.revision !== input.revision || !fresh(record, input.appBuild, now))) {
    const pending: TrustedExternalUrlRequest[] = [];
    let bytes = 0;
    for (const request of collectExternalAuditLinks({ details: input.details })) {
      if (!trustedExternalUrl(request).ok) continue;
      const next = { ...request, label: request.label.slice(0, 60) };
      bytes += utf8ToBytes(JSON.stringify(next)).length + 80;
      if (bytes > MAX_BYTES - 2048 || pending.length >= MAX_LINKS) break;
      pending.push(next);
    }
    if (!record || record.revision !== input.revision || !fresh(record, input.appBuild, now)) {
      record = { schema: 1, appBuild: input.appBuild, revision: input.revision,
        createdAt: now, pending, cursor: 0, entries: [] };
    } else {
      // Exact request hashes make additions/removals safe on a same-revision
      // in-memory details replacement; existing results remain attributable.
      if (JSON.stringify(record.pending) !== JSON.stringify(pending)) { record.entries = []; record.cursor = 0; }
      record.pending = pending;
    }
    detailsRef = input.details;
    dirty = true; indexedRecord = null;
  }
  if (!record || !fresh(record, input.appBuild, now)) { record = null; return; }
  const active = record;
  if (active.cursor === active.pending.length && active.entries.some(entry => !entry || now - entry[1] >= PASSIVE_AUDIT_MAX_AGE_MS)) {
    active.cursor = 0;
  }
  const start = Date.now();
  for (let count = 0; count < 8 && active.cursor < active.pending.length && !input.stopped(); count++) {
    const request = active.pending[active.cursor];
    // Validate persisted input again before invoking an OS API.
    if (typeof request?.url !== 'string' || typeof request.label !== 'string' || !trustedExternalUrl(request).ok) {
      active.cursor++; continue;
    }
    const key = active.cursor;
    if (!active.entries[key] || now - active.entries[key]![1] >= PASSIVE_AUDIT_MAX_AGE_MS) {
      const started = Date.now();
      const result = await auditExternalLink(request, {
        platform: input.platform, reachability: false, timeoutMs: 1_000,
      });
      if (input.stopped()) break;
      active.entries[key] = [result.handler.status, Date.now(), Date.now() - started, result.handler.attempted];
    }
    active.cursor++; dirty = true;
    if (Date.now() - start >= 250) break;
    await new Promise<void>(resolve => setTimeout(resolve, 15));
  }
  if (lastWriteAt === 0 || Date.now() - lastWriteAt >= 30_000 ||
    active.cursor - lastWrittenCursor >= 64 || active.cursor === active.pending.length) await flushPassiveLinks();
}

/** Checkpoint at most every 30 seconds/64 links, plus background/completion.
 * Compact tuples avoid thousands of repeated status/label/detail strings. */
export function flushPassiveLinks(): Promise<void> {
  writes = writes.then(async () => {
    if (!record || !dirty) return;
    const current = record;
    const cursor = current.cursor;
    const raw = JSON.stringify(current);
    if (utf8ToBytes(raw).length > MAX_BYTES) return;
    dirty = false;
    await AsyncStorage.setItem(KEY, raw).catch(() => { dirty = true; });
    if (record === current) { lastWriteAt = Date.now(); lastWrittenCursor = cursor; }
  });
  return writes;
}

export function preloadedPassiveLink(request: TrustedExternalUrlRequest, appBuild: string, revision: string | null): Entry | null {
  const now = Date.now();
  if (!record || !revision || record.revision !== revision || !fresh(record, appBuild, now)) return null;
  if (indexedRecord !== record) {
    lookup = new Map(record.pending.map((item, i) => [requestKey(item), i]));
    indexedRecord = record;
  }
  const index = lookup.get(requestKey(request));
  const entry = index == null ? null : record.entries[index];
  if (!entry || !Number.isFinite(entry[1]) || entry[1] > now || now - entry[1] >= PASSIVE_AUDIT_MAX_AGE_MS ||
    !Number.isFinite(entry[2]) || entry[2] < 0 || !['pass', 'fail', 'unknown'].includes(entry[0])) return null;
  const trusted = trustedExternalUrl(request);
  if (!trusted.ok) return null;
  return { checkedAt: entry[1], durationMs: entry[2], result: {
    label: request.label, purpose: request.purpose, host: trusted.host, path: new StandardUrl(trusted.url).pathname,
    validation: { status: 'pass', attempted: true, detail: 'Approved, credential-free HTTPS destination.' },
    handler: { status: entry[0], attempted: entry[3] === true, detail: entry[0] === 'pass'
      ? 'The operating system reported an installed handler for this destination during passive preloading.'
      : entry[0] === 'fail' ? 'The operating system could not find a handler for this destination.'
      : 'The installed browser handler could not be verified during passive preloading.' },
    reachability: { status: 'unknown', attempted: false, detail: 'HTTP reachability is not tested by passive background checks.' },
    httpStatus: null,
  } };
}
