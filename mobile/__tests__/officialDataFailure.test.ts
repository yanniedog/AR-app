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
    expect(officialDataFailureReason(new TypeError('Network request failed'))).toBe('network');
    expect(officialDataFailureReason(new Error('not-allowlisted'))).toBe('blocked-by-policy');
  });
  it('keeps parse errors short', () => {
    expect(officialDataFailureReason(new Error('x'.repeat(300)))).toHaveLength('Error: '.length + 80);
  });
});
