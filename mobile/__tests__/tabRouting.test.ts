import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  isPrimaryTabRootPath, primaryTabLabel, resolveActiveTab,
  shouldShowAppTabBar, TAB_BAR_ORDER, tabHref,
} from '../src/lib/tabRouting';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

it('provides three distinct, plainly named destinations', () => {
  expect([...TAB_BAR_ORDER]).toEqual(['browse', 'watchlist', 'market']);
  expect(TAB_BAR_ORDER.map(primaryTabLabel)).toEqual(['Rates', 'Saved', 'Market']);
});

it.each(['/', '/onboarding', '/onboarding/step', '/product/a'])(
  'withholds section navigation before preference hydration on %s',
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
  ['/', 'browse'], ['/product/x', 'browse'], ['/search', 'browse'],
  ['/categories', 'browse'], ['/matches', 'browse'], ['/catalogue', 'browse'],
  ['/banks', 'browse'], ['/bank/a', 'browse'], ['/rate-receipt', 'browse'],
  ['/watchlist', 'watchlist'], ['/market', 'market'], ['/passthrough', 'market'],
  ['/rba-response', 'market'], ['/trends', 'market'], ['/rba', 'market'],
  ['/bank-rates', 'market'], ['/research', 'market'], ['/tools', 'browse'],
  ['/calculator', 'browse'], ['/projections', 'browse'], ['/calculation-receipt', 'browse'],
  ['/profile', 'browse'], ['/settings', 'browse'], ['/debug-log', 'browse'],
  ['/third-party-notices', 'browse'], ['/about', 'browse'],
])('assigns %s to its stable section %s', (path, owner) => {
  expect(resolveActiveTab(path)).toBe(owner);
  expect(resolveActiveTab(`${path}?source=menu`)).toBe(owner);
});

it.each(['/unknown', '/constructor', '/__proto__', '/banking', '/rba-other'])(
  'does not infer ownership from an unrelated route %s',
  (path) => expect(resolveActiveTab(path)).toBeNull(),
);

it('makes only exact section roots tab reselect no-ops', () => {
  expect(isPrimaryTabRootPath('/(tabs)', 'browse')).toBe(true);
  expect(isPrimaryTabRootPath('/browse/', 'browse')).toBe(true);
  expect(isPrimaryTabRootPath('/(tabs)/market', 'market')).toBe(true);
  expect(isPrimaryTabRootPath('/tools?from=menu', 'browse')).toBe(false);
  expect(isPrimaryTabRootPath('/passthrough', 'market')).toBe(false);
  expect(isPrimaryTabRootPath('/product/x', 'browse')).toBe(false);
});

it('tab navigation retains the existing results task instead of clearing scope', () => {
  expect(tabHref('browse')).toBe('/(tabs)/browse');
  expect(tabHref('market')).toBe('/(tabs)/market');
  expect(tabHref('watchlist')).toBe('/(tabs)/watchlist');
});

it('retains native Back history on cold-start links and explicitly registers moved pages', () => {
  const root = read('../app/_layout.tsx');
  const tabs = read('../app/(tabs)/_layout.tsx');
  expect(root).toMatch(/initialRouteName:\s*'\(tabs\)'/);
  expect(tabs).toMatch(/initialRouteName:\s*'browse'/);
  expect(tabs).toContain('name="index" options={{ href: null');
  expect(tabs).toContain('name="tools" options={{ href: null');
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
