import {
  APP_DESTINATION_GROUPS,
  destinationSectionFromParam,
  destinationHref,
  destinationIsActive,
} from '../src/lib/appDestinations';

describe('app destination registry', () => {
  it('includes RBA rates alongside account and app destinations', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(new Set(destinations.map((destination) => destination.id)).size).toBe(destinations.length);
    expect(destinations.map((destination) => destination.id)).toEqual([
      'rba',
      'profile',
      'settings',
      'about',
    ]);
  });

  it('builds stable menu destinations', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(destinationHref(destinations[0], 'Savings')).toBe('/rba');
    expect(destinations[0]).toMatchObject({ label: 'RBA rates', icon: 'bank' });
    expect(destinationHref(destinations[1], 'Savings')).toBe('/profile');
    expect(destinationHref(destinations[2], 'Savings')).toBe('/settings');
    expect(destinationHref(destinations[3], 'Savings')).toBe('/about');
  });

  it.each(['/rba', '/rba/', '/rba?source=menu', '/rba#markets', '/(tabs)/rba'])(
    'selects RBA rates for %s',
    (pathname) => expect(destinationIsActive('rba', pathname)).toBe(true),
  );

  it.each(['/rba-response', '/research', '/about', '/browse', '/rba-other'])(
    'does not select RBA rates for unrelated route %s',
    (pathname) => expect(destinationIsActive('rba', pathname)).toBe(false),
  );

  it('maps focused routes back to their menu destination', () => {
    expect(destinationIsActive('profile', '/profile')).toBe(true);
    expect(destinationIsActive('settings', '/settings')).toBe(true);
    expect(destinationIsActive('about', '/about')).toBe(true);
    expect(destinationIsActive('about', '/debug-log')).toBe(true);
    expect(destinationIsActive('profile', '/browse')).toBe(false);
  });

  it('resolves visible category route parameters in key and slug form', () => {
    expect(destinationSectionFromParam('Savings')).toBe('Savings');
    expect(destinationSectionFromParam(['term-deposits'])).toBe('TD');
    expect(destinationSectionFromParam('not-a-section')).toBeUndefined();
  });
});
