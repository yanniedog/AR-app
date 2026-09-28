import { buildBreadcrumbs, shouldShowBreadcrumbs } from '../src/lib/breadcrumbs';
import type { RateRow } from '../src/types';

const build = (pathname: string) => buildBreadcrumbs({ pathname, section: 'Mortgage' });

it('exposes every taxonomy ancestor with its exact jump destination', () => {
  const crumbs = buildBreadcrumbs({
    pathname: '/categories', section: 'Mortgage', path: ['OO', 'PI', 'VARIABLE'],
  });
  expect(crumbs.map((crumb) => crumb.label)).toEqual([
    'Rates', 'Home loans', 'Owner-occupied', 'Principal & interest', 'Variable rate',
  ]);
  expect(crumbs[1].target).toEqual({ section: 'Mortgage', path: [] });
  expect(crumbs[2].target).toEqual({ section: 'Mortgage', path: ['OO'] });
  expect(crumbs.at(-1)?.target).toBeUndefined();
});

it('keeps search scope and its ancestors on direct links', () => {
  const crumbs = buildBreadcrumbs({ pathname: '/search', section: 'TD', path: ['12M', 'AT_MATURITY'] });
  expect(crumbs.map((crumb) => crumb.label)).toEqual(['Rates', 'Term deposits', '1 year', 'Paid at maturity', 'Search']);
  expect(crumbs.at(-2)?.target).toEqual({ section: 'TD', path: ['12M', 'AT_MATURITY'] });
});

it.each([
  ['/debug-log', ['Tools', 'About and help', 'Debug log'], '/(tabs)/tools'],
  ['/third-party-notices', ['Tools', 'About and help', 'Open-source notices'], '/(tabs)/tools'],
  ['/rba-response', ['Market', 'Bank response'], '/(tabs)/market'],
  ['/bank-rates', ['Market', 'Bank rates over time'], '/(tabs)/market'],
  ['/matches', ['Rates', 'Matched rates'], { pathname: '/(tabs)/browse', params: { section: undefined, path: undefined, request: undefined } }],
])('gives %s a working parent even without navigation history', (pathname, labels, href) => {
  const crumbs = build(pathname);
  expect(crumbs.map((crumb) => crumb.label)).toEqual(labels);
  expect(crumbs[0].target).toEqual({ href });
});

it('returns to Tools and preserves the scenario category when opening its parent', () => {
  const crumbs = buildBreadcrumbs({ pathname: '/projections', section: 'Savings' });
  expect(crumbs[0].target).toEqual({ href: '/(tabs)/tools' });
  expect(crumbs[1].target).toEqual({ href: { pathname: '/calculator', params: { section: 'Savings' } } });
});

it('preserves exact product keys and rate tiers when jumping back from a receipt', () => {
  const row = {
    product_key: 'bank/a%,b', product_name: 'Variable home loan',
    taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE',
  } as RateRow;
  const crumbs = buildBreadcrumbs({ pathname: '/rate-receipt', section: 'Savings', product: { row, section: 'Mortgage' }, rateIndex: '7' });
  expect(crumbs.map((crumb) => crumb.label)).toEqual([
    'Rates', 'Home loans', 'Owner-occupied', 'Principal & interest', 'Variable rate', 'Variable home loan', 'Bank-call brief',
  ]);
  expect(crumbs.at(-2)?.target).toEqual({ href: { pathname: '/product/[key]', params: { key: 'bank/a%,b', ri: '7' } } });
});

it('uses a neutral label when product evidence is unavailable', () => {
  expect(build('/product/secret-key').map((crumb) => crumb.label)).toEqual(['Rates', 'Product']);
});

it('keeps the bar available on focused routes while respecting onboarding', () => {
  for (const path of ['/categories', '/compare', '/product/a', '/settings', '/debug-log', '/unknown']) {
    expect(shouldShowBreadcrumbs(path, true)).toBe(true);
    expect(shouldShowBreadcrumbs(path, false)).toBe(false);
  }
  expect(shouldShowBreadcrumbs('/onboarding', true)).toBe(false);
});


it('keeps primary hubs free of duplicate breadcrumbs', () => {
  for (const path of ['/', '/browse', '/watchlist', '/market', '/tools', '/(tabs)/market/']) {
    expect(shouldShowBreadcrumbs(path, true)).toBe(false);
  }
  expect(shouldShowBreadcrumbs('/onboarding/step', true)).toBe(false);
});
