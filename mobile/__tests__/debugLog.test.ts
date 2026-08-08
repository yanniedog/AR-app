import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// eslint-disable-next-line import/first -- imports after jest mocks
import {
  ANDROID_LOG_PATH_HINT,
  MAX_LOG_BYTES,
  MAX_LOG_FILE_BYTES,
  MAX_LOG_LINES,
  PASTE_RS_ATTEMPT_TIMEOUT_MS,
  PASTE_RS_TAIL_MAX_BYTES,
  PASTE_CNET_URL,
  RingBuffer,
  debugLog,
  deleteDebugLogUpload,
  formatEntry,
  formatErrorTrace,
  formatLogUploadBody,
  formatVersionedLogExport,
  formatLogDisplayTail,
  installGlobalErrorHandlers,
  parseLogLine,
  redactSecrets,
  resetGlobalErrorHandlersForTests,
  uploadDebugLog,
  uploadLogsToPasteRs,
} from '../src/lib/debugLog';
import {
  LATEST_PERFORMANCE_AUDIT_STORAGE_KEY,
  PERFORMANCE_AUDIT_SCHEMA_VERSION,
} from '../src/lib/performanceAuditSchema';
import {
  setDiagnosticsEnabled,
  setObservabilityDepsForTests,
  type CrashlyticsLike,
  type ClarityLike,
} from '../src/lib/observability';

const crashlyticsApi: CrashlyticsLike = {
  log: jest.fn(),
  recordError: jest.fn(),
  setCrashlyticsCollectionEnabled: jest.fn(async () => {}),
};

const clarityApi: ClarityLike = {
  initialize: jest.fn(),
  pause: jest.fn(async () => true),
  resume: jest.fn(async () => true),
  consent: jest.fn(async () => true),
};

describe('redactSecrets', () => {
  it('redacts EXPO_TOKEN and bearer tokens', () => {
    const input = 'auth EXPO_TOKEN=abc123 Bearer sk-live-xyz token=secretval';
    const out = redactSecrets(input);
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('sk-live-xyz');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts account identifiers and email addresses', () => {
    const out = redactSecrets(
      'auth signed in uid=firebase-123 email=person@example.com subscriptionId=sub-secret',
    );
    expect(out).not.toContain('firebase-123');
    expect(out).not.toContain('person@example.com');
    expect(out).not.toContain('sub-secret');
  });
});

describe('formatErrorTrace', () => {
  it('keeps the full stack on one physical log line', () => {
    const error = new Error('audit failed');
    const trace = formatErrorTrace(error);
    expect(trace).toContain('Error: audit failed');
    expect(trace).toContain(String.raw`\n`);
    expect(trace).not.toContain('\n');
  });

  it('formats non-Error rejection values safely', () => {
    expect(formatErrorTrace(undefined)).toBe('undefined');
    expect(formatErrorTrace({ reason: 'slow' })).toBe('{"reason":"slow"}');
  });
});

describe('RingBuffer', () => {
  it('evicts oldest lines when exceeding MAX_LOG_LINES', () => {
    const buf = new RingBuffer();
    for (let i = 0; i < MAX_LOG_LINES + 5; i++) {
      buf.append({
        ts: new Date().toISOString(),
        level: 'debug',
        tag: 't',
        message: `line-${i}`,
      });
    }
    expect(buf.size()).toBe(MAX_LOG_LINES);
    expect(buf.getText()).toContain(`line-${MAX_LOG_LINES + 4}`);
    expect(buf.getText()).not.toContain('line-0');
  });

  it('evicts by byte budget', () => {
    const buf = new RingBuffer();
    const chunk = 'x'.repeat(1024);
    const lines = Math.ceil(MAX_LOG_BYTES / (chunk.length + 40)) + 2;
    for (let i = 0; i < lines; i++) {
      buf.append({
        ts: new Date().toISOString(),
        level: 'info',
        tag: 'big',
        message: `${chunk}-${i}`,
      });
    }
    expect(buf.size()).toBeLessThan(lines);
    expect(buf.getText().length).toBeLessThanOrEqual(MAX_LOG_BYTES + 512);
  });

  it('uses a stable cursor after head entries are evicted', () => {
    const buf = new RingBuffer();
    for (let i = 0; i < MAX_LOG_LINES; i++) {
      buf.append({
        ts: new Date().toISOString(),
        level: 'debug',
        tag: 'old',
        message: `line-${i}`,
      });
    }
    const cursor = buf.getCursor();
    buf.append({
      ts: new Date().toISOString(),
      level: 'error',
      tag: 'new',
      message: 'route failed',
    });

    expect(buf.size()).toBe(MAX_LOG_LINES);
    expect(buf.getEntriesAfter(cursor)).toEqual([
      expect.objectContaining({ tag: 'new', message: 'route failed' }),
    ]);
  });
});

describe('formatLogUploadBody', () => {
  it('wraps entries with header metadata', () => {
    const body = formatLogUploadBody('2026-01-01T00:00:00.000Z [INFO] app: hi', {
      app: '1.0.0',
      lines: '1',
    });
    expect(body).toContain('# AR-app mobile debug log');
    expect(body).toContain('app=1.0.0');
    expect(body).toContain('[INFO] app: hi');
  });

  it('re-redacts restored legacy entries at export time', () => {
    const body = formatLogUploadBody(
      '2026-01-01T00:00:00.000Z [INFO] auth: signed in uid=legacy-user person@example.com',
    );
    expect(body).not.toContain('legacy-user');
    expect(body).not.toContain('person@example.com');
  });

  it('puts the exact installed app version and build in every canonical export', () => {
    const body = formatVersionedLogExport('log body', '1.2.3', '456', {
      app_version: 'stale',
      build_version: 'stale',
    });
    expect(body).toContain('app_version=1.2.3');
    expect(body).toContain('build_version=456');
    expect(body).not.toContain('stale');
  });
});

describe('uploadDebugLog', () => {
  it('uses paste.rs without contacting the backup when the primary succeeds', async () => {
    const mockFetch = jest.fn(async () => ({
      status: 201,
      text: async () => 'https://paste.rs/primary',
    })) as unknown as typeof fetch;

    const result = await uploadDebugLog('hello', mockFetch);

    expect(result).toEqual(expect.objectContaining({ provider: 'paste.rs', attempts: 1 }));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails over once to an unguessable c-net paste after a transient outage', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ status: 500, text: async () => 'unavailable' })
      .mockResolvedValueOnce({
        status: 201,
        text: async () =>
          JSON.stringify({
            url: 'https://paste.c-net.org/11111111-2222-3333-4444-555555555555',
            delete_key: 'delete-secret',
          }),
      }) as unknown as typeof fetch;

    const result = await uploadDebugLog('hello', mockFetch);

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'paste.c-net.org',
        attempts: 2,
        deleteKey: 'delete-secret',
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      PASTE_CNET_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json, */*',
          'X-UUID': '1',
        }),
        body: 'hello',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not duplicate a client-rejected upload to the backup', async () => {
    const mockFetch = jest.fn(async () => ({
      status: 400,
      text: async () => 'bad request',
    })) as unknown as typeof fetch;

    await expect(uploadDebugLog('hello', mockFetch)).rejects.toThrow(
      'paste.rs rejected the upload',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a backup response outside the exact HTTPS allowlist', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ status: 503, text: async () => 'unavailable' })
      .mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ url: 'https://example.com/not-allowed' }),
      }) as unknown as typeof fetch;

    await expect(uploadDebugLog('hello', mockFetch)).rejects.toThrow(
      'Both public upload services are unavailable',
    );
  });
});

describe('deleteDebugLogUpload', () => {
  it('deletes only an allowlisted backup upload with its key', async () => {
    const mockFetch = jest.fn(async () => ({ status: 204 })) as unknown as typeof fetch;
    const url = 'https://paste.c-net.org/11111111-2222-3333-4444-555555555555';

    await deleteDebugLogUpload(url, 'delete-secret', mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'X-Delete-Key': 'delete-secret' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('rejects non-backup URLs before sending the delete key', async () => {
    const mockFetch = jest.fn() as unknown as typeof fetch;
    await expect(
      deleteDebugLogUpload('https://example.com/not-allowed', 'delete-secret', mockFetch),
    ).rejects.toThrow('cannot be deleted');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('uploadLogsToPasteRs', () => {
  it('returns paste URL on 201', async () => {
    const mockFetch = jest.fn(async () => ({
      status: 201,
      text: async () => 'https://paste.rs/abc123',
    })) as unknown as typeof fetch;
    const result = await uploadLogsToPasteRs('hello', mockFetch);
    expect(result.url).toBe('https://paste.rs/abc123');
    expect(result.truncated).toBe(false);
    expect(result.clientTruncated).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.originalBytes).toBe(5);
    expect(result.uploadedBytes).toBe(5);
    expect(PASTE_RS_ATTEMPT_TIMEOUT_MS).toBe(20_000);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://paste.rs/',
      expect.objectContaining({
        method: 'POST',
        body: 'hello',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('marks truncated on 206', async () => {
    const mockFetch = jest.fn(async () => ({
      status: 206,
      text: async () => 'https://paste.rs/partial',
    })) as unknown as typeof fetch;
    const result = await uploadLogsToPasteRs('big log', mockFetch);
    expect(result.truncated).toBe(true);
    expect(result.clientTruncated).toBe(false);
  });

  it('retries 429 once and bounds Retry-After before succeeding', async () => {
    const sleep = jest.fn(async () => {});
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => '30' },
        text: async () => 'rate limited',
      })
      .mockResolvedValueOnce({
        status: 201,
        text: async () => 'https://paste.rs/retried',
      }) as unknown as typeof fetch;

    const result = await uploadLogsToPasteRs('x', mockFetch, { sleep });

    expect(result.url).toBe('https://paste.rs/retried');
    expect(result.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(5_000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses a UTF-8-safe 128 KiB newest tail for the final attempt', async () => {
    const body = `${'old😀'.repeat(40_000)}\nNEWEST-END-😀`;
    const mockFetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('network request failed'))
      .mockResolvedValueOnce({
        status: 503,
        text: async () => '<html><body>Unavailable</body></html>',
      })
      .mockResolvedValueOnce({
        status: 201,
        text: async () => 'https://paste.rs/tail',
      }) as unknown as typeof fetch;

    const result = await uploadLogsToPasteRs(body, mockFetch, {
      sleep: async () => {},
    });
    const tailBody = (mockFetch as jest.Mock).mock.calls[2][1].body as string;

    expect(result.url).toBe('https://paste.rs/tail');
    expect(result.attempts).toBe(3);
    expect(result.clientTruncated).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.originalBytes).toBe(new TextEncoder().encode(body).length);
    expect(result.uploadedBytes).toBe(new TextEncoder().encode(tailBody).length);
    expect(result.uploadedBytes).toBeLessThanOrEqual(PASTE_RS_TAIL_MAX_BYTES);
    expect(tailBody).toContain('Earlier debug log content omitted locally');
    expect(tailBody).toContain('NEWEST-END-😀');
    expect(tailBody).not.toContain('\uFFFD');
  });

  it('does not retry other 4xx responses and strips raw HTML from the error', async () => {
    const mockFetch = jest.fn(async () => ({
      status: 400,
      text: async () =>
        '<html><head><title>Bad request</title></head><body><script>alert(1)</script>Invalid &lt;upload&gt;</body></html>',
    })) as unknown as typeof fetch;

    await expect(
      uploadLogsToPasteRs('x', mockFetch, { sleep: async () => {} }),
    ).rejects.toThrow(
      'paste.rs rejected the upload (status 400): Bad request Invalid <upload> Use Share or Copy instead.',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('makes at most three attempts and reports a friendly 5xx failure', async () => {
    const sleep = jest.fn(async () => {});
    const mockFetch = jest.fn(async () => ({
      status: 500,
      text: async () =>
        '<html><head><title>500 Internal Server Error</title></head></html>',
    })) as unknown as typeof fetch;

    await expect(
      uploadLogsToPasteRs('x', mockFetch, { sleep }),
    ).rejects.toThrow(
      'paste.rs is temporarily unavailable (server error 500). Try again later, or use Share or Copy instead.',
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('aborts each timed-out attempt and stops after the tail attempt', async () => {
    const signals: AbortSignal[] = [];
    const mockFetch = jest.fn((_url: unknown, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    await expect(
      uploadLogsToPasteRs('x', mockFetch, {
        attemptTimeoutMs: 2,
        sleep: async () => {},
      }),
    ).rejects.toThrow('paste.rs did not respond in time');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});

describe('parseLogLine', () => {
  it('round-trips formatted entries', () => {
    const entry = {
      ts: '2026-01-01T00:00:00.000Z',
      level: 'info' as const,
      tag: 'app',
      message: 'bootstrap starting',
    };
    const parsed = parseLogLine(formatEntry(entry));
    expect(parsed).toEqual(entry);
  });

  it('re-redacts identifiers restored from an older persisted log', () => {
    const parsed = parseLogLine(
      '2026-01-01T00:00:00.000Z [INFO ] auth: signed in uid=legacy-user person@example.com',
    );
    expect(parsed?.message).not.toContain('legacy-user');
    expect(parsed?.message).not.toContain('person@example.com');
  });
});

describe('persistent log file', () => {
  const LOG_PATH = 'file:///docs/logs/ar-local.log';
  const AUDIT_SIDECAR_PATH = 'file:///docs/logs/ar-performance-audit-latest.json';

  function installPathAwareFiles(seed: Record<string, string> = {}): Record<string, string> {
    const files = { ...seed };
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
      files[path] = contents;
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (path: string) => {
      if (!(path in files)) throw new Error(`missing file ${path}`);
      return files[path];
    });
    (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (path: string) => {
      delete files[path];
    });
    return files;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    setObservabilityDepsForTests({
      crashlytics: () => crashlyticsApi,
      clarity: clarityApi,
    });
    await setDiagnosticsEnabled(true);
    debugLog.clear();
    await AsyncStorage.clear();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('');
  });

  afterEach(() => {
    setObservabilityDepsForTests(null);
  });

  it('writes log lines to the persistent file', async () => {
    debugLog.info('test', 'file persist');
    await debugLog.flushToFile();

    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///docs/logs/',
      { intermediates: true },
    );
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    const [path, contents] = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(path).toBe(LOG_PATH);
    expect(contents).toContain('file persist');
    expect(contents).not.toContain('secret');
  });

  it('reads and re-redacts the complete current-session file for upload', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
      '2026-01-01T00:00:00.000Z [INFO ] app: token=old-secret',
    );

    const complete = await debugLog.readCompleteText();

    expect(complete).toContain('token=[REDACTED]');
    expect(complete).not.toContain('old-secret');
  });

  it('flushes a crash-detectable complete audit into the physical log without export duplication', async () => {
    const files = installPathAwareFiles();
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=physical app_version=9.8.7 build_version=654`;
    await debugLog.storePerformanceAudit(marker, {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
      sentinel: 'physical-complete-audit',
    });

    const physicalLog = files[LOG_PATH];
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_BEGIN ${marker}`);
    expect(physicalLog).toContain('PERFORMANCE_AUDIT_REPORT_JSON');
    expect(physicalLog).toContain('physical-complete-audit');
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_END ${marker}`);
    expect(physicalLog).toContain('PERFORMANCE_AUDIT_REPORT_SIDECAR');
    expect(files[AUDIT_SIDECAR_PATH]).toContain('physical-complete-audit');

    const complete = await debugLog.readCompleteText();
    expect(complete.match(/physical-complete-audit/g)).toHaveLength(1);
    expect(complete).not.toContain('# Latest complete performance audit');
  });

  it('keeps a complete audit block when the physical log is already near capacity', async () => {
    const noiseLine = `${'n'.repeat(8_000)}\n`;
    const nearlyFull = noiseLine.repeat(Math.ceil(MAX_LOG_FILE_BYTES / noiseLine.length));
    const files = installPathAwareFiles({ [LOG_PATH]: nearlyFull });
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=near-full app_version=9.8.7 build_version=654`;
    const report = {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
      sentinel: 'near-full-audit-body',
      checks: Array.from({ length: 40 }, (_, index) => ({
        id: `check-${index}`,
        label: `verbose check ${index}`,
        detail: 'x'.repeat(2_000),
      })),
    };

    await debugLog.storePerformanceAudit(marker, report);

    const physicalLog = files[LOG_PATH];
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_BEGIN ${marker}`);
    expect(physicalLog).toContain('near-full-audit-body');
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_END ${marker}`);
    expect(new TextEncoder().encode(physicalLog).length).toBeLessThanOrEqual(MAX_LOG_FILE_BYTES);
    expect(files[AUDIT_SIDECAR_PATH]).toContain('near-full-audit-body');
  });

  it('keeps begin/end markers and restores an oversized report from the sidecar', async () => {
    const files = installPathAwareFiles();
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=oversized app_version=9.8.7 build_version=654`;
    const report = {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
      sentinel: 'oversized-audit-body',
      blob: 'O'.repeat(MAX_LOG_FILE_BYTES + 64 * 1024),
    };

    await debugLog.storePerformanceAudit(marker, report);

    const physicalLog = files[LOG_PATH];
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_BEGIN ${marker}`);
    expect(physicalLog).toContain(`PERFORMANCE_AUDIT_REPORT_END ${marker}`);
    expect(physicalLog).toContain('PERFORMANCE_AUDIT_REPORT_SIDECAR');
    expect(physicalLog).not.toContain('PERFORMANCE_AUDIT_REPORT_JSON');
    expect(physicalLog).not.toContain('oversized-audit-body');
    expect(new TextEncoder().encode(physicalLog).length).toBeLessThanOrEqual(MAX_LOG_FILE_BYTES);
    expect(files[AUDIT_SIDECAR_PATH]).toContain('oversized-audit-body');

    files[LOG_PATH] = physicalLog;
    const complete = await debugLog.readCompleteText();
    expect(complete).toContain('# Latest complete performance audit');
    expect(complete).toContain('oversized-audit-body');
  });

  it('restores the latest audit from the sidecar when AsyncStorage persistence fails', async () => {
    const files = installPathAwareFiles();
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockRejectedValueOnce(new Error('asyncstorage full'));
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=sidecar-only app_version=9.8.7 build_version=654`;

    await debugLog.storePerformanceAudit(marker, {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
      sentinel: 'sidecar-after-asyncstorage-failure',
    });

    await expect(AsyncStorage.getItem(LATEST_PERFORMANCE_AUDIT_STORAGE_KEY)).resolves.toBeNull();
    expect(files[AUDIT_SIDECAR_PATH]).toContain('sidecar-after-asyncstorage-failure');
    files[LOG_PATH] = 'log without reserved audit markers';

    const complete = await debugLog.readCompleteText();
    expect(complete).toContain('# Latest complete performance audit');
    expect(complete).toContain('sidecar-after-asyncstorage-failure');
  });

  it('does not report physical audit persistence when the filesystem write fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=write-failure app_version=9.8.7 build_version=654`;

    await expect(debugLog.storePerformanceAudit(marker, {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
    })).rejects.toThrow('disk full');
  });

  it('includes the durable complete audit after the bounded ring has evicted its marker', async () => {
    const files = installPathAwareFiles();
    const marker = `PERFORMANCE_AUDIT_SUMMARY schema=${PERFORMANCE_AUDIT_SCHEMA_VERSION} session=durable app_version=9.8.7 build_version=654`;
    await debugLog.storePerformanceAudit(marker, {
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION,
      app: { appVersion: '9.8.7', buildVersion: '654' },
      sentinel: 'complete-audit-survived',
    });
    debugLog.info('perf-audit', marker);
    const chunk = 'x'.repeat(8 * 1024);
    for (let index = 0; index < Math.ceil(MAX_LOG_BYTES / chunk.length) + 10; index += 1) {
      debugLog.info('noise', `${index}:${chunk}`);
    }
    expect(debugLog.getText()).not.toContain(marker);
    await debugLog.flushToFile();
    // Simulate a later bounded-file rollover that dropped the reserved audit block.
    files[LOG_PATH] = 'newest bounded on-disk log';

    const complete = await debugLog.readCompleteText();

    expect(complete).toContain('# Latest complete performance audit');
    expect(complete).toContain(marker);
    expect(complete).toContain('complete-audit-survived');
    expect(complete).toContain('"appVersion":"9.8.7"');
    expect(complete).toContain('"buildVersion":"654"');
  });

  it('rejects a durable audit stored with an older schema', async () => {
    await AsyncStorage.setItem(LATEST_PERFORMANCE_AUDIT_STORAGE_KEY, JSON.stringify({
      schemaVersion: PERFORMANCE_AUDIT_SCHEMA_VERSION - 1,
      summaryMarker: 'old-schema-marker',
      reportJson: '{"sentinel":"old-schema-report"}',
    }));
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('current log only');

    const complete = await debugLog.readCompleteText();

    expect(complete).toBe('current log only');
    expect(complete).not.toContain('old-schema-marker');
    expect(complete).not.toContain('old-schema-report');
  });

  it('clear deletes the persistent log file', async () => {
    debugLog.info('test', 'before clear');
    await debugLog.flushToFile();
    debugLog.clear();

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      LOG_PATH,
      { idempotent: true },
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      AUDIT_SIDECAR_PATH,
      { idempotent: true },
    );
  });

  it('restores tail from log file on startup', async () => {
    const line = formatEntry({
      ts: '2026-01-01T00:00:00.000Z',
      level: 'warn',
      tag: 'store',
      message: 'from disk',
    });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(`${line}\n`);

    debugLog.clear();
    await debugLog.restoreFromStorage();
    expect(debugLog.getText()).toContain('from disk');
  });

  it('exposes Android scoped storage path hint', () => {
    expect(debugLog.getAndroidLogPathHint()).toBe(ANDROID_LOG_PATH_HINT);
    expect(ANDROID_LOG_PATH_HINT).toContain('com.eyex.australianrates');
  });
});

describe('debugLog integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setObservabilityDepsForTests({
      crashlytics: () => crashlyticsApi,
      clarity: clarityApi,
    });
    await setDiagnosticsEnabled(true);
    debugLog.clear();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    setObservabilityDepsForTests(null);
  });

  it('stores redacted lines and restores tail snapshot', async () => {
    debugLog.info('test', 'hello EXPO_TOKEN=secret');
    expect(debugLog.getText()).toContain('[REDACTED]');
    expect(debugLog.getText()).not.toContain('secret');

    debugLog.clear();
    expect(debugLog.getText()).toBe('');

    debugLog.info('test', 'persist me');
    await debugLog.flushToFile();

    await debugLog.restoreFromStorage();
    expect(debugLog.getText()).toContain('persist me');
    expect(debugLog.getEntries().filter((entry) => entry.message === 'persist me')).toHaveLength(1);
  });

  it('forwards warn/error lines to Crashlytics', () => {
    debugLog.warn('store', 'prefs rehydrate failed');
    debugLog.error('payload', 'download failed');

    expect(crashlyticsApi.log).toHaveBeenCalledWith('[WARN] store: prefs rehydrate failed');
    expect(crashlyticsApi.log).toHaveBeenCalledWith('[ERROR] payload: download failed');
    expect(crashlyticsApi.recordError).toHaveBeenCalledTimes(1);
  });

  it('redacts secrets forwarded to Crashlytics', () => {
    debugLog.warn('test', 'hello EXPO_TOKEN=secret');

    expect(crashlyticsApi.log).toHaveBeenCalledWith('[WARN] test: hello EXPO_TOKEN=[REDACTED]');
    expect(crashlyticsApi.log).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });

  it('keeps performance audit reports local even when diagnostics are enabled', () => {
    debugLog.info('perf-audit', '{"kind":"report","device":"test"}');

    expect(debugLog.getText()).toContain('"kind":"report"');
    expect(crashlyticsApi.log).not.toHaveBeenCalled();
    expect(crashlyticsApi.recordError).not.toHaveBeenCalled();
  });

  it('collapses multi-line audit failures into one parseable logfile row', () => {
    debugLog.clear();
    const stack = [
      'Error: Mounted action completion was not observed for browse.category.first',
      '    at runDeepAuditStep (PerformanceAuditRunner.tsx:552:13)',
      '    at async runAudit (PerformanceAuditRunner.tsx:1950:15)',
    ].join('\n');

    debugLog.error('perf-audit', `PERFORMANCE_AUDIT_FAILURE session=pa-test error=${stack}`);

    const lines = debugLog.getText().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[ERROR] perf-audit: PERFORMANCE_AUDIT_FAILURE');
    expect(lines[0]).toContain('Mounted action completion was not observed');
    expect(lines[0]).toContain('runDeepAuditStep');
    expect(lines[0]).toContain(String.raw`\n`);
  });

  it('installGlobalErrorHandlers forwards fatal errors to debugLog', () => {
    debugLog.clear();
    resetGlobalErrorHandlersForTests();
    const flushSpy = jest.spyOn(debugLog, 'flushToFile').mockResolvedValue(undefined);
    const g = global as typeof global & {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    };
    const previous = jest.fn();
    g.ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (handler) => {
        handler(new Error('ribbon blew up'), true);
      },
    };

    installGlobalErrorHandlers();

    expect(debugLog.getText()).toContain('[ERROR] global: fatal trace=Error: ribbon blew up');
    expect(previous).toHaveBeenCalled();
    expect(flushSpy).not.toHaveBeenCalled();
    flushSpy.mockRestore();
  });
});

describe('debug log display tail', () => {
  it('bounds only the rendered text while preserving recent complete lines', () => {
    const text = ['old line', 'middle line', 'new line'].join('\n');
    const display = formatLogDisplayTail(text, 18);

    expect(display).toContain('exports include the full log');
    expect(display).not.toContain('old line');
    expect(display).toContain('new line');
  });

  it('returns small logs unchanged', () => {
    expect(formatLogDisplayTail('small log', 32)).toBe('small log');
  });
});

describe('cold-start log session', () => {
  it('clears stale entries synchronously and preserves new bootstrap entries', async () => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('stale disk log');
    debugLog.info('old', 'previous process');

    const reset = debugLog.beginColdStartSession();
    expect(debugLog.getText()).toBe('');
    debugLog.info('app', 'bootstrap starting version=1.2.3 build=456');

    await reset;
    await debugLog.flushToFile();

    expect(debugLog.getText()).toContain('version=1.2.3 build=456');
    expect(debugLog.getText()).not.toContain('previous process');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///docs/logs/ar-local.log',
      { idempotent: true },
    );
    const writes = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
    expect(writes.at(-1)?.[1]).toContain('version=1.2.3 build=456');
  });
});
