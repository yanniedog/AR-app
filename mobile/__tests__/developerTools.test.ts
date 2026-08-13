import { readFileSync } from 'fs';

import { shouldShowAppTabBar } from '../src/lib/tabRouting';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

describe('quiet diagnostics access', () => {
  it('keeps troubleshooting tools collapsed under About', () => {
    const about = read('../app/about.tsx');
    expect(about).toContain('title="Diagnostics"');
    expect(about).toContain('defaultOpen={false}');
    expect(about).toContain("router.push('/performance-audit')");
    expect(about).toContain("router.push('/debug-log')");
  });

  it('removes the hidden gesture, duplicate links and direct-route gate', () => {
    const settings = read('../app/(tabs)/settings.tsx');
    expect(settings).not.toContain('versionTaps');
    expect(settings).not.toContain("router.push('/performance-audit'");
    expect(settings).not.toContain("router.push('/debug-log'");

    for (const source of [read('../app/performance-audit.tsx'), read('../app/debug-log.tsx')]) {
      expect(source).not.toContain('useDeveloperToolsEnabled');
      expect(source).not.toMatch(/return <Redirect/);
    }
  });
});

describe('consent banner placement', () => {
  it('only reserves tab-bar space on routes that actually show the bar', () => {
    expect(shouldShowAppTabBar('/onboarding', false)).toBe(false);
    expect(shouldShowAppTabBar('/', false)).toBe(false);
    expect(shouldShowAppTabBar('/', true)).toBe(true);

    const layout = read('../app/_layout.tsx');
    expect(layout).toContain('aboveTabBar={tabBarVisible}');
    expect(layout).toContain('const tabBarVisible = shouldShowAppTabBar(pathname, onboarded);');
  });
});
