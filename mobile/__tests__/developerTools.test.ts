import { DEFAULT_PREFS } from '../src/data/store';

/**
 * The performance audit and debug log are maintainer tools. They must not be
 * reachable by an ordinary user, including by direct navigation, until the
 * Settings version row has been tapped seven times.
 */
describe('developer tools gate', () => {
  it('stays locked by default', () => {
    expect(DEFAULT_PREFS.developerToolsUnlocked).toBe(false);
  });

  it('guards both maintainer routes, not just the Settings entries', () => {
    const performanceAudit = require('fs').readFileSync(
      require.resolve('../app/performance-audit.tsx'),
      'utf8',
    ) as string;
    const debugLog = require('fs').readFileSync(
      require.resolve('../app/debug-log.tsx'),
      'utf8',
    ) as string;

    for (const source of [performanceAudit, debugLog]) {
      expect(source).toContain('useDeveloperToolsEnabled');
      expect(source).toMatch(/if \(!developerTools\) return <Redirect/);
    }
  });
});
