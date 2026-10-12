const LOG = 'file:///docs/logs/ar-local.log';
const PREVIOUS = 'file:///docs/logs/ar-local-previous.log';
const SIDECAR = 'file:///docs/logs/ar-performance-audit-latest.json';

describe('previous process crash evidence', () => {
  let log: typeof import('../src/lib/debugLog').debugLog;
  let fs: typeof import('expo-file-system/legacy');
  let files: Record<string, string>;

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- recreate the cold-start singleton
    log = require('../src/lib/debugLog').debugLog;
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

  it('retains crash evidence in the original file when the native move fails', async () => {
    files[LOG] = '2026-10-12T06:30:00.000Z [ERROR] app: crash evidence\n';
    jest.mocked(fs.moveAsync).mockRejectedValueOnce(new Error('move unavailable'));
    await log.beginColdStartSession();
    log.info('app', 'new startup');
    await log.flushToFile(true);
    expect(files[LOG]).toContain('crash evidence');
    expect(files[LOG]).toContain('new startup');
    expect(files[LOG]).toContain('rotation failed');
    expect(fs.deleteAsync).not.toHaveBeenCalledWith(LOG, expect.anything());
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
