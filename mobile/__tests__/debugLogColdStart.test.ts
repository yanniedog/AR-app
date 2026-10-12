const LOG = 'file:///docs/logs/ar-local.log';
const PREVIOUS = 'file:///docs/logs/ar-local-previous.log';
const SIDECAR = 'file:///docs/logs/ar-performance-audit-latest.json';

describe('previous process crash evidence', () => {
  let log: typeof import('../src/lib/debugLog').debugLog;
  let fs: typeof import('expo-file-system/legacy');
  let files: Record<string, string>;
  let diagnostics: typeof import('../src/lib/debugLog').getDebugLogFlushDiagnostics;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- simulate a new JS process
    fs = require('expo-file-system/legacy');
    files = {};
    jest.mocked(fs.getInfoAsync).mockImplementation(async path => path in files
      ? { exists: true, uri: path, isDirectory: false, modificationTime: 0, size: new TextEncoder().encode(files[path]).length }
      : { exists: false, uri: path, isDirectory: false });
    jest.mocked(fs.readAsStringAsync).mockImplementation(async path => {
      if (!(path in files)) throw new Error('missing');
      return files[path];
    });
    jest.mocked(fs.writeAsStringAsync).mockImplementation(async (path, body) => { files[path] = body; });
    jest.mocked(fs.deleteAsync).mockImplementation(async path => { delete files[path]; });
    jest.mocked(fs.moveAsync).mockImplementation(async ({ from, to }) => {
      files[to] = files[from];
      delete files[from];
    });
    jest.mocked(fs.copyAsync).mockImplementation(async ({ from, to }) => { files[to] = files[from]; });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- recreate the cold-start singleton
    ({ debugLog: log, getDebugLogFlushDiagnostics: diagnostics } = require('../src/lib/debugLog'));
  });

  afterEach(async () => { await log.clear(); });

  it('rotates the last durable audit checkpoint before startup writes and exports both sessions', async () => {
    const interrupted = '2026-10-12T06:30:00.000Z [INFO ] perf-audit: {"kind":"check","sessionId":"interrupted-228"}\n';
    files[LOG] = interrupted;
    files[PREVIOUS] = 'older session to replace';
    files[SIDECAR] = JSON.stringify({
      schemaVersion: 7,
      summaryMarker: 'PERFORMANCE_AUDIT_SUMMARY app_version=1.0.225',
      reportJson: '{"app":{"appVersion":"1.0.225"}}',
    });

    const coldStart = log.beginColdStartSession();
    expect(log.getText()).toBe('');
    log.info('app', 'bootstrap starting version=1.0.228 build=289');
    await Promise.all([coldStart, log.flushToFile(true)]);

    expect(files[PREVIOUS]).toBe(interrupted);
    expect(files[LOG]).toContain('bootstrap starting version=1.0.228');
    expect(files[LOG]).not.toContain('interrupted-228');
    expect(fs.readAsStringAsync).not.toHaveBeenCalledWith(PREVIOUS);
    // Calling startup twice in one process must not rotate the new file again.
    await log.beginColdStartSession();
    expect(fs.moveAsync).toHaveBeenCalledTimes(1);
    const exported = await log.readCompleteText();
    expect(exported).toContain('# Previous app session (retained before restart)');
    expect(exported).toContain(interrupted);
    expect(exported).toContain('# Current app session');
    expect(exported).toContain('bootstrap starting version=1.0.228');
    expect(exported).toContain('# Latest saved performance audit (may be from an earlier app session)');
    expect(exported).toContain('app_version=1.0.225');
    expect(exported).not.toContain('older session to replace');
  });

  it('copies a near-budget crash log natively after rename fails and keeps new rollover writes separate', async () => {
    const interrupted = `2026-10-12T06:30:00.000Z [ERROR] app: crash evidence ${'x'.repeat(2 * 1024 * 1024 - 128)}\n`;
    files[LOG] = interrupted;
    jest.mocked(fs.moveAsync).mockRejectedValue(new Error('move unavailable'));
    await log.beginColdStartSession();
    expect(fs.copyAsync).toHaveBeenCalledWith({ from: LOG, to: PREVIOUS });
    expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    for (let index = 0; index < 40; index += 1) {
      log.info('app', `new checkpoint ${index} ${'n'.repeat(64 * 1024)}`);
      await log.flushToFile(true);
    }
    expect(files[PREVIOUS]).toBe(interrupted);
    expect(new TextEncoder().encode(files[LOG]).length).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(files[LOG]).toContain('new checkpoint 39');
    expect(files[LOG]).not.toContain('crash evidence');
    const exported = await log.readCompleteText();
    expect(exported.split('# Current app session')[0]).toContain(interrupted);
    expect(exported.split('# Current app session')[1]).not.toContain('crash evidence');
  });

  it('bounds failed-rotation queues, preserves the original, and resumes durable logging after recovery', async () => {
    const interrupted = `2026-10-12T06:30:00.000Z [ERROR] app: crash evidence ${'x'.repeat(2 * 1024 * 1024 - 128)}\n`;
    files[LOG] = interrupted;
    jest.mocked(fs.moveAsync).mockRejectedValue(new Error('move unavailable'));
    jest.mocked(fs.copyAsync).mockRejectedValue(new Error('copy unavailable'));
    await log.beginColdStartSession();
    for (let index = 0; index < 80; index += 1) {
      log.info('app', `pending checkpoint ${index} ${'n'.repeat(64 * 1024)}`);
    }
    await expect(log.flushToFile(true)).rejects.toThrow('copy unavailable');
    expect(diagnostics().queuedBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(diagnostics().droppedPendingLines).toBeGreaterThan(0);
    expect(files[LOG]).toBe(interrupted);
    expect(fs.deleteAsync).not.toHaveBeenCalledWith(LOG, expect.anything());
    const incomplete = await log.readCompleteText();
    expect(incomplete).toContain(interrupted);
    expect(incomplete).toContain('# Current app session (memory only; log rotation is pending)');
    expect(incomplete).toContain('INCOMPLETE EXPORT');
    expect(incomplete).toContain('pending checkpoint 79');
    jest.mocked(fs.copyAsync).mockImplementation(async ({ from, to }) => { files[to] = files[from]; });
    jest.mocked(fs.copyAsync).mockClear();
    await expect(Promise.all([log.flushToFile(true), log.flushToFile(true)])).resolves.toEqual([undefined, undefined]);
    expect(fs.copyAsync).toHaveBeenCalledTimes(1);
    expect(files[PREVIOUS]).toBe(interrupted);
    expect(files[LOG]).not.toContain('crash evidence');
    expect(files[LOG]).toContain('pending checkpoint 79');
    expect(files[LOG]).toContain('INCOMPLETE LOG');
    expect(diagnostics().queuedBytes).toBe(0);
  });

  it('does not treat an empty queue or reserved report write as durable while rotation is unavailable', async () => {
    files[LOG] = 'previous crash evidence';
    jest.mocked(fs.moveAsync).mockRejectedValue(new Error('move unavailable'));
    jest.mocked(fs.copyAsync).mockRejectedValue(new Error('copy unavailable'));
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => {});
    await log.beginColdStartSession();
    warning.mockRestore();
    expect(diagnostics().queuedLines).toBe(0);
    await expect(log.flushToFile(true)).rejects.toThrow('copy unavailable');
    await expect(log.storePerformanceAudit('test-report', { checks: [] })).rejects.toThrow('copy unavailable');
    expect(files[LOG]).toBe('previous crash evidence');
  });

  it('labels memory-only current entries when the protected original is empty', async () => {
    files[LOG] = '';
    jest.mocked(fs.moveAsync).mockRejectedValue(new Error('move unavailable'));
    jest.mocked(fs.copyAsync).mockRejectedValue(new Error('copy unavailable'));
    await log.beginColdStartSession();
    log.info('app', 'memory-only startup');
    const exported = await log.readCompleteText();
    expect(exported).toContain('# Current app session (memory only; log rotation is pending)');
    expect(exported).toContain('INCOMPLETE EXPORT');
    expect(exported).toContain('memory-only startup');
    expect(files[LOG]).toBe('');
  });

  it.each(['missing', 'truncated', 'unknown-size'])(
    'does not remove the original when the native fallback copy is %s', async mode => {
      files[LOG] = 'complete original crash evidence';
      jest.mocked(fs.moveAsync).mockRejectedValue(new Error('move unavailable'));
      jest.mocked(fs.copyAsync).mockImplementation(async ({ to }) => {
        if (mode !== 'missing') files[to] = mode === 'truncated' ? 'partial' : files[LOG];
      });
      if (mode === 'unknown-size') {
        const realInfo = jest.mocked(fs.getInfoAsync).getMockImplementation()!;
        jest.mocked(fs.getInfoAsync).mockImplementation(async path => {
          const info = await realInfo(path);
          return path === PREVIOUS && info.exists ? { ...info, size: Number.NaN } : info;
        });
      }
      await log.beginColdStartSession();
      await expect(log.flushToFile(true)).rejects.toThrow('copy could not be verified');
      expect(files[LOG]).toBe('complete original crash evidence');
      expect(fs.deleteAsync).not.toHaveBeenCalledWith(LOG, expect.anything());
      const exported = await log.readCompleteText();
      expect(exported).toContain('complete original crash evidence');
      expect(exported).not.toContain('partial');
    },
  );

  it.each(['read-failed', 'stat-failed'])(
    'reports an incomplete export when the retained archive is %s', async mode => {
      files[PREVIOUS] = 'retained crash evidence';
      await log.beginColdStartSession();
      const realRead = jest.mocked(fs.readAsStringAsync).getMockImplementation()!;
      jest.mocked(fs.readAsStringAsync).mockImplementation(async path => {
        if (path === PREVIOUS) throw new Error('archive unavailable');
        return realRead(path);
      });
      if (mode === 'stat-failed') {
        const realInfo = jest.mocked(fs.getInfoAsync).getMockImplementation()!;
        jest.mocked(fs.getInfoAsync).mockImplementation(async path => {
          if (path === PREVIOUS) throw new Error('archive stat unavailable');
          return realInfo(path);
        });
      }
      const exported = await log.readCompleteText();
      expect(exported).toContain('INCOMPLETE EXPORT: The previous app session could not be read');
      expect(files[PREVIOUS]).toBe('retained crash evidence');
      // Cleanup needs the normal stat implementation after the failure probe.
      jest.mocked(fs.getInfoAsync).mockImplementation(async path => path in files
        ? { exists: true, uri: path, isDirectory: false, modificationTime: 0, size: files[path].length }
        : { exists: false, uri: path, isDirectory: false });
    },
  );

  it('does not flag a normally absent previous file as incomplete', async () => {
    await log.beginColdStartSession();
    expect(await log.readCompleteText()).not.toContain('INCOMPLETE EXPORT');
  });

  it('keeps the retained session when there is no current file to rotate and redacts its export', async () => {
    files[PREVIOUS] = '2026-10-12T06:30:00.000Z [ERROR] app: token=old-secret\n';
    await log.beginColdStartSession();
    expect(fs.moveAsync).not.toHaveBeenCalled();
    const exported = await log.readCompleteText();
    expect(exported).toContain('[REDACTED]');
    expect(exported).not.toContain('old-secret');
  });

  it('explicit Clear removes and verifies both sessions and the saved report', async () => {
    files[LOG] = 'current';
    files[PREVIOUS] = 'previous';
    files[SIDECAR] = 'saved report';
    await log.clear();
    expect(files).toEqual({});
    expect(fs.getInfoAsync).toHaveBeenCalledWith(PREVIOUS);
    expect(await log.readCompleteText()).not.toContain('previous');
  });
});
