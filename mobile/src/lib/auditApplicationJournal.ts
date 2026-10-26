import { debugLog, subscribeApplicationJournal, type LogEntry } from './debugLog';
import { deidentifyAuditText } from './performanceAuditDiagnostic';

export interface PublicApplicationLogEntry {
  ts: string;
  level: string;
  tag: string;
  message: string;
}

export interface AuditApplicationLogSection {
  capturedAt: string | null;
  entries: PublicApplicationLogEntry[];
  entryCount: number;
  truncatedEntryCount: number;
  omittedEntryCount: number;
  omittedChars: number;
  complete: boolean;
  uncertainOmittedEntryCount: number;
}

export interface AuditApplicationJournal {
  beforeAudit: AuditApplicationLogSection;
  duringAndAfterAudit: AuditApplicationLogSection;
}

let activeSession: string | null = null;
let unsubscribe: (() => void) | null = null;
let before: PublicApplicationLogEntry[] | null = null;
let beforeCapturedAt: string | null = null;
let during: PublicApplicationLogEntry[] = [];
let duringBytes = 2;
let duringOmissions: { first: number; last: number; entries: number; chars: number }[] = [];
const MAX_OMISSION_INTERVALS = 1024;
function recordOmission(entry: PublicApplicationLogEntry): void {
  const at = Date.parse(entry.ts);
  duringOmissions.push({ first: at, last: at, entries: 1, chars: entry.message.length + omittedChars(entry.message) });
  if (duringOmissions.length > MAX_OMISSION_INTERVALS) {
    const [first, second] = duringOmissions.splice(0, 2);
    duringOmissions.unshift({ first: Math.min(first.first, second.first), last: Math.max(first.last, second.last),
      entries: first.entries + second.entries, chars: first.chars + second.chars });
  }
}
function lossThrough(finishedAt?: string | null) {
  const finish = finishedAt ? Date.parse(finishedAt) : Number.NaN;
  let entries = 0, chars = 0, uncertain = 0;
  for (const loss of duringOmissions) {
    if (!Number.isFinite(finish) || loss.last <= finish) { entries += loss.entries; chars += loss.chars; }
    else if (!(loss.first > finish)) uncertain += loss.entries;
  }
  return { entries, chars, uncertain };
}
export const PUBLIC_JOURNAL_MESSAGE_MAX_CHARS = 16_384;
export const PUBLIC_JOURNAL_SECTION_MAX_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
function omittedChars(message: string): number {
  return [...message.matchAll(/…\[truncated (\d+) chars\]/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}
function entryBytes(entry: PublicApplicationLogEntry): number { return encoder.encode(JSON.stringify(entry)).length; }


function section(entries: PublicApplicationLogEntry[], capturedAt: string | null,
  lostEntries = 0, lostChars = 0, uncertain = 0): AuditApplicationLogSection {
  const retained: PublicApplicationLogEntry[] = [];
  let bytes = 2;
  for (const entry of entries) {
    const weight = entryBytes(entry) + 1;
    if (bytes + weight > PUBLIC_JOURNAL_SECTION_MAX_BYTES) {
      lostEntries++; lostChars += entry.message.length + omittedChars(entry.message);
    } else { retained.push(entry); bytes += weight; }
  }
  const truncatedEntryCount = retained.filter(entry => omittedChars(entry.message) > 0).length;
  const missingChars = lostChars + retained.reduce((sum, entry) => sum + omittedChars(entry.message), 0);
  return { capturedAt, entries: retained, entryCount: retained.length, truncatedEntryCount,
    omittedEntryCount: lostEntries, omittedChars: missingChars, uncertainOmittedEntryCount: uncertain,
    complete: lostEntries === 0 && truncatedEntryCount === 0 && uncertain === 0 };
}

export function toPublicApplicationLogEntry(entry: LogEntry): PublicApplicationLogEntry {
  const tag = /^[A-Za-z][\w.-]{0,40}$/.test(entry.tag) ? entry.tag : 'log';
  const level = ['debug', 'info', 'warn', 'error'].includes(entry.level) ? entry.level : 'info';
  return {
    ts: entry.ts,
    level,
    tag,
    message: deidentifyAuditText(entry.message, PUBLIC_JOURNAL_MESSAGE_MAX_CHARS) ?? '[REDACTED]',
  };
}

/**
 * Freeze the log that already exists, then keep every later line even if the
 * ring buffer later drops it. A new session key starts a new pair of sections.
 */
export function capturePreAuditApplicationJournal(sessionKey?: string): void {
  if (sessionKey && sessionKey === activeSession && before) return;
  if (!sessionKey && before) return;
  unsubscribe?.();
  activeSession = sessionKey ?? activeSession;
  during = []; duringBytes = 2; duringOmissions = [];
  unsubscribe = subscribeApplicationJournal(entry => {
    const sanitized = toPublicApplicationLogEntry(entry);
    const weight = entryBytes(sanitized) + 1;
    if (duringBytes + weight > PUBLIC_JOURNAL_SECTION_MAX_BYTES) {
      recordOmission(sanitized);
    } else { during.push(sanitized); duringBytes += weight; }
  });
  before = debugLog.getEntries().map(toPublicApplicationLogEntry);
  beforeCapturedAt = new Date().toISOString();
  during = []; duringBytes = 2; duringOmissions = [];
}

/** Stop at the authoritative audit-finish boundary, before finalization logs. */
export function closeAuditApplicationJournal(): void {
  unsubscribe?.(); unsubscribe = null;
}

export function resetAuditApplicationJournalForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  activeSession = null;
  before = null;
  beforeCapturedAt = null;
  during = []; duringBytes = 2; duringOmissions = [];
}

function through(entries: PublicApplicationLogEntry[], finishedAt?: string | null): PublicApplicationLogEntry[] {
  const finishMs = finishedAt ? Date.parse(finishedAt) : Number.NaN;
  if (!Number.isFinite(finishMs)) return entries;
  return entries.filter(entry => {
    const at = Date.parse(entry.ts);
    return !Number.isFinite(at) || at <= finishMs;
  });
}

/** Before-audit lines stay in their snapshot. Materializing the report stops later capture. */
export function auditApplicationJournal(startedAt?: string | null, finishedAt?: string | null): AuditApplicationJournal {
  const capturedAt = finishedAt ?? null;
  if (before) {
    unsubscribe?.();
    unsubscribe = null;
    during = through(during, finishedAt);
    const lost = lossThrough(finishedAt);
    return {
      beforeAudit: section(before, beforeCapturedAt),
      duringAndAfterAudit: section(during.slice(), capturedAt, lost.entries, lost.chars, lost.uncertain),
    };
  }
  const entries = debugLog.getEntries().map(toPublicApplicationLogEntry);
  const start = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (!Number.isFinite(start)) {
    return { beforeAudit: section([], null), duringAndAfterAudit: section(through(entries, finishedAt), capturedAt) };
  }
  const prior: PublicApplicationLogEntry[] = [];
  const later: PublicApplicationLogEntry[] = [];
  for (const entry of entries) {
    const at = Date.parse(entry.ts);
    if (Number.isFinite(at) && at < start) prior.push(entry);
    else later.push(entry);
  }
  return { beforeAudit: section(prior, startedAt ?? null), duringAndAfterAudit: section(through(later, finishedAt), capturedAt) };
}
