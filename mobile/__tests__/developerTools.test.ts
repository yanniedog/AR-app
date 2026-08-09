import { readFileSync } from 'fs';

import { DEFAULT_PREFS } from '../src/data/store';
import { shouldShowAppTabBar } from '../src/lib/tabRouting';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

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
    for (const source of [read('../app/performance-audit.tsx'), read('../app/debug-log.tsx')]) {
      expect(source).toContain('useDeveloperToolsEnabled');
      expect(source).toMatch(/if \(!developerTools\) return <Redirect/);
    }
  });

  it('waits for rehydration instead of bouncing an unlocked user to Settings', () => {
    // AsyncStorage loads async, so an unlocked user cold-launching a deep link
    // would lose the destination if `null` were treated as locked.
    const hook = read('../src/lib/developerTools.ts');
    expect(hook).toMatch(/if \(!hydrated\) return null;/);

    for (const source of [read('../app/performance-audit.tsx'), read('../app/debug-log.tsx')]) {
      expect(source).toMatch(/if \(developerTools == null\) return <ScreenSkeleton/);
      // The undecided check must precede the redirect.
      expect(source.indexOf('developerTools == null')).toBeLessThan(
        source.indexOf('if (!developerTools) return <Redirect'),
      );
    }
  });
});

describe('consent banner placement', () => {
  it('only reserves tab-bar space on routes that actually show the bar', () => {
    // Onboarding hides the bar, so the banner must not offset past it there.
    expect(shouldShowAppTabBar('/onboarding', false)).toBe(false);
    expect(shouldShowAppTabBar('/', false)).toBe(false);
    expect(shouldShowAppTabBar('/', true)).toBe(true);

    const layout = read('../app/_layout.tsx');
    expect(layout).toContain('aboveTabBar={tabBarVisible}');
    expect(layout).toContain('const tabBarVisible = shouldShowAppTabBar(pathname, onboarded);');
  });
});
