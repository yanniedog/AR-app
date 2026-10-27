import { auditApplicationJournal, capturePreAuditApplicationJournal, closeAuditApplicationJournal,
  PUBLIC_JOURNAL_MESSAGE_MAX_CHARS, PUBLIC_JOURNAL_SECTION_MAX_BYTES, resetAuditApplicationJournalForTests,
  toPublicApplicationLogEntry } from '../src/lib/auditApplicationJournal';
import type { LogEntry } from '../src/lib/debugLog';
let mockListener: ((entry: LogEntry) => void) | null = null;
jest.mock('../src/lib/debugLog', () => ({ debugLog: { getEntries: () => [] },
  subscribeApplicationJournal: (listener: (entry: LogEntry) => void) => { mockListener = listener; return () => { mockListener = null; }; } }));
afterEach(resetAuditApplicationJournalForTests);
const emit = (message: string, ts = '2026-10-26T08:00:00.000Z') => mockListener?.({ ts, message, tag: 'pricing', level: 'info' });

test('journal preserves safe messages beyond 400 characters and marks any bounded omission after redaction', () => {
  const safe = 'Pricing remained pending. '.repeat(40);
  expect(toPublicApplicationLogEntry({ ts: '', level: 'info', tag: 'pricing', message: safe }).message).toBe(safe.trim());
  const large = 'x'.repeat(PUBLIC_JOURNAL_MESSAGE_MAX_CHARS + 100);
  capturePreAuditApplicationJournal('bounded'); emit(large);
  const section = auditApplicationJournal().duringAndAfterAudit;
  expect(section).toMatchObject({ entryCount: 1, truncatedEntryCount: 1, omittedChars: 100, complete: false });
  expect(section.entries[0].message).toContain('…[truncated 100 chars]');
});

test('capture caps entry bytes and reports omitted entries instead of growing without bound', () => {
  capturePreAuditApplicationJournal('budget');
  for (let i = 0; i < 200; i++) emit('x'.repeat(16_000));
  const section = auditApplicationJournal().duringAndAfterAudit;
  expect(section.omittedEntryCount).toBeGreaterThan(0);
  expect(section.entryCount + section.omittedEntryCount).toBe(200);
  expect(section.complete).toBe(false);
  expect(new TextEncoder().encode(JSON.stringify(section.entries)).length).toBeLessThanOrEqual(PUBLIC_JOURNAL_SECTION_MAX_BYTES);
});

test('post-finish overflow cannot contaminate retained interval loss counters', () => {
  capturePreAuditApplicationJournal('finish'); emit('audit interval');
  for (let i = 0; i < 200; i++) emit('x'.repeat(16_000), '2026-10-26T08:00:02.000Z');
  const section = auditApplicationJournal(undefined, '2026-10-26T08:00:01.000Z').duringAndAfterAudit;
  expect(section).toMatchObject({ entryCount: 1, omittedEntryCount: 0, omittedChars: 0, complete: true });
});

test('authoritative finish closes capture before finalization activity', () => {
  capturePreAuditApplicationJournal('close'); emit('last audit line'); closeAuditApplicationJournal();
  emit('post-finish line');
  expect(auditApplicationJournal().duringAndAfterAudit.entries.map(entry => entry.message)).toEqual(['last audit line']);
});
