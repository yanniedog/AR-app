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

function section(entries: PublicApplicationLogEntry[], capturedAt: string | null): AuditApplicationLogSection {
  return { capturedAt, entries, entryCount: entries.length };
}

export function toPublicApplicationLogEntry(entry: LogEntry): PublicApplicationLogEntry {
  const tag = /^[A-Za-z][\w.-]{0,40}$/.test(entry.tag) ? entry.tag : 'log';
  const level = ['debug', 'info', 'warn', 'error'].includes(entry.level) ? entry.level : 'info';
  return {
    ts: entry.ts,
    level,
    tag,
    message: deidentifyAuditText(entry.message) ?? '[REDACTED]',
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
  during = [];
  unsubscribe = subscribeApplicationJournal(entry => {
    during.push(toPublicApplicationLogEntry(entry));
  });
  before = debugLog.getEntries().map(toPublicApplicationLogEntry);
  beforeCapturedAt = new Date().toISOString();
  during = [];
}

export function resetAuditApplicationJournalForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  activeSession = null;
  before = null;
  beforeCapturedAt = null;
  during = [];
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
    return {
      beforeAudit: section(before, beforeCapturedAt),
      duringAndAfterAudit: section(during.slice(), capturedAt),
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
