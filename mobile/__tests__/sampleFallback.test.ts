import {
  SAMPLE_MAX_AGE_DAYS,
  sampleFallbackIsUsable,
  sampleManifestIsUsable,
  sampleManifest,
} from '../src/data/sample';

describe('bundled sample safety', () => {
  it('allows the labelled sample inside its bounded observation window', () => {
    expect(sampleFallbackIsUsable(new Date(sampleManifest.generated_at))).toBe(true);
  });

  it('rejects the sample after its bounded observation window', () => {
    const observed = Date.parse(sampleManifest.generated_at);
    expect(sampleFallbackIsUsable(new Date(observed + (SAMPLE_MAX_AGE_DAYS + 1) * 86400000))).toBe(false);
  });

  it('rejects a sample dated after the device clock', () => {
    const observed = Date.parse(sampleManifest.generated_at);
    expect(sampleFallbackIsUsable(new Date(observed - 1))).toBe(false);
  });

  it('checks a cached sample against its own generation time', () => {
    const now = new Date(sampleManifest.generated_at);
    expect(sampleManifestIsUsable({
      run_date: '2025-01-01',
      generated_at: '2025-01-01T00:00:00Z',
    }, now)).toBe(false);
    expect(sampleManifestIsUsable(sampleManifest, now)).toBe(true);
  });
});
