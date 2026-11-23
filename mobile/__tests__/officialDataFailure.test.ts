import { officialDataFailureReason } from '../src/data/officialDataFailure';

describe('officialDataFailureReason', () => {
  it('reports the HTTP status', () => {
    expect(officialDataFailureReason(new Error('Official RBA data request failed (403)'))).toBe('http-403');
  });
  it('reports timeouts', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(officialDataFailureReason(abort)).toBe('timeout');
  });
  it('reports network and policy failures', () => {
    expect(officialDataFailureReason(new TypeError('Network request failed'))).toBe('network (Network request failed)');
    expect(officialDataFailureReason(new Error('not-allowlisted'))).toBe('blocked-by-policy');
  });
  it('keeps 160 characters of a TLS failure so the root cause survives', () => {
    const message = `fetch failed: javax.net.ssl.SSLHandshakeException: java.security.cert.CertPathValidatorException: Trust anchor for certification path not found. ${'x'.repeat(200)}`;
    const reason = officialDataFailureReason(new TypeError(message));
    expect(reason).toBe(`network (${message.slice(0, 160)})`);
    expect(reason).toContain('Trust anchor for certification path not found');
    expect(reason.length).toBe('network ()'.length + 160);
  });
  it('treats a TLS error name as a network failure even when the message has no TLS words', () => {
    const error = new Error(`handshake rejected ${'y'.repeat(200)}`);
    error.name = 'SSLHandshakeException';
    expect(officialDataFailureReason(error)).toBe(`network (${error.message.slice(0, 160)})`);
  });
  it('keeps parse errors short', () => {
    expect(officialDataFailureReason(new Error('x'.repeat(300)))).toHaveLength('Error: '.length + 80);
  });
});

describe('parseOfficialData', () => {
  const { parseOfficialData, resetOfficialDataFailureReportsForTests } = require('../src/data/officialDataFailure');
  const { debugLog } = require('../src/lib/debugLog');
  beforeEach(() => { resetOfficialDataFailureReportsForTests(); jest.restoreAllMocks(); });

  it('returns the parsed value without logging', () => {
    const warn = jest.spyOn(debugLog, 'warn').mockImplementation(() => undefined);
    expect(parseOfficialData('https://www.rba.gov.au/statistics/tables/csv/g1-data.csv', () => 42)).toBe(42);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the source and stage of a parse failure and rethrows', () => {
    const warn = jest.spyOn(debugLog, 'warn').mockImplementation(() => undefined);
    expect(() => parseOfficialData('https://www.rba.gov.au/statistics/tables/csv/g1-data.csv', () => { throw new Error('Missing series'); }))
      .toThrow('Missing series');
    expect(warn).toHaveBeenCalledWith('official-data', expect.stringContaining('stage=parse source=www.rba.gov.au/statistics/tables/csv/g1-data.csv'));
  });

  it('stays quiet when the request began inside a local audit', () => {
    const warn = jest.spyOn(debugLog, 'warn').mockImplementation(() => undefined);
    expect(() => parseOfficialData('https://www.rba.gov.au/x.csv', () => { throw new Error('x'); }, true)).toThrow('x');
    expect(warn).not.toHaveBeenCalled();
  });
});
