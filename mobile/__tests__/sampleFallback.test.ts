import {
  SAMPLE_MAX_AGE_DAYS,
  sampleFallbackIsUsable,
  sampleManifest,
} from '../src/data/sample';

describe('bundled sample safety', () => {
  it('allows the labelled sample inside its bounded observation window', () => {
    expect(sampleFallbackIsUsable(new Date(`${sampleManifest.run_date}T00:00:00Z`))).toBe(true);
  });

  it('rejects the sample after its bounded observation window', () => {
    const observed = Date.parse(`${sampleManifest.run_date}T00:00:00Z`);
    expect(sampleFallbackIsUsable(new Date(observed + (SAMPLE_MAX_AGE_DAYS + 1) * 86400000))).toBe(false);
  });
});
