import { readFileSync } from 'fs';

import {
  isPrimaryTabRootPath,
  primaryTabLabel,
  resolveActiveTab,
  shouldShowAppTabBar,
  TAB_BAR_ORDER,
  tabHref,
} from '../src/lib/tabRouting';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

describe('tabRouting', () => {
  it('orders the four household-level destinations', () => {
    expect([...TAB_BAR_ORDER]).toEqual([
      'index',
      'browse',
      'passthrough',
      'watchlist',
    ]);
    expect(TAB_BAR_ORDER.map(primaryTabLabel)).toEqual([
      'Today',
      'Explore',
      'Changes',
      'My rates',
    ]);
  });

  it('keeps Settings and the legacy Market route out of the primary tab bar', () => {
    expect(TAB_BAR_ORDER).not.toContain('settings');
    expect(TAB_BAR_ORDER).not.toContain('trends');
    expect(TAB_BAR_ORDER).toHaveLength(4);
  });

  it('hides the bar before onboarding and on the onboarding route', () => {
    expect(shouldShowAppTabBar('/', false)).toBe(false);
    expect(shouldShowAppTabBar('/onboarding', true)).toBe(false);
    expect(shouldShowAppTabBar('/onboarding/step', true)).toBe(false);
  });

  it('keeps the bar only on primary destination roots', () => {
    expect(shouldShowAppTabBar('/', true)).toBe(true);
    expect(shouldShowAppTabBar('/browse', true)).toBe(true);
    expect(shouldShowAppTabBar('/passthrough', true)).toBe(true);
    expect(shouldShowAppTabBar('/trends', true)).toBe(true);
    expect(shouldShowAppTabBar('/watchlist', true)).toBe(true);
    expect(shouldShowAppTabBar('/(tabs)/browse', true)).toBe(true);

    for (const path of [
      '/product/abc',
      '/search',
      '/banks',
      '/bank/lender',
      '/compare',
      '/calculator',
      '/projections',
      '/rate-receipt',
      '/rba-response',
      '/settings',
      '/profile',
      '/performance-audit',
      '/debug-log',
      '/terms',
    ]) {
      expect(shouldShowAppTabBar(path, true)).toBe(false);
    }
  });

  it('merges legacy Market and Rate Moves routes under Changes ownership', () => {
    expect(resolveActiveTab('/')).toBe('index');
    expect(resolveActiveTab('/product/x')).toBe('browse');
    expect(resolveActiveTab('/search')).toBe('browse');
    expect(resolveActiveTab('/passthrough')).toBe('passthrough');
    expect(resolveActiveTab('/rba-response')).toBe('passthrough');
    expect(resolveActiveTab('/trends')).toBe('passthrough');
    expect(resolveActiveTab('/rba')).toBe('passthrough');
    expect(resolveActiveTab('/watchlist')).toBe('watchlist');
    expect(resolveActiveTab('/settings')).toBeNull();
    expect(resolveActiveTab('/debug-log')).toBeNull();
    expect(resolveActiveTab('/unknown')).toBeNull();
  });

  it('treats only canonical destination paths as reselect no-ops', () => {
    expect(isPrimaryTabRootPath('/(tabs)', 'index')).toBe(true);
    expect(isPrimaryTabRootPath('/browse/', 'browse')).toBe(true);
    expect(isPrimaryTabRootPath('/passthrough', 'passthrough')).toBe(true);
    expect(isPrimaryTabRootPath('/trends', 'passthrough')).toBe(false);
    expect(isPrimaryTabRootPath('/product/x', 'browse')).toBe(false);
  });

  it('keeps legacy and auxiliary route hrefs stable', () => {
    expect(tabHref('settings')).toBe('/(tabs)/settings');
    expect(tabHref('trends')).toBe('/(tabs)/trends');
    expect(tabHref('passthrough')).toBe('/(tabs)/passthrough');
    expect(tabHref('index')).toBe('/(tabs)');
  });
});

describe('navigation shell compatibility', () => {
  it('keeps a cold-start back destination in both router layouts', () => {
    for (const source of [read('../app/_layout.tsx'), read('../app/(tabs)/_layout.tsx')]) {
      expect(source).toMatch(/unstable_settings\s*=\s*{[\s\S]*initialRouteName:\s*'index'/);
    }
  });

  it('keeps existing public and notification destinations registered', () => {
    const root = read('../app/_layout.tsx');
    for (const route of [
      'node',
      'search',
      'product/[key]',
      'bank/[provider]',
      'rba-response',
      'rba',
    ]) {
      expect(root).toContain(`name="${route}"`);
    }

    const tabs = read('../app/(tabs)/_layout.tsx');
    expect(tabs).toMatch(/<Tabs\.Screen\s+name="passthrough"/);
    expect(tabs).toMatch(/<Tabs\.Screen\s+name="trends"/);
  });
});
