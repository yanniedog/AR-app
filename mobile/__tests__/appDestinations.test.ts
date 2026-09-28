import {
  APP_DESTINATION_GROUPS, destinationSectionFromParam, destinationHref, destinationIsActive,
} from '../src/lib/appDestinations';
import { resolveActiveTab } from '../src/lib/tabRouting';

const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);

it('gives every group and destination a distinct identity and exact route', () => {
  expect(APP_DESTINATION_GROUPS.map((group) => group.id)).toEqual(['home', 'rates', 'saved', 'market', 'tools', 'app']);
  expect(new Set(destinations.map((item) => item.id)).size).toBe(destinations.length);
  expect(new Set(destinations.map((item) => item.path)).size).toBe(destinations.length);
  for (const item of destinations) {
    expect(resolveActiveTab(item.path)).not.toBeNull();
    expect(destinationIsActive(item.id, item.path)).toBe(true);
    expect(destinations.filter((entry) => destinationIsActive(entry.id, item.path))).toEqual([item]);
  }
});

it('makes the important rate, market and planning tools independently discoverable', () => {
  expect(destinations.map((item) => item.id)).toEqual(expect.arrayContaining([
    'home', 'rates', 'search', 'matches', 'banks', 'categories', 'catalogue', 'saved',
    'market', 'bank-rates', 'changes', 'bank-response', 'rba', 'research',
    'tools', 'calculator', 'projections', 'profile', 'settings', 'about',
  ]));
});

it('passes the current category to tools and resets category drills explicitly', () => {
  const find = (id: string) => destinations.find((item) => item.id === id)!;
  expect(destinationHref(find('calculator'), 'Savings')).toEqual({ pathname: '/calculator', params: { section: 'Savings' } });
  expect(destinationHref(find('projections'), 'TD')).toEqual({ pathname: '/projections', params: { section: 'TD' } });
  expect(destinationHref(find('categories'), 'Savings')).toEqual({
    pathname: '/categories', params: expect.objectContaining({ section: 'savings', request: expect.any(String) }),
  });
  expect(destinationHref(find('rates'), 'Savings')).toEqual({ pathname: '/(tabs)/browse', params: { section: undefined, path: undefined, request: undefined } });
});

it.each(['/rba', '/rba/', '/rba?source=menu', '/rba#markets', '/(tabs)/rba'])(
  'selects the exact RBA destination for %s',
  (pathname) => expect(destinationIsActive('rba', pathname)).toBe(true),
);

it.each(['/rba-response', '/research', '/about', '/browse', '/rba-other'])(
  'does not select the RBA destination for %s',
  (pathname) => expect(destinationIsActive('rba', pathname)).toBe(false),
);

it('does not mark a parent as the current page', () => {
  expect(destinationIsActive('about', '/debug-log')).toBe(false);
  expect(destinationIsActive('rates', '/product/a')).toBe(false);
  expect(destinationIsActive('market', '/passthrough')).toBe(false);
});

it('accepts section keys and slugs', () => {
  expect(destinationSectionFromParam('Savings')).toBe('Savings');
  expect(destinationSectionFromParam(['term-deposits'])).toBe('TD');
  expect(destinationSectionFromParam('not-a-section')).toBeUndefined();
});
