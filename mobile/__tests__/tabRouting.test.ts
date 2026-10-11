import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  isPrimaryTabRootPath, primaryTabLabel, resolveActiveTab,
  shouldShowAppTabBar, TAB_BAR_ORDER, tabHref,
} from '../src/lib/tabRouting';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

it('provides five distinct, plainly named destinations', () => {
  expect([...TAB_BAR_ORDER]).toEqual(['index', 'browse', 'watchlist', 'market', 'tools']);
  expect(TAB_BAR_ORDER.map(primaryTabLabel)).toEqual(['Home', 'Rates', 'Saved', 'Market', 'Tools']);
});

it.each(['/', '/onboarding', '/onboarding/step', '/product/a'])(
  'withholds section navigation before onboarding on %s',
  (path) => expect(shouldShowAppTabBar(path, false)).toBe(false),
);

it.each(['/onboarding', '/onboarding/step', '/compare', '/compare?keys=a'])(
  'keeps the focused %s flow free of primary navigation',
  (path) => expect(shouldShowAppTabBar(path, true)).toBe(false),
);

it.each([
  '/', '/browse', '/market', '/tools', '/watchlist', '/(tabs)/browse',
  '/product/abc', '/search', '/categories', '/matches', '/catalogue', '/banks',
  '/bank/lender', '/calculator', '/projections', '/rate-receipt', '/calculation-receipt',
  '/rba-response', '/rba', '/research', '/passthrough', '/bank-rates', '/trends',
  '/settings', '/profile', '/performance-audit', '/debug-log', '/terms', '/unknown',
])('preserves an escape to every section while visiting %s', (path) => {
  expect(shouldShowAppTabBar(path, true)).toBe(true);
});

it.each([
  ['/', 'index'], ['/product/x', 'browse'], ['/search', 'browse'],
  ['/categories', 'browse'], ['/matches', 'browse'], ['/catalogue', 'browse'],
  ['/banks', 'browse'], ['/bank/a', 'browse'], ['/rate-receipt', 'browse'],
  ['/watchlist', 'watchlist'], ['/market', 'market'], ['/passthrough', 'market'],
  ['/rba-response', 'market'], ['/trends', 'market'], ['/rba', 'market'],
  ['/bank-rates', 'market'], ['/research', 'market'], ['/tools', 'tools'],
  ['/calculator', 'tools'], ['/projections', 'tools'], ['/calculation-receipt', 'tools'],
  ['/profile', 'tools'], ['/settings', 'tools'], ['/debug-log', 'tools'],
  ['/third-party-notices', 'tools'], ['/about', 'tools'],
])('assigns %s to its stable section %s', (path, owner) => {
  expect(resolveActiveTab(path)).toBe(owner);
  expect(resolveActiveTab(`${path}?source=menu`)).toBe(owner);
});

it.each(['/unknown', '/constructor', '/__proto__', '/banking', '/rba-other'])(
  'does not infer ownership from an unrelated route %s',
  (path) => expect(resolveActiveTab(path)).toBeNull(),
);

it('makes only exact section roots tab reselect no-ops', () => {
  expect(isPrimaryTabRootPath('/(tabs)', 'index')).toBe(true);
  expect(isPrimaryTabRootPath('/browse/', 'browse')).toBe(true);
  expect(isPrimaryTabRootPath('/(tabs)/market', 'market')).toBe(true);
  expect(isPrimaryTabRootPath('/tools?from=menu', 'tools')).toBe(true);
  expect(isPrimaryTabRootPath('/passthrough', 'market')).toBe(false);
  expect(isPrimaryTabRootPath('/product/x', 'browse')).toBe(false);
});

it('clears compatibility category parameters when returning to the Rates hub', () => {
  expect(tabHref('browse')).toEqual({
    pathname: '/(tabs)/browse', params: { section: undefined, path: undefined, request: undefined },
  });
  expect(tabHref('index')).toBe('/(tabs)');
  expect(tabHref('market')).toBe('/(tabs)/market');
  expect(tabHref('tools')).toBe('/(tabs)/tools');
});

it('retains native Back history on cold-start links and explicitly registers moved pages', () => {
  const root = read('../app/_layout.tsx');
  const tabs = read('../app/(tabs)/_layout.tsx');
  for (const source of [root, tabs]) {
    expect(source).toMatch(/unstable_settings\s*=\s*{[\s\S]*initialRouteName:\s*'index'/);
  }
  for (const route of [
    'node', 'categories', 'matches', 'catalogue', 'bank-rates', 'passthrough',
    'search', 'product/[key]', 'bank/[provider]', 'rba-response', 'rba', 'research',
    'calculation-receipt',
  ]) expect(root).toContain(`name="${route}"`);
  expect(tabs).toContain('TAB_BAR_ORDER.map');
  expect(tabs).not.toMatch(/<Tabs\.Screen\s+name="passthrough"/);
});

it('retains unambiguous Settings and both legacy Market redirects', () => {
  expect(read('../app/_layout.tsx')).toContain('<Stack.Screen name="settings"');
  expect(existsSync(resolve(__dirname, '../app/(tabs)/settings.tsx'))).toBe(false);
  expect(read('../app/(tabs)/trends.tsx')).toContain("from '../trends'");
  expect(read('../app/trends.tsx')).toContain("focus === 'rba'");
});
