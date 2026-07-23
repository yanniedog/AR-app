// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  compareVersions,
  nextReleaseVersion,
  nextVersionCode,
} = require('../scripts/android-release-version-pure.cjs');

describe('Android APK release iteration', () => {
  it('advances the patch after the latest published APK', () => {
    expect(nextReleaseVersion('1.0.43', '1.0.43')).toBe('1.0.44');
    expect(nextReleaseVersion('1.0.43', '1.0.44')).toBe('1.0.45');
  });

  it('uses an intentional higher checked-in version as the next release', () => {
    expect(nextReleaseVersion('1.1.0', '1.0.44')).toBe('1.1.0');
    expect(nextReleaseVersion('2.0.0', '1.99.99')).toBe('2.0.0');
  });

  it('keeps the checked-in version when there is no previous release', () => {
    expect(nextReleaseVersion('1.0.43', null)).toBe('1.0.43');
  });

  it('rejects versions that cannot produce an unambiguous release tag', () => {
    expect(() => nextReleaseVersion('1.0', '1.0.43')).toThrow('x.y.z');
    expect(() => nextReleaseVersion('1.0.43', 'release-44')).toThrow('x.y.z');
  });

  it('compares numeric semantic versions', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.43', '1.0.43')).toBe(0);
    expect(compareVersions('1.0.42', '1.0.43')).toBe(-1);
  });

  it('increments versionCode above the release and workflow floors', () => {
    expect(nextVersionCode(142, 156, 25)).toBe(157);
    expect(nextVersionCode(200, 156, 25)).toBe(200);
    expect(nextVersionCode(142, null, 300)).toBe(300);
  });
});
