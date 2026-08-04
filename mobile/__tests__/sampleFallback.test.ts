import { sampleFallbackIsUsable, sampleManifest } from '../src/data/sample';

describe('bundled sample safety', () => {
  it('allows the labelled sample inside its 90-day observation window', () => {
    expect(sampleFallbackIsUsable(new Date(`${sampleManifest.run_date}T00:00:00Z`))).toBe(true);
  });

  it('rejects the sample after its 90-day observation window', () => {
    const observed = Date.parse(`${sampleManifest.run_date}T00:00:00Z`);
    expect(sampleFallbackIsUsable(new Date(observed + 91 * 86400000))).toBe(false);
  });
});
