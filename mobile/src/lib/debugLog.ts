import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { bridgeLogToCrashlytics } from './observability';
import {
  compactPerformanceAuditReportForLog,
} from './performanceAuditLog';
import {
  LATEST_PERFORMANCE_AUDIT_STORAGE_KEY,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
} from './performanceAuditSchema';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
}

export const MAX_LOG_LINES = 2000;
export const MAX_LOG_BYTES = 512 * 1024;
export const PERSIST_TAIL_LINES = 100;
export const MAX_LOG_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_LOG_DISPLAY_BYTES = 16 * 1024;
/** Upper bound for automatic audit upload bodies — avoids holding multi-MiB strings. */
export const LOG_UPLOAD_MAX_BODY_BYTES = 768 * 1024;
export const LOG_UPLOAD_READ_CHUNK_BYTES = 256 * 1024;
export const LOG_FILE_FLUSH_MS = 100;
export const ANDROID_PACKAGE = 'com.eyex.australianrates';
export const ANDROID_LOG_PATH_HINT = `Android/data/${ANDROID_PACKAGE}/files/logs/ar-local.log`;

const STORAGE_KEY = 'ar-debug-log-tail';
const LOG_DIR = `${FileSystem.documentDirectory ?? ''}logs/`;
const LOG_FILE = `${LOG_DIR}ar-local.log`;
/** Full audit JSON kept beside the bounded ring so trim cannot drop the diagnosis. */
const PERFORMANCE_AUDIT_SIDECAR_FILE = `${LOG_DIR}ar-performance-audit-latest.json`;

const SECRET_VALUE = String.raw`[^\s,;}"']+`;
const SECRET_PATTERNS: RegExp[] = [
  new RegExp(String.raw`EXPO_TOKEN[=:\s]${SECRET_VALUE}`, "gi"),
  new RegExp(String.raw`Bearer\s+${SECRET_VALUE}`, "gi"),
  new RegExp(String.raw`Authorization:\s*${SECRET_VALUE}`, "gi"),
  new RegExp(String.raw`(?:api[_-]?key|secret|password|token)[=:\s]${SECRET_VALUE}`, "gi"),
  new RegExp(String.raw`"(?:EXPO_TOKEN|api[_-]?key|secret|password|token)"\s*:\s*"[^"]+"`, "gi"),
  new RegExp(String.raw`'(?:EXPO_TOKEN|api[_-]?key|secret|password|token)'\s*:\s*'[^']+'`, "gi"),
];
const PRIVATE_IDENTIFIER_PATTERN =
  /\b(uid|user[_-]?id|subscription[_-]?id|subscriptionId)\s*[=:]\s*[^\s,;}"']+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const LOG_LINE_RE = /^(\S+)\s+\[(\w+)\s*\]\s+([^:]+):\s(.*)$/;

/** Strip likely secrets before lines are stored or uploaded. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const key = match.split(/[=:\s]/)[0] ?? 'secret';
      return `${key}=[REDACTED]`;
    });
  }
  return out
    .replace(PRIVATE_IDENTIFIER_PATTERN, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
}

export function formatEntry(entry: LogEntry): string {
  const level = entry.level.toUpperCase().padEnd(5);
  return `${entry.ts} [${level}] ${entry.tag}: ${entry.message}`;
}

/**
 * Preserve the complete JS traceback in one physical log line so it survives
 * file-tail parsing and can be exported without orphaned stack frames.
 */
export function formatErrorTrace(error: unknown): string {
  let trace: string;
  if (error instanceof Error) {
    trace = error.stack ?? `${error.name}: ${error.message}`;
  } else {
    try {
      trace =
        typeof error === 'string'
          ? error
          : JSON.stringify(error) ?? String(error);
    } catch {
      trace = String(error);
    }
  }
  return trace.replace(/\r/g, '').replace(/\n/g, String.raw`\n`);
}

/** Parse a single persisted log line back into a LogEntry. */
export function parseLogLine(line: string): LogEntry | null {
  const match = line.match(LOG_LINE_RE);
  if (!match) return null;
  const level = match[2].toLowerCase() as LogLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(level)) return null;
  return { ts: match[1], level, tag: match[3].trim(), message: redactSecrets(match[4]) };
}

function parseLogFile(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const entry = parseLogLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

const textEncoder = new TextEncoder();

function entryBytes(entry: LogEntry): number {
  return textEncoder.encode(formatEntry(entry) + "\n").length;
}

const textDecoder = new TextDecoder();

function trimToBudget(content: string, maxBytes: number): string {
  const limit = Math.max(0, Math.floor(maxBytes));
  const bytes = textEncoder.encode(content);
  if (bytes.length <= limit) return content;
  if (limit === 0) return '';
  let start = bytes.length - limit;
  while (start < bytes.length && bytes[start] !== 0x0a) start += 1;
  start += 1;
  if (start >= bytes.length) return '';
  return textDecoder.decode(bytes.slice(start));
}

function trimFileTail(content: string): string {
  return trimToBudget(content, MAX_LOG_FILE_BYTES);
}

/**
 * Keep the interactive log screen cheap even when one structured audit report
 * occupies hundreds of KiB. This is display-only: copy/share/upload continue
 * to read the complete bounded in-memory log.
 */
export function formatLogDisplayTail(
  content: string,
  maxBytes = MAX_LOG_DISPLAY_BYTES,
): string {
  const limit = Math.max(0, Math.floor(maxBytes));
  const bytes = textEncoder.encode(content);
  if (bytes.length <= limit) return content;
  if (limit === 0) return '';
  const tail = textDecoder.decode(bytes.slice(bytes.length - limit));
  const newline = tail.indexOf('\n');
  const visible = newline >= 0 ? tail.slice(newline + 1) : tail;
  return `[Showing newest ${limit} bytes of ${bytes.length}; exports include the full log]\n${visible}`;
}

async function ensureLogDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  }
}

let pendingFileLines: string[] = [];
let fileFlushTimer: ReturnType<typeof setTimeout> | null = null;
let fileFlushPromise: Promise<void> | null = null;
let fileContentCache: string | null = null;
let fileWriteEpoch = 0;
let coldStartResetPromise: Promise<void> | null = null;

function scheduleFileFlush(): void {
  if (fileFlushTimer) return;
  fileFlushTimer = setTimeout(() => {
    fileFlushTimer = null;
    void flushPendingToFile();
  }, LOG_FILE_FLUSH_MS);
}

async function syncLogFile(appendText: string, epoch: number): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error('documentDirectory unavailable');
  }
  await ensureLogDir();
  const existing = fileContentCache ?? (await FileSystem.readAsStringAsync(LOG_FILE).catch(() => ''));
  if (epoch !== fileWriteEpoch) return;
  const combined = trimFileTail(existing + appendText);
  await FileSystem.writeAsStringAsync(LOG_FILE, combined);
  if (epoch !== fileWriteEpoch) return;
  fileContentCache = combined;
}

async function flushPendingToFile(requirePhysical = false): Promise<void> {
  // The UI cold-start reset owns the file until stale content is deleted.
  // New-session entries remain queued and are written immediately afterwards.
  if (coldStartResetPromise) await coldStartResetPromise;
  if (fileFlushPromise) {
    await fileFlushPromise;
    if (pendingFileLines.length === 0) return;
  }

  const batch = pendingFileLines.splice(0);
  if (batch.length === 0) return;
  const epoch = fileWriteEpoch;

  fileFlushPromise = (async () => {
    try {
      if (!FileSystem.documentDirectory) {
        pendingFileLines.unshift(...batch);
        if (requirePhysical) throw new Error('documentDirectory unavailable');
        return;
      }
      await syncLogFile(batch.join(''), epoch);
    } catch (error) {
      if (epoch === fileWriteEpoch) {
        pendingFileLines.unshift(...batch);
      }
      if (requirePhysical) throw error;
    } finally {
      fileFlushPromise = null;
    }
  })();

  await fileFlushPromise;
}

export class RingBuffer {
  private entries: { entry: LogEntry; sequence: number }[] = [];
  private bytes = 0;
  private nextSequence = 1;

  append(entry: LogEntry): void {
    this.entries.push({ entry, sequence: this.nextSequence });
    this.nextSequence += 1;
    this.bytes += entryBytes(entry);
    while (
      this.entries.length > MAX_LOG_LINES ||
      this.bytes > MAX_LOG_BYTES
    ) {
      const removed = this.entries.shift();
      if (!removed) break;
      this.bytes -= entryBytes(removed.entry);
    }
  }

  clear(): void {
    this.entries = [];
    this.bytes = 0;
  }

  loadHistory(history: LogEntry[]): void {
    const merged = [...history, ...this.entries.map(({ entry }) => entry)];
    merged.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    this.entries = [];
    this.bytes = 0;
    for (const entry of merged) {
      this.append(entry);
    }
  }

  getEntries(): LogEntry[] {
    return this.entries.map(({ entry }) => entry);
  }

  getCursor(): number {
    return this.nextSequence - 1;
  }

  getEntriesAfter(cursor: number): LogEntry[] {
    return this.entries
      .filter(({ sequence }) => sequence > cursor)
      .map(({ entry }) => entry);
  }

  getText(): string {
    return this.entries.map(({ entry }) => formatEntry(entry)).join('\n');
  }

  size(): number {
    return this.entries.length;
  }
}

type Listener = () => void;

const buffer = new RingBuffer();
const listeners = new Set<Listener>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const fn of listeners) fn();
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistTail();
  }, 500);
}

async function persistTail(): Promise<void> {
  try {
    const tail = buffer.getEntries().slice(-PERSIST_TAIL_LINES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tail));
  } catch {
    // non-fatal
  }
}

function append(level: LogLevel, tag: string, message: string): void {
  // Collapse real newlines so stack traces and audit dumps stay one parseable
  // physical line (callers may also pre-escape via formatErrorTrace).
  const messageRedacted = redactSecrets(
    String(message).replace(/\r/g, '').replace(/\n/g, String.raw`\n`),
  );
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message: messageRedacted,
  };
  buffer.append(entry);
  pendingFileLines.push(formatEntry(entry) + '\n');
  // Performance reports can be large and include device/app timing context.
  // Keep them local even when general Crashlytics diagnostics are enabled;
  // sharing remains an explicit action from the Debug log screen.
  if (tag !== 'perf-audit') {
    bridgeLogToCrashlytics(level, tag, messageRedacted);
  }
  notify();
  // Audit checkpoints are explicitly flushed by the runner. Avoid scheduling
  // a large AsyncStorage tail serialization in the middle of the next measured
  // navigation phase.
  if (tag !== 'perf-audit') schedulePersist();
  scheduleFileFlush();
}

interface StoredPerformanceAudit {
  schemaVersion: typeof PERFORMANCE_AUDIT_SCHEMA_VERSION;
  summaryMarker: string;
  reportJson: string;
}

const PERFORMANCE_AUDIT_REPORT_BEGIN = 'PERFORMANCE_AUDIT_REPORT_BEGIN';
const PERFORMANCE_AUDIT_REPORT_JSON = 'PERFORMANCE_AUDIT_REPORT_JSON';
const PERFORMANCE_AUDIT_REPORT_END = 'PERFORMANCE_AUDIT_REPORT_END';
const PERFORMANCE_AUDIT_REPORT_SIDECAR = 'PERFORMANCE_AUDIT_REPORT_SIDECAR';

function physicalAuditMarker(summaryMarker: string): string {
  return `${PERFORMANCE_AUDIT_REPORT_BEGIN} ${summaryMarker}`;
}

function isPerformanceAuditReportLine(line: string): boolean {
  return (
    line.includes(PERFORMANCE_AUDIT_REPORT_BEGIN) ||
    line.includes(PERFORMANCE_AUDIT_REPORT_JSON) ||
    line.includes(PERFORMANCE_AUDIT_REPORT_END) ||
    line.includes(PERFORMANCE_AUDIT_REPORT_SIDECAR)
  );
}

/** Drop prior audit dump lines so a new reserved-tail write does not stack multi-MB JSON. */
function stripPerformanceAuditReportLines(content: string): string {
  if (!content) return '';
  const hadTrailingNewline = content.endsWith('\n');
  const kept = content
    .split('\n')
    .filter((line) => line.length > 0 && !isPerformanceAuditReportLine(line));
  if (kept.length === 0) return '';
  return kept.join('\n') + (hadTrailingNewline ? '\n' : '');
}

function ensureTrailingNewline(content: string): string {
  if (!content) return '';
  return content.endsWith('\n') ? content : `${content}\n`;
}

async function writePerformanceAuditSidecar(stored: StoredPerformanceAudit): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await ensureLogDir();
  await FileSystem.writeAsStringAsync(
    PERFORMANCE_AUDIT_SIDECAR_FILE,
    JSON.stringify(stored),
  );
}

async function readPerformanceAuditSidecar(): Promise<StoredPerformanceAudit | null> {
  if (!FileSystem.documentDirectory) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(PERFORMANCE_AUDIT_SIDECAR_FILE);
    return parseStoredPerformanceAudit(raw);
  } catch {
    return null;
  }
}

/**
 * Persist the complete audit block at the end of the physical log, reserving
 * enough budget so begin/json/end cannot be sliced mid-line by the 2MB trim.
 */
async function writeReservedPerformanceAuditBlock(
  blockText: string,
  epoch: number,
): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error('documentDirectory unavailable');
  }
  await ensureLogDir();
  const existing = fileContentCache ?? (await FileSystem.readAsStringAsync(LOG_FILE).catch(() => ''));
  if (epoch !== fileWriteEpoch) return;
  const cleaned = ensureTrailingNewline(stripPerformanceAuditReportLines(existing));
  const blockBytes = textEncoder.encode(blockText).length;
  if (blockBytes > MAX_LOG_FILE_BYTES) {
    throw new Error(
      `Performance audit block (${blockBytes} bytes) exceeds the ${MAX_LOG_FILE_BYTES}-byte physical log budget`,
    );
  }
  const head = trimToBudget(cleaned, MAX_LOG_FILE_BYTES - blockBytes);
  const combined = ensureTrailingNewline(head) + blockText;
  await FileSystem.writeAsStringAsync(LOG_FILE, combined);
  if (epoch !== fileWriteEpoch) return;
  fileContentCache = combined;
}

function parseStoredPerformanceAudit(raw: string | null): StoredPerformanceAudit | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredPerformanceAudit>;
    if (
      value.schemaVersion !== PERFORMANCE_AUDIT_SCHEMA_VERSION ||
      typeof value.summaryMarker !== 'string' ||
      typeof value.reportJson !== 'string'
    ) return null;
    return {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      summaryMarker: redactSecrets(value.summaryMarker),
      reportJson: redactSecrets(value.reportJson),
    };
  } catch {
    return null;
  }
}

async function readLatestStoredPerformanceAudit(): Promise<StoredPerformanceAudit | null> {
  return (
    (await readPerformanceAuditSidecar()) ??
    parseStoredPerformanceAudit(
      await AsyncStorage.getItem(LATEST_PERFORMANCE_AUDIT_STORAGE_KEY).catch(() => null),
    )
  );
}

function compactStoredPerformanceAudit(latest: StoredPerformanceAudit): string {
  try {
    return redactSecrets(
      JSON.stringify(compactPerformanceAuditReportForLog(JSON.parse(latest.reportJson))),
    );
  } catch {
    return latest.reportJson;
  }
}

async function readPhysicalLogTailForUpload(): Promise<{
  text: string;
  omittedBytes: number;
}> {
  if (!FileSystem.documentDirectory) {
    return { text: buffer.getText(), omittedBytes: 0 };
  }
  const info = await FileSystem.getInfoAsync(LOG_FILE).catch(() => ({ exists: false }));
  if (!info.exists) return { text: buffer.getText(), omittedBytes: 0 };
  const size = typeof (info as { size?: unknown }).size === 'number'
    ? Math.max(0, Math.floor((info as { size: number }).size))
    : 0;
  if (size <= LOG_UPLOAD_READ_CHUNK_BYTES || size === 0) {
    return {
      text: await FileSystem.readAsStringAsync(LOG_FILE).catch(() => buffer.getText()),
      omittedBytes: 0,
    };
  }
  const position = size - LOG_UPLOAD_READ_CHUNK_BYTES;
  const chunk = await FileSystem.readAsStringAsync(LOG_FILE, {
    position,
    length: LOG_UPLOAD_READ_CHUNK_BYTES,
  }).catch(() => buffer.getText());
  const firstNewline = chunk.indexOf('\n');
  const text = firstNewline >= 0 ? chunk.slice(firstNewline + 1) : chunk;
  return {
    text,
    omittedBytes: position + (firstNewline >= 0 ? firstNewline + 1 : 0),
  };
}

function buildBoundedAuditUploadText(
  physicalTail: string,
  initiallyOmittedBytes: number,
  latest: StoredPerformanceAudit | null,
): string {
  const cleanTail = stripPerformanceAuditReportLines(redactSecrets(physicalTail));
  const auditBlock = latest
    ? [
        '# Latest complete performance audit',
        latest.summaryMarker,
        compactStoredPerformanceAudit(latest),
      ].join('\n')
    : '';
  const auditBytes = textEncoder.encode(auditBlock).length;
  const markerReserveBytes = 256;
  if (auditBytes + markerReserveBytes > LOG_UPLOAD_MAX_BODY_BYTES) {
    throw new Error(
      `Compact performance report (${auditBytes} bytes) exceeds the automatic upload budget`,
    );
  }
  let tail = trimToBudget(
    cleanTail,
    LOG_UPLOAD_MAX_BODY_BYTES - auditBytes - markerReserveBytes,
  );
  let omittedBytes = initiallyOmittedBytes + Math.max(
    0,
    textEncoder.encode(cleanTail).length - textEncoder.encode(tail).length,
  );
  const compose = () => [
    ...(omittedBytes > 0 ? [
      `# Earlier physical debug log content omitted from the automatic upload ` +
        `(omitted_bytes=${omittedBytes}); the complete log remains on device.`,
    ] : []),
    tail,
    auditBlock,
  ].filter(Boolean).join('\n');
  let result = compose();
  const overflow = textEncoder.encode(result).length - LOG_UPLOAD_MAX_BODY_BYTES;
  if (overflow > 0) {
    const beforeBytes = textEncoder.encode(tail).length;
    tail = trimToBudget(tail, Math.max(0, beforeBytes - overflow - 64));
    omittedBytes += beforeBytes - textEncoder.encode(tail).length;
    result = compose();
  }
  return result;
}

const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function isValidEntry(entry: unknown): entry is LogEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Partial<LogEntry>;
  if (typeof e.ts !== 'string' || !e.ts) return false;
  if (typeof e.level !== 'string' || !VALID_LOG_LEVELS.includes(e.level as LogLevel)) return false;
  if (typeof e.tag !== 'string' || !e.tag) return false;
  if (typeof e.message !== 'string') return false;
  return true;
}

export const debugLog = {
  debug(tag: string, message: string): void {
    append('debug', tag, message);
  },
  info(tag: string, message: string): void {
    append('info', tag, message);
  },
  warn(tag: string, message: string): void {
    append('warn', tag, message);
  },
  error(tag: string, message: string): void {
    append('error', tag, message);
    void flushPendingToFile();
  },
  /**
   * Start one fresh log session for this UI process. Memory is cleared
   * synchronously before any startup entry can be appended; disk cleanup runs
   * ahead of the first flush. Reopening an existing backgrounded process does
   * not reload this module, so its current session remains intact.
   */
  beginColdStartSession(): Promise<void> {
    if (coldStartResetPromise) return coldStartResetPromise;
    fileWriteEpoch += 1;
    buffer.clear();
    pendingFileLines = [];
    fileContentCache = null;
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    const inFlight = fileFlushPromise;
    fileFlushPromise = null;
    notify();
    coldStartResetPromise = (async () => {
      if (inFlight) await inFlight.catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      await FileSystem.deleteAsync(LOG_FILE, { idempotent: true }).catch(() => {});
      await FileSystem.deleteAsync(PERFORMANCE_AUDIT_SIDECAR_FILE, { idempotent: true }).catch(() => {});
    })();
    return coldStartResetPromise;
  },
  async clear(): Promise<void> {
    fileWriteEpoch += 1;
    buffer.clear();
    pendingFileLines = [];
    fileContentCache = null;
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    const inFlight = fileFlushPromise;
    fileFlushPromise = null;
    if (inFlight) {
      await inFlight.catch(() => {});
    }
    if (coldStartResetPromise) await coldStartResetPromise.catch(() => {});
    notify();
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await AsyncStorage.removeItem(LATEST_PERFORMANCE_AUDIT_STORAGE_KEY).catch(() => {});
    await FileSystem.deleteAsync(LOG_FILE, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(PERFORMANCE_AUDIT_SIDECAR_FILE, { idempotent: true }).catch(() => {});
  },
  getText(): string {
    return buffer.getText();
  },
  getDisplayText(maxBytes = MAX_LOG_DISPLAY_BYTES): string {
    return formatLogDisplayTail(buffer.getText(), maxBytes);
  },
  getEntries(): LogEntry[] {
    return buffer.getEntries();
  },
  getCursor(): number {
    return buffer.getCursor();
  },
  getEntriesAfter(cursor: number): LogEntry[] {
    return buffer.getEntriesAfter(cursor);
  },
  getLogFileUri(): string {
    return LOG_FILE;
  },
  getAndroidLogPathHint(): string {
    return ANDROID_LOG_PATH_HINT;
  },
  async flushToFile(requirePhysical = false): Promise<void> {
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    await flushPendingToFile(requirePhysical);
  },
  /**
   * Persist the canonical complete audit in both durable snapshot storage and
   * the physical diagnostic log. Snapshot storage keeps the newest diagnosis
   * independently recoverable if the bounded log later rolls over; explicit
   * begin/end records make a crash-truncated physical report detectable.
   */
  async storePerformanceAudit(summaryMarker: string, report: unknown): Promise<void> {
    const stored: StoredPerformanceAudit = {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      summaryMarker: redactSecrets(summaryMarker),
      reportJson: redactSecrets(JSON.stringify(report)),
    };
    // Sidecar first: AsyncStorage can fail after a durable disk write; reverse order
    // would leave neither physical artifact when setItem throws.
    await writePerformanceAuditSidecar(stored);
    try {
      await AsyncStorage.setItem(LATEST_PERFORMANCE_AUDIT_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // non-fatal once the sidecar exists
    }

    const beginMessage = physicalAuditMarker(stored.summaryMarker);
    let compactReportJson = stored.reportJson;
    try {
      compactReportJson = redactSecrets(
        JSON.stringify(compactPerformanceAuditReportForLog(JSON.parse(stored.reportJson))),
      );
    } catch {
      // Keep the original body if compaction cannot parse a custom fixture.
    }
    const jsonMessage = `${PERFORMANCE_AUDIT_REPORT_JSON} ${compactReportJson}`;
    const endMessage = `${PERFORMANCE_AUDIT_REPORT_END} ${stored.summaryMarker}`;
    const sidecarMessage = `${PERFORMANCE_AUDIT_REPORT_SIDECAR} ${PERFORMANCE_AUDIT_SIDECAR_FILE}`;
    const blockEntries: LogEntry[] = [beginMessage, jsonMessage, sidecarMessage, endMessage].map(
      (message) => ({
        ts: new Date().toISOString(),
        level: 'info' as const,
        tag: 'perf-audit',
        message,
      }),
    );
    for (const entry of blockEntries) {
      buffer.append(entry);
    }
    notify();

    // Flush ordinary pending lines first so the reserved audit write sees a
    // coherent head, then pin the complete block at the file tail.
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    await flushPendingToFile(FileSystem.documentDirectory != null);
    if (FileSystem.documentDirectory) {
      const epoch = fileWriteEpoch;
      const fullBlockText = blockEntries.map((entry) => `${formatEntry(entry)}\n`).join('');
      const compactEntries = blockEntries.filter(
        (entry) => !entry.message.startsWith(`${PERFORMANCE_AUDIT_REPORT_JSON} `),
      );
      const compactBlockText = compactEntries.map((entry) => `${formatEntry(entry)}\n`).join('');
      const blockText =
        textEncoder.encode(fullBlockText).length <= MAX_LOG_FILE_BYTES
          ? fullBlockText
          : compactBlockText;
      await writeReservedPerformanceAuditBlock(blockText, epoch);
      const physical = await FileSystem.readAsStringAsync(LOG_FILE);
      const sidecar = await readPerformanceAuditSidecar();
      const beginOk = physical.includes(beginMessage);
      const endOk = physical.includes(endMessage);
      const jsonInLog = physical.includes(compactReportJson);
      const sidecarOk =
        sidecar?.summaryMarker === stored.summaryMarker &&
        sidecar.reportJson === stored.reportJson;
      // Reserved-tail write keeps begin/end intact; compact JSON lives in the log
      // when it fits, otherwise the sidecar is the durable full body.
      if (!beginOk || !endOk || (!jsonInLog && !sidecarOk)) {
        throw new Error('Complete performance audit was not verified in the physical log file');
      }
    }
  },
  /** Read the flushed on-disk log plus a paste-sized audit snapshot. */
  async readCompleteText(): Promise<string> {
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    await flushPendingToFile();
    const text = !FileSystem.documentDirectory
      ? buffer.getText()
      : await FileSystem.readAsStringAsync(LOG_FILE).catch(() => buffer.getText());
    const clean = redactSecrets(text);
    // Prefer the sidecar so a failed/stale AsyncStorage write cannot hide a newer disk report.
    const latest = await readLatestStoredPerformanceAudit();
    if (!latest) return clean;
    const physicalBegin = physicalAuditMarker(latest.summaryMarker);
    const physicalEnd = `${PERFORMANCE_AUDIT_REPORT_END} ${latest.summaryMarker}`;
    const compactJson = compactStoredPerformanceAudit(latest);
    if (
      clean.includes(physicalBegin) &&
      clean.includes(physicalEnd) &&
      (clean.includes(compactJson) || clean.includes(latest.reportJson))
    ) {
      return clean;
    }
    return [
      clean,
      '',
      '# Latest complete performance audit',
      latest.summaryMarker,
      compactJson,
    ].join('\n');
  },
  /** Bounded automatic-upload snapshot: newest physical lines plus the complete compact audit. */
  async readAuditUploadText(): Promise<string> {
    if (fileFlushTimer) {
      clearTimeout(fileFlushTimer);
      fileFlushTimer = null;
    }
    await flushPendingToFile();
    const [physical, latest] = await Promise.all([
      readPhysicalLogTailForUpload(),
      readLatestStoredPerformanceAudit(),
    ]);
    return buildBoundedAuditUploadText(physical.text, physical.omittedBytes, latest);
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async restoreFromStorage(): Promise<void> {
    const restored: LogEntry[] = [];

    try {
      if (FileSystem.documentDirectory) {
        await ensureLogDir();
        const info = await FileSystem.getInfoAsync(LOG_FILE);
        if (info.exists) {
          const text = await FileSystem.readAsStringAsync(LOG_FILE);
          fileContentCache = text;
          restored.push(...parseLogFile(text).slice(-MAX_LOG_LINES));
        }
      }
    } catch {
      // non-fatal
    }

    if (restored.length === 0) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const tail = JSON.parse(raw) as LogEntry[];
          if (Array.isArray(tail)) {
            restored.push(...tail.filter(isValidEntry));
          }
        }
      } catch {
        // ignore corrupt snapshot
      }
    }

    if (restored.length === 0) return;
    // Startup logging may have flushed to the same file while this deferred
    // read was in flight. Do not merge those exact current-session entries a
    // second time into the bounded diagnostic buffer.
    const liveLines = new Set(buffer.getEntries().map(formatEntry));
    buffer.loadHistory(restored.filter((entry) => !liveLines.has(formatEntry(entry))));
    notify();
  },
};

/** Format log bundle for paste.rs upload (header + body). */
export function formatLogUploadBody(entriesText: string, meta?: Record<string, string>): string {
  const lines = ['# AR-app mobile debug log', `generated=${new Date().toISOString()}`];
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      lines.push(redactSecrets(`${key}=${value}`));
    }
  }
  // Re-redact at the export boundary so logs restored from an older app build
  // receive the current privacy rules too.
  lines.push('', redactSecrets(entriesText));
  return lines.join('\n');
}

/** Canonical export wrapper: every exported artifact identifies its installed build. */
export function formatVersionedLogExport(
  entriesText: string,
  appVersion: string,
  buildVersion: string,
  meta: Record<string, string> = {},
): string {
  return formatLogUploadBody(entriesText, {
    ...meta,
    app_version: appVersion,
    build_version: buildVersion,
  });
}

export const PASTE_RS_URL = 'https://paste.rs/';
export const PASTE_CNET_URL = 'https://paste.c-net.org/';
export const PASTE_RS_ATTEMPT_TIMEOUT_MS = 20_000;
export const PASTE_RS_TAIL_MAX_BYTES = 128 * 1024;

const PASTE_RS_RETRY_BACKOFF_MS = 1_000;
const PASTE_RS_MAX_RETRY_DELAY_MS = 5_000;

export interface PasteRsUploadResult {
  url: string;
  /** paste.rs returned 206 and truncated the submitted body. */
  truncated: boolean;
  /** The client submitted only the newest log tail after two transient failures. */
  clientTruncated: boolean;
  attempts: number;
  originalBytes: number;
  uploadedBytes: number;
}

export interface DebugLogUploadResult extends PasteRsUploadResult {
  provider: 'paste.rs' | 'paste.c-net.org';
  /** Present only for the backup provider and kept in memory for deletion. */
  deleteKey?: string;
}

export interface PasteRsUploadOptions {
  attemptTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

type PasteRsFailureKind =
  | 'timeout'
  | 'network'
  | 'rate-limit'
  | 'server'
  | 'client'
  | 'invalid-response';

class PasteRsAttemptError extends Error {
  constructor(
    readonly kind: PasteRsFailureKind,
    readonly status?: number,
    readonly responseBody = '',
    readonly retryAfter?: string | null,
  ) {
    super(kind);
    this.name = 'PasteRsAttemptError';
  }

  get transient(): boolean {
    return (
      this.kind === 'timeout' ||
      this.kind === 'network' ||
      this.kind === 'rate-limit' ||
      this.kind === 'server'
    );
  }
}

export class PasteRsUploadError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = 'PasteRsUploadError';
  }
}

function sanitizePasteRsResponse(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function friendlyPasteRsError(error: PasteRsAttemptError): string {
  switch (error.kind) {
    case 'timeout':
      return 'paste.rs did not respond in time. Try again, or use Share or Copy instead.';
    case 'network':
      return 'Could not reach paste.rs. Check your connection, then try again or use Share or Copy instead.';
    case 'rate-limit':
      return 'paste.rs is rate-limiting uploads. Try again later, or use Share or Copy instead.';
    case 'server':
      return `paste.rs is temporarily unavailable (server error ${error.status ?? 'unknown'}). Try again later, or use Share or Copy instead.`;
    case 'client': {
      const detail = sanitizePasteRsResponse(error.responseBody);
      return `paste.rs rejected the upload (status ${error.status ?? 'unknown'})${detail ? `: ${detail}` : '.'} Use Share or Copy instead.`;
    }
    case 'invalid-response':
      return 'paste.rs returned an invalid upload link. Use Share or Copy instead.';
  }
}

function retryDelayMs(retryAfter: string | null | undefined, now: number): number {
  if (!retryAfter) return PASTE_RS_RETRY_BACKOFF_MS;

  const seconds = Number(retryAfter);
  const requestedMs = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(retryAfter) - now;
  if (!Number.isFinite(requestedMs)) return PASTE_RS_RETRY_BACKOFF_MS;
  return Math.max(0, Math.min(PASTE_RS_MAX_RETRY_DELAY_MS, requestedMs));
}

function createNewestLogTail(body: string): {
  body: string;
  clientTruncated: boolean;
  originalBytes: number;
  uploadedBytes: number;
} {
  const encoded = textEncoder.encode(body);
  if (encoded.length <= PASTE_RS_TAIL_MAX_BYTES) {
    return {
      body,
      clientTruncated: false,
      originalBytes: encoded.length,
      uploadedBytes: encoded.length,
    };
  }

  let omittedBytes = encoded.length;
  let uploadBody = '';
  for (let pass = 0; pass < 4; pass += 1) {
    const marker =
      `# Earlier debug log content omitted locally before upload ` +
      `(omitted_bytes=${omittedBytes}). Only the newest log tail follows.\n`;
    const markerBytes = textEncoder.encode(marker).length;
    const tailBudget = Math.max(0, PASTE_RS_TAIL_MAX_BYTES - markerBytes);
    let tailStart = Math.max(0, encoded.length - tailBudget);

    // Do not start inside a multi-byte UTF-8 sequence.
    while (tailStart < encoded.length && (encoded[tailStart] & 0xc0) === 0x80) {
      tailStart += 1;
    }

    uploadBody = marker + textDecoder.decode(encoded.slice(tailStart));
    if (tailStart === omittedBytes) break;
    omittedBytes = tailStart;
  }

  return {
    body: uploadBody,
    clientTruncated: true,
    originalBytes: encoded.length,
    uploadedBytes: textEncoder.encode(uploadBody).length,
  };
}

async function runPasteRsAttempt(
  body: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ url: string; truncated: boolean }> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new PasteRsAttemptError('timeout'));
    }, timeoutMs);
  });

  try {
    const request = (async () => {
      const response = await fetchImpl(PASTE_RS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        signal: controller.signal,
      });
      const raw = (await response.text()).trim();

      if (response.status === 201 || response.status === 206) {
        let parsed: URL;
        try {
          parsed = new URL(raw);
        } catch {
          throw new PasteRsAttemptError('invalid-response', response.status);
        }
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'paste.rs') {
          throw new PasteRsAttemptError('invalid-response', response.status);
        }
        return { url: raw, truncated: response.status === 206 };
      }

      const retryAfter = response.headers?.get?.('Retry-After');
      if (response.status === 429) {
        throw new PasteRsAttemptError('rate-limit', response.status, raw, retryAfter);
      }
      if (response.status === 0) {
        throw new PasteRsAttemptError('network', response.status, raw, retryAfter);
      }
      if (response.status >= 500 && response.status <= 599) {
        throw new PasteRsAttemptError('server', response.status, raw, retryAfter);
      }
      throw new PasteRsAttemptError('client', response.status, raw, retryAfter);
    })();
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof PasteRsAttemptError) throw error;
    if (
      timedOut ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new PasteRsAttemptError('timeout');
    }
    throw new PasteRsAttemptError('network');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function runPasteCnetAttempt(
  body: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ url: string; deleteKey?: string }> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new PasteRsAttemptError('timeout'));
    }, timeoutMs);
  });

  try {
    const request = (async () => {
      const response = await fetchImpl(PASTE_CNET_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json, */*',
          'Content-Type': 'text/plain',
          'X-UUID': '1',
        },
        body,
        signal: controller.signal,
      });
      const raw = (await response.text()).trim();
      if (response.status < 200 || response.status > 299) {
        const retryAfter = response.headers?.get?.('Retry-After');
        if (response.status === 429) {
          throw new PasteRsAttemptError('rate-limit', response.status, raw, retryAfter);
        }
        if (response.status === 0) {
          throw new PasteRsAttemptError('network', response.status, raw, retryAfter);
        }
        if (response.status >= 500) {
          throw new PasteRsAttemptError('server', response.status, raw, retryAfter);
        }
        throw new PasteRsAttemptError('client', response.status, raw, retryAfter);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new PasteRsAttemptError('invalid-response', response.status);
      }
      const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      const url = typeof record?.url === 'string' ? record.url.trim() : '';
      const deleteKey = typeof record?.delete_key === 'string' ? record.delete_key : undefined;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new PasteRsAttemptError('invalid-response', response.status);
      }
      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'paste.c-net.org') {
        throw new PasteRsAttemptError('invalid-response', response.status);
      }
      return { url, ...(deleteKey ? { deleteKey } : {}) };
    })();
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof PasteRsAttemptError) throw error;
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      throw new PasteRsAttemptError('timeout');
    }
    throw new PasteRsAttemptError('network');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Upload once to paste.rs, then fail over to the explicitly disclosed backup
 * only for a transient primary outage. Client rejections never duplicate data.
 */
export async function uploadDebugLog(
  body: string,
  fetchImpl: typeof fetch = fetch,
  options: PasteRsUploadOptions = {},
): Promise<DebugLogUploadResult> {
  const timeoutMs = Math.max(1, options.attemptTimeoutMs ?? PASTE_RS_ATTEMPT_TIMEOUT_MS);
  const originalBytes = textEncoder.encode(body).length;
  try {
    const result = await runPasteRsAttempt(body, fetchImpl, timeoutMs);
    return {
      ...result,
      provider: 'paste.rs',
      clientTruncated: false,
      attempts: 1,
      originalBytes,
      uploadedBytes: originalBytes,
    };
  } catch (error) {
    const primaryFailure = error as PasteRsAttemptError;
    if (!primaryFailure.transient) {
      throw new PasteRsUploadError(friendlyPasteRsError(primaryFailure), 1);
    }
  }

  try {
    const result = await runPasteCnetAttempt(body, fetchImpl, timeoutMs);
    return {
      url: result.url,
      provider: 'paste.c-net.org',
      ...(result.deleteKey ? { deleteKey: result.deleteKey } : {}),
      truncated: false,
      clientTruncated: false,
      attempts: 2,
      originalBytes,
      uploadedBytes: originalBytes,
    };
  } catch (error) {
    const detail = friendlyPasteRsError(error as PasteRsAttemptError)
      .replaceAll('paste.rs', 'the backup upload service');
    throw new PasteRsUploadError(
      `Both public upload services are unavailable. ${detail}`,
      2,
    );
  }
}

/** Delete a backup-host upload without persisting or exposing its delete key. */
export async function deleteDebugLogUpload(
  url: string,
  deleteKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = PASTE_RS_ATTEMPT_TIMEOUT_MS,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('The upload link is invalid.');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'paste.c-net.org' || !deleteKey) {
    throw new Error('This upload cannot be deleted from the app.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetchImpl(url, {
      method: 'DELETE',
      headers: { 'X-Delete-Key': deleteKey },
      signal: controller.signal,
    });
    if (response.status < 200 || response.status > 299) {
      throw new Error(`The upload host could not delete the log (status ${response.status}).`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The upload host did not confirm deletion in time.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

let globalHandlersInstalled = false;

/** Test hook — allow reinstalling handlers between Jest cases. */
export function resetGlobalErrorHandlersForTests(): void {
  globalHandlersInstalled = false;
}

/** Log fatal JS errors and unhandled rejections before the process/native layer exits. */
export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  const utils = (global as typeof global & { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (utils?.setGlobalHandler) {
    const previous = utils.getGlobalHandler?.();
    utils.setGlobalHandler((error, isFatal) => {
      debugLog.error(
        'global',
        `${isFatal ? 'fatal' : 'js'} trace=${formatErrorTrace(error)}`,
      );
      previous?.(error, isFatal);
    });
  }

  const processLike = global as typeof global & {
    process?: { on?: (event: string, listener: (reason: unknown) => void) => void };
  };
  processLike.process?.on?.('unhandledRejection', (reason) => {
    debugLog.error('global', `unhandledRejection trace=${formatErrorTrace(reason)}`);
  });
}

/**
 * POST plain text to paste.rs. Transient failures get one bounded retry, then
 * one final attempt containing only a UTF-8-safe 128 KiB newest-log tail.
 */
export async function uploadLogsToPasteRs(
  body: string,
  fetchImpl: typeof fetch = fetch,
  options: PasteRsUploadOptions = {},
): Promise<PasteRsUploadResult> {
  const timeoutMs = Math.max(1, options.attemptTimeoutMs ?? PASTE_RS_ATTEMPT_TIMEOUT_MS);
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const originalBytes = textEncoder.encode(body).length;

  let firstFailure: PasteRsAttemptError;
  try {
    const result = await runPasteRsAttempt(body, fetchImpl, timeoutMs);
    return {
      ...result,
      clientTruncated: false,
      attempts: 1,
      originalBytes,
      uploadedBytes: originalBytes,
    };
  } catch (error) {
    firstFailure = error as PasteRsAttemptError;
    if (!firstFailure.transient) {
      throw new PasteRsUploadError(friendlyPasteRsError(firstFailure), 1);
    }
  }

  await sleep(retryDelayMs(firstFailure.retryAfter, now()));

  let secondFailure: PasteRsAttemptError;
  try {
    const result = await runPasteRsAttempt(body, fetchImpl, timeoutMs);
    return {
      ...result,
      clientTruncated: false,
      attempts: 2,
      originalBytes,
      uploadedBytes: originalBytes,
    };
  } catch (error) {
    secondFailure = error as PasteRsAttemptError;
    if (!secondFailure.transient) {
      throw new PasteRsUploadError(friendlyPasteRsError(secondFailure), 2);
    }
  }

  await sleep(retryDelayMs(secondFailure.retryAfter, now()));

  const tail = createNewestLogTail(body);
  try {
    const result = await runPasteRsAttempt(tail.body, fetchImpl, timeoutMs);
    return {
      ...result,
      clientTruncated: tail.clientTruncated,
      attempts: 3,
      originalBytes: tail.originalBytes,
      uploadedBytes: tail.uploadedBytes,
    };
  } catch (error) {
    const finalFailure = error as PasteRsAttemptError;
    throw new PasteRsUploadError(friendlyPasteRsError(finalFailure), 3);
  }
}
