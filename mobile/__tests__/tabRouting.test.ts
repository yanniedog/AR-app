import {
  resolveActiveTab,
  shouldShowAppTabBar,
  TAB_BAR_ORDER,
  tabHref,
} from '../src/lib/tabRouting';

describe('tabRouting', () => {
  it('orders tabs Today → Products → Rate moves → Market → Saved', () => {
    expect([...TAB_BAR_ORDER]).toEqual([
      'index',
      'browse',
      'passthrough',
      'trends',
      'watchlist',
    ]);
  });

  it('keeps Settings out of the primary tab bar', () => {
    expect(TAB_BAR_ORDER).not.toContain('settings');
    expect(TAB_BAR_ORDER.length).toBeLessThanOrEqual(5);
  });

  it('hides the bar before onboarding and on the onboarding route', () => {
    expect(shouldShowAppTabBar('/', false)).toBe(false);
    expect(shouldShowAppTabBar('/onboarding', true)).toBe(false);
    expect(shouldShowAppTabBar('/onboarding/step', true)).toBe(false);
  });

  it('keeps the bar on Today and every post-onboarding stack route', () => {
    expect(shouldShowAppTabBar('/', true)).toBe(true);
    expect(shouldShowAppTabBar('/browse', true)).toBe(true);
    expect(shouldShowAppTabBar('/product/abc', true)).toBe(true);
    expect(shouldShowAppTabBar('/search', true)).toBe(true);
    expect(shouldShowAppTabBar('/banks', true)).toBe(true);
    expect(shouldShowAppTabBar('/settings', true)).toBe(true);
    expect(shouldShowAppTabBar('/performance-audit', true)).toBe(true);
    expect(shouldShowAppTabBar('/compare', true)).toBe(true);
  });

  it('resolves stack destinations back to their owning tab', () => {
    expect(resolveActiveTab('/')).toBe('index');
    expect(resolveActiveTab('/product/x')).toBe('browse');
    expect(resolveActiveTab('/search')).toBe('browse');
    expect(resolveActiveTab('/passthrough')).toBe('passthrough');
    expect(resolveActiveTab('/trends')).toBe('trends');
    expect(resolveActiveTab('/rba')).toBe('trends');
    expect(resolveActiveTab('/watchlist')).toBe('watchlist');
    expect(resolveActiveTab('/settings')).toBe('settings');
    expect(resolveActiveTab('/debug-log')).toBe('settings');
  });

  it('exposes stable tab hrefs', () => {
    expect(tabHref('settings')).toBe('/(tabs)/settings');
    expect(tabHref('index')).toBe('/(tabs)');
  });
});
